import json

import pytest

from tests.helpers import decision, schema
from trader.decision import InvalidDecision
from trader.jev_schema import CompiledSchema, SchemaError, load_latest, save, validate_revision


def test_compiled_schema_shape():
    s = schema().to_json()
    q = s["questions"]
    assert q["regime"]["options"] == ["trending", "mean_reverting", "high_vol", "crisis"]
    assert q["direction"]["options"] == ["long", "short", "neutral"]
    assert q["toxic_flow"]["type"] == "noul"
    assert q["setup_quality"] == {**q["setup_quality"], "type": "score", "levels": 4}
    assert q["risk_state"]["options"] == ["safe", "near_limit", "reduce"]


def test_out_of_schema_values_rejected():
    for bad in ({"direction": "buy"}, {"regime": "bull"}, {"direction_conf": 1.2},
                {"toxic_flow_p": float("nan")}, {"setup_quality": 4}):
        with pytest.raises(InvalidDecision):
            decision(**bad)


def _rev(old, **kw):
    d = old.to_json()
    d["version"] = old.version + 1
    d.update(kw)
    return CompiledSchema(d["version"], d["symbol"], d["finalist"], d["context"], d["questions"],
                          tuple(d["allowed_directions"]))


def test_revision_may_rewrite_instructions_and_narrow():
    old = schema()
    q = {k: {**v, "instructions": "new " + v["instructions"]} for k, v in old.questions.items()}
    validate_revision(old, _rev(old, questions=q, allowed_directions=["long", "neutral"]))


def test_revision_cannot_widen_or_change_options():
    old = schema(allowed_directions=["long", "neutral"])
    with pytest.raises(SchemaError):
        validate_revision(old, _rev(old, allowed_directions=["long", "short", "neutral"]))
    q = json.loads(json.dumps(old.questions))
    q["direction"]["options"] = ["long", "short", "neutral", "yolo"]
    with pytest.raises(SchemaError):
        validate_revision(old, _rev(old, questions=q))


def test_versions_immutable(tmp_path):
    s = schema()
    save(s, str(tmp_path))
    with pytest.raises(SchemaError):
        save(s, str(tmp_path))
    assert load_latest(str(tmp_path), "BTC-PERP").version == 1
