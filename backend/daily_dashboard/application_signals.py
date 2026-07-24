"""Deterministic, zero-cost classifier for recruiting email observations."""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass

from .models import JobApplication


@dataclass(frozen=True)
class EmailEnvelope:
    message_id: str
    thread_id: str
    sender: str
    subject: str
    snippet: str
    body: str
    received_at: str
    source_url: str


@dataclass(frozen=True)
class ClassifiedSignal:
    signal_type: str
    company: str
    role_hint: str
    summary: str
    suggested_stage: str
    suggested_next_step: str
    suggested_deadline_at: str | None
    application_id: int | None
    confidence: int


RULES = (
    ("rejection", "rejected", ("unfortunately", "not moving forward", "will not be moving forward", "other candidates")),
    ("offer", "offer", ("offer letter", "pleased to offer", "employment offer")),
    ("oa", "oa", ("online assessment", "coding assessment", "coding challenge", "hackerrank", "codesignal")),
    ("interview", "interview", ("schedule your interview", "interview availability", "prepare for your interview", "interview invitation")),
    ("recruiter", "recruiter_screen", ("recruiter", "next steps", "phone screen", "introductory call")),
    ("confirmation", "applied", ("received your application", "we received your", "thanks for applying", "thank you for your application", "application has been received", "application is in")),
)

NEXT_STEPS = {
    "confirmation": "Wait for a response; review again in 7 days.",
    "oa": "Complete the online assessment before the deadline.",
    "recruiter": "Reply and prepare a concise experience pitch.",
    "interview": "Confirm the interview and prepare role-specific stories.",
    "offer": "Review the offer, deadline and open questions.",
    "rejection": "Close this application; capture one useful lesson if needed.",
    "status_update": "Open the email and verify the new application status.",
}


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def detect_rule(text: str) -> tuple[str, str, int]:
    normalized = normalize(text)
    for signal_type, stage, phrases in RULES:
        if any(phrase in normalized for phrase in phrases):
            return signal_type, stage, 88
    if "application" in normalized and ("update" in normalized or "status" in normalized):
        return "status_update", "applied", 62
    return "status_update", "applied", 45


def match_application(text: str, applications: list[JobApplication]) -> JobApplication | None:
    normalized = normalize(text)
    candidates = [
        application
        for application in applications
        if len(normalize(application.company)) >= 3 and normalize(application.company) in normalized
    ]
    if len(candidates) == 1:
        return candidates[0]
    if candidates:
        role_candidates = [item for item in candidates if normalize(item.role) in normalized]
        if len(role_candidates) == 1:
            return role_candidates[0]
    return None


def extract_company(text: str, sender: str, matched: JobApplication | None) -> str:
    if matched:
        return matched.company
    normalized = normalize(text)
    known_aliases = {
        "claude corps": "Anthropic",
    }
    for alias, company in known_aliases.items():
        if alias in normalized:
            return company
    patterns = (
        r"(?:applying|applied) to ([^,!|]+)",
        r"application to ([^,!|]+)",
        r"joining ([^,!|]+)",
        r"application (?:for .+? )?at ([^,!|]+)",
        r"(?:opening|role|position) at ([^.!|]+)",
    )
    for pattern in patterns:
        result = re.search(pattern, text, flags=re.IGNORECASE)
        if result:
            company = result.group(1).strip()
            company = re.split(r"\b(?:thanks|we|our|your)\b", company, maxsplit=1, flags=re.IGNORECASE)[0]
            return company.strip(" .,:-")[:200]
    address = re.search(r"@([a-z0-9.-]+)", sender.lower())
    if address:
        host = address.group(1).split(".")[-2]
        if host not in {
            "gmail", "greenhouse", "greenhouse-mail", "lever", "workday", "myworkday",
            "ashbyhq", "oraclecloud", "workflow",
        }:
            return host.replace("-", " ").title()[:200]
    return ""


def extract_role(text: str, matched: JobApplication | None) -> str:
    if matched:
        return matched.role
    patterns = (
        r"(?:apply|applied) for (?:the )?(.+?) role\b",
        r"application for (?:the )?(.+?)(?: position| role| at |$)",
        r"your (.+?) application(?:\s|$|-)",
        r"for (?:the )?(.+?) position",
        r"status update for (.+?)(?:\.|$)",
    )
    for pattern in patterns:
        result = re.search(pattern, text, flags=re.IGNORECASE)
        if result:
            role = result.group(1).strip(" :-")
            role = re.sub(r"^(?:job\s+)?(?:req(?:uisition)?\s*)?#?r?\d{5,}\s+", "", role, flags=re.IGNORECASE)
            normalized_role = normalize(role)
            if len(role) > 160 or any(
                phrase in normalized_role
                for phrase in ("has been received", "we will review", "if your", "thank you for")
            ):
                continue
            return role[:300]
    if "claude corps" in normalize(text):
        return "Claude Corps"
    return "Role from Gmail"


def extract_deadline(text: str, received_at: str) -> str | None:
    iso = re.search(r"\b(20\d{2})-(\d{2})-(\d{2})\b", text)
    if iso:
        return iso.group(0)
    month = re.search(
        r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?",
        text,
        flags=re.IGNORECASE,
    )
    if not month:
        return None
    try:
        received_year = dt.datetime.fromisoformat(received_at.replace("Z", "+00:00")).year
    except ValueError:
        received_year = dt.date.today().year
    year = int(month.group(3) or received_year)
    parsed = dt.datetime.strptime(f"{month.group(1)} {month.group(2)} {year}", "%B %d %Y")
    return parsed.date().isoformat()


def classify_email(email: EmailEnvelope, applications: list[JobApplication]) -> ClassifiedSignal:
    searchable = " ".join((email.subject, email.sender, email.snippet, email.body))
    signal_type, stage, confidence = detect_rule(searchable)
    matched = match_application(searchable, applications)
    company = extract_company(email.subject, email.sender, matched) or extract_company(searchable, email.sender, matched)
    role_hint = extract_role(searchable, matched)
    deadline = extract_deadline(searchable, email.received_at) if signal_type in {"oa", "interview", "offer"} else None
    if matched:
        confidence = min(99, confidence + 8)
    summary = email.subject.strip()[:500]
    return ClassifiedSignal(
        signal_type=signal_type,
        company=company,
        role_hint=role_hint,
        summary=summary,
        suggested_stage=stage,
        suggested_next_step=NEXT_STEPS[signal_type],
        suggested_deadline_at=deadline,
        application_id=matched.id if matched else None,
        confidence=confidence,
    )
