"""Problem workspace and attempt APIs."""

from __future__ import annotations

import datetime as dt
from collections.abc import Generator
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import make_engine
from .models import ProblemAttempt, ProblemDraft


router = APIRouter(prefix="/api/v1", tags=["attempts"])


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def get_session() -> Generator[Session, None, None]:
    with Session(make_engine()) as session:
        yield session


class DraftPayload(BaseModel):
    language: str = Field(default="python", min_length=1, max_length=40)
    solution: str = Field(default="", max_length=30_000)
    reflection: str = Field(default="", max_length=10_000)


class AttemptPayload(DraftPayload):
    status: Literal["draft", "stuck", "solved"]

    @model_validator(mode="after")
    def validate_solved_solution(self):
        if self.status == "solved" and not self.solution.strip():
            raise ValueError("solution is required when status is solved")
        return self


class AttemptUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["draft", "stuck", "solved"] | None = None
    language: str | None = Field(default=None, min_length=1, max_length=40)
    solution: str | None = Field(default=None, max_length=30_000)
    reflection: str | None = Field(default=None, max_length=10_000)


def attempt_dict(attempt: ProblemAttempt) -> dict:
    return {
        "id": attempt.id,
        "problem_key": attempt.problem_key,
        "status": attempt.status,
        "language": attempt.language,
        "solution": attempt.solution,
        "reflection": attempt.reflection,
        "source": attempt.source,
        "created_at": attempt.created_at,
        "updated_at": attempt.updated_at,
        "deleted_at": attempt.deleted_at,
    }


@router.get("/problems/{problem_key:path}/workspace")
def get_workspace(problem_key: str, session: Session = Depends(get_session)) -> dict:
    draft = session.get(ProblemDraft, problem_key)
    attempts = session.scalars(
        select(ProblemAttempt)
        .where(ProblemAttempt.problem_key == problem_key, ProblemAttempt.deleted_at.is_(None))
        .order_by(ProblemAttempt.created_at.desc(), ProblemAttempt.id.desc())
    ).all()
    return {
        "draft": None if draft is None else {
            "problem_key": draft.problem_key,
            "language": draft.language,
            "solution": draft.solution,
            "reflection": draft.reflection,
            "updated_at": draft.updated_at,
        },
        "attempts": [attempt_dict(attempt) for attempt in attempts],
    }


@router.put("/problems/{problem_key:path}/draft")
def save_draft(
    problem_key: str,
    payload: DraftPayload,
    session: Session = Depends(get_session),
) -> dict:
    timestamp = now_iso()
    draft = session.get(ProblemDraft, problem_key)
    if draft is None:
        draft = ProblemDraft(problem_key=problem_key, updated_at=timestamp)
        session.add(draft)
    draft.language = payload.language
    draft.solution = payload.solution
    draft.reflection = payload.reflection
    draft.updated_at = timestamp
    session.commit()
    return {"ok": True, "updated_at": timestamp}


@router.post("/problems/{problem_key:path}/attempts", status_code=201)
def create_attempt(
    problem_key: str,
    payload: AttemptPayload,
    session: Session = Depends(get_session),
) -> dict:
    if payload.status == "solved" and not payload.solution.strip():
        raise HTTPException(status_code=422, detail="Solution is required for Solved")
    timestamp = now_iso()
    attempt = ProblemAttempt(
        problem_key=problem_key,
        status=payload.status,
        language=payload.language,
        solution=payload.solution,
        reflection=payload.reflection,
        source="native",
        legacy_stuck_count=0,
        created_at=timestamp,
        updated_at=timestamp,
    )
    session.add(attempt)
    if payload.status in {"stuck", "solved"}:
        draft = session.get(ProblemDraft, problem_key)
        if draft:
            session.delete(draft)
    session.commit()
    session.refresh(attempt)
    return {"ok": True, "attempt": attempt_dict(attempt)}


@router.patch("/attempts/{attempt_id}")
def update_attempt(
    attempt_id: int,
    payload: AttemptUpdate,
    session: Session = Depends(get_session),
) -> dict:
    attempt = session.get(ProblemAttempt, attempt_id)
    if attempt is None or attempt.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    changes = payload.model_dump(exclude_none=True)
    next_status = changes.get("status", attempt.status)
    next_solution = changes.get("solution", attempt.solution)
    if next_status == "solved" and not next_solution.strip():
        raise HTTPException(status_code=422, detail="Solution is required for Solved")
    for field, value in changes.items():
        setattr(attempt, field, value)
    attempt.updated_at = now_iso()
    session.commit()
    return {"ok": True, "attempt": attempt_dict(attempt)}


@router.delete("/attempts/{attempt_id}", status_code=204)
def delete_attempt(
    attempt_id: int,
    session: Session = Depends(get_session),
) -> Response:
    attempt = session.get(ProblemAttempt, attempt_id)
    if attempt is None or attempt.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    attempt.deleted_at = now_iso()
    attempt.updated_at = attempt.deleted_at
    session.commit()
    return Response(status_code=204)
