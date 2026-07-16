import sqlite3

from fastapi.testclient import TestClient

from daily_dashboard import legacy
from daily_dashboard.main import app


def test_health_endpoint():
    response = TestClient(app).get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "version": "2.0.0-dev",
        "mode": "read-only-migration",
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
