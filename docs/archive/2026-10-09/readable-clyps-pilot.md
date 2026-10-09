# Readable Clyps and prepared live pilot

October 9, 2026; local work on `codex/clamp-clyps`. The user requested readable
conversation identifiers and chose preparation of a ChatGPT ↔ Claude pilot as
the next CLAMP increment.

## Implemented

- Stable `readable_id` from the first packet title plus its account-local event
  sequence, e.g. `dashboard-planning--2`. Distinguishes duplicate titles and
  survives title changes/restarts. Legacy events derive the name without edits.
- All MCP handoff operations accept readable names; canonical UUID IDs remain
  accepted. Saves normalize update/link identities before retry fingerprinting.
  Persisted packet links and immutable ORMD lineage keep canonical identities.
- Dashboard list/detail, continuation copying, exports, graph navigation and
  fragment URLs use names. Old UUID bookmarks open and become readable URLs.
  Linked labels are captured with pinned revision metadata; labels are claims.
- PostgreSQL alias reads use the account-local first-packet sequence to select
  one conversation, then verify its full name. They retain the existing small
  read footprint and owner boundary. A mismatched slug never selects by number.
- [Live pilot](../../CLAMP_PILOT.md), seed and executable independent-stdio-client
  rehearsal. Three prompts cover creation, Claude continuation and ChatGPT
  return, with bounded counts, exact fidelity, revision/checksum and graph checks.

No schema migration or paid model call. References are scoped to an account or
local store; restoring fresh identities also creates fresh references. These
names identify saved handoffs, not ordinary app conversations.

## Evidence

- 34 existing/focused handoff checks pass: local persistence, readable duplicate
  names/renames/retries, MCP schema and independent transports, Clyps, portability,
  PGlite hosted/account boundaries, per-packet read size and dashboard API.
  One small new reference regression; existing cases cover the remaining changes.
- Ten existing desktop/mobile Edge dashboard checks pass, including readable
  continuation, opening a UUID bookmark, pinned graph traversal, revision/export,
  inert text, fallback copying, late responses and expired access. Initial run
  passed eight; two race tests awaited a UUID request after URLs became readable.
  Their gate now watches the actual reference; rerun passes all ten.
- Syntax/resource check passes. Local rehearsal passed three saved revisions
  at 392, 427 and 430 complete ORMD tokens, preserving all fixture constraints and
  its unresolved question. A supporting pinned Clyp, process restart, title change,
  identical retry and original revision reads were exercised.

This evidence uses fixtures and SDK clients. Live ChatGPT/Claude discovery,
OAuth grants, real model continuation quality and hosted dashboard acceptance
remain unobserved. Publication/deployment must precede the live run; this batch
does not push or deploy. The prior CLAMP source/snapshot commits remain recorded
in [the initial increment](clamp-clyps.md).

Committed source: `3111e39`; Converse runtime snapshot: `7d30d50`. All 108 managed
files match that source. Converse syntax/engine checks and 203 application tests
pass, with one optional live Neon skip and checkout-local temporary storage.
The synthetic preview on port 59618 was refreshed; the previously selected
Demo workstream 8 now opens as `demo-workstream-8--18`.
