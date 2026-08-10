"""Native, domain-scoped Daily Agent with confirmation-gated writes."""

from __future__ import annotations

import json
import os
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .api_life_tasks import LifeTaskCreate, task_dict
from .infra import get_session, now_iso
from .models import AgentConfiguration, AgentDraft, AgentMessage, JobApplication, LifeTask
from .repository import neetcode_snapshot
from .snapshot import load_dashboard_snapshot


router = APIRouter(prefix="/api/v1/daily-agent", tags=["daily-agent"])
MAX_HISTORY = 20
MAX_TOOL_ROUNDS = 4


SYSTEM_PROMPT = """你是 Daily OS 里的 Daily Agent，服务于一个用户。

你负责帮助用户看清今天、生活事项、求职进度和刷题进度。中文为主，简短、直接，不做空泛鼓励。
凡是涉及当前数据的回答，必须先调用相应读取工具；不要把之前对话里的说法当作数据库事实。

安全边界：
- 读取工具可以直接运行。
- 你不能修改 Calendar、Notion、Dashboard Snapshot、求职记录、刷题记录或文件系统。
- 新建生活事项只能调用 draft_life_task。它只会生成待审批卡片，绝不会直接写入 Life。
- 调用 draft_life_task 后必须明确说“已起草，确认后才会写入”，不能说“已经添加/安排好了”。
- 不要声称拥有未注册的工具，不执行 shell，不访问任意文件或网络。

日期和时间必须使用 YYYY-MM-DD 或 YYYY-MM-DDTHH:MM。一次最多起草三个生活事项。"""


class AgentChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2_000)


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


@dataclass(frozen=True)
class ModelResponse:
    message: dict[str, Any]
    usage: dict[str, int | None]


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


def draft_dict(draft: AgentDraft) -> dict[str, Any]:
    return {
        "id": draft.id,
        "message_id": draft.message_id,
        "kind": draft.kind,
        "payload": json.loads(draft.payload_json),
        "summary": draft.summary,
        "status": draft.status,
        "created_at": draft.created_at,
        "resolved_at": draft.resolved_at,
    }


def message_dict(message: AgentMessage, drafts: list[AgentDraft] | None = None) -> dict[str, Any]:
    trace = json.loads(message.trace_json or "{}")
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "tool_calls": json.loads(message.tool_calls_json),
        "trace": trace or None,
        "created_at": message.created_at,
        "drafts": [draft_dict(draft) for draft in (drafts or [])],
    }


def conversation_history(session: Session) -> list[dict[str, Any]]:
    messages = session.scalars(select(AgentMessage).order_by(AgentMessage.id.asc())).all()
    drafts = session.scalars(select(AgentDraft).order_by(AgentDraft.id.asc())).all()
    by_message: dict[int, list[AgentDraft]] = {}
    for draft in drafts:
        by_message.setdefault(draft.message_id, []).append(draft)
    return [message_dict(message, by_message.get(message.id, [])) for message in messages]


def _tools() -> list[dict[str, Any]]:
    category = ["personal", "home", "health", "finance", "errands", "social", "admin", "other"]
    return [
        {
            "type": "function",
            "function": {
                "name": "get_today",
                "description": "Read today's Dashboard snapshot: date, events, Notion/weekly tasks, freshness and metrics.",
                "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_life_tasks",
                "description": "List current local Life tasks, ordered with open and due items first.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "include_completed": {
                            "type": "boolean",
                            "description": "Include completed Life tasks. Defaults to false.",
                        }
                    },
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_applications",
                "description": "List job applications with stage, next step, follow-up and deadline.",
                "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_neetcode_progress",
                "description": "Read NeetCode progress summary and recent attempts.",
                "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "draft_life_task",
                "description": "Draft one local Life task. This does not create it; the user must approve the card.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Concrete task title."},
                        "category": {"type": "string", "enum": category},
                        "due_at": {
                            "type": ["string", "null"],
                            "description": "YYYY-MM-DD or YYYY-MM-DDTHH:MM, or null for someday.",
                        },
                        "notes": {"type": "string"},
                    },
                    "required": ["title", "category", "due_at", "notes"],
                    "additionalProperties": False,
                },
            },
        },
    ]


