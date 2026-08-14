"""Native, domain-scoped Daily Agent with confirmation-gated writes."""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .agent_sessions import (
    clear_session_history,
    conversation_history,
    create_session,
    delete_session,
    draft_dict,
    list_sessions,
    message_dict,
    rename_session,
    session_dict,
    touch_session,
)
from .infra import get_session, now_iso
from .life_tasks import LifeTaskCreate, create_task, task_dict
from .agent_turns import (
    ModelResponse,
    normalize_usage as _normalize_usage,
    run_agent_turn,
    tool_definitions as _tools,
)
from .models import AgentConfiguration, AgentDraft, AgentSession


router = APIRouter(prefix="/api/v1/daily-agent", tags=["daily-agent"])


class AgentChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: int = Field(gt=0)
    message: str = Field(min_length=1, max_length=2_000)


class AgentSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="New chat", max_length=120)


class AgentSessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=120)


class AgentSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_url: str = Field(min_length=1, max_length=2_000)
    model: str = Field(min_length=1, max_length=200)
    api_key: str | None = Field(default=None, max_length=10_000)
    clear_api_key: bool = False


class AgentSettingsTest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_url: str | None = Field(default=None, min_length=1, max_length=2_000)
    model: str | None = Field(default=None, min_length=1, max_length=200)
    api_key: str | None = Field(default=None, max_length=10_000)


@dataclass(frozen=True)
class AgentSettings:
    base_url: str
    api_key: str
    model: str
    source: str
    has_saved_api_key: bool

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.model)


def _clean_base_url(value: str) -> str:
    value = value.strip().rstrip("/")
    if not value.startswith(("https://", "http://")):
        raise ValueError("Base URL must start with http:// or https://")
    return value


def _environment_settings() -> tuple[str, str, str]:
    return (
        os.environ.get(
            "DAILY_AGENT_BASE_URL",
            os.environ.get("AI_TUTOR_BASE_URL", "https://api.openai.com/v1"),
        ),
        os.environ.get("DAILY_AGENT_API_KEY", os.environ.get("AI_TUTOR_API_KEY", "")),
        os.environ.get("DAILY_AGENT_MODEL", os.environ.get("AI_TUTOR_MODEL", "")),
    )


def agent_settings(session: Session, overrides: AgentSettingsTest | None = None) -> AgentSettings:
    """Resolve UI-saved settings first, with environment variables as fallback."""

    env_base_url, env_api_key, env_model = _environment_settings()
    saved = session.get(AgentConfiguration, 1)
    base_url = saved.base_url if saved and saved.base_url.strip() else env_base_url
    api_key = saved.api_key if saved and saved.api_key.strip() else env_api_key
    model = saved.model if saved and saved.model.strip() else env_model
    if overrides is not None:
        base_url = overrides.base_url or base_url
        model = overrides.model or model
        api_key = overrides.api_key.strip() if overrides.api_key and overrides.api_key.strip() else api_key
    source = "saved" if saved else ("environment" if api_key.strip() or model.strip() else "default")
    if saved and not saved.api_key.strip() and env_api_key.strip():
        source = "saved + environment key"
    return AgentSettings(
        base_url=_clean_base_url(base_url),
        api_key=api_key.strip(),
        model=model.strip(),
        source=source,
        has_saved_api_key=bool(saved and saved.api_key.strip()),
    )


def settings_dict(settings: AgentSettings) -> dict[str, Any]:
    return {
        "base_url": settings.base_url,
        "model": settings.model,
        "has_api_key": bool(settings.api_key),
        "has_saved_api_key": settings.has_saved_api_key,
        "source": settings.source,
    }




def _model_request_body(
    settings: AgentSettings,
    messages: list[dict[str, Any]],
) -> dict[str, Any]:
    request_body: dict[str, Any] = {
        "model": settings.model,
        "messages": messages,
        "tools": _tools(),
        "tool_choice": "auto",
    }
    # GPT-5.6 Chat Completions supports function tools with effective reasoning none.
    if settings.base_url == "https://api.openai.com/v1" and settings.model.startswith("gpt-5.6"):
        request_body["reasoning_effort"] = "none"
    return request_body




async def _call_model(settings: AgentSettings, messages: list[dict[str, Any]]) -> ModelResponse:
    timeout = httpx.Timeout(connect=10.0, read=90.0, write=15.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.api_key}",
                "Content-Type": "application/json",
            },
            json=_model_request_body(settings, messages),
        )
        response.raise_for_status()
        payload = response.json()
    try:
        return ModelResponse(
            message=payload["choices"][0]["message"],
            usage=_normalize_usage(payload.get("usage")),
        )
    except (KeyError, IndexError, TypeError) as error:
        raise ValueError("Model response did not contain a message") from error


async def _test_model_connection(settings: AgentSettings) -> None:
    """Make a tiny request without ever exposing the upstream response body."""

    timeout = httpx.Timeout(connect=10.0, read=30.0, write=15.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{settings.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.model,
                "messages": [{"role": "user", "content": "Reply exactly with OK."}],
            },
        )
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload.get("choices"), list):
        raise ValueError("Model response was not OpenAI-compatible")


def _connection_error(error: Exception) -> str:
    if isinstance(error, httpx.HTTPStatusError):
        status = error.response.status_code
        if status in (401, 403):
            return "Authentication failed. Check the API key."
        if status == 404:
            return "Endpoint or model was not found. Check Base URL and model."
        if status == 429:
            return "The provider rate limit or quota was reached."
        if 400 <= status < 500:
            return "The provider rejected these settings. Check Base URL and model."
        return "The model provider is temporarily unavailable."
    if isinstance(error, (httpx.TimeoutException, httpx.ConnectError)):
        return "Could not reach the model provider. Check Base URL and network access."
    return "The provider returned an incompatible response."




