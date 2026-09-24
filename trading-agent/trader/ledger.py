"""Append-only JSONL ledger. The overnight review reads only this file."""

from __future__ import annotations

import dataclasses
import json
import os
from typing import Any, Iterator


class Ledger:
    def __init__(self, path: str):
        self.path = path
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._f = open(path, "a", buffering=1)

    def write(self, kind: str, ts: float, **data: Any) -> None:
        rec = {"kind": kind, "ts": ts}
        for k, v in data.items():
            rec[k] = dataclasses.asdict(v) if dataclasses.is_dataclass(v) else v
        self._f.write(json.dumps(rec, sort_keys=True, default=str) + "\n")

    def close(self) -> None:
        self._f.close()


def read(path: str) -> Iterator[dict]:
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)
