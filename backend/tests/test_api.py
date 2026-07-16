import sqlite3
import plistlib
from pathlib import Path

import anyio
import httpx

from daily_dashboard import legacy
from daily_dashboard.main import app


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_health_endpoint():
    async def request_health():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/api/v1/health")

    response = anyio.run(request_health)
    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "version": "2.0.0-dev",
        "mode": "parallel-preview",
    }


def test_legacy_adapter_is_read_only_and_summarizes_progress(tmp_path):
    bank = tmp_path / "problem_bank.json"
    bank.write_text(
        """[
          {"key":"leetcode:one","title":"One","topic":"Arrays & Hashing"},
          {"key":"leetcode:two","title":"Two","topic":"Arrays & Hashing"}
        ]""",
        encoding="utf-8",
    )
    database = tmp_path / "dashboard.db"
    connection = sqlite3.connect(database)
    connection.execute(
        """
        CREATE TABLE problem_progress (
          problem_key TEXT PRIMARY KEY, title TEXT, topic TEXT, url TEXT,
          completed INTEGER, stuck_count INTEGER, solution TEXT, reflection TEXT,
          completed_at TEXT, updated_at TEXT
        )
        """
    )
    connection.execute(
        "INSERT INTO problem_progress VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("leetcode:one", "One", "Arrays & Hashing", "https://example.com", 1, 2,
         "print('ok')", "", "2026-07-15T09:00:00-07:00", "2026-07-15T09:00:00-07:00"),
    )
    connection.commit()
    connection.close()

    problems = legacy.load_problem_bank(bank)
    progress = legacy.load_legacy_progress(database)

    assert len(problems) == 2
    assert progress["leetcode:one"]["completed"] is True
    assert progress["leetcode:one"]["solution"] == "print('ok')"


def test_dashboard_snapshot_adapter(tmp_path):
    snapshot = tmp_path / "dashboard_snapshot.json"
    snapshot.write_text(
        '{"date":"2026-07-15","events":[{"key":"event:one","title":"Focus"}]}',
        encoding="utf-8",
    )

    payload = legacy.load_dashboard_snapshot(snapshot)

    assert payload["date"] == "2026-07-15"
    assert payload["events"][0]["key"] == "event:one"


def test_v2_launch_agent_runs_at_login_and_keeps_server_alive():
    service_path = PROJECT_ROOT / "launchd" / "com.bruce.daily-dashboard-v2.plist"
    with service_path.open("rb") as file:
        service = plistlib.load(file)

    assert service["Label"] == "com.bruce.daily-dashboard-v2"
    assert service["RunAtLoad"] is True
    assert service["KeepAlive"] is True
    assert service["ProgramArguments"] == [
        "/Users/bruce/daily-dashboard/bin/run_v2_dev.sh"
    ]
