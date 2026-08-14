# ADR 0002: Publish a validated last-known-good Daily Snapshot

- Status: Accepted
- Date: 2026-07-17

## Context

Calendar, Notion, Brave Search and Job Feeds fail independently. The old generator mixed acquisition, fallback, HTML rendering and persistence, and a partial failure could produce misleading zero metrics.

## Decision

`SnapshotStore` is the deep Module responsible for the snapshot Interface. It validates the contract, retains source-owned fields on adapter failure, recomputes metrics after fallback, and atomically replaces the JSON file only after validation.

## Consequences

- Consumers no longer implement their own JSON error or fallback policy.
- A source can be stale without making the dashboard empty.
- `refresh_job_feeds.py` and the full refresh use the same persistence seam.
