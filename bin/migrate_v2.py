#!/usr/bin/env python3
"""Run the repeat-safe legacy-to-v2 database migration."""

from __future__ import annotations

import sys
from pathlib import Path


BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / "backend"))

from daily_dashboard.legacy_migration import main  # noqa: E402


if __name__ == "__main__":
    main()
