"""Application intake — the single place a JobApplication is born or advanced.

Manual entry, one-click capture from a Job Lead, and accepting an Application
Signal all converge here, so the birth defaults and the stage-advancement rule
live in one testable module. Invariant 4 (a Signal never changes an Application
without an explicit decision) stays with the caller: these functions run only
after a decision has been made.

Functions mutate the session and ``flush`` so the caller keeps transaction
control (the signal decision commits the Application and the Signal together).
They never import the web layer; ``IntakeError`` is the domain-level failure the
route translates into an HTTP response.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .application_lifecycle import stage_advances
from .models import ApplicationSignal, JobApplication


class IntakeError(ValueError):
    """A Signal cannot be materialized into an Application (e.g. unknown company)."""


def capture_from_lead(
    session: Session,
    lead: dict[str, Any],
    *,
    resume_version: str,
    now: str,
    today: dt.date,
) -> tuple[JobApplication, bool]:
    """Return the Application for a Job Lead, creating one if none matches its URL.

    The boolean is ``True`` when a new Application was created. A blank lead URL
    never matches an existing Application, so it always creates a fresh one.
    """
    url = str(lead.get("url") or "")
    existing = (
        session.scalar(select(JobApplication).where(JobApplication.job_url == url))
        if url
        else None
    )
    if existing is not None:
        return existing, False

    reasons = ", ".join(str(reason) for reason in lead.get("match_reasons", []))
    application = JobApplication(
        company=str(lead.get("company") or "Unknown company"),
        role=str(lead.get("role") or "Unknown role"),
        job_url=url,
        stage="applied",
        next_step="Follow up if there is no response",
        applied_at=today.isoformat(),
        follow_up_at=(today + dt.timedelta(days=7)).isoformat(),
        resume_version=resume_version,
        notes=f"Auto-imported from {lead.get('source', 'job feed')}. Match: {reasons}".strip(),
        created_at=now,
        updated_at=now,
    )
    session.add(application)
    session.flush()
    return application, True


def advance_from_signal(
    session: Session,
    signal: ApplicationSignal,
    *,
    now: str,
) -> JobApplication:
    """Create or advance the Application an accepted Signal refers to.

    A Signal already linked to an Application advances its stage only when the
    proposal does not regress the pipeline (see :func:`stage_advances`); a
    proposed deadline is always recorded. An unlinked Signal creates a minimal
    Application, which requires a company — otherwise :class:`IntakeError` is
    raised so the caller can ask the user to add it manually.
    """
    application = (
        session.get(JobApplication, signal.application_id) if signal.application_id else None
    )
    if application is None:
        if not signal.company:
            raise IntakeError("Company could not be inferred; dismiss and add manually")
        application = JobApplication(
            company=signal.company,
            role=signal.role_hint or "Role from Gmail",
            job_url="",
            stage=signal.suggested_stage,
            next_step=signal.suggested_next_step,
            applied_at=signal.received_at[:10] if signal.suggested_stage == "applied" else None,
            follow_up_at=None,
            deadline_at=signal.suggested_deadline_at,
            contact_name="",
            contact_type="none",
            contact_status="not_contacted",
            resume_version="",
            notes=f"Imported from Gmail: {signal.subject}",
            created_at=now,
            updated_at=now,
        )
        session.add(application)
        session.flush()
        signal.application_id = application.id
        return application

    if stage_advances(application.stage, signal.suggested_stage):
        application.stage = signal.suggested_stage
        application.next_step = signal.suggested_next_step
    if signal.suggested_deadline_at:
        application.deadline_at = signal.suggested_deadline_at
    application.updated_at = now
    return application
