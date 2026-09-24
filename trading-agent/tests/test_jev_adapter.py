"""JevEngine adapter against the documented typesafe_sdk surface (docs.typesafe.ai, 2026-09-24).

The fake SDK below mirrors the documented classes: Choice(criteria=Mapping),
Score(criteria=ordered list, 0-based), Noul(instructions), and SystemOneResponse.answers
holding ChoiceAnswer / ScoreAnswer / NoulAnswer objects.
"""

from dataclasses import dataclass, field
from types import SimpleNamespace

import pytest

from tests.helpers import schema, snap
from trader.decision import InvalidDecision
from trader.jev_client import JevEngine, decide_batch


@dataclass
class Q:
    type: str
    instructions: object = None
    criteria: object = None


def _choice(instructions=None, criteria=None):
    assert isinstance(criteria, dict) and criteria, "Choice criteria must be a non-empty mapping"
    return Q("choice", instructions, criteria)


def _score(instructions=None, criteria=None):
    assert isinstance(criteria, list) and criteria, "Score criteria must be a non-empty ordered list"
    return Q("score", instructions, criteria)


def _noul(instructions=None, criteria=None):
    return Q("noul", instructions, criteria)


@dataclass
class FakeClient:
    response: object = None
    calls: list = field(default_factory=list)
    closed: bool = False

    def system_one(self, state, questions):
        self.calls.append((state, questions))
        return self.response

    def close(self):
        self.closed = True


def choice_ans(choice, conf, **p):
    return SimpleNamespace(type="choice", choice=choice, confidence=conf, probabilities=p)


def response(direction="long", dconf=0.9, score=2.4, noul=0.1, regime="trending", risk="safe"):
    return SimpleNamespace(
        model="jev",
        answers={
            "regime": choice_ans(regime, 0.85),
            "direction": choice_ans(direction, dconf),
            "toxic_flow": SimpleNamespace(type="noul", noul=noul),
            "setup_quality": SimpleNamespace(type="score", score=score, confidence=0.7,
                                             probabilities={0: .1, 1: .1, 2: .3, 3: .5}),
            "risk_state": choice_ans(risk, 0.9),
        },
    )


FAKE_SDK = SimpleNamespace(Choice=_choice, Score=_score, Noul=_noul)


def engine(resp):
    return JevEngine(sdk=FAKE_SDK, client=FakeClient(resp))


def test_questions_match_documented_constructor_shapes():
    e = engine(response())
    qs = e.build_questions(schema())
    assert set(qs) == {"regime", "direction", "toxic_flow", "setup_quality", "risk_state"}
    assert qs["direction"].criteria == {"long": None, "short": None, "neutral": None}
    assert list(qs["regime"].criteria) == ["trending", "mean_reverting", "high_vol", "crisis"]
    # Score criteria: one entry per level, starting at score 0.
    assert len(qs["setup_quality"].criteria) == 4
    assert qs["setup_quality"].criteria[0].startswith("0")
    assert qs["toxic_flow"].type == "noul"


def test_state_carries_thesis_context_and_snapshot():
    e = engine(response())
    s = schema()
    e.decide(snap(), s)
    state, _ = e._client.calls[0]
    assert s.context in state and "BTC-PERP" in state


def test_parse_documented_response():
    d = engine(response(score=2.4, noul=0.12)).decide(snap(), schema())
    assert (d.direction, d.direction_conf) == ("long", 0.9)
    assert d.setup_quality == pytest.approx(2.4)  # expected score may fall between levels
    assert d.toxic_flow_p == pytest.approx(0.12)
    assert d.regime == "trending" and d.risk_state == "safe"


def test_dict_shaped_response_also_parses():
    r = response()
    as_dict = {"answers": {k: vars(v) for k, v in r.answers.items()}}
    assert engine(as_dict).decide(snap(), schema()).direction == "long"


