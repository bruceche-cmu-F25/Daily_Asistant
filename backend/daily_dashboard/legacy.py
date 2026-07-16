"""Read-only adapters for the legacy problem bank and progress database."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(
    os.environ.get("DASHBOARD_HOME", Path(__file__).resolve().parents[2])
)
PROBLEM_BANK_PATH = PROJECT_ROOT / "data" / "problem_bank.json"
LEGACY_DB_PATH = PROJECT_ROOT / "data" / "dashboard.db"
DASHBOARD_SNAPSHOT_PATH = PROJECT_ROOT / "data" / "dashboard_snapshot.json"


def load_problem_bank(path: Path = PROBLEM_BANK_PATH) -> list[dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return [item for item in payload if isinstance(item, dict)]


def load_dashboard_snapshot(path: Path = DASHBOARD_SNAPSHOT_PATH) -> dict[str, Any]:
    """Read the structured snapshot emitted by the unchanged daily generator."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "date": "",
            "generated_at": "",
            "weekly_plan": {"title": "Road Map", "url": ""},
            "metrics": {"calendar_events": 0, "notion_tasks": 0, "fresh_jobs": 0},
            "source_status": [],
            "stale_sources": ["Calendar", "Notion", "Brave Search"],
            "events": [],
            "links": {"study": [], "jobs": []},
            "weekly": [],
            "notion": [],
            "jobs": [],
            "news": [],
            "job_groups": {},
            "quick_actions": [],
            "quiet_links": [],
            "target_copy": "",
            "target_copy_cn": "",
        }
    return payload if isinstance(payload, dict) else {}


def load_legacy_progress(path: Path = LEGACY_DB_PATH) -> dict[str, dict[str, Any]]:
    """Read progress without creating or mutating the legacy SQLite database."""
    if not path.is_file():
        return {}
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        table = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'problem_progress'"
        ).fetchone()
        if not table:
            return {}
        rows = connection.execute(
            """
            SELECT problem_key, title, topic, url, completed, stuck_count,
                   solution, reflection, completed_at, updated_at
            FROM problem_progress
            ORDER BY updated_at DESC
            """
        ).fetchall()
    finally:
        connection.close()
    return {
        row["problem_key"]: {
            "completed": bool(row["completed"]),
            "title": row["title"],
            "topic": row["topic"],
            "url": row["url"],
            "stuck_count": int(row["stuck_count"] or 0),
            "solution": row["solution"],
            "reflection": row["reflection"],
            "completed_at": row["completed_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    }


def neetcode_snapshot() -> dict[str, Any]:
    problems = load_problem_bank()
    progress = load_legacy_progress()
    topics: dict[str, dict[str, int]] = {}
    for problem in problems:
        topic_name = str(problem.get("topic", "Uncategorized"))
        topic = topics.setdefault(topic_name, {"total": 0, "completed": 0})
        topic["total"] += 1
        if progress.get(str(problem.get("key")), {}).get("completed"):
            topic["completed"] += 1
    completed = sum(1 for item in progress.values() if item.get("completed"))
    return {
        "problems": problems,
        "progress": progress,
        "attempts": [],
        "topics": [{"name": name, **counts} for name, counts in topics.items()],
        "summary": {
            "completed": completed,
            "total": len(problems),
            "stuck": sum(int(item.get("stuck_count", 0)) for item in progress.values()),
        },
    }
