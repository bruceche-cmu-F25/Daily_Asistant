import anyio
import httpx
from sqlalchemy.orm import Session

from daily_dashboard.api_attempts import get_session
from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import upgrade_database
from daily_dashboard.main import app


def request(method, path, json=None):
    async def run_request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, json=json)

    return anyio.run(run_request)


def test_todo_state_is_upserted_and_import_is_repeat_safe(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        payload = {
            "item_key": "calendar:event-1:2026-07-15:09:00",
            "source": "calendar",
            "title": "Focus block",
            "completed": True,
        }
        saved = request("PUT", "/api/v1/todos/calendar:event-1:2026-07-15:09:00", payload)
        assert saved.status_code == 200
        assert saved.json()["item"]["completed"] is True

        imported = request("POST", "/api/v1/todos/import", [{**payload, "completed": False}])
        assert imported.status_code == 200
        assert imported.json()["imported"] == 1

        listed = request("GET", "/api/v1/todos")
        assert listed.status_code == 200
        assert len(listed.json()["items"]) == 1
        assert listed.json()["items"][0]["completed"] is False
    finally:
        app.dependency_overrides.clear()
