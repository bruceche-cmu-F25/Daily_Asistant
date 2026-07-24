# ADR 0001: React + FastAPI is the canonical runtime

- Status: Accepted
- Date: 2026-07-17

## Context

The project was operating two products: generated `today.html` on port 8765 and React + FastAPI on port 8766. The scheduled task still generated the old page even though it opened the new one, creating two writable databases and two interaction models.

## Decision

The 09:00 task runs `bin/refresh_dashboard.py`, publishes `data/dashboard_snapshot.json`, and opens `http://127.0.0.1:8766/`. React + FastAPI and `data/daily_v2.db` are canonical. The generated `today.html`, 8765 server and v1-only assets are removed. A dated, read-only copy of the old database remains solely for repeat-safe migration and recovery.

## Consequences

- One operational page, API and writable database.
- Old data remains available for repeat-safe migration and recovery.
- There is no second page, server, interaction model or rendering test suite to drift from the canonical product.
