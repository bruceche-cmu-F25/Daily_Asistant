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


def test_life_tasks_create_timeline_complete_reopen_and_delete(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        someday = request("POST", "/api/v1/life-tasks", {
            "title": "Replace apartment air filter",
            "category": "home",
            "notes": "Check the filter size first.",
        })
        scheduled = request("POST", "/api/v1/life-tasks", {
            "title": "Renew driver's license",
            "category": "admin",
            "due_at": "2026-08-02T10:30",
        })
        assert someday.status_code == 201
        assert scheduled.status_code == 201

        items = request("GET", "/api/v1/life-tasks").json()["items"]
        assert [item["title"] for item in items] == [
            "Renew driver's license",
            "Replace apartment air filter",
        ]
        task_id = scheduled.json()["task"]["id"]
        completed = request("PATCH", f"/api/v1/life-tasks/{task_id}", {"completed": True})
        assert completed.json()["task"]["completed"] is True
        assert completed.json()["task"]["completed_at"]

        reopened = request("PATCH", f"/api/v1/life-tasks/{task_id}", {"completed": False})
        assert reopened.json()["task"]["completed"] is False
        assert reopened.json()["task"]["completed_at"] is None

        deleted = request("DELETE", f"/api/v1/life-tasks/{task_id}")
        assert deleted.status_code == 204
        assert len(request("GET", "/api/v1/life-tasks").json()["items"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_life_tasks_reject_blank_titles_unknown_categories_and_bad_dates(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        assert request("POST", "/api/v1/life-tasks", {"title": "   "}).status_code == 422
        assert request("POST", "/api/v1/life-tasks", {
            "title": "Bad category",
            "category": "work",
        }).status_code == 422
        assert request("POST", "/api/v1/life-tasks", {
            "title": "Bad date",
            "due_at": "tomorrow",
        }).status_code == 422
    finally:
        app.dependency_overrides.clear()
