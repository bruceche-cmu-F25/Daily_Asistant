import json

import pytest
from pydantic import ValidationError

from daily_dashboard.snapshot import SnapshotStore


def base_candidate():
    return {
        "date": "2026-07-17",
        "generated_at": "2026-07-17T09:00:00-07:00",
        "source_status": [
            {"name": "Calendar", "ok": True, "detail": "Updated"},
            {"name": "Notion", "ok": True, "detail": "Updated"},
            {"name": "Brave Search", "ok": True, "detail": "Updated"},
            {"name": "Job Feeds", "ok": True, "detail": "Updated"},
        ],
        "events": [{"title": "Focus"}],
        "weekly": [{"text": "Ship", "is_todo": True}],
        "notion": [],
        "jobs": [{"title": "Role"}],
        "news": [],
        "discover_events": [],
        "job_leads": [{"key": "lead-1"}],
    }


def test_publish_is_atomic_and_recomputes_metrics(tmp_path):
    path = tmp_path / "snapshot.json"
    stored = SnapshotStore(path).publish(base_candidate())

    assert stored["metrics"] == {
        "calendar_events": 1,
        "notion_tasks": 1,
        "fresh_jobs": 1,
    }
    assert stored["stale_sources"] == []
    assert json.loads(path.read_text())["events"][0]["title"] == "Focus"
    assert not path.with_suffix(".json.tmp").exists()


def test_failed_source_retains_only_its_last_known_good_fields(tmp_path):
    path = tmp_path / "snapshot.json"
    store = SnapshotStore(path)
    store.publish(base_candidate())
    failed = base_candidate()
    failed["events"] = []
    failed["jobs"] = [{"title": "New role"}]
    failed["source_status"][0] = {"name": "Calendar", "ok": False, "detail": "offline"}

    stored = store.publish(failed)

    assert stored["events"] == [{"title": "Focus"}]
    assert stored["jobs"] == [{"title": "New role"}]
    assert stored["stale_sources"] == ["Calendar"]
    assert stored["metrics"]["calendar_events"] == 1


def test_invalid_candidate_never_overwrites_last_good_snapshot(tmp_path):
    path = tmp_path / "snapshot.json"
    store = SnapshotStore(path)
    original = store.publish(base_candidate())
    invalid = base_candidate()
    invalid["source_status"] = [{"name": "Calendar", "ok": "not-a-bool", "detail": "bad"}]

    with pytest.raises(ValidationError):
        store.publish(invalid)

    assert store.load() == original


def test_malformed_file_returns_safe_default(tmp_path):
    path = tmp_path / "snapshot.json"
    path.write_text("{broken", encoding="utf-8")

    loaded = SnapshotStore(path).load()

    assert loaded["events"] == []
    assert loaded["metrics"]["calendar_events"] == 0
