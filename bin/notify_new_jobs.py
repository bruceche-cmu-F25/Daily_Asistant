#!/usr/bin/env python3
"""Send one local macOS notification for job leads first seen today."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any


BASE = Path(os.environ.get("DASHBOARD_HOME", Path(__file__).resolve().parent.parent))
SNAPSHOT_PATH = BASE / "data" / "dashboard_snapshot.json"
STATE_PATH = BASE / "data" / "job_alert_state.json"


def load_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def pending_alert(snapshot: dict[str, Any], state: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    refreshed_at = str(snapshot.get("job_feed_refreshed_at") or snapshot.get("generated_at") or "")
    date_key = refreshed_at[:10]
    notified = set(state.get("notified_keys", [])) if state.get("date") == date_key else set()
    fresh = [
        lead for lead in snapshot.get("job_leads", [])
        if isinstance(lead, dict)
        and lead.get("key")
        and lead.get("is_new_today")
        and str(lead["key"]) not in notified
    ]
    return date_key, fresh


def save_state(date_key: str, keys: list[str]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_PATH.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"date": date_key, "notified_keys": keys}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(STATE_PATH)


def main() -> None:
    snapshot = load_json(SNAPSHOT_PATH)
    state = load_json(STATE_PATH)
    date_key, fresh = pending_alert(snapshot, state)
    if not date_key or not fresh:
        print({"notified": 0})
        return

    companies = list(dict.fromkeys(str(lead.get("company") or "Unknown") for lead in fresh))
    preview = " · ".join(companies[:4])
    if len(companies) > 4:
        preview += f" · +{len(companies) - 4} more"
    title = f"Daily OS · {len(fresh)} new matched job{'s' if len(fresh) != 1 else ''}"
    script = f"display notification {json.dumps(preview)} with title {json.dumps(title)} sound name \"Glass\""
    result = subprocess.run(["/usr/bin/osascript", "-e", script], check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "Unable to send job notification")

    existing = state.get("notified_keys", []) if state.get("date") == date_key else []
    save_state(date_key, list(dict.fromkeys([*map(str, existing), *(str(lead["key"]) for lead in fresh)])))
    print({"notified": len(fresh), "companies": companies})


if __name__ == "__main__":
    main()
