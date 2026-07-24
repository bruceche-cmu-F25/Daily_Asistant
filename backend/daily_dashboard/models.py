"""Persistent v2 domain models."""

from __future__ import annotations

from sqlalchemy import CheckConstraint, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .application_lifecycle import CONTACT_STATUSES, CONTACT_TYPES, STAGES, sql_check
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


class LifeTask(Base):
    """A user-authored personal task, isolated from external daily sources."""

    __tablename__ = "life_tasks"
    __table_args__ = (
        CheckConstraint("completed IN (0, 1)", name="ck_life_task_completed"),
        CheckConstraint(
            "category IN ('personal', 'home', 'health', 'finance', 'errands', 'social', 'admin', 'other')",
            name="ck_life_task_category",
        ),
        Index("ix_life_task_completed_due", "completed", "due_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False, default="personal")
    due_at: Mapped[str | None] = mapped_column(String(16), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class TripPlan(Base):
    """The single current trip plan, including its ordered itinerary as JSON."""

    __tablename__ = "trip_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    destination: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    start_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    end_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    stops_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        CheckConstraint(sql_check("stage", STAGES), name="ck_job_application_stage"),
        CheckConstraint(sql_check("contact_type", CONTACT_TYPES), name="ck_job_application_contact_type"),
        CheckConstraint(sql_check("contact_status", CONTACT_STATUSES), name="ck_job_application_contact_status"),
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
    deadline_at: Mapped[str | None] = mapped_column(String(10), nullable=True)
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


class ApplicationSignal(Base):
    """A read-only email observation awaiting an explicit CRM decision."""

    __tablename__ = "application_signals"
    __table_args__ = (
        CheckConstraint(
            "signal_type IN ('confirmation', 'oa', 'recruiter', 'interview', 'offer', 'rejection', 'status_update')",
            name="ck_application_signal_type",
        ),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'dismissed')",
            name="ck_application_signal_status",
        ),
        Index("ix_application_signal_status_received", "status", "received_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_message_id: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    source_thread_id: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    sender: Mapped[str] = mapped_column(Text, nullable=False, default="")
    subject: Mapped[str] = mapped_column(Text, nullable=False, default="")
    received_at: Mapped[str] = mapped_column(String(40), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    signal_type: Mapped[str] = mapped_column(String(30), nullable=False)
    company: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    role_hint: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    suggested_stage: Mapped[str] = mapped_column(String(30), nullable=False)
    suggested_next_step: Mapped[str] = mapped_column(Text, nullable=False, default="")
    suggested_deadline_at: Mapped[str | None] = mapped_column(String(10), nullable=True)
    application_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
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
