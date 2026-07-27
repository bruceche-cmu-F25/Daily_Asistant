#!/bin/zsh
set -euo pipefail

BASE="${DASHBOARD_HOME:-$HOME/daily-dashboard}"
cd "$BASE"

PI_WEB_PORT="${PI_WEB_PORT:-30141}"
PI_WEB_PACKAGE="@agegr/pi-web@0.8.1"

find_npx() {
  if [[ -n "${NPX_BIN:-}" && -x "$NPX_BIN" ]]; then
    print -r -- "$NPX_BIN"
    return
  fi

  local candidate
  for candidate in /opt/homebrew/bin/npx /usr/local/bin/npx; do
    if [[ -x "$candidate" ]]; then
      print -r -- "$candidate"
      return
    fi
  done

  command -v npx 2>/dev/null || true
}

if ! /usr/sbin/lsof -nP -iTCP:"$PI_WEB_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  NPX_PATH="$(find_npx)"
  if [[ -n "$NPX_PATH" ]]; then
    /usr/bin/nohup "$NPX_PATH" -y "$PI_WEB_PACKAGE" \
      --port "$PI_WEB_PORT" \
      --hostname 127.0.0.1 \
      --no-open \
      >> "$BASE/pi-web.log" \
      2>> "$BASE/pi-web.err" &
  else
    print -u2 "Pi Web was not started: npx was not found."
  fi
fi

if [[ -x "$BASE/.venv/bin/uvicorn" ]]; then
  "$BASE/.venv/bin/alembic" -c "$BASE/alembic.ini" upgrade head
  exec "$BASE/.venv/bin/uvicorn" daily_dashboard.main:app --app-dir backend --host 127.0.0.1 --port 8766
fi
uv run alembic -c "$BASE/alembic.ini" upgrade head
exec uv run uvicorn daily_dashboard.main:app --app-dir backend --host 127.0.0.1 --port 8766
