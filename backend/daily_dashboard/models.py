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


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        CheckConstraint(
            "stage IN ('saved', 'applied', 'oa', 'recruiter_screen', 'interview', 'offer', 'rejected', 'withdrawn')",
            name="ck_job_application_stage",
        ),
        CheckConstraint(
            "contact_type IN ('none', 'alumni', 'recruiter', 'hiring_manager', 'employee', 'other')",
            name="ck_job_application_contact_type",
        ),
        CheckConstraint(
            "contact_status IN ('not_contacted', 'planned', 'contacted', 'replied')",
            name="ck_job_application_contact_status",
        ),
        Index("ix_job_application_stage_follow_up", "stage", "follow_up_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(300), nullable=False)
    job_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    stage: Mapped[str] = mapped_column(String(30), nullable=False, default="saved")
    next_step: Mapped[str] = mapped_column(Text, nullable=False, default="")
    applied_at: Mapped[str | None] = mapped_column(String(10), nullable=True)
    follow_up_at: Mapped[str | None] = mapped_column(String(10), nullable=True)
    contact_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    contact_type: Mapped[str] = mapped_column(String(30), nullable=False, default="none")
    contact_status: Mapped[str] = mapped_column(String(30), nullable=False, default="not_contacted")
    resume_version: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class JobLeadDecision(Base):
    __tablename__ = "job_lead_decisions"
    __table_args__ = (
        CheckConstraint(
            "decision IN ('pending', 'skipped', 'applied')",
            name="ck_job_lead_decision",
        ),
    )

    lead_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    decision: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    application_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
