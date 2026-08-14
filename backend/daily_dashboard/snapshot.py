"""Validated, last-known-good read model for the Daily Dashboard.

The React application consumes one snapshot. Source adapters may fail independently;
publishing therefore retains the last successful fields for a failed source and marks
them stale instead of replacing useful data with empty lists.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .legacy import DASHBOARD_SNAPSHOT_PATH


class SourceStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    ok: bool
    detail: str = ""


class Metrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calendar_events: int = Field(default=0, ge=0)
    notion_tasks: int = Field(default=0, ge=0)
    fresh_jobs: int = Field(default=0, ge=0)


class DashboardSnapshot(BaseModel):
    """Stable API contract; rich feed records remain adapter-owned dictionaries."""

    model_config = ConfigDict(extra="allow")

    schema_version: int = Field(default=1, ge=1)
    date: str = ""
    generated_at: str = ""
    weekly_plan: dict[str, Any] = Field(default_factory=lambda: {"title": "Road Map", "url": ""})
    metrics: Metrics = Field(default_factory=Metrics)
    source_status: list[SourceStatus] = Field(default_factory=list)
    stale_sources: list[str] = Field(default_factory=list)
    events: list[dict[str, Any]] = Field(default_factory=list)
    links: dict[str, list[dict[str, Any]]] = Field(default_factory=lambda: {"study": [], "jobs": []})
    weekly: list[dict[str, Any]] = Field(default_factory=list)
    notion: list[dict[str, Any]] = Field(default_factory=list)
    jobs: list[dict[str, Any]] = Field(default_factory=list)
    news: list[dict[str, Any]] = Field(default_factory=list)
    discover_events: list[dict[str, Any]] = Field(default_factory=list)
    job_leads: list[dict[str, Any]] = Field(default_factory=list)
    candidate_profile: dict[str, Any] = Field(default_factory=dict)
    job_groups: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)
    quick_actions: list[dict[str, Any]] = Field(default_factory=list)
    quiet_links: list[dict[str, Any]] = Field(default_factory=list)
    target_copy: str = ""
    target_copy_cn: str = ""


SOURCE_FIELDS: dict[str, tuple[str, ...]] = {
    "Calendar": ("events",),
    "Notion": ("links", "weekly", "notion", "weekly_plan", "job_groups", "quick_actions"),
    "Brave Search": ("jobs", "news", "discover_events"),
    "Job Feeds": ("job_leads", "candidate_profile", "job_feed_refreshed_at"),
}


def empty_snapshot() -> dict[str, Any]:
    return DashboardSnapshot().model_dump(mode="json")


class SnapshotStore:
    """Own validation, fallback policy and atomic persistence behind one seam."""

    def __init__(self, path: Path = DASHBOARD_SNAPSHOT_PATH):
        self.path = Path(path)

    def load(self) -> dict[str, Any]:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            return DashboardSnapshot.model_validate(raw).model_dump(mode="json")
        except (OSError, json.JSONDecodeError, ValidationError, TypeError):
            return empty_snapshot()

    def publish(self, candidate: dict[str, Any]) -> dict[str, Any]:
        previous = self.load()
        merged = dict(candidate)
        statuses = {
            item.get("name"): item
            for item in merged.get("source_status", [])
            if isinstance(item, dict) and item.get("name")
        }
        stale: list[str] = []
        for source, fields in SOURCE_FIELDS.items():
            if statuses.get(source, {}).get("ok") is True:
                continue
            stale.append(source)
            for field in fields:
                if field in previous:
                    merged[field] = previous[field]

        merged["stale_sources"] = stale
        self._recompute_metrics(merged)
        validated = DashboardSnapshot.model_validate(merged).model_dump(mode="json")
        self._atomic_write(validated)
        return validated

    def update_source(
        self,
        source: str,
        fields: dict[str, Any],
        *,
        ok: bool,
        detail: str,
    ) -> dict[str, Any]:
        candidate = self.load()
        candidate.update(fields)
        statuses = [
            item for item in candidate.get("source_status", [])
            if isinstance(item, dict) and item.get("name") != source
        ]
        statuses.append({"name": source, "ok": ok, "detail": detail})
        candidate["source_status"] = statuses
        return self.publish(candidate)

    @staticmethod
    def _recompute_metrics(payload: dict[str, Any]) -> None:
        task_count = sum(
            1
            for item in list(payload.get("weekly") or []) + list(payload.get("notion") or [])
            if isinstance(item, dict) and item.get("is_todo")
        )
        payload["metrics"] = {
            "calendar_events": len(payload.get("events") or []),
            "notion_tasks": task_count,
            "fresh_jobs": len(payload.get("jobs") or []),
        }

    def _atomic_write(self, payload: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(f"{self.path.suffix}.tmp")
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        os.replace(temporary, self.path)


def load_dashboard_snapshot(path: Path = DASHBOARD_SNAPSHOT_PATH) -> dict[str, Any]:
    return SnapshotStore(path).load()
