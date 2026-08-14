#!/bin/zsh
# launchd starts with a tiny PATH, so set the Homebrew paths explicitly.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/opt/local/bin:/opt/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
source ~/.zprofile 2>/dev/null
source ~/.zshrc 2>/dev/null

BASE="${DASHBOARD_HOME:-$HOME/daily-dashboard}"
DASHBOARD_URL="${DASHBOARD_URL:-http://127.0.0.1:8766/}"
OPEN_BIN="${DASHBOARD_OPEN_BIN:-/usr/bin/open}"
PYTHON_BIN="$BASE/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="$(command -v python3)"
fi

if "$BASE/bin/refresh_dashboard.py" --no-reminders >> "$BASE/run.log" 2>> "$BASE/run.err"; then
  print -r -- "Dashboard snapshot updated for $DASHBOARD_URL"
else
  status=$?
  print -u2 -r -- "Dashboard refresh failed (exit $status). See $BASE/run.err"
  exit "$status"
fi

if [[ -f "$BASE/data/google-oauth-client.json" && -f "$BASE/data/gmail-token.json" ]]; then
  if ! "$PYTHON_BIN" "$BASE/bin/sync_gmail.py" >> "$BASE/run.log" 2>> "$BASE/run.err"; then
    print -u2 -r -- "Gmail scan failed; dashboard data was still refreshed. See $BASE/run.err"
  fi
fi

if ! "$PYTHON_BIN" "$BASE/bin/notify_new_jobs.py" >> "$BASE/run.log" 2>> "$BASE/run.err"; then
  print -u2 -r -- "Job alert failed; dashboard data was still refreshed. See $BASE/run.err"
fi

if ! "$OPEN_BIN" "$DASHBOARD_URL" >> "$BASE/run.log" 2>> "$BASE/run.err"; then
  print -u2 -r -- "Dashboard updated, but could not open $DASHBOARD_URL"
fi
