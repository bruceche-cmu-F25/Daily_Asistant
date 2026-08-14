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


def test_application_crm_create_update_list_and_delete(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        created = request("POST", "/api/v1/applications", {
            "company": "OpenAI",
            "role": "Software Engineer",
            "job_url": "https://example.com/jobs/1",
            "stage": "applied",
            "next_step": "Ask an alumnus for context",
            "applied_at": "2026-07-17",
            "follow_up_at": "2026-07-22",
            "deadline_at": "2026-07-29",
            "contact_name": "Alex",
            "contact_type": "alumni",
            "contact_status": "planned",
            "resume_version": "backend-v3.pdf",
            "notes": "Emphasize FastAPI work.",
        })
        assert created.status_code == 201
        application_id = created.json()["application"]["id"]
        assert created.json()["application"]["resume_version"] == "backend-v3.pdf"
        assert created.json()["application"]["deadline_at"] == "2026-07-29"

        updated = request("PATCH", f"/api/v1/applications/{application_id}", {
            "stage": "recruiter_screen",
            "contact_status": "replied",
            "next_step": "Prepare the recruiter screen story",
        })
        assert updated.status_code == 200
        assert updated.json()["application"]["stage"] == "recruiter_screen"
        assert updated.json()["application"]["contact_status"] == "replied"

        regressed = request("PATCH", f"/api/v1/applications/{application_id}", {
            "stage": "applied",
            "next_step": "This must not overwrite the current next step",
        })
        assert regressed.status_code == 409
        assert "cannot regress" in regressed.json()["detail"]

        listed = request("GET", "/api/v1/applications")
        assert listed.status_code == 200
        assert len(listed.json()["items"]) == 1
        assert listed.json()["items"][0]["company"] == "OpenAI"
        assert listed.json()["items"][0]["stage"] == "recruiter_screen"
        assert listed.json()["items"][0]["next_step"] == "Prepare the recruiter screen story"

        deleted = request("DELETE", f"/api/v1/applications/{application_id}")
        assert deleted.status_code == 204
        assert request("GET", "/api/v1/applications").json()["items"] == []
    finally:
        app.dependency_overrides.clear()


def test_application_crm_rejects_blank_company_and_unknown_stage(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        response = request("POST", "/api/v1/applications", {
            "company": "   ",
            "role": "Engineer",
            "stage": "maybe",
        })
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()
