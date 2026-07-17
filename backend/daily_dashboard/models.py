"""Persistent v2 domain models."""

from __future__ import annotations

from sqlalchemy import CheckConstraint, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class ProblemAttempt(Base):
    __tablename__ = "problem_attempts"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'stuck', 'solved')", name="ck_attempt_status"),
        Index("ix_attempt_problem_created", "problem_key", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    problem_key: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    language: Mapped[str] = mapped_column(String(40), nullable=False, default="python")
    solution: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reflection: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="native")
    legacy_stuck_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)
    deleted_at: Mapped[str | None] = mapped_column(String(40), nullable=True)


class ProblemDraft(Base):
    __tablename__ = "problem_drafts"

    problem_key: Mapped[str] = mapped_column(String(300), primary_key=True)
    language: Mapped[str] = mapped_column(String(40), nullable=False, default="python")
    solution: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reflection: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class TodoState(Base):
    __tablename__ = "todo_states"
    __table_args__ = (
        CheckConstraint("completed IN (0, 1)", name="ck_todo_completed"),
    )

    item_key: Mapped[str] = mapped_column(String(500), primary_key=True)
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class SyncState(Base):
    __tablename__ = "sync_states"

    source: Mapped[str] = mapped_column(String(80), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="never")
    last_success_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    last_attempt_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=False, default="")


class MigrationMarker(Base):
    __tablename__ = "migration_markers"

    name: Mapped[str] = mapped_column(String(120), primary_key=True)
    applied_at: Mapped[str] = mapped_column(String(40), nullable=False)
    detail_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
