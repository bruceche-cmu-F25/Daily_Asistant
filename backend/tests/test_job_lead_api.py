import anyio
import httpx
from sqlalchemy.orm import Session

from daily_dashboard import api_job_leads
from daily_dashboard.api_attempts import get_session
from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import upgrade_database
from daily_dashboard.main import app


LEAD = {
    "key": "lead-netic-1",
    "company": "Netic",
    "role": "Agent Software Engineer - New Grad",
    "location": "San Francisco, CA",
    "url": "https://example.com/jobs/netic-1",
    "source": "SpeedyApply 2027 AI",
    "track": "new_grad",
    "category": "AI/ML",
    "posted_at": "2026-07-17",
    "age_days": 0,
    "is_big_tech": False,
    "match_score": 96,
    "match_reasons": ["2027 / early-career timing", "AI / agentic systems", "Bay Area / local"],
}


def request(method, path, json=None):
    async def run_request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, json=json)

    return anyio.run(run_request)


def test_daily_job_queue_skip_and_one_click_application(tmp_path, monkeypatch):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    monkeypatch.setattr(api_job_leads, "snapshot_leads", lambda: ([LEAD], "2026-07-17T09:00:00-07:00"))
    monkeypatch.setattr(api_job_leads, "load_candidate_profile", lambda: {
        "resume_version": "Chi Cheng-Resume-2026-May.pdf",
    })
    app.dependency_overrides[get_session] = override_session
    try:
        listed = request("GET", "/api/v1/job-leads")
        assert listed.status_code == 200
        assert listed.json()["items"][0]["decision"] == "pending"

        skipped = request("PATCH", "/api/v1/job-leads/lead-netic-1", {"decision": "skipped"})
        assert skipped.status_code == 200
        assert skipped.json()["lead"]["decision"] == "skipped"

        applied = request("POST", "/api/v1/job-leads/lead-netic-1/applied")
        assert applied.status_code == 200
        application = applied.json()["application"]
        assert application["company"] == "Netic"
        assert application["stage"] == "applied"
        assert application["resume_version"] == "Chi Cheng-Resume-2026-May.pdf"
        assert application["follow_up_at"] > application["applied_at"]

        applied_again = request("POST", "/api/v1/job-leads/lead-netic-1/applied")
        assert applied_again.status_code == 200
        assert applied_again.json()["application"]["id"] == application["id"]
        assert len(request("GET", "/api/v1/applications").json()["items"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_job_lead_rejects_unknown_key(tmp_path, monkeypatch):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    monkeypatch.setattr(api_job_leads, "snapshot_leads", lambda: ([LEAD], ""))
    app.dependency_overrides[get_session] = override_session
    try:
        response = request("POST", "/api/v1/job-leads/missing/applied")
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()
