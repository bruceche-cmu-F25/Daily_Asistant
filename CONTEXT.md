# Daily Assistant Domain Context

## Product boundary

Daily Assistant is a local-first personal operating system for one user on one Mac. React + FastAPI at `127.0.0.1:8766` is the canonical product. External systems are read through adapters; user-owned state is persisted locally in SQLite.

## Domain vocabulary

- **Daily Snapshot** — the validated, last-known-good read model consumed by the home, learning, application and discovery pages.
- **Source Refresh** — one attempt to update a source-owned portion of the Daily Snapshot.
- **Source Adapter** — code translating Calendar, Notion, Brave Search, public Job Feeds or Gmail into local domain records.
- **Stale Source** — a source whose latest refresh failed; its last successful fields remain visible with an explicit stale marker.
- **Job Lead** — a public role candidate ranked against the local candidate profile. It is not an application until the user marks it applied.
- **Application** — a locally persisted job application and its current stage, next step, follow-up, deadline, contact and resume version.
- **Application Signal** — a read-only observation from recruiting email that proposes an Application change. It has no effect until accepted.
- **Life Task** — a user-authored personal, household, health, finance, errand or social task. It is stored locally and never imported from or exported to Calendar/Notion.
- **Archived v1 data** — the read-only SQLite backup retained after the generated HTML/8765 runtime was removed. It exists only for repeat-safe migration and recovery.

## Module ownership

- `daily_dashboard.snapshot` owns validation, last-known-good fallback and atomic snapshot persistence.
- `refresh_dashboard.py` orchestrates Source Adapters and publishes one Daily Snapshot.
- `api_application_signals` owns confirmation-gated Application Signal decisions.
- `application_signals` owns deterministic email classification; it never mutates Gmail.
- `daily_v2.db` is the only writable application database in the canonical runtime.

## Invariants

1. A failed source refresh never erases last-known-good data for that source.
2. Invalid snapshots never replace the current snapshot.
3. Gmail access is read-only; no email, label, archive or send operation is performed.
4. An Application Signal cannot change or create an Application without an explicit user decision.
5. The 09:00 task refreshes the canonical snapshot and opens 8766; it does not render `today.html` or start 8765.
6. Life Tasks remain separate from source-owned Daily Todos and are never overwritten by Source Refresh.
7. The retired `today.html`/8765 runtime cannot be started from this repository.
