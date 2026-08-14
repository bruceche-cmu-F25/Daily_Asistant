"""Unit tests for the Application intake Module.

These exercise the birth defaults and the stage-advancement rule directly
against a session, without going through the FastAPI layer.
"""

from __future__ import annotations

import datetime as dt
from collections.abc import Iterator

import pytest
from sqlalchemy.orm import Session

from daily_dashboard.application_intake import (
    ApplicationCreate,
    ApplicationUpdate,
    IntakeError,
    advance_from_signal,
    capture_from_lead,
    create_manual,
    stage_advances,
    update_manual,
)
from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import upgrade_database
from daily_dashboard.models import ApplicationSignal, JobApplication


NOW = "2026-07-17T10:00:00-07:00"
TODAY = dt.date(2026, 7, 17)


@pytest.fixture
def session(tmp_path) -> Iterator[Session]:
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)
    with Session(make_engine(database)) as active:
        yield active


def make_signal(session: Session, **overrides) -> ApplicationSignal:
    values = dict(
        source_message_id="gmail-1",
        received_at=NOW,
        signal_type="confirmation",
        company="Example Labs",
        role_hint="Software Engineer",
        suggested_stage="applied",
        suggested_next_step="Wait for a response.",
        suggested_deadline_at=None,
        application_id=None,
        confidence=88,
        status="pending",
        created_at=NOW,
        updated_at=NOW,
    )
    values.update(overrides)
    signal = ApplicationSignal(**values)
    session.add(signal)
    session.flush()
    return signal


def make_application(session: Session, **overrides) -> JobApplication:
    values = dict(company="Example Labs", role="Software Engineer", stage="applied")
    values.update(overrides)
    application = JobApplication(**values, created_at=NOW, updated_at=NOW)
    session.add(application)
    session.flush()
    return application


def test_stage_advances_is_monotonic_with_terminal_override():
    assert stage_advances("applied", "oa") is True
    assert stage_advances("applied", "applied") is True
    assert stage_advances("interview", "applied") is False
    assert stage_advances("interview", "rejected") is True
    assert stage_advances("offer", "withdrawn") is True


def test_manual_intake_owns_birth_defaults(session):
    application = create_manual(
        session,
        ApplicationCreate(company="  Example Labs  ", role="  Software Engineer  "),
        now=NOW,
    )

    assert application.company == "Example Labs"
    assert application.role == "Software Engineer"
    assert application.stage == "saved"
    assert application.contact_type == "none"
    assert application.contact_status == "not_contacted"
    assert application.created_at == NOW
    assert application.updated_at == NOW


def test_manual_intake_updates_fields_and_advances_stage(session):
    application = make_application(session, stage="applied", next_step="Wait")

    result = update_manual(
        application,
        ApplicationUpdate(stage="oa", next_step="Finish assessment"),
        now="2026-07-18T10:00:00-07:00",
    )

    assert result.stage == "oa"
    assert result.next_step == "Finish assessment"
    assert result.updated_at == "2026-07-18T10:00:00-07:00"


def test_manual_intake_rejects_regression_without_partial_changes(session):
    application = make_application(
        session,
        stage="interview",
        next_step="Prepare system design",
        contact_status="planned",
    )

    with pytest.raises(IntakeError, match="cannot regress from interview to applied"):
        update_manual(
            application,
            ApplicationUpdate(
                stage="applied",
                next_step="Wait for response",
                contact_status="contacted",
            ),
            now="2026-07-18T10:00:00-07:00",
        )

    assert application.stage == "interview"
    assert application.next_step == "Prepare system design"
    assert application.contact_status == "planned"
    assert application.updated_at == NOW


def test_advance_from_signal_creates_minimal_application_when_unlinked(session):
    signal = make_signal(session, suggested_stage="applied")

    application = advance_from_signal(session, signal, now=NOW)

    assert application.company == "Example Labs"
    assert application.role == "Software Engineer"
    assert application.stage == "applied"
    assert application.applied_at == "2026-07-17"
    assert signal.application_id == application.id


def test_advance_from_signal_requires_company_to_create(session):
    signal = make_signal(session, company="", application_id=None)

    with pytest.raises(IntakeError):
        advance_from_signal(session, signal, now=NOW)


def test_advance_from_signal_records_a_deadline_and_advances_stage(session):
    application = make_application(session, stage="applied")
    signal = make_signal(
        session,
        application_id=application.id,
        suggested_stage="oa",
        suggested_next_step="Finish the assessment.",
        suggested_deadline_at="2026-07-22",
    )

    result = advance_from_signal(session, signal, now=NOW)

    assert result.id == application.id
    assert result.stage == "oa"
    assert result.next_step == "Finish the assessment."
    assert result.deadline_at == "2026-07-22"


def test_advance_from_signal_never_regresses_an_advanced_application(session):
    application = make_application(session, stage="interview", next_step="Prepare system design")
    signal = make_signal(
        session,
        application_id=application.id,
        suggested_stage="applied",
        suggested_next_step="Wait for a response.",
    )

    result = advance_from_signal(session, signal, now=NOW)

    assert result.stage == "interview"
    assert result.next_step == "Prepare system design"


def test_capture_from_lead_creates_with_follow_up_seven_days_out(session):
    lead = {
        "url": "https://example.com/jobs/netic-1",
        "company": "Netic",
        "role": "Agent Software Engineer",
        "source": "SpeedyApply",
        "match_reasons": ["Bay Area", "early-career"],
    }

    application, created = capture_from_lead(
        session, lead, resume_version="resume-v3.pdf", now=NOW, today=TODAY
    )

    assert created is True
    assert application.company == "Netic"
    assert application.stage == "applied"
    assert application.applied_at == "2026-07-17"
    assert application.follow_up_at == "2026-07-24"
    assert application.resume_version == "resume-v3.pdf"
    assert "SpeedyApply" in application.notes


def test_capture_from_lead_returns_existing_match_by_url(session):
    url = "https://example.com/jobs/netic-1"
    existing = make_application(session, job_url=url, company="Netic", role="Existing")
    lead = {"url": url, "company": "Netic", "role": "Agent Software Engineer"}

    application, created = capture_from_lead(
        session, lead, resume_version="resume-v3.pdf", now=NOW, today=TODAY
    )

    assert created is False
    assert application.id == existing.id
