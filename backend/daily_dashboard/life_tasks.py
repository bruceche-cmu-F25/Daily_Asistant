"""Life Task validation, mutation rules and local projection."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from .models import LifeTask


LifeCategory = Literal[
    "personal",
    "home",
    "health",
    "finance",
    "errands",
    "social",
    "admin",
    "other",
]
DUE_PATTERN = r"^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$"


class LifeTaskFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=500)
    category: LifeCategory = "personal"
    due_at: str | None = Field(default=None, pattern=DUE_PATTERN)
    notes: str = Field(default="", max_length=20_000)
    completed: bool = False

    @field_validator("title")
    @classmethod
    def require_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("must not be blank")
        return title

    @field_validator("notes")
    @classmethod
    def trim_notes(cls, value: str) -> str:
        return value.strip()


class LifeTaskCreate(LifeTaskFields):
    pass


class LifeTaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=500)
    category: LifeCategory | None = None
    due_at: str | None = Field(default=None, pattern=DUE_PATTERN)
    notes: str | None = Field(default=None, max_length=20_000)
    completed: bool | None = None

    @field_validator("title")
    @classmethod
    def require_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        title = value.strip()
        if not title:
            raise ValueError("must not be blank")
        return title

    @field_validator("notes")
    @classmethod
    def trim_notes(cls, value: str | None) -> str | None:
        return None if value is None else value.strip()


def task_dict(task: LifeTask) -> dict[str, Any]:
    return {
        "id": task.id,
        "title": task.title,
        "category": task.category,
        "due_at": task.due_at,
        "notes": task.notes,
        "completed": bool(task.completed),
        "completed_at": task.completed_at,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def create_task(session: Session, fields: LifeTaskCreate, *, now: str) -> LifeTask:
    """Create a Life Task with canonical completion timestamps."""
    values = fields.model_dump()
    completed = bool(values.pop("completed"))
    task = LifeTask(
        **values,
        completed=int(completed),
        completed_at=now if completed else None,
        created_at=now,
        updated_at=now,
    )
    session.add(task)
    session.flush()
    return task


def update_task(task: LifeTask, changes: LifeTaskUpdate, *, now: str) -> LifeTask:
    """Update a Life Task and keep completed/completed_at consistent."""
    values = changes.model_dump(exclude_unset=True)
    if "completed" in values:
        completed = bool(values.pop("completed"))
        task.completed = int(completed)
        task.completed_at = now if completed else None
    for field, value in values.items():
        setattr(task, field, value)
    task.updated_at = now
    return task
