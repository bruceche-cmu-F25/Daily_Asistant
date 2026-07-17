#!/usr/bin/env python3
"""Refresh only the local job queue without touching Calendar or Notion."""

from __future__ import annotations

import datetime as dt
import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo

from job_feed import collect_job_leads, load_candidate_profile


BASE = Path(os.environ.get("DASHBOARD_HOME", Path(__file__).resolve().parent.parent))
SNAPSHOT_PATH = BASE / "data" / "dashboard_snapshot.json"
PROFILE_PATH = BASE / "data" / "candidate_profile.json"
TZ = ZoneInfo(os.environ.get("DASHBOARD_TIMEZONE", "America/Los_Angeles"))


def main() -> None:
    profile = load_candidate_profile(PROFILE_PATH)
    today = dt.datetime.now(TZ).date()
    leads, errors = collect_job_leads(profile, today=today)
    try:
        snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        snapshot = {}
    if leads:
        snapshot["job_leads"] = leads
        snapshot["candidate_profile"] = {
            key: profile.get(key)
            for key in ("resume_version", "graduation", "location", "target_roles")
        }
        snapshot["job_feed_refreshed_at"] = dt.datetime.now(TZ).isoformat(timespec="seconds")
        source_status = [
            item for item in snapshot.get("source_status", [])
            if isinstance(item, dict) and item.get("name") != "Job Feeds"
        ]
        source_status.append({"name": "Job Feeds", "ok": True, "detail": f"{len(leads)} matched roles"})
        snapshot["source_status"] = source_status
        snapshot["stale_sources"] = [
            source for source in snapshot.get("stale_sources", []) if source != "Job Feeds"
        ]
        tmp = SNAPSHOT_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, SNAPSHOT_PATH)
    print(json.dumps({"matched": len(leads), "warnings": errors}, ensure_ascii=False))


if __name__ == "__main__":
    main()
