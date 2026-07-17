"""Fetch, normalize, and rank public early-career job feeds."""

from __future__ import annotations

import datetime as dt
import hashlib
import html
import json
import re
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Any


SIMPLIFY_NEW_GRAD_JSON = (
    "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/"
    "dev/.github/scripts/listings.json"
)
SPEEDY_SWE_NEW_GRAD = (
    "https://raw.githubusercontent.com/speedyapply/2027-SWE-College-Jobs/"
    "main/NEW_GRAD_USA.md"
)
SPEEDY_SWE_INTERNS = (
    "https://raw.githubusercontent.com/speedyapply/2027-SWE-College-Jobs/"
    "main/README.md"
)
SPEEDY_AI_NEW_GRAD = (
    "https://raw.githubusercontent.com/speedyapply/2027-AI-College-Jobs/"
    "main/NEW_GRAD_USA.md"
)

BIG_TECH = {
    "adobe",
    "amazon",
    "apple",
    "figma",
    "google",
    "meta",
    "microsoft",
    "netflix",
    "nvidia",
    "openai",
    "salesforce",
    "stripe",
    "tiktok",
    "twitch",
}

ROLE_TERMS = (
    "software engineer",
    "software developer",
    "developer i",
    "engineer i",
    "backend engineer",
    "back-end engineer",
    "full stack",
    "full-stack",
    "frontend engineer",
    "front-end engineer",
    "machine learning engineer",
    "ml engineer",
    "ai engineer",
    "applied engineer",
    "data engineer",
    "product engineer",
    "devops engineer",
    "platform engineer",
    "cloud engineer",
    "associate engineer",
    "technical program manager i",
    "associate product manager",
)

HARD_EXCLUSIONS = (
    "senior",
    "staff",
    "principal",
    "director",
    "vp ",
    "vice president",
    "phd",
    "security clearance",
    "ts/sci",
    "new college grad 2025",
    "new grad 2025",
)

NON_US_MARKERS = (
    "canada",
    "united kingdom",
    " uk",
    "india",
    "germany",
    "france",
    "australia",
    "singapore",
    "poland",
    "ireland",
    "netherlands",
)


def load_candidate_profile(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "resume_version": "Default resume",
            "resume_path": "",
            "graduation": "2026-12",
            "location": "Bay Area, CA",
            "target_roles": ["Software Engineer"],
            "preferred_locations": ["San Francisco", "San Jose", "Remote"],
            "match_groups": [],
        }
    return payload if isinstance(payload, dict) else {}


def _clean_cell(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def _age_days(value: str) -> int | None:
    match = re.search(r"(\d+)\s*(h|d|mo)", value.lower())
    if not match:
        return None
    amount = int(match.group(1))
    unit = match.group(2)
    if unit == "h":
        return 0
    if unit == "mo":
        return amount * 30
    return amount


def _job_key(url: str) -> str:
    parsed = urllib.parse.urlsplit(url.strip())
    path = re.sub(r"/application/?$", "", parsed.path.rstrip("/"), flags=re.I)
    normalized = urllib.parse.urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, "", ""))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]


def _big_tech(company: str) -> bool:
    normalized = re.sub(r"[^a-z0-9]+", " ", company.lower()).strip()
    return any(name == normalized or name in normalized.split() for name in BIG_TECH)


def parse_speedy_markdown(
    markdown: str,
    *,
    today: dt.date,
    source: str,
    track: str,
) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    for line in markdown.splitlines():
        if not line.startswith("|") or "<strong>" not in line or "alt=\"Apply\"" not in line:
            continue
        columns = [column.strip() for column in line.strip().strip("|").split("|")]
        if len(columns) < 5:
            continue
        company_match = re.search(r"<strong>(.*?)</strong>", columns[0], flags=re.I)
        links = re.findall(r'href="([^"]+)"', line, flags=re.I)
        if company_match is None or len(links) < 2:
            continue
        company = _clean_cell(company_match.group(1))
        role = _clean_cell(columns[1])
        location = _clean_cell(columns[2])
        age_days = _age_days(_clean_cell(columns[-1]))
        url = html.unescape(links[-1])
        posted_at = (today - dt.timedelta(days=age_days)).isoformat() if age_days is not None else None
        jobs.append({
            "key": _job_key(url),
            "company": company,
            "role": role,
            "location": location,
            "url": url,
            "source": source,
            "track": track,
            "category": "AI/ML" if "AI" in source else "Software",
            "posted_at": posted_at,
            "age_days": age_days,
            "is_big_tech": _big_tech(company),
        })
    return jobs


