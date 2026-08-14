"""One complete Daily Agent Turn behind a small, testable interface."""

from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .agent_sessions import draft_dict, message_dict, touch_session
from .infra import now_iso
from .life_tasks import LifeTaskCreate, task_dict
from .models import AgentDraft, AgentMessage, AgentSession, JobApplication, LifeTask
from .repository import neetcode_snapshot
from .snapshot import load_dashboard_snapshot


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


class ModelSettings(Protocol):
    model: str


@dataclass(frozen=True)
class ModelResponse:
    message: dict[str, Any]
    usage: dict[str, int | None]


@dataclass(frozen=True)
class AgentTurnEvent:
    type: str
    payload: dict[str, Any]


ModelCaller = Callable[
    [ModelSettings, list[dict[str, Any]]],
    Awaitable[ModelResponse | dict[str, Any]],
]


def tool_definitions() -> list[dict[str, Any]]:
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


def normalize_usage(raw_usage: Any) -> dict[str, int | None]:
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
    model: str,
    status: str,
    started_at: str,
    started_timer: float,
    rounds: list[dict[str, Any]],
    tool_calls: int,
    error_type: str | None = None,
) -> dict[str, Any]:
    trace: dict[str, Any] = {
        "status": status,
        "model": model,
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


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = [part.get("text", "") for part in content if isinstance(part, dict)]
        return "".join(parts).strip()
    return ""


async def run_agent_turn(
    *,
    session: Session,
    session_id: int,
    message: str,
    settings: ModelSettings,
    call_model: ModelCaller,
) -> AsyncIterator[AgentTurnEvent]:
    """Persist and run one complete Turn, yielding transport-neutral progress events."""

    agent_session = session.get(AgentSession, session_id)
    if agent_session is None:
        yield AgentTurnEvent("error", {"error": "Agent Session not found."})
        return
    prior = session.scalars(
        select(AgentMessage)
        .where(AgentMessage.session_id == agent_session.id)
        .order_by(AgentMessage.id.desc())
        .limit(MAX_HISTORY)
    ).all()
    prior.reverse()
    timestamp = now_iso()
    touch_session(agent_session, message=message, now=timestamp)
    user = AgentMessage(
        session_id=agent_session.id,
        role="user",
        content=message.strip(),
        tool_calls_json="[]",
        trace_json="{}",
        created_at=timestamp,
    )
    trace_started_at = now_iso()
    trace_started_timer = time.perf_counter()
    assistant = AgentMessage(
        session_id=agent_session.id,
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
    yield AgentTurnEvent("started", {"model": settings.model, "started_at": trace_started_at})

    try:
        for round_index in range(1, MAX_TOOL_ROUNDS + 1):
            round_started_at = now_iso()
            round_started_timer = time.perf_counter()
            try:
                raw_response = await call_model(settings, messages)
            except (httpx.HTTPError, ValueError):
                trace_rounds.append({
                    "round": round_index,
                    "status": "failed",
                    "started_at": round_started_at,
                    "completed_at": now_iso(),
                    "duration_ms": max(0, round((time.perf_counter() - round_started_timer) * 1_000)),
                    **normalize_usage(None),
                    "tools": [],
                })
                raise
            if isinstance(raw_response, ModelResponse):
                model_message = raw_response.message
                usage = raw_response.usage
            else:
                model_message = raw_response
                usage = normalize_usage(None)
            tool_calls = model_message.get("tool_calls") or []
            names = [str(call.get("function", {}).get("name", "unknown")) for call in tool_calls]
            trace_rounds.append({
                "round": round_index,
                "status": "completed",
                "started_at": round_started_at,
                "completed_at": now_iso(),
                "duration_ms": max(0, round((time.perf_counter() - round_started_timer) * 1_000)),
                **usage,
                "tools": names,
            })
            text = _content_text(model_message.get("content"))
            if not tool_calls:
                reply = text
                break

            messages.append({
                "role": "assistant",
                "content": model_message.get("content"),
                "tool_calls": tool_calls,
            })
            yield AgentTurnEvent("tools", {"names": names})
            for index, call in enumerate(tool_calls):
                function = call.get("function", {})
                name = str(function.get("name", ""))
                if index >= 3:
                    result, draft, arguments = (
                        "Tool batch limit exceeded; this call was not run.", None, {},
                    )
                elif name == "draft_life_task" and len(made) >= 3:
                    result, draft, arguments = (
                        "Draft limit reached; this call was not run.", None, {},
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
                    yield AgentTurnEvent("draft", {"draft": draft_dict(draft)})
                messages.append({
                    "role": "tool",
                    "tool_call_id": str(call.get("id", "")),
                    "content": result,
                })
            yield AgentTurnEvent("tools", {"names": []})
        else:
            reply = "我为这次操作调用了太多工具，已安全停止；没有未经确认的写入。"
    except (httpx.HTTPError, ValueError) as error:
        reply = f"Daily Agent 暂时无法完成这次请求：{error.__class__.__name__}。"
        assistant.content = reply
        assistant.tool_calls_json = json.dumps(used, ensure_ascii=False)
        assistant.trace_json = json.dumps(
            _trace_payload(
                model=settings.model,
                status="failed",
                started_at=trace_started_at,
                started_timer=trace_started_timer,
                rounds=trace_rounds,
                tool_calls=len(used),
                error_type=error.__class__.__name__,
            ),
            ensure_ascii=False,
        )
        agent_session.updated_at = now_iso()
        session.commit()
        yield AgentTurnEvent("error", {"error": reply})
        return

    if not reply:
        reply = "已起草，确认卡片后才会写入 Life。" if made else "这次没有得到可用结果，请换一种说法。"
    assistant.content = reply
    assistant.tool_calls_json = json.dumps(used, ensure_ascii=False)
    assistant.trace_json = json.dumps(
        _trace_payload(
            model=settings.model,
            status="completed",
            started_at=trace_started_at,
            started_timer=trace_started_timer,
            rounds=trace_rounds,
            tool_calls=len(used),
        ),
        ensure_ascii=False,
    )
    agent_session.updated_at = now_iso()
    session.commit()
    session.refresh(assistant)
    current_drafts = session.scalars(
        select(AgentDraft).where(AgentDraft.message_id == assistant.id).order_by(AgentDraft.id)
    ).all()
    yield AgentTurnEvent("text", {"text": reply})
    yield AgentTurnEvent("done", {"message": message_dict(assistant, current_drafts)})
