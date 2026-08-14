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


def test_email_signal_requires_confirmation_before_updating_crm(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        application = request("POST", "/api/v1/applications", {
            "company": "Example Labs",
            "role": "Software Engineer",
            "stage": "applied",
        }).json()["application"]
        imported = request("POST", "/api/v1/application-signals/import", {
            "emails": [{
                "message_id": "gmail-1",
                "thread_id": "thread-1",
                "sender": "recruiting@examplelabs.com",
                "subject": "Example Labs coding assessment",
                "snippet": "Please finish your online assessment by July 22, 2026.",
                "body": "Complete the coding challenge by July 22, 2026.",
                "received_at": "2026-07-17T10:00:00-07:00",
                "source_url": "https://mail.google.com/mail/u/0/#inbox/gmail-1",
            }],
        })
        assert imported.status_code == 200
        assert imported.json()["imported"] == 1

        before = request("GET", "/api/v1/applications").json()["items"][0]
        assert before["stage"] == "applied"
        signal = request("GET", "/api/v1/application-signals").json()["items"][0]
        assert signal["signal_type"] == "oa"
        assert signal["application_id"] == application["id"]
        assert signal["suggested_deadline_at"] == "2026-07-22"

        accepted = request(
            "POST",
            f"/api/v1/application-signals/{signal['id']}/decision",
            {"decision": "accepted"},
        )
        assert accepted.status_code == 200
        assert accepted.json()["application"]["stage"] == "oa"
        assert accepted.json()["application"]["deadline_at"] == "2026-07-22"
        assert request("GET", "/api/v1/application-signals").json()["items"] == []
    finally:
        app.dependency_overrides.clear()


def test_duplicate_import_is_idempotent_and_dismiss_does_not_create_application(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    payload = {
        "emails": [{
            "message_id": "gmail-2",
            "sender": "jobs@notion.so",
            "subject": "Thank you for your application to Notion, Chi!",
            "received_at": "2026-07-17T09:00:00-07:00",
        }],
    }
    try:
        assert request("POST", "/api/v1/application-signals/import", payload).json()["imported"] == 1
        second = request("POST", "/api/v1/application-signals/import", payload).json()
        assert second == {
            "ok": True,
            "imported": 0,
            "updated": 1,
            "skipped": 0,
            "filtered": 0,
        }
        signal = request("GET", "/api/v1/application-signals").json()["items"][0]
        dismissed = request(
            "POST",
            f"/api/v1/application-signals/{signal['id']}/decision",
            {"decision": "dismissed"},
        )
        assert dismissed.status_code == 200
        assert dismissed.json()["application"] is None
        assert request("GET", "/api/v1/applications").json()["items"] == []
    finally:
        app.dependency_overrides.clear()


def test_late_confirmation_never_regresses_an_advanced_application(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        request("POST", "/api/v1/applications", {
            "company": "Notion",
            "role": "Software Engineer",
            "stage": "interview",
            "next_step": "Prepare system design",
        })
        request("POST", "/api/v1/application-signals/import", {
            "emails": [{
                "message_id": "gmail-late-confirmation",
                "sender": "recruiting@makenotion.com",
                "subject": "Thank you for your application to Notion!",
                "received_at": "2026-07-17T08:00:00-07:00",
            }],
        })
        signal = request("GET", "/api/v1/application-signals").json()["items"][0]
        accepted = request(
            "POST",
            f"/api/v1/application-signals/{signal['id']}/decision",
            {"decision": "accepted"},
        ).json()["application"]

        assert accepted["stage"] == "interview"
        assert accepted["next_step"] == "Prepare system design"
    finally:
        app.dependency_overrides.clear()
