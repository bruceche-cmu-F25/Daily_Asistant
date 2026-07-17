import sqlite3

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import migrate_legacy
from daily_dashboard.models import MigrationMarker, ProblemAttempt


def create_legacy_database(path):
    connection = sqlite3.connect(path)
    connection.execute(
        """
        CREATE TABLE problem_progress (
          problem_key TEXT PRIMARY KEY, title TEXT, topic TEXT, url TEXT,
          completed INTEGER, stuck_count INTEGER, solution TEXT, reflection TEXT,
          completed_at TEXT, updated_at TEXT
        )
        """
    )
    connection.executemany(
        "INSERT INTO problem_progress VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("leetcode:solved", "Solved", "Arrays", "https://example.com/solved", 1, 2,
             "def solved(): pass", "remember map", "2026-07-15T09:00:00-07:00", "2026-07-15T09:00:00-07:00"),
            ("leetcode:stuck", "Stuck", "Trees", "https://example.com/stuck", 0, 1,
             "# partial", "recursion", None, "2026-07-15T10:00:00-07:00"),
        ],
    )
    connection.commit()
    connection.close()


def test_migration_backs_up_imports_and_is_repeat_safe(tmp_path):
    legacy = tmp_path / "dashboard.db"
    target = tmp_path / "daily_v2.db"
    backups = tmp_path / "backups"
    create_legacy_database(legacy)

    first = migrate_legacy(legacy, target, backups)
    second = migrate_legacy(legacy, target, backups)

    assert first["already_imported"] is False
    assert first["attempts_imported"] == 2
    assert first["backup"] is not None
    assert len(list(backups.glob("*.db"))) == 1
    assert second["already_imported"] is True
    assert second["backup"] is None

    with Session(make_engine(target)) as session:
        attempts = session.scalars(select(ProblemAttempt).order_by(ProblemAttempt.id)).all()
        marker_count = session.scalar(select(func.count()).select_from(MigrationMarker))

    by_problem = {attempt.problem_key: attempt for attempt in attempts}
    assert by_problem["leetcode:solved"].status == "solved"
    assert by_problem["leetcode:solved"].solution == "def solved(): pass"
    assert by_problem["leetcode:solved"].legacy_stuck_count == 2
    assert by_problem["leetcode:stuck"].status == "stuck"
    assert by_problem["leetcode:stuck"].reflection == "recursion"
    assert marker_count == 1
