#!/bin/bash
# Continuous OKX tape recorder with one file per UTC day.
# Meant to be kept alive by launchd (macOS) or systemd; it exits only on error.
#   tapes/<prefix>-YYYYMMDD.jsonl   (UTC date)
# VENUE=okx (default) or VENUE=coinbase (UK GBP spot, prefix cb).
set -u
cd "$(dirname "$0")/.."
PY="${PYTHON:-python3}"
VENUE="${VENUE:-okx}"
if [ "$VENUE" = "coinbase" ]; then SCRIPT=scripts/record_coinbase.py; PFX=cb; else SCRIPT=scripts/record_okx.py; PFX=okx; fi
mkdir -p tapes
while true; do
  day=$(date -u +%Y%m%d)
  now=$(date -u +%s)
  midnight=$(( (now / 86400 + 1) * 86400 ))
  secs=$(( midnight - now ))
  [ "$secs" -lt 5 ] && { sleep "$secs"; continue; }
  "$PY" "$SCRIPT" --out "tapes/${PFX}-${day}.jsonl" --duration "$secs" || sleep 30
  # compress every finished day (never today's file, which is still being written)
  today=$(date -u +%Y%m%d)
  for f in tapes/${PFX}-*.jsonl; do
    [ -e "$f" ] || continue
    [ "$f" = "tapes/${PFX}-${today}.jsonl" ] && continue
    gzip -f "$f"
  done
done
