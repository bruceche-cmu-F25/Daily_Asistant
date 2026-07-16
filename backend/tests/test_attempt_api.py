import anyio
import httpx
from sqlalchemy.orm import Session

from daily_dashboard.api_attempts import get_session
from daily_dashboard.database import make_engine
from daily_dashboard.legacy_migration import upgrade_database
from daily_dashboard.main import app


def request(app, method, path, json=None):
    async def run_request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, json=json)

    return anyio.run(run_request)


def test_draft_and_attempt_lifecycle(tmp_path):
    database = tmp_path / "daily_v2.db"
    upgrade_database(database)

    def override_session():
        with Session(make_engine(database)) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        draft = request(app, "PUT", "/api/v1/problems/leetcode:two-sum/draft", {
            "language": "python",
            "solution": "def two_sum():\n    pass",
            "reflection": "",
        })
        assert draft.status_code == 200

        workspace = request(app, "GET", "/api/v1/problems/leetcode:two-sum/workspace")
        assert workspace.json()["draft"]["solution"].startswith("def two_sum")

        invalid = request(app, "POST", "/api/v1/problems/leetcode:two-sum/attempts", {
            "status": "solved", "language": "python", "solution": "   ", "reflection": ""
        })
        assert invalid.status_code == 422

        solved = request(app, "POST", "/api/v1/problems/leetcode:two-sum/attempts", {
            "status": "solved",
            "language": "python",
            "solution": "def two_sum(nums, target):\n    return []",
            "reflection": "complement map",
        })
        assert solved.status_code == 201
        attempt_id = solved.json()["attempt"]["id"]

        after_solved = request(app, "GET", "/api/v1/problems/leetcode:two-sum/workspace")
        assert after_solved.json()["draft"] is None
        assert len(after_solved.json()["attempts"]) == 1

        edited = request(app, "PATCH", f"/api/v1/attempts/{attempt_id}", {
            "reflection": "use a complement map"
        })
        assert edited.status_code == 200
        assert edited.json()["attempt"]["reflection"] == "use a complement map"

        deleted = request(app, "DELETE", f"/api/v1/attempts/{attempt_id}")
        assert deleted.status_code == 204
        final_workspace = request(app, "GET", "/api/v1/problems/leetcode:two-sum/workspace")
        assert final_workspace.json()["attempts"] == []
    finally:
        app.dependency_overrides.clear()
