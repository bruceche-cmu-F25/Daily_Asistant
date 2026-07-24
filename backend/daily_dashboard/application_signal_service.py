"""Persist classified recruiting email observations behind one reusable service."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .infra import now_iso
from .application_signals import EmailEnvelope, classify_email
from .models import ApplicationSignal, JobApplication, SyncState


def record_sync_error(session: Session, source: str, message: str) -> None:
    timestamp = now_iso()
    sync = session.get(SyncState, source)
    if sync is None:
        sync = SyncState(source=source)
        session.add(sync)
    sync.status = "error"
    sync.last_attempt_at = timestamp
    sync.error_message = message[:2_000]
    session.commit()


def import_email_signals(
    session: Session,
    emails: Iterable[EmailEnvelope],
    *,
    source: str,
) -> dict[str, int | bool]:
    applications = list(session.scalars(select(JobApplication)).all())
    imported = updated = skipped = filtered = 0
    timestamp = now_iso()
    for email in emails:
        existing = session.scalar(
            select(ApplicationSignal).where(ApplicationSignal.source_message_id == email.message_id)
        )
        if existing and existing.status != "pending":
            skipped += 1
            continue
        classified = classify_email(email, applications)
        if classified.confidence < 60 and classified.application_id is None:
            filtered += 1
            continue
        values = dict(
            source_message_id=email.message_id,
            source_thread_id=email.thread_id,
            sender=email.sender[:1_000],
            subject=email.subject[:2_000],
            received_at=email.received_at,
            source_url=email.source_url,
            signal_type=classified.signal_type,
            company=classified.company,
            role_hint=classified.role_hint,
            summary=classified.summary,
            suggested_stage=classified.suggested_stage,
            suggested_next_step=classified.suggested_next_step,
            suggested_deadline_at=classified.suggested_deadline_at,
            application_id=classified.application_id,
            confidence=classified.confidence,
            status="pending",
            created_at=timestamp,
            updated_at=timestamp,
        )
        if existing:
            for field, value in values.items():
                if field not in {"source_message_id", "created_at"}:
                    setattr(existing, field, value)
            updated += 1
        else:
            session.add(ApplicationSignal(**values))
            imported += 1
    sync = session.get(SyncState, source)
    if sync is None:
        sync = SyncState(source=source)
        session.add(sync)
    sync.status = "ok"
    sync.last_attempt_at = timestamp
    sync.last_success_at = timestamp
    sync.error_message = ""
    session.commit()
    return {
        "ok": True,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "filtered": filtered,
    }
