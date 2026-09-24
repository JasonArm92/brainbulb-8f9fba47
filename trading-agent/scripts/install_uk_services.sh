#!/bin/bash
# macOS: switch the Mac to the UK set-up (practice money only).
#   * stops the old perpetuals practice trader (derivatives are banned for UK retail)
#   * com.jason.cb-recorder  - records Coinbase GBP prices, keeps the Mac awake on charger
#   * com.jason.uk-trader    - practice auto-trader, UK spot rules, starts at GBP 50
#   * com.jason.live-view    - the real-time web page on port 8787 (read-only, key-protected)
# Safe to run again. Nothing here places real orders.
set -eu
cd "$(dirname "$0")/.."
REPO="$(pwd)"
PY="${PYTHON:-/opt/homebrew/bin/python3}"
LA="$HOME/Library/LaunchAgents"
UID_="$(id -u)"
mkdir -p "$LA" runtime/uk-spot tapes

stop() { launchctl bootout "gui/$UID_/$1" 2>/dev/null || launchctl unload "$LA/$1.plist" 2>/dev/null || true; }

plist() {   # label, log, args...
  local label="$1" log="$2"; shift 2
  local args=""
  for a in "$@"; do args="$args    <string>$a</string>
"; done
  cat > "$LA/$label.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
$args  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PYTHON</key><string>$PY</string><key>VENUE</key><string>coinbase</string></dict>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$log</string>
  <key>StandardErrorPath</key><string>$log</string>
</dict>
</plist>
EOF
}

# 1. retire the non-compliant perpetuals practice trader (its files stay in runtime/shadow)
stop com.jason.shadow-trader
[ -f "$LA/com.jason.shadow-trader.plist" ] && mv "$LA/com.jason.shadow-trader.plist" "$REPO/runtime/shadow-trader.plist.disabled"

# 2-4. UK services
plist com.jason.cb-recorder "$REPO/tapes/cb-recorder.log" /usr/bin/caffeinate -s /bin/bash "$REPO/scripts/run_recorder.sh"
plist com.jason.uk-trader "$REPO/runtime/uk-spot/trader.log" "$PY" -m trader shadow --profile uk-spot
plist com.jason.live-view "$REPO/runtime/uk-spot/live-view.log" "$PY" -m trader live --port 8787
for l in com.jason.cb-recorder com.jason.uk-trader com.jason.live-view; do
  stop "$l"
  launchctl bootstrap "gui/$UID_" "$LA/$l.plist" 2>/dev/null || launchctl load -w "$LA/$l.plist"
done
"$PY" -c "from trader.live_server import load_token; print(load_token('runtime/live_token'))" > /dev/null
echo "installed. live view key: runtime/live_token"
