#!/bin/zsh
set -euo pipefail

BASE="${DASHBOARD_HOME:-$HOME/daily-dashboard}"
cd "$BASE"
if [[ -x "$BASE/.venv/bin/uvicorn" ]]; then
  "$BASE/.venv/bin/alembic" -c "$BASE/alembic.ini" upgrade head
  exec "$BASE/.venv/bin/uvicorn" daily_dashboard.main:app --app-dir backend --host 127.0.0.1 --port 8766
fi
uv run alembic -c "$BASE/alembic.ini" upgrade head
exec uv run uvicorn daily_dashboard.main:app --app-dir backend --host 127.0.0.1 --port 8766
