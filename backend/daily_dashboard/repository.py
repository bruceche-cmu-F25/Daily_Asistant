"""Read models for the v2 API."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from .database import DATABASE_PATH, make_engine
from .legacy import PROBLEM_BANK_PATH, load_problem_bank, neetcode_snapshot as legacy_snapshot
from .models import ProblemAttempt


def neetcode_snapshot(
    problem_bank_path: Path = PROBLEM_BANK_PATH,
    database_path: Path = DATABASE_PATH,
) -> dict[str, Any]:
    if not Path(database_path).is_file():
        return legacy_snapshot()

    problems = load_problem_bank(problem_bank_path)
    engine = make_engine(database_path)
    try:
        with Session(engine) as session:
            attempts = session.scalars(
                select(ProblemAttempt)
                .where(ProblemAttempt.deleted_at.is_(None))
                .order_by(ProblemAttempt.created_at.desc(), ProblemAttempt.id.desc())
            ).all()
    except OperationalError:
        return legacy_snapshot()

    by_problem: dict[str, list[ProblemAttempt]] = {}
    for attempt in attempts:
        by_problem.setdefault(attempt.problem_key, []).append(attempt)

    progress: dict[str, dict[str, Any]] = {}
    for problem_key, problem_attempts in by_problem.items():
        solved = next((attempt for attempt in problem_attempts if attempt.status == "solved"), None)
        latest = problem_attempts[0]
        stuck_count = sum(
            attempt.legacy_stuck_count
            if attempt.source == "legacy-v1"
            else int(attempt.status == "stuck")
            for attempt in problem_attempts
        )
        progress[problem_key] = {
            "completed": solved is not None,
            "stuck_count": stuck_count,
            "solution": solved.solution if solved else latest.solution,
            "reflection": solved.reflection if solved else latest.reflection,
            "completed_at": solved.created_at if solved else None,
            "updated_at": latest.updated_at,
            "attempt_count": len(problem_attempts),
        }

    topics: dict[str, dict[str, int]] = {}
    for problem in problems:
        topic_name = str(problem.get("topic", "Uncategorized"))
        topic = topics.setdefault(topic_name, {"total": 0, "completed": 0})
        topic["total"] += 1
        if progress.get(str(problem.get("key")), {}).get("completed"):
            topic["completed"] += 1

    return {
        "problems": problems,
        "progress": progress,
        "topics": [{"name": name, **counts} for name, counts in topics.items()],
        "summary": {
            "completed": sum(int(item["completed"]) for item in progress.values()),
            "total": len(problems),
            "stuck": sum(int(item["stuck_count"]) for item in progress.values()),
            "attempts": len(attempts),
        },
    }
