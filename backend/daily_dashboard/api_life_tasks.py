"""Local-only personal life task and timeline APIs."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .api_applications import now_iso
from .api_attempts import get_session
from .models import LifeTask


router = APIRouter(prefix="/api/v1/life-tasks", tags=["life-tasks"])
LifeCategory = Literal["personal", "home", "health", "finance", "errands", "social", "admin", "other"]
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


def task_dict(task: LifeTask) -> dict:
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


@router.get("")
def list_life_tasks(session: Session = Depends(get_session)) -> dict:
    tasks = session.scalars(
        select(LifeTask).order_by(
            LifeTask.completed.asc(),
            LifeTask.due_at.is_(None),
            LifeTask.due_at.asc(),
            LifeTask.id.desc(),
        )
    ).all()
    return {"items": [task_dict(task) for task in tasks]}


@router.post("", status_code=201)
def create_life_task(payload: LifeTaskCreate, session: Session = Depends(get_session)) -> dict:
    timestamp = now_iso()
    values = payload.model_dump()
    completed = bool(values.pop("completed"))
    task = LifeTask(
        **values,
        completed=int(completed),
        completed_at=timestamp if completed else None,
        created_at=timestamp,
        updated_at=timestamp,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return {"ok": True, "task": task_dict(task)}


@router.patch("/{task_id}")
def update_life_task(
    task_id: int,
    payload: LifeTaskUpdate,
    session: Session = Depends(get_session),
) -> dict:
    task = session.get(LifeTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Life task not found")
    values = payload.model_dump(exclude_unset=True)
    if "completed" in values:
        completed = bool(values.pop("completed"))
        task.completed = int(completed)
        task.completed_at = now_iso() if completed else None
    for field, value in values.items():
        setattr(task, field, value)
    task.updated_at = now_iso()
    session.commit()
    return {"ok": True, "task": task_dict(task)}


@router.delete("/{task_id}", status_code=204)
def delete_life_task(task_id: int, session: Session = Depends(get_session)) -> Response:
    task = session.get(LifeTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Life task not found")
    session.delete(task)
    session.commit()
    return Response(status_code=204)
