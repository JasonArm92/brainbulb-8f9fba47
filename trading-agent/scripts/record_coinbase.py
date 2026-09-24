#!/usr/bin/env python3
"""Record a Coinbase GBP spot tape (public data only, no keys, no orders).

  python3 scripts/record_coinbase.py --out tapes/cb-$(date -u +%Y%m%d).jsonl
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from trader.coinbase_tape import CoinbaseRecorder  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--poll", type=float, default=2.0)
ap.add_argument("--all-trades", action="store_true")
ap.add_argument("--duration", type=float, default=None)
a = ap.parse_args()
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
CoinbaseRecorder(a.out, poll_s=a.poll, aggregate=not a.all_trades).run(a.duration)
