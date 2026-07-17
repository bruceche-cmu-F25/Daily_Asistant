import datetime as dt
import json
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "bin"))

from job_feed import _job_key, parse_simplify_listings, parse_speedy_markdown, rank_and_dedupe  # noqa: E402


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


if __name__ == "__main__":
    unittest.main()