def _application_summary(application: JobApplication) -> dict[str, Any]:
    return {
        "id": application.id,
        "company": application.company,
        "role": application.role,
        "stage": application.stage,
        "next_step": application.next_step,
        "follow_up_at": application.follow_up_at,
        "deadline_at": application.deadline_at,
        "contact_status": application.contact_status,
    }


def _execute_tool(
    name: str,
    arguments: dict[str, Any],
    session: Session,
    assistant_id: int,
) -> tuple[str, AgentDraft | None]:
    if name == "get_today":
        snapshot = load_dashboard_snapshot()
        result = {
            "date": snapshot.get("date"),
            "generated_at": snapshot.get("generated_at"),
            "stale_sources": snapshot.get("stale_sources", []),
            "metrics": snapshot.get("metrics", {}),
            "events": snapshot.get("events", [])[:30],
            "weekly": snapshot.get("weekly", [])[:30],
            "notion": snapshot.get("notion", [])[:30],
        }
        return json.dumps(result, ensure_ascii=False), None

    if name == "list_life_tasks":
        query = select(LifeTask).order_by(
            LifeTask.completed.asc(),
            LifeTask.due_at.is_(None),
            LifeTask.due_at.asc(),
            LifeTask.id.desc(),
        )
        if not bool(arguments.get("include_completed", False)):
            query = query.where(LifeTask.completed == 0)
        tasks = session.scalars(query.limit(40)).all()
        return json.dumps([task_dict(task) for task in tasks], ensure_ascii=False), None

    if name == "list_applications":
        applications = session.scalars(
            select(JobApplication).order_by(
                JobApplication.follow_up_at.is_(None),
                JobApplication.follow_up_at.asc(),
                JobApplication.id.desc(),
            ).limit(40)
        ).all()
        return json.dumps(
            [_application_summary(application) for application in applications],
            ensure_ascii=False,
        ), None

    if name == "get_neetcode_progress":
        progress = neetcode_snapshot()
        result = {
            "summary": progress.get("summary", {}),
            "topics": progress.get("topics", []),
            "recent_attempts": progress.get("attempts", [])[-12:],
        }
        return json.dumps(result, ensure_ascii=False), None

    if name == "draft_life_task":
        try:
            payload = LifeTaskCreate.model_validate(arguments).model_dump()
        except ValidationError as error:
            return f"Draft rejected by validation: {error.errors(include_url=False)}", None
        draft = AgentDraft(
            message_id=assistant_id,
            kind="life_task",
            payload_json=json.dumps(payload, ensure_ascii=False, sort_keys=True),
            summary=payload["title"],
            status="pending",
            created_at=now_iso(),
            resolved_at=None,
        )
        session.add(draft)
        session.commit()
        session.refresh(draft)
        return (
            f"Draft #{draft.id} created. It is NOT in Life yet and requires explicit approval.",
            draft,
        )

    return f"Unknown tool: {name}", None


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


def _usage_int(usage: dict[str, Any], *paths: tuple[str, ...]) -> int | None:
    for path in paths:
        value: Any = usage
        for key in path:
            if not isinstance(value, dict):
                value = None
                break
            value = value.get(key)
        if isinstance(value, int) and not isinstance(value, bool):
            return value
    return None


def _normalize_usage(raw_usage: Any) -> dict[str, int | None]:
    usage = raw_usage if isinstance(raw_usage, dict) else {}
    prompt_tokens = _usage_int(usage, ("prompt_tokens",), ("input_tokens",))
    completion_tokens = _usage_int(usage, ("completion_tokens",), ("output_tokens",))
    total_tokens = _usage_int(usage, ("total_tokens",))
    if total_tokens is None and prompt_tokens is not None and completion_tokens is not None:
        total_tokens = prompt_tokens + completion_tokens
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "cached_tokens": _usage_int(
            usage,
            ("prompt_tokens_details", "cached_tokens"),
            ("input_tokens_details", "cached_tokens"),
            ("cache_read_input_tokens",),
        ),
    }


