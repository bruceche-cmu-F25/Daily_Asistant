"""Local-first current trip plan and itinerary API."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from .infra import get_session, now_iso
from .models import TripPlan


router = APIRouter(prefix="/api/v1/trip-plan", tags=["trip-plan"])
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
DATETIME_PATTERN = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$"


class TripStopInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=80)
    title: str = Field(min_length=1, max_length=500)
    location: str = Field(default="", max_length=1_000)
    visit_at: str | None = Field(default=None, pattern=DATETIME_PATTERN)
    notes: str = Field(default="", max_length=20_000)

    @field_validator("title", "location", "notes")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class TripPlanPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=500)
    destination: str = Field(default="", max_length=500)
    start_date: str | None = Field(default=None, pattern=DATE_PATTERN)
    end_date: str | None = Field(default=None, pattern=DATE_PATTERN)
    notes: str = Field(default="", max_length=20_000)
    stops: list[TripStopInput] = Field(default_factory=list, max_length=200)

    @field_validator("title", "destination", "notes")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self


def normalized_stops(stops: list[TripStopInput]) -> list[dict]:
    items = []
    for position, stop in enumerate(stops):
        item = stop.model_dump()
        item["id"] = item["id"] or uuid.uuid4().hex[:12]
        item["position"] = position
        items.append(item)
    return sorted(items, key=lambda item: (item["visit_at"] is None, item["visit_at"] or "", item["position"]))


def plan_dict(plan: TripPlan) -> dict:
    try:
        stops = json.loads(plan.stops_json)
    except json.JSONDecodeError:
        stops = []
    return {
        "id": plan.id,
        "title": plan.title,
        "destination": plan.destination,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
        "notes": plan.notes,
        "stops": stops if isinstance(stops, list) else [],
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


@router.get("")
def get_trip_plan(session: Session = Depends(get_session)) -> dict:
    plan = session.get(TripPlan, 1)
    return {"plan": plan_dict(plan) if plan else None}


@router.put("")
def save_trip_plan(payload: TripPlanPayload, session: Session = Depends(get_session)) -> dict:
    timestamp = now_iso()
    stops = normalized_stops(payload.stops)
    plan = session.get(TripPlan, 1)
    if plan is None:
        plan = TripPlan(id=1, created_at=timestamp, updated_at=timestamp)
        session.add(plan)
    plan.title = payload.title
    plan.destination = payload.destination
    plan.start_date = payload.start_date
    plan.end_date = payload.end_date
    plan.notes = payload.notes
    plan.stops_json = json.dumps(stops, ensure_ascii=False)
    plan.updated_at = timestamp
    session.commit()
    session.refresh(plan)
    return {"ok": True, "plan": plan_dict(plan)}


@router.delete("", status_code=204)
def delete_trip_plan(session: Session = Depends(get_session)) -> Response:
    plan = session.get(TripPlan, 1)
    if plan is not None:
        session.delete(plan)
        session.commit()
    return Response(status_code=204)
