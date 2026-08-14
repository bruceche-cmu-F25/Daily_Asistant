from dataclasses import dataclass

from daily_dashboard.snapshot import SnapshotStore
from daily_dashboard.source_refresh import RefreshContext, SourceRefresh, SourceResult


@dataclass
class FakeAdapter:
    name: str
    fields: dict
    ok: bool = True
    detail: str = "Updated"
    error: Exception | None = None

    def refresh(self, _context: RefreshContext) -> SourceResult:
        if self.error:
            raise self.error
        return SourceResult(self.name, self.fields, self.ok, self.detail)


def adapters(*, calendar_events, jobs):
    return [
        FakeAdapter("Calendar", {"events": calendar_events}),
        FakeAdapter("Notion", {
            "weekly_plan": {"title": "Week 4", "url": "https://notion.example/week"},
            "links": {"study": [], "jobs": []},
            "weekly": [{"text": "Ship", "is_todo": True}],
            "notion": [],
        }),
        FakeAdapter("Brave Search", {
            "jobs": jobs,
            "news": [],
            "discover_events": [],
        }),
        FakeAdapter("Job Feeds", {
            "job_leads": [{"key": "lead-1"}],
            "candidate_profile": {},
            "job_feed_refreshed_at": "2026-08-10T09:00:00-07:00",
        }),
    ]


def test_source_refresh_publishes_all_adapter_projections(tmp_path):
    store = SnapshotStore(tmp_path / "snapshot.json")
    refresh = SourceRefresh(
        store,
        adapters(calendar_events=[{"title": "Focus"}], jobs=[{"title": "Role"}]),
    )

    report = refresh.run(
        today="2026-08-10",
        generated_at="2026-08-10T09:00:00-07:00",
        base_fields={"schema_version": 1, "target_copy": "Target"},
    )

    assert [result.name for result in report.results] == [
        "Calendar", "Notion", "Brave Search", "Job Feeds"
    ]
    assert report.published["stale_sources"] == []
    assert report.published["metrics"] == {
        "calendar_events": 1,
        "notion_tasks": 1,
        "fresh_jobs": 1,
    }
    assert report.fresh_fields("Calendar")["events"] == [{"title": "Focus"}]


def test_source_refresh_isolates_failure_and_keeps_last_known_good_fields(tmp_path):
    store = SnapshotStore(tmp_path / "snapshot.json")
    SourceRefresh(
        store,
        adapters(calendar_events=[{"title": "Keep me"}], jobs=[{"title": "Old role"}]),
    ).run(
        today="2026-08-09",
        generated_at="2026-08-09T09:00:00-07:00",
        base_fields={"schema_version": 1},
    )
    partial_adapters = adapters(
        calendar_events=[],
        jobs=[{"title": "New role"}],
    )
    partial_adapters[0].error = RuntimeError("calendar offline")

    report = SourceRefresh(store, partial_adapters).run(
        today="2026-08-10",
        generated_at="2026-08-10T09:00:00-07:00",
        base_fields={"schema_version": 1},
    )

    assert report.published["events"] == [{"title": "Keep me"}]
    assert report.published["jobs"] == [{"title": "New role"}]
    assert report.published["stale_sources"] == ["Calendar"]
    assert report.results[0].ok is False
    assert report.results[0].detail == "RuntimeError: calendar offline"
    assert report.fresh_fields("Calendar") == {}
