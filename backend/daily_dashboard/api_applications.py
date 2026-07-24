"""Local-first job application CRM APIs."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .api_attempts import get_session
from .models import JobApplication


router = APIRouter(prefix="/api/v1/applications", tags=["applications"])

ApplicationStage = Literal[
    "saved",
    "applied",
    "oa",
    "recruiter_screen",
    "interview",
    "offer",
    "rejected",
    "withdrawn",
]
ContactType = Literal["none", "alumni", "recruiter", "hiring_manager", "employee", "other"]
ContactStatus = Literal["not_contacted", "planned", "contacted", "replied"]


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


class ApplicationFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=300)
    job_url: str = Field(default="", max_length=4_000)
    stage: ApplicationStage = "saved"
    next_step: str = Field(default="", max_length=4_000)
    applied_at: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    follow_up_at: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    deadline_at: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    contact_name: str = Field(default="", max_length=200)
    contact_type: ContactType = "none"
    contact_status: ContactStatus = "not_contacted"
    resume_version: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=20_000)

    @field_validator("company", "role")
    @classmethod
    def require_non_whitespace(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("must not be blank")
        return normalized

    @field_validator("job_url", "next_step", "contact_name", "resume_version", "notes")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class ApplicationCreate(ApplicationFields):
    pass


class ApplicationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = Field(default=None, min_length=1, max_length=300)
    job_url: str | None = Field(default=None, max_length=4_000)
    stage: ApplicationStage | None = None
    next_step: str | None = Field(default=None, max_length=4_000)
    applied_at: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    follow_up_at: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    deadline_at: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    contact_name: str | None = Field(default=None, max_length=200)
    contact_type: ContactType | None = None
    contact_status: ContactStatus | None = None
    resume_version: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=20_000)

    @field_validator("company", "role")
    @classmethod
    def require_non_whitespace(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("must not be blank")
        return normalized

    @field_validator("job_url", "next_step", "contact_name", "resume_version", "notes")
    @classmethod
    def trim_text(cls, value: str | None) -> str | None:
        return None if value is None else value.strip()


def application_dict(application: JobApplication) -> dict:
    return {
        "id": application.id,
        "company": application.company,
        "role": application.role,
        "job_url": application.job_url,
        "stage": application.stage,
        "next_step": application.next_step,
        "applied_at": application.applied_at,
        "follow_up_at": application.follow_up_at,
        "deadline_at": application.deadline_at,
        "contact_name": application.contact_name,
        "contact_type": application.contact_type,
        "contact_status": application.contact_status,
        "resume_version": application.resume_version,
        "notes": application.notes,
        "created_at": application.created_at,
        "updated_at": application.updated_at,
    }


@router.get("")
def list_applications(session: Session = Depends(get_session)) -> dict:
    applications = session.scalars(
        select(JobApplication).order_by(JobApplication.updated_at.desc(), JobApplication.id.desc())
    ).all()
    return {"items": [application_dict(application) for application in applications]}


@router.post("", status_code=201)
def create_application(
    payload: ApplicationCreate,
    session: Session = Depends(get_session),
) -> dict:
    timestamp = now_iso()
    application = JobApplication(**payload.model_dump(), created_at=timestamp, updated_at=timestamp)
    session.add(application)
    session.commit()
    session.refresh(application)
    return {"ok": True, "application": application_dict(application)}


@router.patch("/{application_id}")
def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    session: Session = Depends(get_session),
) -> dict:
    application = session.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(application, field, value)
    application.updated_at = now_iso()
    session.commit()
    return {"ok": True, "application": application_dict(application)}


@router.delete("/{application_id}", status_code=204)
def delete_application(
    application_id: int,
    session: Session = Depends(get_session),
) -> Response:
    application = session.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    session.delete(application)
    session.commit()
    return Response(status_code=204)
