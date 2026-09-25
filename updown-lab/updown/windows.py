"""5-minute UTC-aligned windows. A window resolves UP if the closing reference is at or
above the opening reference (the rule Polymarket's BTC Up/Down markets use)."""

from __future__ import annotations

from dataclasses import dataclass

from .config import WINDOW_S


def window_start(ts: float) -> int:
    return int(ts // WINDOW_S) * WINDOW_S


@dataclass
class Window:
    start: int
    open_ref: float | None = None
    close_ref: float | None = None

    @property
    def end(self) -> int:
        return self.start + WINDOW_S

    @property
    def slug(self) -> str:
        return f"btc-updown-5m-{self.start}"

    def time_left(self, now: float) -> float:
        return max(0.0, self.end - now)

    def outcome(self) -> str | None:
        if self.open_ref is None or self.close_ref is None:
            return None
        return "UP" if self.close_ref >= self.open_ref else "DOWN"
