"""Local-only personal life task and timeline APIs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .infra import get_session, now_iso
from .life_tasks import (
    LifeTaskCreate,
    LifeTaskUpdate,
    create_task,
    task_dict,
    update_task,
)
from .models import LifeTask


router = APIRouter(prefix="/api/v1/life-tasks", tags=["life-tasks"])


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
    task = create_task(session, payload, now=timestamp)
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
    update_task(task, payload, now=now_iso())
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
