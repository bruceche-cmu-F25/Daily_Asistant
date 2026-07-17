#!/bin/zsh
# launchd starts with a tiny PATH, so set the Homebrew paths explicitly.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/opt/local/bin:/opt/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
source ~/.zprofile 2>/dev/null
source ~/.zshrc 2>/dev/null

BASE="${DASHBOARD_HOME:-$HOME/daily-dashboard}"
DASHBOARD_URL="${DASHBOARD_URL:-http://127.0.0.1:8766/}"
OPEN_BIN="${DASHBOARD_OPEN_BIN:-/usr/bin/open}"

if "$BASE/bin/generate_dashboard.py" --no-open >> "$BASE/run.log" 2>> "$BASE/run.err"; then
  print -r -- "Dashboard updated: $BASE/today.html"
else
  status=$?
  print -u2 -r -- "Dashboard generation failed (exit $status). See $BASE/run.err"
  exit "$status"
fi

if ! "$OPEN_BIN" "$DASHBOARD_URL" >> "$BASE/run.log" 2>> "$BASE/run.err"; then
  print -u2 -r -- "Dashboard updated, but could not open $DASHBOARD_URL"
fi
