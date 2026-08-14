#!/usr/bin/env python3
"""Refresh only the local job queue without touching Calendar or Notion."""

from __future__ import annotations

import datetime as dt
import os
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

from job_feed import collect_job_leads, load_candidate_profile, mark_first_seen


BASE = Path(os.environ.get("DASHBOARD_HOME", Path(__file__).resolve().parent.parent))
BACKEND = BASE / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from daily_dashboard.snapshot import SnapshotStore

SNAPSHOT_PATH = BASE / "data" / "dashboard_snapshot.json"
PROFILE_PATH = BASE / "data" / "candidate_profile.json"
TZ = ZoneInfo(os.environ.get("DASHBOARD_TIMEZONE", "America/Los_Angeles"))


def main() -> None:
    profile = load_candidate_profile(PROFILE_PATH)
    today = dt.datetime.now(TZ).date()
    leads, errors = collect_job_leads(profile, today=today)
    store = SnapshotStore(SNAPSHOT_PATH)
    previous = store.load()
    refreshed_at = dt.datetime.now(TZ).isoformat(timespec="seconds")
    leads = mark_first_seen(
        leads,
        list(previous.get("job_leads") or []),
        refreshed_at=refreshed_at,
        previous_refreshed_at=str(previous.get("job_feed_refreshed_at") or previous.get("generated_at") or ""),
    )
    if leads:
        store.update_source(
            "Job Feeds",
            {
                "job_leads": leads,
                "candidate_profile": {
                    key: profile.get(key)
                    for key in ("resume_version", "graduation", "location", "target_roles")
                },
                "job_feed_refreshed_at": refreshed_at,
            },
            ok=True,
            detail=f"{len(leads)} matched roles",
        )
    else:
        store.update_source(
            "Job Feeds",
            {},
            ok=False,
            detail="; ".join(errors) or "No matching roles",
        )
    print({"matched": len(leads), "warnings": errors})


if __name__ == "__main__":
    main()
