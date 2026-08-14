"""Agent Session lifecycle and isolated conversation history."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .models import AgentDraft, AgentMessage, AgentSession


DEFAULT_TITLE = "New chat"


def session_dict(agent_session: AgentSession) -> dict[str, Any]:
    return {
        "id": agent_session.id,
        "title": agent_session.title,
        "created_at": agent_session.created_at,
        "updated_at": agent_session.updated_at,
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
        "session_id": message.session_id,
        "role": message.role,
        "content": message.content,
        "tool_calls": json.loads(message.tool_calls_json),
        "trace": trace or None,
        "created_at": message.created_at,
        "drafts": [draft_dict(draft) for draft in (drafts or [])],
    }


def create_session(session: Session, *, title: str = DEFAULT_TITLE, now: str) -> AgentSession:
    agent_session = AgentSession(
        title=title.strip()[:120] or DEFAULT_TITLE,
        created_at=now,
        updated_at=now,
    )
    session.add(agent_session)
    session.flush()
    return agent_session


def list_sessions(session: Session) -> list[AgentSession]:
    return list(
        session.scalars(
            select(AgentSession).order_by(AgentSession.updated_at.desc(), AgentSession.id.desc())
        ).all()
    )


def rename_session(agent_session: AgentSession, *, title: str, now: str) -> AgentSession:
    agent_session.title = title.strip()[:120] or DEFAULT_TITLE
    agent_session.updated_at = now
    return agent_session


def title_from_message(message: str) -> str:
    compact = " ".join(message.split())
    return compact[:48] + ("…" if len(compact) > 48 else "") or DEFAULT_TITLE


def touch_session(agent_session: AgentSession, *, message: str, now: str) -> None:
    if agent_session.title == DEFAULT_TITLE:
        agent_session.title = title_from_message(message)
    agent_session.updated_at = now


def conversation_history(session: Session, session_id: int) -> list[dict[str, Any]]:
    messages = session.scalars(
        select(AgentMessage)
        .where(AgentMessage.session_id == session_id)
        .order_by(AgentMessage.id.asc())
    ).all()
    message_ids = [message.id for message in messages]
    drafts = (
        session.scalars(
            select(AgentDraft)
            .where(AgentDraft.message_id.in_(message_ids))
            .order_by(AgentDraft.id.asc())
        ).all()
        if message_ids
        else []
    )
    by_message: dict[int, list[AgentDraft]] = {}
    for draft in drafts:
        by_message.setdefault(draft.message_id, []).append(draft)
    return [message_dict(message, by_message.get(message.id, [])) for message in messages]


def clear_session_history(session: Session, session_id: int) -> None:
    message_ids = select(AgentMessage.id).where(AgentMessage.session_id == session_id)
    session.execute(delete(AgentDraft).where(AgentDraft.message_id.in_(message_ids)))
    session.execute(delete(AgentMessage).where(AgentMessage.session_id == session_id))


def delete_session(session: Session, agent_session: AgentSession) -> None:
    clear_session_history(session, agent_session.id)
    session.delete(agent_session)