@pytest.mark.parametrize("mutate", [
    lambda r: r.answers.pop("direction"),
    lambda r: setattr(r.answers["direction"], "choice", "moon"),
    lambda r: setattr(r.answers["direction"], "confidence", 1.7),
    lambda r: setattr(r.answers["setup_quality"], "score", 3.5),
    lambda r: setattr(r.answers["toxic_flow"], "type", "choice"),
    lambda r: delattr(r.answers["toxic_flow"], "noul"),
])
def test_malformed_response_is_rejected(mutate):
    r = response()
    mutate(r)
    with pytest.raises((InvalidDecision, KeyError)):
        engine(r).decide(snap(), schema())


def test_malformed_response_means_hold_in_batch():
    r = response()
    r.answers["direction"].choice = "moon"
    out = decide_batch(engine(r), [(snap(), schema())])
    assert out == {"BTC-PERP": None}


def test_sdk_exception_means_hold_in_batch():
    class Boom(FakeClient):
        def system_one(self, state, questions):
            raise ConnectionError("TypeSafeAPIConnectionError")

    e = JevEngine(sdk=FAKE_SDK, client=Boom())
    assert decide_batch(e, [(snap(), schema())]) == {"BTC-PERP": None}


def test_production_client_disables_sdk_retries(monkeypatch):
    made = {}

    class Client:
        def __init__(self, **kw):
            made.update(kw)

    sdk = SimpleNamespace(Choice=_choice, Score=_score, Noul=_noul, TypeSafeClient=Client,
                          RetryPolicy=lambda **kw: ("retry", kw))
    monkeypatch.setenv("TYPESAFE_API_KEY", "test-key")
    JevEngine(sdk=sdk, timeout_s=0.5)
    assert made["api_key"] == "test-key" and made["timeout"] == 0.5
    assert made["model"] == "jev-1.13.0"  # pinned, never the moving "jev-latest" alias
    assert made["retry"] == ("retry", {"max_retries": 0, "timeout": 0.5})


def test_missing_key_refuses_to_start(monkeypatch):
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        JevEngine(sdk=FAKE_SDK)


def test_real_sdk_end_to_end_over_mock_transport():
    """Uses the real typesafe_sdk (0.7.x) request/response models; only HTTP is mocked."""
    ts = pytest.importorskip("typesafe_sdk")
    httpx2 = pytest.importorskip("httpx2")
    import json

    seen = {}

    def handler(req):
        seen["url"], seen["body"] = str(req.url), json.loads(req.content)
        ch = lambda c, p: {"type": "choice", "choice": c, "confidence": p, "probabilities": {c: p}}
        return httpx2.Response(200, json={
            "model": "jev-latest", "usage": {"input_tokens": 300, "output_tokens": 5},
            "answers": {
                "regime": ch("high_vol", 0.8), "direction": ch("short", 0.86),
                "risk_state": ch("safe", 0.9), "toxic_flow": {"type": "noul", "noul": 0.2},
                "setup_quality": {"type": "score", "score": 2.2, "confidence": 0.75,
                                  "legend": {str(i): str(i) for i in range(4)},
                                  "probabilities": {"0": .05, "1": .15, "2": .35, "3": .45}},
            }})

    client = ts.TypeSafeClient(api_key="k", transport=httpx2.MockTransport(handler),
                               retry=ts.RetryPolicy(max_retries=0), timeout=0.5)
    d = JevEngine(sdk=ts, client=client).decide(snap(), schema())
    assert seen["url"].endswith("/v1/systemone")
    q = seen["body"]["questions"]
    assert q["direction"] == {"type": "choice", "instructions": q["direction"]["instructions"],
                              "criteria": {"long": None, "short": None, "neutral": None}}
    assert q["setup_quality"]["type"] == "score" and len(q["setup_quality"]["criteria"]) == 4
    assert q["toxic_flow"]["type"] == "noul"
    assert (d.direction, d.regime, d.setup_quality, d.toxic_flow_p) == ("short", "high_vol", 2.2, 0.2)
