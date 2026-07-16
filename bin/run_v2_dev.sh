#!/bin/zsh
set -euo pipefail

BASE="${DASHBOARD_HOME:-$HOME/daily-dashboard}"
cd "$BASE"
if [[ -x "$BASE/.venv/bin/uvicorn" ]]; then
  exec "$BASE/.venv/bin/uvicorn" daily_dashboard.main:app --app-dir backend --host 127.0.0.1 --port 8766
fi
exec uv run uvicorn daily_dashboard.main:app --app-dir backend --host 127.0.0.1 --port 8766
