import anyio
import httpx

from daily_dashboard.api_ai_tutor import TutorContext, build_tutor_prompt
from daily_dashboard.main import app


def tutor_context() -> dict:
    return {
        "node": {
            "id": "react",
            "label": "React",
            "labelZh": "React",
            "does": "Maps application state to a component tree.",
            "doesZh": "把应用状态映射为组件树。",
            "matters": "It provides composition and state synchronization.",
            "mattersZh": "它提供组合与状态同步能力。",
        },
        "domain": {"title": "FRONTEND", "titleZh": "前端"},
        "adjacent": [
            {"label": "Components", "labelZh": "组件"},
            {"label": "Client State", "labelZh": "客户端状态"},
        ],
        "path": {"title": "React Frontend", "titleZh": "React 前端"},
        "mode": "quiz",
    }


def test_status_is_safe_when_unconfigured(monkeypatch):
    monkeypatch.delenv("AI_TUTOR_API_KEY", raising=False)
    monkeypatch.delenv("AI_TUTOR_MODEL", raising=False)

    async def request_status():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.get("/api/v1/ai-tutor/status")

    response = anyio.run(request_status)
    assert response.status_code == 200
    assert response.json()["configured"] is False
    assert response.json()["model"] is None
    assert "API_KEY" not in str(response.json().get("api_key", ""))


def test_status_exposes_model_but_never_api_key(monkeypatch):
    monkeypatch.setenv("AI_TUTOR_API_KEY", "secret-test-key")
    monkeypatch.setenv("AI_TUTOR_MODEL", "compatible-model")

    async def request_status():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.get("/api/v1/ai-tutor/status")

    response = anyio.run(request_status)
    assert response.json()["configured"] is True
    assert response.json()["model"] == "compatible-model"
    assert "secret-test-key" not in response.text


def test_prompt_is_bounded_to_learning_context_and_quiz_mode():
    context = TutorContext.model_validate(tutor_context())
    prompt = build_tutor_prompt(context)

    assert "React 前端" in prompt
    assert "组件 (Components)" in prompt
    assert "一次只问一道题" in prompt
    assert "不调用工具" in prompt
    assert "不访问文件" in prompt


def test_chat_returns_503_before_contacting_upstream_when_unconfigured(monkeypatch):
    monkeypatch.delenv("AI_TUTOR_API_KEY", raising=False)
    monkeypatch.delenv("AI_TUTOR_MODEL", raising=False)

    async def request_chat():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.post(
                "/api/v1/ai-tutor/chat",
                json={
                    "messages": [{"role": "user", "content": "Quiz me"}],
                    "context": tutor_context(),
                },
            )

    response = anyio.run(request_chat)
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]


def test_chat_rejects_more_than_six_turn_messages(monkeypatch):
    monkeypatch.setenv("AI_TUTOR_API_KEY", "secret-test-key")
    monkeypatch.setenv("AI_TUTOR_MODEL", "compatible-model")

    async def request_chat():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.post(
                "/api/v1/ai-tutor/chat",
                json={
                    "messages": [
                        {"role": "user", "content": f"message {index}"}
                        for index in range(7)
                    ],
                    "context": tutor_context(),
                },
            )

    response = anyio.run(request_chat)
    assert response.status_code == 422
