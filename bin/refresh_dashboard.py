#!/usr/bin/env python3
"""Refresh the canonical React/FastAPI Daily Snapshot."""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path


BASE = Path(__file__).resolve().parent.parent
for import_root in (BASE / "backend", BASE / "bin"):
    if str(import_root) not in sys.path:
        sys.path.insert(0, str(import_root))

import generate_dashboard as sources  # noqa: E402
from daily_dashboard.snapshot import SnapshotStore  # noqa: E402
from daily_dashboard.source_refresh import RefreshReport, SourceRefresh  # noqa: E402
from source_adapters import (  # noqa: E402
    BraveSearchSourceAdapter,
    CalendarSourceAdapter,
    JobFeedsSourceAdapter,
    NotionSourceAdapter,
)


def collect_snapshot(
    store: SnapshotStore | None = None,
    *,
    generated_at: str | None = None,
) -> RefreshReport:
    """Run every Source Adapter and atomically publish one full/partial refresh."""

    store = store or SnapshotStore()
    generated_at = generated_at or dt.datetime.now(sources.TZ).isoformat(timespec="seconds")
    previous = store.load()
    refresh = SourceRefresh(
        store,
        [
            CalendarSourceAdapter(),
            NotionSourceAdapter(),
            BraveSearchSourceAdapter(),
            JobFeedsSourceAdapter(),
        ],
    )
    return refresh.run(
        today=sources.TODAY.isoformat(),
        generated_at=generated_at,
        base_fields={
            "schema_version": 1,
            "quiet_links": previous.get("quiet_links") or [],
            "target_copy": sources.TARGET_COPY,
            "target_copy_cn": sources.TARGET_COPY_CN,
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh the canonical Daily Dashboard snapshot")
    parser.add_argument("--no-reminders", action="store_true", help="Do not schedule per-event reminders")
    args = parser.parse_args()
    store = SnapshotStore()
    report = collect_snapshot(store)
    if not args.no_reminders:
        sources.schedule_events(list(report.fresh_fields("Calendar").get("events") or []))
    print(store.path)
    if report.published.get("stale_sources"):
        print("Stale sources: " + ", ".join(report.published["stale_sources"]))


if __name__ == "__main__":
    main()
