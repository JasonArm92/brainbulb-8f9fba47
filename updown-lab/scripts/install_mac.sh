#!/bin/bash
# macOS: set up and start the Up/Down Lab (paper only, simulated market).
#   * a private Python environment in .venv with FastAPI/uvicorn
#   * com.jason.updown-lab       - the engine + phone view on port 8788 (key in runtime/token)
#   * com.jason.updown-backtest  - re-runs the model backtest every morning at 04:17
# Safe to run again. There is no live-trading code in this project.
set -eu
cd "$(dirname "$0")/.."
REPO="$(pwd)"
PY="${PYTHON:-/opt/homebrew/bin/python3}"
LA="$HOME/Library/LaunchAgents"
UID_="$(id -u)"
mkdir -p "$LA" runtime
[ -x .venv/bin/python ] || "$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip >/dev/null
.venv/bin/pip install -q -r requirements-dev.txt
VPY="$REPO/.venv/bin/python"
[ -f runtime/backtest.json ] || "$VPY" -m updown.backtest --days 30

write() {  # label, log, extra plist xml, args...
  local label="$1" log="$2" extra="$3"; shift 3
  local args=""; for a in "$@"; do args="$args    <string>$a</string>
"; done
  cat > "$LA/$label.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array>
$args  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
$extra
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$log</string>
  <key>StandardErrorPath</key><string>$log</string>
</dict>
</plist>
PL
}
write com.jason.updown-lab "$REPO/runtime/lab.log" "  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>" "$VPY" -m updown.server --port 8788
write com.jason.updown-backtest "$REPO/runtime/backtest.log" "  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>17</integer></dict>" "$VPY" -m updown.backtest --days 30
for l in com.jason.updown-lab com.jason.updown-backtest; do
  launchctl bootout "gui/$UID_/$l" 2>/dev/null || true
  sleep 1
  for try in 1 2 3; do launchctl bootstrap "gui/$UID_" "$LA/$l.plist" 2>/dev/null && break; launchctl list "$l" >/dev/null 2>&1 && break; sleep 2; done
  launchctl list "$l" >/dev/null 2>&1 || { echo "could not start $l" >&2; exit 1; }
done
"$VPY" -c "from updown.server import load_token; load_token('runtime/token')"
echo "installed. key: runtime/token  port: 8788"
