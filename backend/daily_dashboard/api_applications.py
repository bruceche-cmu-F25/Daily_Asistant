"""Local-first job application CRM APIs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .application_intake import (
    ApplicationCreate,
    ApplicationUpdate,
    IntakeError,
    application_dict,
    create_manual,
    update_manual,
)
from .infra import get_session, now_iso
from .models import JobApplication


router = APIRouter(prefix="/api/v1/applications", tags=["applications"])


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
    application = create_manual(session, payload, now=timestamp)
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
    try:
        update_manual(application, payload, now=now_iso())
    except IntakeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
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
