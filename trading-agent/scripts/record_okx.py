#!/usr/bin/env python3
"""Record an OKX replay tape (public data only, no keys, no orders).

  python3 scripts/record_okx.py --out tapes/okx-$(date -u +%Y%m%d).jsonl
  python3 scripts/record_okx.py --out tapes/test.jsonl --duration 600   # 10-minute smoke test

Rung 1 needs >= 30 days. scripts/run_recorder.sh writes one file per UTC day and
gzips finished days. Replay takes them directly: python3 -m trader replay tapes/okx-*
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from trader.okx_tape import Recorder  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--poll", type=float, default=2.0, help="seconds between book/trade polls")
ap.add_argument("--all-trades", action="store_true", help="keep every trade print (about 50x larger tape)")
ap.add_argument("--duration", type=float, default=None, help="seconds; default runs until stopped")
a = ap.parse_args()
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
Recorder(a.out, poll_s=a.poll, aggregate=not a.all_trades).run(a.duration)
