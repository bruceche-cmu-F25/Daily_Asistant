import datetime as dt
import json
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "bin"))

from job_feed import _job_key, location_tier, mark_first_seen, parse_simplify_listings, parse_speedy_markdown, rank_and_dedupe  # noqa: E402


PROFILE = {
    "preferred_locations": ["San Francisco", "Mountain View", "Remote"],
    "match_groups": [
        {"label": "AI / agentic systems", "keywords": ["ai", "agent"], "weight": 14},
        {"label": "Python / backend / APIs", "keywords": ["backend", "api"], "weight": 12},
    ],
}


class JobFeedTests(unittest.TestCase):
    def test_parses_speedy_rows_and_derives_open_date(self):
        markdown = """
| Company | Position | Location | Posting | Age |
|---|---|---|---|---|
| <a href="https://netic.ai"><strong>Netic</strong></a> | Software Engineer - Agent Platform - New Grad - 2026-2027 | San Francisco, CA | <a href="https://jobs.example.com/netic"><img src="x" alt="Apply"/></a> | 1d |
"""
        jobs = parse_speedy_markdown(
            markdown,
            today=dt.date(2026, 7, 17),
            source="SpeedyApply 2027 SWE",
            track="new_grad",
        )
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["company"], "Netic")
        self.assertEqual(jobs[0]["posted_at"], "2026-07-16")
        ranked = rank_and_dedupe(jobs, PROFILE)
        self.assertGreaterEqual(ranked[0]["match_score"], 80)
        self.assertIn("AI / agentic systems", ranked[0]["match_reasons"])

    def test_simplify_parser_keeps_only_active_visible_roles(self):
        payload = [
            {
                "active": True,
                "is_visible": True,
                "url": "https://jobs.example.com/active",
                "company_name": "Example AI",
                "title": "Backend Software Engineer - Early Career",
                "locations": ["Mountain View, CA"],
                "category": "Software",
                "date_posted": 1784246400,
            },
            {
                "active": False,
                "is_visible": True,
                "url": "https://jobs.example.com/closed",
                "company_name": "Closed",
                "title": "Software Engineer",
            },
        ]
        jobs = parse_simplify_listings(payload, today=dt.date(2026, 7, 17))
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0]["company"], "Example AI")

    def test_excludes_senior_and_phd_roles(self):
        base = {
            "key": "one",
            "company": "BigCo",
            "role": "Senior Software Engineer",
            "location": "San Francisco, CA",
            "url": "https://example.com/one",
            "source": "test",
            "track": "new_grad",
            "category": "Software",
            "posted_at": "2026-07-17",
            "age_days": 0,
            "is_big_tech": False,
        }
        phd = {**base, "key": "two", "role": "Machine Learning Engineer - PhD"}
        self.assertEqual(rank_and_dedupe([base, phd], PROFILE), [])

    def test_ashby_application_embed_uses_the_same_job_key(self):
        direct = "https://jobs.ashbyhq.com/netic/job-123"
        embedded = "https://jobs.ashbyhq.com/netic/job-123/application?embed=true"
        self.assertEqual(_job_key(direct), _job_key(embedded))

    def test_bay_area_city_coverage(self):
        self.assertEqual(location_tier("Oakland, CA"), "bay_area")
        self.assertEqual(location_tier("Redwood City, California"), "bay_area")
        self.assertEqual(location_tier("Remote in USA"), "remote")
        self.assertEqual(location_tier("Pittsburgh, PA"), "other_us")
        self.assertEqual(location_tier(""), "unknown")

    def test_bay_area_jobs_sort_before_higher_scoring_remote_jobs(self):
        base = {
            "company": "Example",
            "role": "Software Engineer",
            "url": "https://example.com/job",
            "source": "test",
            "track": "new_grad",
            "category": "Software",
            "posted_at": "2026-07-17",
            "age_days": 0,
            "is_big_tech": False,
        }
        bay_area = {
            **base,
            "key": "bay-area",
            "location": "Berkeley, CA",
            "age_days": 20,
        }
        remote = {
            **base,
            "key": "remote",
            "role": "AI Software Engineer - New Grad 2027",
            "location": "Remote in USA",
        }

        ranked = rank_and_dedupe([remote, bay_area], PROFILE)

        self.assertEqual([item["key"] for item in ranked], ["bay-area", "remote"])
        self.assertEqual(ranked[0]["location_tier"], "bay_area")

    def test_first_seen_survives_refresh_and_marks_only_todays_roles(self):
        previous = [{"key": "old", "first_seen_at": "2026-07-16T09:00:00-07:00"}]
        current = [{"key": "old"}, {"key": "new"}]

        marked = mark_first_seen(
            current,
            previous,
            refreshed_at="2026-07-17T09:00:00-07:00",
            previous_refreshed_at="2026-07-16T09:00:00-07:00",
        )

        self.assertEqual(marked[0]["first_seen_at"], "2026-07-16T09:00:00-07:00")
        self.assertFalse(marked[0]["is_new_today"])
        self.assertTrue(marked[1]["is_new_today"])

    def test_existing_unannotated_feed_becomes_a_quiet_baseline(self):
        marked = mark_first_seen(
            [{"key": "existing"}],
            [{"key": "existing"}],
            refreshed_at="2026-07-17T09:00:00-07:00",
            previous_refreshed_at="2026-07-17T08:00:00-07:00",
        )

        self.assertFalse(marked[0]["is_new_today"])


if __name__ == "__main__":
    unittest.main()
