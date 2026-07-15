#!/bin/zsh
# launchd starts with a tiny PATH, so set the Homebrew paths explicitly.
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/opt/local/bin:/opt/local/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
source ~/.zprofile 2>/dev/null
source ~/.zshrc 2>/dev/null

BASE="${DASHBOARD_HOME:-$HOME/daily-dashboard}"
if "$BASE/bin/generate_dashboard.py" >> "$BASE/run.log" 2>> "$BASE/run.err"; then
  print -r -- "Dashboard updated: $BASE/today.html"
else
  status=$?
  print -u2 -r -- "Dashboard generation failed (exit $status). See $BASE/run.err"
  exit "$status"
fi