def _sum_round_usage(rounds: list[dict[str, Any]], key: str) -> int | None:
    values = [item[key] for item in rounds if isinstance(item.get(key), int)]
    return sum(values) if values else None


def _trace_payload(
    *,
    settings: AgentSettings,
    status: str,
    started_at: str,
    started_timer: float,
    rounds: list[dict[str, Any]],
    tool_calls: int,
    error_type: str | None = None,
) -> dict[str, Any]:
    trace: dict[str, Any] = {
        "status": status,
        "model": settings.model,
        "started_at": started_at,
        "completed_at": now_iso(),
        "duration_ms": max(0, round((time.perf_counter() - started_timer) * 1_000)),
        "model_calls": len(rounds),
        "prompt_tokens": _sum_round_usage(rounds, "prompt_tokens"),
        "completion_tokens": _sum_round_usage(rounds, "completion_tokens"),
        "total_tokens": _sum_round_usage(rounds, "total_tokens"),
        "cached_tokens": _sum_round_usage(rounds, "cached_tokens"),
        "tool_calls": tool_calls,
        "rounds": rounds,
    }
    if error_type:
        trace["error_type"] = error_type
    return trace


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


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = [part.get("text", "") for part in content if isinstance(part, dict)]
        return "".join(parts).strip()
    return ""


