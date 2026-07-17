from pathlib import Path

from sqlalchemy.orm import Session

from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import upgrade_database
from daily_dashboard.models import ProblemAttempt
from daily_dashboard.repository import neetcode_snapshot


def test_v2_snapshot_keeps_solved_when_a_later_attempt_is_stuck(tmp_path):
    bank = tmp_path / "problem_bank.json"
    bank.write_text(
        '[{"key":"leetcode:one","title":"One","topic":"Arrays","difficulty":"Easy","minutes":25,"start_url":"https://example.com"}]',
        encoding="utf-8",
    )
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)
    with Session(make_engine(database)) as session:
        session.add_all([
            ProblemAttempt(
                problem_key="leetcode:one", status="solved", language="python",
                solution="return 1", reflection="", source="native", legacy_stuck_count=0,
                created_at="2026-07-15T09:00:00-07:00", updated_at="2026-07-15T09:00:00-07:00",
            ),
            ProblemAttempt(
                problem_key="leetcode:one", status="stuck", language="python",
                solution="# retry", reflection="", source="native", legacy_stuck_count=0,
                created_at="2026-07-16T09:00:00-07:00", updated_at="2026-07-16T09:00:00-07:00",
            ),
        ])
        session.commit()

    snapshot = neetcode_snapshot(bank, database)

    assert snapshot["summary"] == {"completed": 1, "total": 1, "stuck": 1, "attempts": 2}
    assert snapshot["progress"]["leetcode:one"]["completed"] is True
    assert snapshot["progress"]["leetcode:one"]["solution"] == "return 1"
    assert snapshot["progress"]["leetcode:one"]["attempt_count"] == 2
