"""Local-only completion state for Calendar and Notion items."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .api_attempts import get_session
from .models import TodoState


router = APIRouter(prefix="/api/v1/todos", tags=["todos"])


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


class TodoPayload(BaseModel):
    item_key: str = Field(min_length=1, max_length=500)
    source: str = Field(min_length=1, max_length=40)
    title: str = Field(default="", max_length=2_000)
    completed: bool


def todo_dict(item: TodoState) -> dict:
    return {
        "item_key": item.item_key,
        "source": item.source,
        "title": item.title,
        "completed": bool(item.completed),
        "updated_at": item.updated_at,
    }


@router.get("")
def list_todos(session: Session = Depends(get_session)) -> dict:
    items = session.scalars(select(TodoState).order_by(TodoState.updated_at.desc())).all()
    return {"items": [todo_dict(item) for item in items]}


@router.put("/{item_key:path}")
def save_todo(
    item_key: str,
    payload: TodoPayload,
    session: Session = Depends(get_session),
) -> dict:
    if payload.item_key != item_key:
        raise HTTPException(status_code=400, detail="item_key must match the request path")
    normalized_key = item_key
    item = session.get(TodoState, normalized_key)
    if item is None:
        item = TodoState(item_key=normalized_key, source=payload.source, updated_at=now_iso())
        session.add(item)
    item.source = payload.source
    item.title = payload.title
    item.completed = int(payload.completed)
    item.updated_at = now_iso()
    session.commit()
    return {"ok": True, "item": todo_dict(item)}


@router.post("/import")
def import_todos(
    payload: list[TodoPayload],
    session: Session = Depends(get_session),
) -> dict:
    timestamp = now_iso()
    imported = 0
    for incoming in payload[:2_000]:
        item = session.get(TodoState, incoming.item_key)
        if item is None:
            item = TodoState(item_key=incoming.item_key, source=incoming.source, updated_at=timestamp)
            session.add(item)
        item.source = incoming.source
        item.title = incoming.title
        item.completed = int(incoming.completed)
        item.updated_at = timestamp
        imported += 1
    session.commit()
    return {"ok": True, "imported": imported}
