# ADR 0003: Gmail Copilot is read-only and confirmation-gated

- Status: Accepted
- Date: 2026-07-17

## Context

Recruiting emails contain high-value stage changes and deadlines, but automatically changing CRM state from an imperfect classifier would be unsafe. The local Mac now has a reusable Gmail read-only OAuth grant, while Codex Gmail remains a manual fallback.

## Decision

The Gmail Adapter imports normalized email envelopes into local Application Signals. Classification is deterministic and costs no model/API calls. Only metadata needed to review a proposal is persisted; full message bodies are not stored. The user must accept or dismiss every proposal. Accepting updates a matched Application or creates a minimal Application; Gmail itself is never mutated.

The canonical Implementation is a small standard-library Desktop OAuth and Gmail REST Adapter using only `gmail.readonly`. It refreshes access tokens locally and runs during the 09:00 refresh. The earlier `codex_gmail_bridge` remains behind the same import Interface as a manual fallback; both share the deterministic classifier and persistence Service.

## Consequences

- The UI accurately reports `AUTO SYNC` only when both local credential and token files exist.
- A failed Gmail request is recorded but does not prevent the daily dashboard refresh.
- OAuth credentials and tokens remain local, mode `600`, and Git-ignored.
- No silent CRM changes and no Gmail write permissions.
