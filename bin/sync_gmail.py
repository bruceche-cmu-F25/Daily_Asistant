#!/usr/bin/env python3
"""Fetch recent recruiting mail and create confirmation-gated local signals."""

from __future__ import annotations

import json
import sys
from pathlib import Path


BASE = Path(__file__).resolve().parent.parent
BACKEND = BASE / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from daily_dashboard.application_signal_service import import_email_signals, record_sync_error  # noqa: E402
from daily_dashboard.database import SessionLocal  # noqa: E402
from daily_dashboard.gmail_adapter import GmailAdapter, GmailAuthError  # noqa: E402


def main() -> None:
    adapter = GmailAdapter()
    with SessionLocal() as session:
        try:
            emails = adapter.search()
            result = import_email_signals(session, emails, source="gmail-api")
        except GmailAuthError as exc:
            record_sync_error(session, "gmail-api", str(exc))
            raise SystemExit(str(exc)) from exc
    print(json.dumps({"matched_emails": len(emails), **result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
