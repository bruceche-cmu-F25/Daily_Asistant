"""Narrow, text-only adapter for the Learning Map AI Tutor."""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


router = APIRouter(prefix="/api/v1/ai-tutor", tags=["ai-tutor"])


class TutorMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2_000)


class TutorNode(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=160)
    labelZh: str = Field(min_length=1, max_length=160)
    does: str = Field(min_length=1, max_length=1_000)
    doesZh: str = Field(min_length=1, max_length=1_000)
    matters: str = Field(min_length=1, max_length=1_000)
    mattersZh: str = Field(min_length=1, max_length=1_000)


class TutorLabel(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    titleZh: str = Field(min_length=1, max_length=160)


class TutorAdjacent(BaseModel):
    label: str = Field(min_length=1, max_length=160)
    labelZh: str = Field(min_length=1, max_length=160)


class TutorContext(BaseModel):
    node: TutorNode
    domain: TutorLabel
    adjacent: list[TutorAdjacent] = Field(default_factory=list, max_length=12)
    path: TutorLabel | None = None
    mode: Literal["explain", "example", "quiz", "question"]


class TutorRequest(BaseModel):
    messages: list[TutorMessage] = Field(min_length=1, max_length=6)
    context: TutorContext


def tutor_settings() -> tuple[str, str, str]:
    """Read configuration per request so local env changes are easy to test."""

    return (
        os.environ.get("AI_TUTOR_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        os.environ.get("AI_TUTOR_API_KEY", "").strip(),
        os.environ.get("AI_TUTOR_MODEL", "").strip(),
    )


def build_tutor_prompt(context: TutorContext) -> str:
    """Build bounded context without granting tools, files, or broader app state."""

    adjacent = "、".join(
        f"{item.labelZh} ({item.label})" for item in context.adjacent
    ) or "无"
    path = (
        f"{context.path.titleZh} ({context.path.title})"
        if context.path
        else "自由探索 / Whole system"
    )
    mode_rules = {
        "explain": "先给直观心智模型，再解释精确定义与边界。",
        "example": "给一个具体、可追踪的例子，明确输入、过程、输出和失败情况。",
        "quiz": "一次只问一道题，不要透露答案；等学习者回答后再反馈并继续。",
        "question": "直接回答问题；必要时指出它和当前节点的关系。",
    }
    return f"""你是 Daily Learning Map 的受限 AI Tutor。
只辅导当前知识节点，不调用工具，不访问文件，不声称看过用户项目，也不执行任何操作。
中文为主，保留关键 English terms 和一条简短 English definition。默认控制在约 300–500 个中文字符。
如果问题明显离开当前节点及其相邻概念，简短说明边界，并把讨论带回相关知识。

当前节点：{context.node.labelZh} ({context.node.label})
所属领域：{context.domain.titleZh} ({context.domain.title})
学习路线：{path}
作用：{context.node.doesZh}
English definition: {context.node.does}
重要性：{context.node.mattersZh}
相邻概念：{adjacent}
本次模式：{context.mode}
模式要求：{mode_rules[context.mode]}"""


@router.get("/status")
def ai_tutor_status() -> dict[str, bool | str | None]:
    _, api_key, model = tutor_settings()
    configured = bool(api_key and model)
    return {
        "configured": configured,
        "model": model if configured else None,
        "detail": (
            f"Ready · {model}"
            if configured
            else "Set AI_TUTOR_API_KEY and AI_TUTOR_MODEL in the backend environment."
        ),
    }


async def stream_tutor(request: TutorRequest) -> AsyncIterator[str]:
    base_url, api_key, model = tutor_settings()
    upstream_messages = [
        {"role": "system", "content": build_tutor_prompt(request.context)},
        *[message.model_dump() for message in request.messages],
    ]
    payload = {
        "model": model,
        "messages": upstream_messages,
        "stream": True,
        "temperature": 0.35,
    }
    timeout = httpx.Timeout(connect=10.0, read=90.0, write=15.0, pool=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode("utf-8", errors="replace")
                    detail = body[:500] or f"Upstream returned {response.status_code}"
                    yield f"data: {json.dumps({'error': detail}, ensure_ascii=False)}\n\n"
                    return

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data:
                        continue
                    if data == "[DONE]":
                        yield "data: [DONE]\n\n"
                        return
                    try:
                        event = json.loads(data)
                        text = event["choices"][0]["delta"].get("content")
                    except (KeyError, IndexError, TypeError, json.JSONDecodeError):
                        text = None
                    if text:
                        yield (
                            f"data: {json.dumps({'text': text}, ensure_ascii=False)}\n\n"
                        )
    except httpx.HTTPError as error:
        yield (
            "data: "
            + json.dumps(
                {"error": f"AI Tutor upstream connection failed: {error.__class__.__name__}"},
                ensure_ascii=False,
            )
            + "\n\n"
        )


@router.post("/chat")
async def ai_tutor_chat(request: TutorRequest) -> StreamingResponse:
    _, api_key, model = tutor_settings()
    if not api_key or not model:
        raise HTTPException(
            status_code=503,
            detail="AI Tutor is not configured. Set AI_TUTOR_API_KEY and AI_TUTOR_MODEL.",
        )
    return StreamingResponse(
        stream_tutor(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store",
            "X-Accel-Buffering": "no",
        },
    )
