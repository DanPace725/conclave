# Hosted handoff preparation

The explicit save/reference/retrieve workflow now has an owner-scoped PostgreSQL repository, durable OAuth authorization provider, official SDK routes and a thin Converse entrypoint. The private pilot reuses Converse's existing signed identity cookie and database. No model API keys or extra inference calls are required for packet operations.

## Implementation

- `src/handoff-repository.js`: owner-required packet adapter, transaction row locks, immutable event persistence and exact shared tool behavior. JSONB key reordering is normalized before packet hashing; round-trip hashes match receipts. An explicit 2,000-event cap preserves old data and retry receipts while refusing additional writes atomically.
- `src/handoff-oauth.js`: encrypted client registration data; nonce-bound pending consent; one-time codes; resource/client/redirect/scopes/PKCE binding; hashed access/refresh token indexes; rotated refresh tokens; per-owner revocation; 30-day grant expiry; allowed-account and session-secret-epoch checks. A grant cannot move to another resource origin. Expired records are ignored, not automatically purged.
- `src/handoff-hosted.js`: fixed-origin Express application using the official SDK auth router and Bearer verifier; escaped consent/connection pages with same-origin CSRF; stateless Streamable HTTP; read-only grants omit the save tool; bounded payloads and generic unexpected errors. Local SDK rate limiting is supplemented by a durable 100-registration/hour pilot ceiling.
- `src/handoff-mcp-server.js`: common tool definitions now used by local launchers and hosted deployments. Pinned SDK/Express/Zod dependencies now belong to the shared engine manifest, while launchers remain in the private MCP package.
- Migration `0005_handoff_mcp`: app-scoped packet events, OAuth records and lock rows; immutable packet-event trigger. Generated schema snapshot and journal retained.
- `integrations/converse/api/mcp.js`: body-parser-disabled handler, disabled until `CONCLAVE_MCP_ORIGIN` is set, with explicit whitelisted routing markers for hosting rewrites. The application owns deployment rewrites/local-dev routes.
- `docs/HANDOFF_SETUP.md`: ongoing user document, including hosting unblock/credential rotation, sign-in, ChatGPT/Claude/Gemini CLI setup, local configurations, cross-app pilot, revocation and later publication work.

## Evidence

Five hosted regression cases use PGlite plus actual HTTP and SDK clients: owner isolation, restart, concurrent retries, immutable rows, history/conflicts, canonical hashes, OAuth discovery/registration/consent, escaped client labels, CSRF, PKCE/resource/code replay failures, rotated refresh tokens, revocation, secret/account/resource changes, read-only tool enforcement and atomic capacity refusal with retained retry receipts. The PGlite fixture serializes its single connection; genuine multi-connection Neon contention is not established by it.

The existing six packet tests and four independently spawned SDK transport tests still exercise local storage. Final full source suite: **340 passes, one optional skip, zero failures** (341 total); separate transport suite: **four passes**. Syntax, evaluation credential checks and `git diff --check` pass. The pinned SDK transport contract remains protocol `2025-11-25`; MCP v2 is not claimed. Downstream verification totals are recorded in Converse's project context after migration.

## Hosting blocker and credential handling

Vercel's connector returned 403 for the known Converse project `prj_beTOmGOU1uOwSx0Pzo0IpmAZ1UhZ` in team `team_AVDt6N5rHbtdtGb5snRBARly`. The CLI first could not write its config outside the sandbox; a workspace-local config using its existing login then returned “You do not have access to the specified account.” No change to another project's scope or deployment was attempted. Temporary copied CLI credential/config files were removed; no credentials were committed.

An overly broad `.env` inspection accidentally included the existing database password and session secret in tool output. Follow-up configuration checks use presence booleans only. The user checklist explicitly calls for resetting that database role password, updating both database URLs and rotating `SESSION_SECRET` before a live pilot, while preserving `KEY_ENCRYPTION_SECRET` and never sharing replacements in chat. No replacement secrets have been generated or submitted.

## Limits

No live database migration, deployment, push, account connector installation, real Google/Neon sign-in flow, ChatGPT-to-Claude invocation or public submission was performed. Routes stay disabled until configured. Public operational abuse management, expiry cleanup, larger direct-query storage and permanent account deletion remain future work. Local SQLite packets are not silently copied to hosted accounts. Current setup instructions cite official platform documentation; account eligibility and actual UI are not established by fixtures.
