"""Operator settings for the practice bots, changed from the live view.

Each practice account has runtime/<account>/settings.json. The live view writes
it; the running bot re-reads it within a second and applies it without a
restart.

Two kinds of setting:
  * strategy knobs (how often it decides, how confident it must be, stop and
    target distances, which coins, pause) can move anywhere inside the bounds
    below;
  * hard safety limits (loss stops, per-coin and total size, number of coins)
    can only be made STRICTER than the profile in trader/config.py. A request
    to loosen one is clamped back to the profile value.

Nothing here can reach a real exchange account.
"""

from __future__ import annotations

import dataclasses
import json
import os
import time

from .config import AgentConfig, GateConfig, RiskLimits, UK_FAST_GATE, UK_SMALL_ACCOUNT

COINS = ["BTC", "ETH", "SOL", "AAVE"]
DECISION_CHOICES = [10, 15, 30, 60]

# Profile base values. The CLI and the settings clamp both read these.
PROFILES: dict[str, dict] = {
    "uk-spot": {"gate": GateConfig(), "risk": UK_SMALL_ACCOUNT, "min_stop_bps": 250.0, "reward_risk": 1.5},
    "uk-spot-fast": {"gate": UK_FAST_GATE, "risk": UK_SMALL_ACCOUNT, "min_stop_bps": 150.0, "reward_risk": 1.2},
}

# key: (label, help, kind, min, max, step)
SPEC: dict[str, tuple] = {
    "decision_every_s": ("Decide every", "How often the bot looks at every coin and decides to buy, sell or wait. "
                         "Faster reacts sooner but each decision sees less new information.",
                         "choice", DECISION_CHOICES, None, None),
    "paused": ("Pause new bets", "Stops the bot opening new bets. Stop-losses and profit targets on open bets "
               "keep working.", "bool", None, None, None),
    "coins": ("Coins it may buy", "Switch a coin off to stop new bets on it. Any open bet on it is still "
              "managed until it closes.", "coins", COINS, None, None),
    "min_confidence": ("Confidence needed", "How sure the AI must be about the direction before a bet. Higher "
                       "means fewer, pickier trades.", "num", 0.60, 0.95, 0.01),
    "min_setup": ("Set-up quality needed", "The AI scores each chart set-up 0 to 3. The bot only bets at or above "
                  "this score.", "int", 0, 3, 1),
    "require_edge": ("Only bet when it beats fees", "On: the bot only bets when its odds of winning, after the "
                     "~1.2% Coinbase round-trip fees, are positive. Off: it may bet anyway, risking a small fixed "
                     "slice each time.", "bool", None, None, None),
    "risk_per_bet_pct": ("Risk per bet (when not beating fees)", "Share of the account lost if a bet taken "
                         "without a proven edge hits its stop-loss.", "num", 0.1, 1.0, 0.05),
    "stop_pct": ("Smallest stop-loss", "How far a price may fall before the bot sells to cap the loss. It widens "
                 "automatically when the market is jumpy.", "num", 0.5, 5.0, 0.1),
    "reward_risk": ("Profit target vs stop", "Take-profit distance as a multiple of the stop. 1.5 with a 2% stop "
                    "means selling at +3%.", "num", 0.5, 4.0, 0.1),
    # hard limits: tighten only
    "max_per_coin_pct": ("Most in one coin", "Largest share of the account in a single coin.", "limit", 5, 30, 1),
    "max_total_pct": ("Most in bets overall", "Largest share of the account in coins at once. The rest stays "
                      "in cash.", "limit", 5, 50, 1),
    "max_coins": ("Most coins at once", "How many different coins it may hold together.", "limit", 1, 2, 1),
    "daily_loss_pct": ("Daily loss stop", "If the account falls this much in a day, the bot stops trading until "
                       "tomorrow.", "limit", 0.5, 3.0, 0.1),
    "drawdown_pct": ("Emergency stop", "If the account falls this much from its best, the bot stops for good "
                     "until reset.", "limit", 2, 15, 0.5),
}
LIMIT_KEYS = [k for k, v in SPEC.items() if v[2] == "limit"]


