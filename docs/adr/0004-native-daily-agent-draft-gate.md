# ADR 0004: Native Daily Agent with a draft approval gate

## Status

Accepted — 2026-08-10

## Context

Daily already embeds Pi Web at `/agent`. Pi Web is a separate-origin coding workspace with its own sessions, permissions and project-file tools. It is useful for programming, but it does not understand Daily's domain model and should not be given direct access to `daily_v2.db`.

TIM demonstrates a different pattern: a domain agent gets a small tool surface, reads current state, and routes consequential writes through explicit proposals. Daily needs that interaction without merging the privileged coding agent into the application backend.

`TodoState` cannot represent a new local to-do. It only records completion state for source-owned Calendar and Notion items, so creating arbitrary rows there would produce data that the Snapshot UI cannot render.

## Decision

Add a native Daily Agent to the FastAPI runtime and mount its React side panel once above every route.

- The model connection is OpenAI-compatible and uses `DAILY_AGENT_*`, falling back to the existing `AI_TUTOR_*` connection.
- Read tools expose bounded projections of the Daily Snapshot, Life Tasks, Applications and NeetCode progress.
- The only write tool in the first release is `draft_life_task`.
- `draft_life_task` inserts an `agent_drafts` row and does not insert a `life_tasks` row.
- `POST /api/v1/daily-agent/drafts/{id}/approve` validates the stored payload, creates the Life Task and resolves the Draft in one transaction.
- Resolved Drafts cannot be approved or dismissed again.
- No shell, filesystem, arbitrary network, arbitrary SQL, Calendar mutation, Notion mutation, Application mutation or NeetCode mutation tool is registered.
- Pi Web remains separate and unchanged as the coding Agent.

## Consequences

The user gets a domain-aware Agent from every Daily page while the authority boundary remains visible and testable. Conversation history and Drafts remain local in SQLite. Creating source-owned Todo items stays unavailable until Daily has a real local task concept or an explicit adapter write contract; the Agent will not fake that capability with `TodoState`.
