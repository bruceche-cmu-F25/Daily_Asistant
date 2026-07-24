"""Read-only Gmail adapters and confirmation-gated CRM updates."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .api_applications import application_dict
from .application_intake import IntakeError, advance_from_signal
from .infra import get_session, now_iso
from .application_signal_service import import_email_signals
from .application_signals import EmailEnvelope
from .gmail_adapter import gmail_configured
from .models import ApplicationSignal, SyncState


router = APIRouter(prefix="/api/v1/application-signals", tags=["application-signals"])


class EmailImport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: str = Field(min_length=1, max_length=200)
    thread_id: str = Field(default="", max_length=200)
    sender: str = Field(default="", max_length=1_000)
    subject: str = Field(min_length=1, max_length=2_000)
    snippet: str = Field(default="", max_length=5_000)
    body: str = Field(default="", max_length=100_000)
    received_at: str = Field(min_length=1, max_length=40)
    source_url: str = Field(default="", max_length=4_000)


class SignalImport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    emails: list[EmailImport] = Field(max_length=100)


class SignalDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["accepted", "dismissed"]


def signal_dict(signal: ApplicationSignal) -> dict:
    return {
        "id": signal.id,
        "source_message_id": signal.source_message_id,
        "sender": signal.sender,
        "subject": signal.subject,
        "received_at": signal.received_at,
        "source_url": signal.source_url,
        "signal_type": signal.signal_type,
        "company": signal.company,
        "role_hint": signal.role_hint,
        "summary": signal.summary,
        "suggested_stage": signal.suggested_stage,
        "suggested_next_step": signal.suggested_next_step,
        "suggested_deadline_at": signal.suggested_deadline_at,
        "application_id": signal.application_id,
        "confidence": signal.confidence,
        "status": signal.status,
        "created_at": signal.created_at,
        "updated_at": signal.updated_at,
    }


@router.get("")
def list_signals(session: Session = Depends(get_session)) -> dict:
    signals = session.scalars(
        select(ApplicationSignal)
        .where(ApplicationSignal.status == "pending")
        .order_by(ApplicationSignal.received_at.desc(), ApplicationSignal.id.desc())
    ).all()
    automatic = gmail_configured()
    source = "gmail-api" if automatic else "gmail-agent-bridge"
    sync = session.get(SyncState, source)
    return {
        "items": [signal_dict(signal) for signal in signals],
        "connection": {
            "adapter": "gmail_api" if automatic else "codex_gmail_bridge",
            "automatic": automatic,
            "last_import_at": sync.last_success_at if sync else None,
            "status": sync.status if sync else "not_connected",
            "detail": (
                sync.error_message if sync and sync.status == "error"
                else "Gmail read-only sync runs with the 09:00 refresh."
                if automatic else "Codex can import Gmail read-only; local OAuth is not connected yet."
            ),
        },
    }


@router.post("/import")
def import_signals(payload: SignalImport, session: Session = Depends(get_session)) -> dict:
    emails = [EmailEnvelope(**item.model_dump()) for item in payload.emails]
    return import_email_signals(session, emails, source="gmail-agent-bridge")


@router.post("/{signal_id}/decision")
def decide_signal(
    signal_id: int,
    payload: SignalDecision,
    session: Session = Depends(get_session),
) -> dict:
    signal = session.get(ApplicationSignal, signal_id)
    if signal is None:
        raise HTTPException(status_code=404, detail="Application signal not found")
    if signal.status != "pending":
        return {"ok": True, "signal": signal_dict(signal), "application": None}
    timestamp = now_iso()
    application = None
    if payload.decision == "accepted":
        try:
            application = advance_from_signal(session, signal, now=timestamp)
        except IntakeError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
    signal.status = payload.decision
    signal.updated_at = timestamp
    session.commit()
    if application:
        session.refresh(application)
    return {
        "ok": True,
        "signal": signal_dict(signal),
        "application": application_dict(application) if application else None,
    }
