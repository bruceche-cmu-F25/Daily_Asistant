import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "notify_new_jobs.py"
SPEC = importlib.util.spec_from_file_location("notify_new_jobs", SCRIPT)
notify_new_jobs = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(notify_new_jobs)


class NotifyNewJobsTests(unittest.TestCase):
    def test_only_returns_unnotified_roles_from_current_refresh_day(self):
        snapshot = {
            "job_feed_refreshed_at": "2026-07-17T09:00:00-07:00",
            "job_leads": [
                {"key": "already", "is_new_today": True},
                {"key": "fresh", "is_new_today": True},
                {"key": "old", "is_new_today": False},
            ],
        }
        state = {"date": "2026-07-17", "notified_keys": ["already"]}

        date_key, fresh = notify_new_jobs.pending_alert(snapshot, state)

        self.assertEqual(date_key, "2026-07-17")
        self.assertEqual([item["key"] for item in fresh], ["fresh"])


if __name__ == "__main__":
    unittest.main()
