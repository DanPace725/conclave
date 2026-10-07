# Explicit handoff MCP: first implementation

October 7, 2026. Branch: `codex/conclave-handoffs`. This increment follows the user's clarified explicit packet workflow rather than implementing the broader context-control connector proposal in full.

## Implemented

- Shared `HandoffService` / validation on append-only Conclave SQLite events. New packet IDs, named discovery, immutable versions, correction lineage, revision conflicts and persistent request deduplication.
- Three MCP tools: `save_handoff`, `find_handoffs`, `get_handoff`. Focus retains whole matching context paragraphs and preserves all other sections; ambiguity and capacity remain explicit.
- Packets are model-mediated external data, never attributed to a human or silently admitted to canonical memory. Reported app/model metadata stays unverified. Reference URLs are stored, never fetched.
- Separate private MCP package with pinned SDK `1.32.1` and Zod `3.25.76`; local stdio and secret-required loopback Streamable HTTP. The package is outside the recursive engine migration; shared engine modules remain migratable without adding SDK dependencies to Converse.
- Generated connection examples and Gemini CLI development extension inside ignored `.conclave/mcp-config/`. No user application settings changed.
- Active [plain-language checklist](../../HANDOFF_SETUP.md) and [technical guide](../../HANDOFF_MCP.md).

## Verification

- Six storage regressions passed: no ordinary-conversation leakage/human events, persistence/retry safety, correction history/stale updates, discovery/ambiguity, full-passage focus, validation and capacity boundaries.
- Four SDK transport regressions passed: independently launched origin/destination processes, concurrent identical saves, authenticated HTTP with Host/Origin/request bounds and actual `2025-11-25` negotiation, and weak-secret rejection.
- Full Conclave suite: **335 passed, 1 optional skip, 0 failures**. Source/adapter syntax and artifact credential checks passed. New MCP dependency audit reported zero known vulnerabilities at test time; this is a point-in-time registry result.
- The first HTTP Host test failed because `fetch` normalized the supplied Host header. Replaced that probe with native HTTP so it sends the actual hostile header; the server rejects it with 403. The implementation did not bypass the guard.
- Local links in active setup/context documents resolve. Runtime tests used disposable local fixtures; no paid model calls or hosted database mutations were required.

## Limits and next work

This is a local, single-user development implementation. It has not been invoked inside a real ChatGPT, Claude, or Gemini account. No hosted OAuth, account grants/revocation, online packet repository, production deployment, public plugin package or directory submission has happened.

The installed/tested SDK supports the legacy initialization contract. Earlier research discussed the `2026-07-28` specification and SDK v2, but those are not implemented here. Pinning and protocol probes establish the narrower actual contract; a later protocol upgrade needs separate client evidence.

Search/focus are deterministic keywords, not semantic ranking or calibrated relevance. The packet is limited to 64 KB and does not automatically incorporate future conversation turns. Full packet history remains retained; permanent erasure and availability lifecycle controls are future work. The generated extension uses absolute local paths and requires this checkout, so it is not a portable distributable.

Next increment: owner-scoped hosted storage and OAuth, then private ChatGPT ↔ Claude account-linking and handoff tests. The user checklist separates steps usable now from tasks waiting on that infrastructure.