def defaults(profile: str) -> dict:
    p = PROFILES[profile]
    g, r = p["gate"], p["risk"]
    return {
        "decision_every_s": 60, "paused": False, "coins": list(COINS),
        "min_confidence": g.min_direction_confidence, "min_setup": g.min_setup_quality,
        "require_edge": g.require_edge_after_costs, "risk_per_bet_pct": g.fixed_risk_frac * 100,
        "stop_pct": p["min_stop_bps"] / 100, "reward_risk": p["reward_risk"],
        "max_per_coin_pct": r.max_position_frac * 100, "max_total_pct": r.max_gross_frac * 100,
        "max_coins": r.max_open_positions, "daily_loss_pct": r.max_daily_loss * 100,
        "drawdown_pct": r.max_drawdown * 100,
    }


def clean(profile: str, raw: dict) -> tuple[dict, list[str]]:
    """Validate and clamp. Returns (settings, notes about anything changed)."""
    base = defaults(profile)
    out, notes = dict(base), []
    for k, v in (raw or {}).items():
        if k not in SPEC:
            continue
        label, _h, kind, lo, hi, step = SPEC[k]
        try:
            if kind == "bool":
                out[k] = bool(v)
            elif kind == "choice":
                v = int(v)
                if v not in lo:
                    v = min(lo, key=lambda c: abs(c - v))
                    notes.append(f"{label}: set to {v} s")
                out[k] = v
            elif kind == "coins":
                out[k] = [c for c in COINS if c in set(v)]
            else:
                v = float(v)
                if kind == "int":
                    v = int(round(v))
                ceiling = base[k] if kind == "limit" else hi   # limits never go above the profile
                if v > ceiling:
                    notes.append(f"{label}: kept at {ceiling:g} (can only be made stricter)" if kind == "limit"
                                 else f"{label}: capped at {hi:g}")
                    v = ceiling
                if v < lo:
                    notes.append(f"{label}: raised to the minimum {lo:g}")
                    v = lo
                out[k] = v
        except (TypeError, ValueError):
            notes.append(f"{label}: ignored an invalid value")
    return out, notes


def apply_to(profile: str, s: dict, kill_switch_path: str) -> tuple[GateConfig, RiskLimits, float, float]:
    """Settings -> (gate, limits, min_stop_bps, reward_risk) for the running bot."""
    p = PROFILES[profile]
    gate = dataclasses.replace(p["gate"], min_direction_confidence=float(s["min_confidence"]),
                               min_setup_quality=int(s["min_setup"]),
                               require_edge_after_costs=bool(s["require_edge"]),
                               fixed_risk_frac=float(s["risk_per_bet_pct"]) / 100)
    r = p["risk"]
    lim = dataclasses.replace(
        r, kill_switch_path=kill_switch_path,
        max_position_frac=min(r.max_position_frac, s["max_per_coin_pct"] / 100),
        max_order_frac=min(r.max_order_frac, s["max_per_coin_pct"] / 100),
        max_gross_frac=min(r.max_gross_frac, s["max_total_pct"] / 100),
        max_beta_gross_frac=min(r.max_beta_gross_frac, s["max_total_pct"] / 100),
        max_open_positions=min(r.max_open_positions or 99, int(s["max_coins"])),
        max_daily_loss=min(r.max_daily_loss, s["daily_loss_pct"] / 100),
        max_drawdown=min(r.max_drawdown, s["drawdown_pct"] / 100),
    )
    return gate, lim, float(s["stop_pct"]) * 100, float(s["reward_risk"])


def profile_config(cfg: AgentConfig, profile: str) -> AgentConfig:
    p = PROFILES[profile]
    return dataclasses.replace(cfg, gate=p["gate"], min_stop_bps=p["min_stop_bps"], reward_risk=p["reward_risk"])


def load(path: str, profile: str) -> dict:
    try:
        with open(path) as f:
            raw = json.load(f)
    except (OSError, ValueError):
        raw = {}
    return clean(profile, raw)[0]


def save(path: str, profile: str, raw: dict) -> tuple[dict, list[str]]:
    s, notes = clean(profile, raw)
    s["updated_ts"] = time.time()
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(s, f, indent=1)
    os.replace(tmp, path)
    return s, notes


def spec_for(profile: str) -> list[dict]:
    base = defaults(profile)
    out = []
    for k, (label, help_, kind, lo, hi, step) in SPEC.items():
        out.append({"key": k, "label": label, "help": help_, "kind": kind,
                    "min": lo if kind not in ("choice", "coins") else None,
                    "max": base[k] if kind == "limit" else hi, "step": step,
                    "choices": lo if kind in ("choice", "coins") else None, "default": base[k]})
    return out