def _sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _run_turn(
    request: AgentChatRequest,
    session: Session,
    settings: AgentSettings,
) -> AsyncIterator[str]:
    prior = session.scalars(
        select(AgentMessage).order_by(AgentMessage.id.desc()).limit(MAX_HISTORY)
    ).all()
    prior.reverse()
    user = AgentMessage(
        role="user",
        content=request.message.strip(),
        tool_calls_json="[]",
        trace_json="{}",
        created_at=now_iso(),
    )
    trace_started_at = now_iso()
    trace_started_timer = time.perf_counter()
    assistant = AgentMessage(
        role="assistant",
        content="",
        tool_calls_json="[]",
        trace_json="{}",
        created_at=trace_started_at,
    )
    session.add_all([user, assistant])
    session.commit()
    session.refresh(user)
    session.refresh(assistant)

    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(
        {"role": item.role, "content": item.content}
        for item in prior
        if item.content.strip()
    )
    messages.append({"role": "user", "content": user.content})
    used: list[dict[str, Any]] = []
    made: list[AgentDraft] = []
    trace_rounds: list[dict[str, Any]] = []
    reply = ""
    yield _sse("started", {"model": settings.model, "started_at": trace_started_at})

    try:
        for round_index in range(1, MAX_TOOL_ROUNDS + 1):
            round_started_at = now_iso()
            round_started_timer = time.perf_counter()
            try:
                raw_response = await _call_model(settings, messages)
            except (httpx.HTTPError, ValueError):
                trace_rounds.append(
                    {
                        "round": round_index,
                        "status": "failed",
                        "started_at": round_started_at,
                        "completed_at": now_iso(),
                        "duration_ms": max(
                            0, round((time.perf_counter() - round_started_timer) * 1_000)
                        ),
                        **_normalize_usage(None),
                        "tools": [],
                    }
                )
                raise
            if isinstance(raw_response, ModelResponse):
                model_message = raw_response.message
                usage = raw_response.usage
            else:
                # Keeps local test doubles and older integrations compatible.
                model_message = raw_response
                usage = _normalize_usage(None)
            tool_calls = model_message.get("tool_calls") or []
            names = [
                str(call.get("function", {}).get("name", "unknown")) for call in tool_calls
            ]
            trace_rounds.append(
                {
                    "round": round_index,
                    "status": "completed",
                    "started_at": round_started_at,
                    "completed_at": now_iso(),
                    "duration_ms": max(
                        0, round((time.perf_counter() - round_started_timer) * 1_000)
                    ),
                    **usage,
                    "tools": names,
                }
            )
            text = _content_text(model_message.get("content"))
            if not tool_calls:
                reply = text
                break

            messages.append(
                {
                    "role": "assistant",
                    "content": model_message.get("content"),
                    "tool_calls": tool_calls,
                }
            )
            yield _sse("tools", {"names": names})
            for index, call in enumerate(tool_calls):
                function = call.get("function", {})
                name = str(function.get("name", ""))
                if index >= 3:
                    result, draft, arguments = (
                        "Tool batch limit exceeded; this call was not run.",
                        None,
                        {},
                    )
                elif name == "draft_life_task" and len(made) >= 3:
                    result, draft, arguments = (
                        "Draft limit reached; this call was not run.",
                        None,
                        {},
                    )
                else:
                    try:
                        arguments = json.loads(function.get("arguments") or "{}")
                        if not isinstance(arguments, dict):
                            raise ValueError("arguments must be an object")
                    except (json.JSONDecodeError, ValueError) as error:
                        result, draft = f"Invalid tool arguments: {error}", None
                        arguments = {}
                    else:
                        result, draft = _execute_tool(name, arguments, session, assistant.id)
                used.append({"name": name, "arguments": arguments, "result": result[:1_500]})
                if draft is not None:
                    made.append(draft)
                    yield _sse("draft", {"draft": draft_dict(draft)})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": str(call.get("id", "")),
                        "content": result,
                    }
                )
            yield _sse("tools", {"names": []})
        else:
            reply = "我为这次操作调用了太多工具，已安全停止；没有未经确认的写入。"
    except (httpx.HTTPError, ValueError) as error:
        reply = f"Daily Agent 暂时无法完成这次请求：{error.__class__.__name__}。"
        assistant.content = reply
        assistant.tool_calls_json = json.dumps(used, ensure_ascii=False)
        assistant.trace_json = json.dumps(
            _trace_payload(
                settings=settings,
                status="failed",
                started_at=trace_started_at,
                started_timer=trace_started_timer,
                rounds=trace_rounds,
                tool_calls=len(used),
                error_type=error.__class__.__name__,
            ),
            ensure_ascii=False,
        )
        session.commit()
        yield _sse("error", {"error": reply})
        return

    if not reply:
        reply = "已起草，确认卡片后才会写入 Life。" if made else "这次没有得到可用结果，请换一种说法。"
    assistant.content = reply
    assistant.tool_calls_json = json.dumps(used, ensure_ascii=False)
    assistant.trace_json = json.dumps(
        _trace_payload(
            settings=settings,
            status="completed",
            started_at=trace_started_at,
            started_timer=trace_started_timer,
            rounds=trace_rounds,
            tool_calls=len(used),
        ),
        ensure_ascii=False,
    )
    session.commit()
    session.refresh(assistant)
    current_drafts = session.scalars(
        select(AgentDraft).where(AgentDraft.message_id == assistant.id).order_by(AgentDraft.id)
    ).all()
    yield _sse("text", {"text": reply})
    yield _sse("done", {"message": message_dict(assistant, current_drafts)})


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


@router.get("/history")
def daily_agent_history(session: Session = Depends(get_session)) -> dict[str, Any]:
    return {"messages": conversation_history(session)}


@router.delete("/history", status_code=204)
def clear_daily_agent_history(session: Session = Depends(get_session)) -> None:
    session.execute(delete(AgentDraft))
    session.execute(delete(AgentMessage))
    session.commit()


@router.post("/chat/stream")
def daily_agent_chat(
    request: AgentChatRequest,
    session: Session = Depends(get_session),
) -> StreamingResponse:
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

    payload = LifeTaskCreate.model_validate(json.loads(draft.payload_json)).model_dump()
    completed = bool(payload.pop("completed"))
    timestamp = now_iso()
    task = LifeTask(
        **payload,
        completed=int(completed),
        completed_at=timestamp if completed else None,
        created_at=timestamp,
        updated_at=timestamp,
    )
    session.add(task)
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
