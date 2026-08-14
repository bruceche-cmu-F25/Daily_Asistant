"""Interface tests for the Life Task Module."""

from collections.abc import Iterator

import pytest
from sqlalchemy.orm import Session

from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import upgrade_database
from daily_dashboard.life_tasks import (
    LifeTaskCreate,
    LifeTaskUpdate,
    create_task,
    task_dict,
    update_task,
)


NOW = "2026-08-10T09:00:00-07:00"


@pytest.fixture
def session(tmp_path) -> Iterator[Session]:
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)
    with Session(make_engine(database)) as active:
        yield active


def test_create_task_owns_defaults_and_completion_timestamp(session):
    task = create_task(
        session,
        LifeTaskCreate(title="  Take vitamins  ", completed=True),
        now=NOW,
    )

    assert task.title == "Take vitamins"
    assert task.category == "personal"
    assert task.completed == 1
    assert task.completed_at == NOW
    assert task.created_at == NOW
    assert task_dict(task)["completed"] is True


def test_update_task_keeps_completion_fields_consistent(session):
    task = create_task(session, LifeTaskCreate(title="Take vitamins"), now=NOW)

    update_task(
        task,
        LifeTaskUpdate(completed=True, notes="  after breakfast  "),
        now="2026-08-10T10:00:00-07:00",
    )
    assert task.completed == 1
    assert task.completed_at == "2026-08-10T10:00:00-07:00"
    assert task.notes == "after breakfast"

    update_task(
        task,
        LifeTaskUpdate(completed=False),
        now="2026-08-10T11:00:00-07:00",
    )
    assert task.completed == 0
    assert task.completed_at is None
    assert task.updated_at == "2026-08-10T11:00:00-07:00"
