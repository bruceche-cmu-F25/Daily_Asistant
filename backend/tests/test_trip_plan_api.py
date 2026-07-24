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


def test_trip_plan_saves_sorted_itinerary_and_can_be_cleared(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        assert request("GET", "/api/v1/trip-plan").json() == {"plan": None}
        saved = request("PUT", "/api/v1/trip-plan", {
            "title": "Japan 2026",
            "destination": "Tokyo, Japan",
            "start_date": "2026-09-10",
            "end_date": "2026-09-16",
            "notes": "Rail pass in wallet.",
            "stops": [
                {"title": "TeamLab", "location": "teamLab Planets", "visit_at": "2026-09-11T14:00"},
                {"title": "Tsukiji breakfast", "location": "Tsukiji Outer Market", "visit_at": "2026-09-11T08:00"},
            ],
        })
        assert saved.status_code == 200
        plan = saved.json()["plan"]
        assert [stop["title"] for stop in plan["stops"]] == ["Tsukiji breakfast", "TeamLab"]
        assert all(stop["id"] for stop in plan["stops"])
        assert request("GET", "/api/v1/trip-plan").json()["plan"]["destination"] == "Tokyo, Japan"

        invalid = request("PUT", "/api/v1/trip-plan", {
            "title": "Bad dates",
            "start_date": "2026-09-20",
            "end_date": "2026-09-10",
        })
        assert invalid.status_code == 422

        assert request("DELETE", "/api/v1/trip-plan").status_code == 204
        assert request("GET", "/api/v1/trip-plan").json() == {"plan": None}
    finally:
        app.dependency_overrides.clear()
