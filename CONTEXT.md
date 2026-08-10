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
- **Application intake** — the single way an Application is created or advanced: manual entry, one-click capture from a Job Lead, or accepting an Application Signal. It owns the birth defaults and the monotonic stage-advancement rule (a terminal outcome may always be recorded; an earlier stage never regresses a later one).
- **Application Signal** — a read-only observation from recruiting email that proposes an Application change. It has no effect until accepted.
- **Life Task** — a user-authored personal, household, health, finance, errand or social task. It is stored locally and never imported from or exported to Calendar/Notion.
- **Daily Agent** — the native domain agent available across every surface. It can read bounded Daily data and can only propose writes through an Agent Draft.
- **Agent Draft** — a locally persisted proposed Life Task. It has no domain effect until the user explicitly approves it; dismissal has no side effect.
- **Agent Configuration** — the singleton local OpenAI-compatible Base URL, model and API credential used by Daily Agent. Browser responses expose only key presence, never the credential value; environment settings remain fallback.
- **Archived v1 data** — the read-only SQLite backup retained after the generated HTML/8765 runtime was removed. It exists only for repeat-safe migration and recovery.

## Module ownership

- `daily_dashboard.snapshot` owns validation, last-known-good fallback and atomic snapshot persistence.
- `refresh_dashboard.py` orchestrates Source Adapters and publishes one Daily Snapshot.
- `application_lifecycle` owns the Application stage and contact vocabulary and the monotonic stage-advancement rule; the validation types, the ranking and the database `CHECK` constraints all derive from it.
- `application_intake` owns Application birth defaults, applying the `application_lifecycle` rule for manual entry, Job Lead capture and Signal acceptance.
- `infra` owns the shared wall clock (`now_iso`) and the request-scoped database session (`get_session`), so no feature module imports another for plumbing.
- `api_application_signals` owns confirmation-gated Application Signal decisions.
- `api_daily_agent` owns the bounded model/tool loop, local model connection settings, conversation history and Agent Draft approval gate. It never receives filesystem or shell tools.
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
8. A Daily Agent model call cannot directly mutate domain records; the only registered write tool creates an Agent Draft.
9. Approving a pending Agent Draft is the only Agent path that creates a Life Task, and the same Draft cannot be approved twice.
