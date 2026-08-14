"""Concrete Source Adapters for the canonical Daily Snapshot refresh."""

from __future__ import annotations

import datetime as dt
from typing import Any

import generate_dashboard as sources
from daily_dashboard.source_refresh import RefreshContext, SourceResult
from job_feed import collect_job_leads, load_candidate_profile, mark_first_seen


def group_job_links(items: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
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


def default_quick_actions(weekly_plan_url: str) -> list[dict[str, str]]:
    return [
        {"title": "Gmail", "subtitle": "Inbox", "url": sources.GMAIL, "kind": "hot"},
        {"title": "LeetCode", "subtitle": "Problem practice", "url": "https://leetcode.com/problemset/", "kind": "blue"},
        {"title": "NeetCode", "subtitle": "Roadmap & patterns", "url": sources.NEETCODE, "kind": "green"},
        {"title": "freeCodeCamp", "subtitle": "JavaScript practice", "url": "https://www.freecodecamp.org/learn/javascript-v9/", "kind": "blue"},
        {"title": "JobRight", "subtitle": "Daily recommendations", "url": sources.JOBRIGHT, "kind": "hot"},
        {"title": "This Week", "subtitle": "Weekly plan", "url": weekly_plan_url, "kind": "green"},
        {"title": "DSA Video", "subtitle": "Abdul Bari algorithms course", "url": sources.ABDUL_BARI, "kind": "purple"},
        {"title": "Harvard Web", "subtitle": "CS50W Web Development", "url": sources.HARVARD_WEB, "kind": "purple"},
        {"title": "printing", "subtitle": "SFPL mobile printing", "url": sources.PRINTING, "kind": "blue"},
    ]


def _prepare(source: str, context: RefreshContext) -> None:
    # The compatibility implementation still reads these globals internally;
    # mutations are contained inside each concrete Adapter, never the orchestrator.
    sources.TODAY = dt.date.fromisoformat(context.today)
    sources.SOURCE_STATUS.pop(source, None)


def _result(name: str, fields: dict[str, Any], default_detail: str) -> SourceResult:
    status = sources.SOURCE_STATUS.get(name)
    if not status:
        return SourceResult(name=name, fields=fields, ok=True, detail=default_detail)
    return SourceResult(
        name=name,
        fields=fields,
        ok=bool(status.get("ok")),
        detail=str(status.get("detail") or default_detail),
    )


class CalendarSourceAdapter:
    name = "Calendar"

    def refresh(self, context: RefreshContext) -> SourceResult:
        _prepare(self.name, context)
        events = sources.agenda_events()
        fields = {
            "events": [{**event, "key": sources.stable_event_key(event)} for event in events]
        }
        return _result(self.name, fields, f"{len(events)} events")


class NotionSourceAdapter:
    name = "Notion"

    def refresh(self, context: RefreshContext) -> SourceResult:
        _prepare(self.name, context)
        title, url, page_id = sources.current_week_page()
        sources.WEEKLY_PLAN_TITLE = title
        sources.WEEKLY_PLAN_URL = url
        sources.WEEKLY_PLAN_ID = page_id
        links = sources.links_to_visit()
        weekly = sources.weekly_plan_digest()
        notion = sources.high_level_notion_digest()
        fields = {
            "weekly_plan": {"title": title, "url": url},
            "links": links,
            "weekly": weekly,
            "notion": notion,
            "job_groups": group_job_links(list(links.get("jobs") or [])),
            "quick_actions": default_quick_actions(url),
        }
        return _result(self.name, fields, f"{len(weekly) + len(notion)} items")


class BraveSearchSourceAdapter:
    name = "Brave Search"

    def refresh(self, context: RefreshContext) -> SourceResult:
        _prepare(self.name, context)
        jobs = sources.job_posts()
        news = sources.tech_news()
        discovered_events = sources.discover_events()
        fields = {
            "jobs": jobs,
            "news": news,
            "discover_events": discovered_events,
        }
        return _result(
            self.name,
            fields,
            f"{len(jobs) + len(news) + len(discovered_events)} results",
        )


class JobFeedsSourceAdapter:
    name = "Job Feeds"

    def refresh(self, context: RefreshContext) -> SourceResult:
        _prepare(self.name, context)
        profile = load_candidate_profile(sources.CANDIDATE_PROFILE_PATH)
        job_leads, feed_errors = collect_job_leads(
            profile,
            today=dt.date.fromisoformat(context.today),
        )
        job_leads = mark_first_seen(
            job_leads,
            list(context.previous.get("job_leads") or []),
            refreshed_at=context.generated_at,
            previous_refreshed_at=str(
                context.previous.get("job_feed_refreshed_at")
                or context.previous.get("generated_at")
                or ""
            ),
        )
        ok = bool(job_leads)
        if ok:
            detail = f"{len(job_leads)} matched roles"
            if feed_errors:
                detail += f"; {len(feed_errors)} source warnings"
        else:
            detail = "; ".join(feed_errors) or "No matching roles"
        return SourceResult(
            name=self.name,
            fields={
                "job_leads": job_leads,
                "job_feed_refreshed_at": context.generated_at,
                "candidate_profile": {
                    key: profile.get(key)
                    for key in ("resume_version", "graduation", "location", "target_roles")
                },
            },
            ok=ok,
            detail=detail,
        )
