"""Automatic daily job queue and one-click application capture."""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from .api_applications import application_dict
from .application_intake import capture_from_lead
from .infra import get_session, now_iso
from .legacy import PROJECT_ROOT
from .models import JobLeadDecision
from .snapshot import load_dashboard_snapshot


router = APIRouter(prefix="/api/v1", tags=["job-leads"])
PROFILE_PATH = PROJECT_ROOT / "data" / "candidate_profile.json"


def load_candidate_profile(path: Path = PROFILE_PATH) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def public_profile(profile: dict[str, Any]) -> dict[str, Any]:
    resume_path = Path(str(profile.get("resume_path") or ""))
    return {
        "resume_version": str(profile.get("resume_version") or "Default resume"),
        "graduation": str(profile.get("graduation") or ""),
        "location": str(profile.get("location") or ""),
        "target_roles": [str(role) for role in profile.get("target_roles", [])],
        "resume_available": resume_path.is_file(),
    }


def snapshot_leads() -> tuple[list[dict[str, Any]], str]:
    snapshot = load_dashboard_snapshot()
    leads = snapshot.get("job_leads", [])
    return (
        [item for item in leads if isinstance(item, dict) and item.get("key")],
        str(snapshot.get("job_feed_refreshed_at") or snapshot.get("generated_at") or ""),
    )


def find_lead(lead_key: str) -> dict[str, Any]:
    leads, _ = snapshot_leads()
    for lead in leads:
        if str(lead.get("key")) == lead_key:
            return lead
    raise HTTPException(status_code=404, detail="Job lead not found in the current feed")


class LeadDecisionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: Literal["pending", "skipped"]


@router.get("/job-leads")
def list_job_leads(session: Session = Depends(get_session)) -> dict[str, Any]:
    leads, refreshed_at = snapshot_leads()
    decisions = {
        item.lead_key: item
        for item in session.scalars(select(JobLeadDecision)).all()
    }
    items = []
    for lead in leads:
        decision = decisions.get(str(lead["key"]))
        items.append({
            **lead,
            "decision": decision.decision if decision else "pending",
            "application_id": decision.application_id if decision else None,
        })
    return {
        "items": items,
        "refreshed_at": refreshed_at,
        "new_count": sum(1 for item in items if item.get("is_new_today")),
    }


@router.patch("/job-leads/{lead_key}")
def update_job_lead(
    lead_key: str,
    payload: LeadDecisionUpdate,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    lead = find_lead(lead_key)
    decision = session.get(JobLeadDecision, lead_key)
    if decision is None:
        decision = JobLeadDecision(
            lead_key=lead_key,
            decision=payload.decision,
            application_id=None,
            updated_at=now_iso(),
        )
        session.add(decision)
    else:
        decision.decision = payload.decision
        if payload.decision != "applied":
            decision.application_id = None
        decision.updated_at = now_iso()
    session.commit()
    return {"ok": True, "lead": {**lead, "decision": decision.decision, "application_id": decision.application_id}}


@router.post("/job-leads/{lead_key}/applied")
def mark_job_lead_applied(
    lead_key: str,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    lead = find_lead(lead_key)
    application, _ = capture_from_lead(
        session,
        lead,
        resume_version=str(load_candidate_profile().get("resume_version") or "Default resume"),
        now=now_iso(),
        today=dt.datetime.now().astimezone().date(),
    )

    decision = session.get(JobLeadDecision, lead_key)
    if decision is None:
        decision = JobLeadDecision(lead_key=lead_key, decision="applied", updated_at=now_iso())
        session.add(decision)
    decision.decision = "applied"
    decision.application_id = application.id
    decision.updated_at = now_iso()
    session.commit()
    session.refresh(application)
    return {
        "ok": True,
        "application": application_dict(application),
        "lead": {**lead, "decision": "applied", "application_id": application.id},
    }


@router.get("/candidate-profile")
def candidate_profile() -> dict[str, Any]:
    return public_profile(load_candidate_profile())


@router.get("/candidate-profile/resume", include_in_schema=False)
def candidate_resume():
    profile = load_candidate_profile()
    resume_path = Path(str(profile.get("resume_path") or ""))
    if not resume_path.is_file():
        raise HTTPException(status_code=404, detail="Local resume is not available")
    return FileResponse(
        resume_path,
        media_type="application/pdf",
        filename=str(profile.get("resume_version") or resume_path.name),
    )