def parse_simplify_listings(payload: Any, *, today: dt.date) -> list[dict[str, Any]]:
    if not isinstance(payload, list):
        return []
    jobs: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict) or not item.get("active") or not item.get("is_visible", True):
            continue
        url = str(item.get("url") or "").strip()
        if not url:
            continue
        timestamp = item.get("date_posted")
        posted_at = None
        age_days = None
        if isinstance(timestamp, (int, float)):
            posted_date = dt.datetime.fromtimestamp(timestamp, tz=dt.timezone.utc).date()
            posted_at = posted_date.isoformat()
            age_days = max(0, (today - posted_date).days)
        locations = item.get("locations") if isinstance(item.get("locations"), list) else []
        company = str(item.get("company_name") or "").strip()
        jobs.append({
            "key": _job_key(url),
            "company": company,
            "role": str(item.get("title") or "").strip(),
            "location": " · ".join(str(location) for location in locations[:3]),
            "url": url,
            "source": "Simplify New Grad",
            "track": "new_grad",
            "category": str(item.get("category") or "Software"),
            "posted_at": posted_at,
            "age_days": age_days,
            "is_big_tech": _big_tech(company),
        })
    return jobs


def score_job(job: dict[str, Any], profile: dict[str, Any]) -> tuple[int, list[str]] | None:
    title = str(job.get("role") or "").lower()
    location = str(job.get("location") or "").lower()
    if not any(term in title for term in ROLE_TERMS):
        return None
    if any(term in title for term in HARD_EXCLUSIONS):
        return None
    if any(marker in location for marker in NON_US_MARKERS) and "remote in usa" not in location:
        return None

    score = 44
    reasons = ["Software engineering baseline"]
    timing_terms = ("2027", "new grad", "new college", "university grad", "early career", "entry-level", "entry level", "engineer i")
    if any(term in title for term in timing_terms):
        score += 15
        reasons[0] = "2027 / early-career timing"

    for group in profile.get("match_groups", []):
        if not isinstance(group, dict):
            continue
        keywords = [str(keyword).lower() for keyword in group.get("keywords", [])]
        if any(keyword in title for keyword in keywords):
            score += int(group.get("weight", 0))
            reasons.append(str(group.get("label") or "Resume skill match"))

    preferred = [str(place).lower() for place in profile.get("preferred_locations", [])]
    if any(place in location for place in preferred if place != "remote"):
        score += 14
        reasons.append("Bay Area / local")
    elif "remote" in location:
        score += 9
        reasons.append("Remote-friendly")

    age_days = job.get("age_days")
    if isinstance(age_days, int):
        if age_days <= 3:
            score += 12
            reasons.append(f"Fresh · {age_days}d")
        elif age_days <= 7:
            score += 8
            reasons.append(f"Fresh · {age_days}d")
        elif age_days <= 14:
            score += 4
            reasons.append(f"Recent · {age_days}d")
        elif age_days > 60:
            score -= 8

    if job.get("is_big_tech"):
        score += 3
    return min(99, max(0, score)), reasons[:4]


def rank_and_dedupe(
    jobs: list[dict[str, Any]],
    profile: dict[str, Any],
    *,
    limit: int = 100,
) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for job in jobs:
        result = score_job(job, profile)
        if result is None:
            continue
        score, reasons = result
        if score < 55:
            continue
        enriched = {**job, "match_score": score, "match_reasons": reasons}
        existing = deduped.get(job["key"])
        if existing is None or score > int(existing.get("match_score", 0)):
            deduped[job["key"]] = enriched
    return sorted(
        deduped.values(),
        key=lambda item: (
            -int(item.get("match_score", 0)),
            item.get("age_days") if isinstance(item.get("age_days"), int) else 9_999,
            str(item.get("company") or ""),
        ),
    )[:limit]


def _request(url: str, timeout: int) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={"User-Agent": "Bruce-Daily-Dashboard/2.0", "Accept": "application/json,text/plain"},
    )


def _fetch_text(url: str, timeout: int) -> str:
    with urllib.request.urlopen(_request(url, timeout), timeout=timeout) as response:
        return response.read().decode("utf-8")


def collect_job_leads(
    profile: dict[str, Any],
    *,
    today: dt.date,
    timeout: int = 45,
) -> tuple[list[dict[str, Any]], list[str]]:
    jobs: list[dict[str, Any]] = []
    errors: list[str] = []
    sources = [
        (SPEEDY_SWE_NEW_GRAD, "SpeedyApply 2027 SWE", "new_grad"),
        (SPEEDY_SWE_INTERNS, "SpeedyApply 2027 SWE", "internship"),
        (SPEEDY_AI_NEW_GRAD, "SpeedyApply 2027 AI", "new_grad"),
    ]
    try:
        simplify_payload = json.loads(_fetch_text(SIMPLIFY_NEW_GRAD_JSON, timeout))
        jobs.extend(parse_simplify_listings(simplify_payload, today=today))
    except Exception as exc:  # Network and upstream formats are intentionally isolated.
        errors.append(f"Simplify: {type(exc).__name__}")
    for url, source, track in sources:
        try:
            jobs.extend(parse_speedy_markdown(
                _fetch_text(url, timeout),
                today=today,
                source=source,
                track=track,
            ))
        except Exception as exc:  # Network and upstream formats are intentionally isolated.
            errors.append(f"{source} {track}: {type(exc).__name__}")
    return rank_and_dedupe(jobs, profile), errors