def _sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _run_turn(
    request: AgentChatRequest,
    session: Session,
    settings: AgentSettings,
) -> AsyncIterator[str]:
    async for event in run_agent_turn(
        session=session,
        session_id=request.session_id,
        message=request.message,
        settings=settings,
        call_model=_call_model,
    ):
        yield _sse(event.type, event.payload)


@router.get("/settings")
def get_daily_agent_settings(
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        return settings_dict(agent_settings(session))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.put("/settings")
def save_daily_agent_settings(
    request: AgentSettingsUpdate,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        base_url = _clean_base_url(request.base_url)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    model = request.model.strip()
    if not model:
        raise HTTPException(status_code=422, detail="Model is required")

    saved = session.get(AgentConfiguration, 1)
    if saved is None:
        saved = AgentConfiguration(
            id=1,
            base_url=base_url,
            model=model,
            api_key="",
            updated_at=now_iso(),
        )
        session.add(saved)
    saved.base_url = base_url
    saved.model = model
    if request.clear_api_key:
        saved.api_key = ""
    elif request.api_key is not None and request.api_key.strip():
        saved.api_key = request.api_key.strip()
    saved.updated_at = now_iso()
    session.commit()
    return settings_dict(agent_settings(session))


@router.post("/settings/test")
async def test_daily_agent_settings(
    request: AgentSettingsTest,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    try:
        settings = agent_settings(session, request)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if not settings.configured:
        raise HTTPException(status_code=422, detail="API key and model are required")
    try:
        await _test_model_connection(settings)
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail=_connection_error(error)) from error
    return {"ok": True, "model": settings.model}


@router.get("/status")
def daily_agent_status(
    session: Session = Depends(get_session),
) -> dict[str, bool | str | None]:
    settings = agent_settings(session)
    return {
        "configured": settings.configured,
        "model": settings.model if settings.configured else None,
        "detail": (
            f"Ready · {settings.model} · {settings.source}"
            if settings.configured
            else "Open Settings to add an API key and model."
        ),
    }


@router.get("/sessions")
def daily_agent_sessions(session: Session = Depends(get_session)) -> dict[str, Any]:
    return {"sessions": [session_dict(item) for item in list_sessions(session)]}


@router.post("/sessions", status_code=201)
def create_daily_agent_session(
    request: AgentSessionCreate,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    agent_session = create_session(session, title=request.title, now=now_iso())
    session.commit()
    session.refresh(agent_session)
    return {"session": session_dict(agent_session)}


@router.patch("/sessions/{session_id}")
def rename_daily_agent_session(
    session_id: int,
    request: AgentSessionUpdate,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    agent_session = session.get(AgentSession, session_id)
    if agent_session is None:
        raise HTTPException(status_code=404, detail="Agent Session not found")
    rename_session(agent_session, title=request.title, now=now_iso())
    session.commit()
    return {"session": session_dict(agent_session)}


@router.delete("/sessions/{session_id}", status_code=204)
def delete_daily_agent_session(
    session_id: int,
    session: Session = Depends(get_session),
) -> None:
    agent_session = session.get(AgentSession, session_id)
    if agent_session is None:
        raise HTTPException(status_code=404, detail="Agent Session not found")
    delete_session(session, agent_session)
    session.commit()


@router.get("/sessions/{session_id}/history")
def daily_agent_history(
    session_id: int,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    if session.get(AgentSession, session_id) is None:
        raise HTTPException(status_code=404, detail="Agent Session not found")
    return {"messages": conversation_history(session, session_id)}


@router.delete("/sessions/{session_id}/history", status_code=204)
def clear_daily_agent_history(
    session_id: int,
    session: Session = Depends(get_session),
) -> None:
    agent_session = session.get(AgentSession, session_id)
    if agent_session is None:
        raise HTTPException(status_code=404, detail="Agent Session not found")
    clear_session_history(session, session_id)
    agent_session.updated_at = now_iso()
    session.commit()


@router.post("/chat/stream")
def daily_agent_chat(
    request: AgentChatRequest,
    session: Session = Depends(get_session),
) -> StreamingResponse:
    if session.get(AgentSession, request.session_id) is None:
        raise HTTPException(status_code=404, detail="Agent Session not found")
    settings = agent_settings(session)
    if not settings.configured:
        raise HTTPException(
            status_code=503,
            detail="Daily Agent is not configured. Open Settings to add an API key and model.",
        )
    return StreamingResponse(
        _run_turn(request, session, settings),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"},
    )


@router.post("/drafts/{draft_id}/approve")
def approve_daily_agent_draft(
    draft_id: int,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    draft = session.get(AgentDraft, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status != "pending":
        raise HTTPException(status_code=409, detail="Draft has already been resolved")
    if draft.kind != "life_task":
        raise HTTPException(status_code=400, detail="Unsupported draft kind")

    timestamp = now_iso()
    task = create_task(
        session,
        LifeTaskCreate.model_validate(json.loads(draft.payload_json)),
        now=timestamp,
    )
    draft.status = "approved"
    draft.resolved_at = timestamp
    session.commit()
    session.refresh(task)
    return {"draft": draft_dict(draft), "task": task_dict(task)}


@router.post("/drafts/{draft_id}/dismiss")
def dismiss_daily_agent_draft(
    draft_id: int,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    draft = session.get(AgentDraft, draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status != "pending":
        raise HTTPException(status_code=409, detail="Draft has already been resolved")
    draft.status = "dismissed"
    draft.resolved_at = now_iso()
    session.commit()
    return {"draft": draft_dict(draft)}
