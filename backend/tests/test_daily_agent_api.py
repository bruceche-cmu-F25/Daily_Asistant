import json

import anyio
import httpx
from sqlalchemy.orm import Session

from daily_dashboard import api_daily_agent
from daily_dashboard.api_daily_agent import get_session
from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import upgrade_database
from daily_dashboard.main import app


def request(method, path, json_body=None):
    async def run_request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, json=json_body)

    return anyio.run(run_request)


def test_daily_agent_drafts_before_approval_and_only_lands_once(tmp_path, monkeypatch):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    calls = 0

    async def fake_model(_settings, messages):
        nonlocal calls
        calls += 1
        if calls == 1:
            return api_daily_agent.ModelResponse(
                message={
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": "call-draft-1",
                        "type": "function",
                        "function": {
                            "name": "draft_life_task",
                            "arguments": json.dumps({
                                "title": "Book dentist",
                                "category": "health",
                                "due_at": "2026-08-12T09:30",
                                "notes": "Bring insurance card",
                            }),
                        },
                    }],
                },
                usage={
                    "prompt_tokens": 10,
                    "completion_tokens": 2,
                    "total_tokens": 12,
                    "cached_tokens": 3,
                },
            )
        assert messages[-1]["role"] == "tool"
        assert "requires explicit approval" in messages[-1]["content"]
        return api_daily_agent.ModelResponse(
            message={"role": "assistant", "content": "已起草；确认卡片后才会写入 Life。"},
            usage={
                "prompt_tokens": 20,
                "completion_tokens": 5,
                "total_tokens": 25,
                "cached_tokens": 0,
            },
        )

    app.dependency_overrides[get_session] = override_session
    monkeypatch.setenv("DAILY_AGENT_API_KEY", "test-key")
    monkeypatch.setenv("DAILY_AGENT_MODEL", "test-model")
    monkeypatch.setattr(api_daily_agent, "_call_model", fake_model)
    try:
        response = request(
            "POST",
            "/api/v1/daily-agent/chat/stream",
            {"message": "周三早上九点半提醒我预约牙医"},
        )
        assert response.status_code == 200
        assert "event: draft" in response.text
        assert "event: done" in response.text

        history = request("GET", "/api/v1/daily-agent/history").json()["messages"]
        assert [message["role"] for message in history] == ["user", "assistant"]
        draft = history[-1]["drafts"][0]
        trace = history[-1]["trace"]
        assert trace["status"] == "completed"
        assert trace["model"] == "test-model"
        assert trace["model_calls"] == 2
        assert trace["tool_calls"] == 1
        assert trace["prompt_tokens"] == 30
        assert trace["completion_tokens"] == 7
        assert trace["total_tokens"] == 37
        assert trace["cached_tokens"] == 3
        assert trace["rounds"][0]["tools"] == ["draft_life_task"]
        assert trace["rounds"][1]["tools"] == []
        assert trace["duration_ms"] >= 0
        assert draft["status"] == "pending"
        assert draft["payload"]["title"] == "Book dentist"
        assert request("GET", "/api/v1/life-tasks").json()["items"] == []

        approved = request("POST", f"/api/v1/daily-agent/drafts/{draft['id']}/approve")
        assert approved.status_code == 200
        assert approved.json()["draft"]["status"] == "approved"
        tasks = request("GET", "/api/v1/life-tasks").json()["items"]
        assert len(tasks) == 1
        assert tasks[0]["title"] == "Book dentist"
        assert tasks[0]["category"] == "health"

        duplicate = request("POST", f"/api/v1/daily-agent/drafts/{draft['id']}/approve")
        assert duplicate.status_code == 409
        assert len(request("GET", "/api/v1/life-tasks").json()["items"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_daily_agent_dismiss_and_clear_history(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)
    engine = make_engine(database)
    with Session(engine) as session:
        message = api_daily_agent.AgentMessage(
            role="assistant",
            content="Drafted",
            tool_calls_json="[]",
            created_at="2026-08-10T12:00:00-07:00",
        )
        session.add(message)
        session.flush()
        session.add(api_daily_agent.AgentDraft(
            message_id=message.id,
            kind="life_task",
            payload_json=json.dumps({
                "title": "Buy milk",
                "category": "errands",
                "due_at": None,
                "notes": "",
                "completed": False,
            }),
            summary="Buy milk",
            status="pending",
            created_at="2026-08-10T12:00:00-07:00",
            resolved_at=None,
        ))
        session.commit()

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        history = request("GET", "/api/v1/daily-agent/history").json()["messages"]
        draft_id = history[0]["drafts"][0]["id"]
        dismissed = request("POST", f"/api/v1/daily-agent/drafts/{draft_id}/dismiss")
        assert dismissed.status_code == 200
        assert dismissed.json()["draft"]["status"] == "dismissed"
        assert request("GET", "/api/v1/life-tasks").json()["items"] == []

        cleared = request("DELETE", "/api/v1/daily-agent/history")
        assert cleared.status_code == 204
        assert request("GET", "/api/v1/daily-agent/history").json() == {"messages": []}
    finally:
        app.dependency_overrides.clear()


def test_daily_agent_requires_model_configuration(tmp_path, monkeypatch):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    for name in (
        "DAILY_AGENT_API_KEY",
        "DAILY_AGENT_MODEL",
        "AI_TUTOR_API_KEY",
        "AI_TUTOR_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)

    app.dependency_overrides[get_session] = override_session
    try:
        status = request("GET", "/api/v1/daily-agent/status")
        assert status.status_code == 200
        assert status.json()["configured"] is False

        response = request(
            "POST",
            "/api/v1/daily-agent/chat/stream",
            {"message": "What is on today?"},
        )
        assert response.status_code == 503
    finally:
        app.dependency_overrides.clear()


def test_daily_agent_settings_save_preserve_clear_and_never_return_key(tmp_path, monkeypatch):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    for name in (
        "DAILY_AGENT_API_KEY",
        "DAILY_AGENT_MODEL",
        "AI_TUTOR_API_KEY",
        "AI_TUTOR_MODEL",
    ):
        monkeypatch.delenv(name, raising=False)
    app.dependency_overrides[get_session] = override_session
    try:
        initial = request("GET", "/api/v1/daily-agent/settings")
        assert initial.status_code == 200
        assert initial.json() == {
            "base_url": "https://api.openai.com/v1",
            "model": "",
            "has_api_key": False,
            "has_saved_api_key": False,
            "source": "default",
        }

        saved = request(
            "PUT",
            "/api/v1/daily-agent/settings",
            {
                "base_url": "https://provider.example/v1/",
                "model": "daily-model",
                "api_key": "top-secret-value",
            },
        )
        assert saved.status_code == 200
        assert saved.json()["base_url"] == "https://provider.example/v1"
        assert saved.json()["model"] == "daily-model"
        assert saved.json()["has_api_key"] is True
        assert saved.json()["has_saved_api_key"] is True
        assert "top-secret-value" not in saved.text
        assert "api_key" not in saved.json()

        preserved = request(
            "PUT",
            "/api/v1/daily-agent/settings",
            {
                "base_url": "https://provider.example/v1",
                "model": "next-model",
                "api_key": "",
            },
        )
        assert preserved.json()["has_saved_api_key"] is True
        assert request("GET", "/api/v1/daily-agent/status").json()["model"] == "next-model"

        cleared = request(
            "PUT",
            "/api/v1/daily-agent/settings",
            {
                "base_url": "https://provider.example/v1",
                "model": "next-model",
                "clear_api_key": True,
            },
        )
        assert cleared.json()["has_api_key"] is False
        assert cleared.json()["has_saved_api_key"] is False
        assert request("GET", "/api/v1/daily-agent/status").json()["configured"] is False
    finally:
        app.dependency_overrides.clear()


def test_daily_agent_settings_override_environment_and_test_unsaved_key(tmp_path, monkeypatch):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    seen = None

    async def fake_test(settings):
        nonlocal seen
        seen = settings

    monkeypatch.setenv("DAILY_AGENT_API_KEY", "environment-key")
    monkeypatch.setenv("DAILY_AGENT_MODEL", "environment-model")
    monkeypatch.setattr(api_daily_agent, "_test_model_connection", fake_test)
    app.dependency_overrides[get_session] = override_session
    try:
        response = request(
            "POST",
            "/api/v1/daily-agent/settings/test",
            {
                "base_url": "http://localhost:1234/v1",
                "model": "typed-model",
                "api_key": "typed-secret",
            },
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True, "model": "typed-model"}
        assert "typed-secret" not in response.text
        assert seen.base_url == "http://localhost:1234/v1"
        assert seen.model == "typed-model"
        assert seen.api_key == "typed-secret"

        settings = request("GET", "/api/v1/daily-agent/settings").json()
        assert settings["model"] == "environment-model"
        assert settings["has_api_key"] is True
        assert settings["has_saved_api_key"] is False
        assert "environment-key" not in json.dumps(settings)
    finally:
        app.dependency_overrides.clear()


def test_daily_agent_openai_gpt_5_6_tools_use_reasoning_none():
    settings = api_daily_agent.AgentSettings(
        base_url="https://api.openai.com/v1",
        api_key="not-a-real-key",
        model="gpt-5.6-terra",
        source="saved",
        has_saved_api_key=True,
    )
    body = api_daily_agent._model_request_body(
        settings,
        [{"role": "user", "content": "What is on today?"}],
    )
    assert body["reasoning_effort"] == "none"
    assert body["tools"]

    gemini = api_daily_agent.AgentSettings(
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        api_key="not-a-real-key",
        model="gemini-2.5-flash",
        source="saved",
        has_saved_api_key=True,
    )
    assert "reasoning_effort" not in api_daily_agent._model_request_body(gemini, [])


def test_daily_agent_normalizes_provider_usage_without_inventing_missing_tokens():
    assert api_daily_agent._normalize_usage({
        "prompt_tokens": 100,
        "completion_tokens": 25,
        "prompt_tokens_details": {"cached_tokens": 40},
    }) == {
        "prompt_tokens": 100,
        "completion_tokens": 25,
        "total_tokens": 125,
        "cached_tokens": 40,
    }
    assert api_daily_agent._normalize_usage({
        "input_tokens": 60,
        "output_tokens": 15,
        "input_tokens_details": {"cached_tokens": 8},
    }) == {
        "prompt_tokens": 60,
        "completion_tokens": 15,
        "total_tokens": 75,
        "cached_tokens": 8,
    }
    assert api_daily_agent._normalize_usage(None) == {
        "prompt_tokens": None,
        "completion_tokens": None,
        "total_tokens": None,
        "cached_tokens": None,
    }


def test_daily_agent_persists_failed_model_trace(tmp_path, monkeypatch):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    async def fake_model(_settings, _messages):
        raise ValueError("upstream body intentionally omitted")

    app.dependency_overrides[get_session] = override_session
    monkeypatch.setenv("DAILY_AGENT_API_KEY", "test-key")
    monkeypatch.setenv("DAILY_AGENT_MODEL", "test-model")
    monkeypatch.setattr(api_daily_agent, "_call_model", fake_model)
    try:
        response = request(
            "POST",
            "/api/v1/daily-agent/chat/stream",
            {"message": "What is on today?"},
        )
        assert response.status_code == 200
        assert "event: error" in response.text
        history = request("GET", "/api/v1/daily-agent/history").json()["messages"]
        trace = history[-1]["trace"]
        assert trace["status"] == "failed"
        assert trace["error_type"] == "ValueError"
        assert trace["model_calls"] == 1
        assert trace["total_tokens"] is None
        assert trace["rounds"][0]["status"] == "failed"
        assert "upstream body intentionally omitted" not in json.dumps(trace)
    finally:
        app.dependency_overrides.clear()


def test_daily_agent_caps_drafts_and_returns_a_result_for_every_tool_call(tmp_path, monkeypatch):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    calls = 0

    async def fake_model(_settings, messages):
        nonlocal calls
        calls += 1
        if calls == 1:
            return {
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": f"call-{index}",
                    "type": "function",
                    "function": {
                        "name": "draft_life_task",
                        "arguments": json.dumps({
                            "title": f"Task {index}",
                            "category": "personal",
                            "due_at": None,
                            "notes": "",
                        }),
                    },
                } for index in range(4)],
            }
        tool_results = [message for message in messages if message["role"] == "tool"]
        assert len(tool_results) == 4
        assert "batch limit" in tool_results[-1]["content"]
        return {"role": "assistant", "content": "起草了前三项。"}

    app.dependency_overrides[get_session] = override_session
    monkeypatch.setenv("DAILY_AGENT_API_KEY", "test-key")
    monkeypatch.setenv("DAILY_AGENT_MODEL", "test-model")
    monkeypatch.setattr(api_daily_agent, "_call_model", fake_model)
    try:
        response = request(
            "POST",
            "/api/v1/daily-agent/chat/stream",
            {"message": "Add four things"},
        )
        assert response.status_code == 200
        history = request("GET", "/api/v1/daily-agent/history").json()["messages"]
        assert len(history[-1]["drafts"]) == 3
        assert request("GET", "/api/v1/life-tasks").json()["items"] == []
    finally:
        app.dependency_overrides.clear()
