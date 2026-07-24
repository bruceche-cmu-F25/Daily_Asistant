#!/usr/bin/env python3
"""Refresh the canonical React/FastAPI dashboard snapshot without rendering v1 HTML."""

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
from job_feed import collect_job_leads, load_candidate_profile, mark_first_seen  # noqa: E402


def group_job_links(items: list[dict]) -> dict[str, list[dict]]:
    groups = {
        "Daily first / 每天先刷": [],
        "Curated lists / 岗位列表": [],
        "Platforms / 平台入口": [],
        "Profile & prep / 简历和准备": [],
    }
    for item in items:
        low = str(item.get("title", "")).lower()
        if "jobright" in low:
            group = "Daily first / 每天先刷"
        elif any(word in low for word in ("github", "speedy", "tiktok", "2027 tech", "new grad positions")):
            group = "Curated lists / 岗位列表"
        elif any(word in low for word in ("simplify", "handshake", "yc", "avisajob", "linkedin", "career ops")):
            group = "Platforms / 平台入口"
        else:
            group = "Profile & prep / 简历和准备"
        groups[group].append(item)
    return groups


def default_quick_actions() -> list[dict]:
    return [
        {"title": "Gmail", "subtitle": "Inbox", "url": sources.GMAIL, "kind": "hot"},
        {"title": "LeetCode", "subtitle": "Problem practice", "url": "https://leetcode.com/problemset/", "kind": "blue"},
        {"title": "NeetCode", "subtitle": "Roadmap & patterns", "url": sources.NEETCODE, "kind": "green"},
        {"title": "freeCodeCamp", "subtitle": "JavaScript practice", "url": "https://www.freecodecamp.org/learn/javascript-v9/", "kind": "blue"},
        {"title": "JobRight", "subtitle": "Daily recommendations", "url": sources.JOBRIGHT, "kind": "hot"},
        {"title": "This Week", "subtitle": "Weekly plan", "url": sources.WEEKLY_PLAN_URL, "kind": "green"},
        {"title": "DSA Video", "subtitle": "Abdul Bari algorithms course", "url": sources.ABDUL_BARI, "kind": "purple"},
        {"title": "Harvard Web", "subtitle": "CS50W Web Development", "url": sources.HARVARD_WEB, "kind": "purple"},
        {"title": "printing", "subtitle": "SFPL mobile printing", "url": sources.PRINTING, "kind": "blue"},
    ]


def collect_snapshot() -> tuple[dict, list[dict]]:
    sources.SOURCE_STATUS.clear()
    sources.WEEKLY_PLAN_TITLE, sources.WEEKLY_PLAN_URL, sources.WEEKLY_PLAN_ID = sources.current_week_page()
    events = sources.agenda_events()
    links = sources.links_to_visit()
    weekly = sources.weekly_plan_digest()
    notion = sources.high_level_notion_digest()
    jobs = sources.job_posts()
    news = sources.tech_news()
    discovered_events = sources.discover_events()
    profile = load_candidate_profile(sources.CANDIDATE_PROFILE_PATH)
    job_leads, feed_errors = collect_job_leads(profile, today=sources.TODAY)
    previous = SnapshotStore().load()
    generated_at = dt.datetime.now(sources.TZ).isoformat(timespec="seconds")
    job_leads = mark_first_seen(
        job_leads,
        list(previous.get("job_leads") or []),
        refreshed_at=generated_at,
        previous_refreshed_at=str(previous.get("job_feed_refreshed_at") or previous.get("generated_at") or ""),
    )
    if job_leads:
        detail = f"{len(job_leads)} matched roles"
        if feed_errors:
            detail += f"; {len(feed_errors)} source warnings"
        sources.set_status("Job Feeds", True, detail)
    else:
        sources.set_status("Job Feeds", False, "; ".join(feed_errors) or "No matching roles")

    quick_actions = default_quick_actions()
    quiet_links = previous.get("quiet_links") or []
    candidate = {
        "schema_version": 1,
        "date": sources.TODAY.isoformat(),
        "generated_at": generated_at,
        "weekly_plan": {"title": sources.WEEKLY_PLAN_TITLE, "url": sources.WEEKLY_PLAN_URL},
        "source_status": [
            {
                "name": name,
                "ok": bool(sources.SOURCE_STATUS.get(name, {}).get("ok")),
                "detail": sources.SOURCE_STATUS.get(name, {}).get("detail", "Not checked"),
            }
            for name in ("Calendar", "Notion", "Brave Search", "Job Feeds")
        ],
        "events": [{**event, "key": sources.stable_event_key(event)} for event in events],
        "links": links,
        "weekly": weekly,
        "notion": notion,
        "jobs": jobs,
        "news": news,
        "discover_events": discovered_events,
        "job_leads": job_leads,
        "job_feed_refreshed_at": generated_at,
        "candidate_profile": {
            key: profile.get(key)
            for key in ("resume_version", "graduation", "location", "target_roles")
        },
        "job_groups": group_job_links(list(links.get("jobs") or [])),
        "quick_actions": quick_actions,
        "quiet_links": quiet_links,
        "target_copy": sources.TARGET_COPY,
        "target_copy_cn": sources.TARGET_COPY_CN,
    }
    return candidate, events


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh the canonical Daily Dashboard snapshot")
    parser.add_argument("--no-reminders", action="store_true", help="Do not schedule per-event reminders")
    args = parser.parse_args()
    candidate, events = collect_snapshot()
    published = SnapshotStore().publish(candidate)
    if not args.no_reminders:
        sources.schedule_events(events)
    print(SnapshotStore().path)
    if published.get("stale_sources"):
        print("Stale sources: " + ", ".join(published["stale_sources"]))


if __name__ == "__main__":
    main()
