#!/usr/bin/env bash
# Overnight loop. Suggested cron (UTC): 30 23 * * *  /path/to/trading-agent/scripts/nightly.sh
# Reviews the day's ledger, refits calibration, writes candidate schemas.
# Candidates are NOT live until an operator runs `python -m trader promote ... --approved-by NAME`.
set -euo pipefail
cd "$(dirname "$0")/.."
day=$(date -u +%Y-%m-%d)
python3 -m pytest -q
python3 -m trader review
mkdir -p runtime/reviews
cp runtime/review.json "runtime/reviews/${day}.json"
if [ -f runtime/ledger.jsonl ]; then mv runtime/ledger.jsonl "runtime/reviews/${day}.ledger.jsonl"; fi
ls schemas/candidates 2>/dev/null || true
