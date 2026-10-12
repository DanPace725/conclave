# Conclave review repairs — October 12, 2026

Implements the user's approval of the [code/docs audit](code-and-docs-review.md). Local source and managed Converse snapshot work only; no publication or deployment is part of this batch.

## Behavior and compatibility

- A new image upload supersedes an older `view_image` selection. A subsequent explicit selection can still switch back, and image-free follow-ups retain it.
- Clyp backups preserve exact source ORMD bytes/checksums in schema 2. Restores get fresh local conversation/event identities, with actual destination lineage in event metadata and unverified source document lineage retained in the document. This avoids random destination UUID tokenization pushing valid near-limit Clyps over 1,500 tokens. Schema-1 backups remain readable; they reconstruct source identity with unknown previous-document lineage because the original format did not include document bytes. Packet hashes and import deduplication survive the upgrade. Older schema-1-only readers cannot read new schema-2 Clyp exports; legacy packet-only exports remain schema 1.
- Inspection/dry-run validates complete restored-document budgets before opening a destination store. It does not assert destination writability. Atomic writes and external-data authority are unchanged.
- Handoff reads share the existing event cache within one operation. A history page no longer repeatedly queries/decodes the same history; subsequent operations still see new revisions. Saves retain fresh transactional revision/retry checks.
- Inference and Agent harness construction resolve credential availability once per operation. Missing credentials are not cached across operations, so later configuration remains visible.
- `npm run verify` runs syntax/resources, engine, package transport, consent browser, embedded MCP App and dashboard browser checks. It requires Microsoft Edge, local listeners and browser process permissions, and uses synthetic fixtures without provider/production calls.
- Current project context and setup docs replace contradictory historical status with a compact active view. Complete pre-review versions remain archived byte for byte; their original relative paths describe the earlier document locations. Historical release/account receipts are distinguished from fresh acceptance.

## Validation

Focused regressions: 38 passed, including an exact 1,500-token Clyp whose destination identity would overflow, schema-1 restore/deduplication, malformed/oversized backup rejection, newer-image replacement and switching back, one history query per operation, and credential refresh on later harness construction.

`npm run verify` passed: syntax/resource checks, 374 engine tests with one optional historical replay skipped, 8 package transport/consent-browser checks (including consent subcases), 14 embedded MCP App browser cases and 12 dashboard browser cases. Browser suites ran outside the restricted sandbox using synthetic desktop/mobile Edge fixtures. Local log: ignored `.conclave/review-verify.log`.

Active documentation check: 24 Markdown files, 119 relative local file links, no missing targets. External destinations and historical archive paths were not revalidated. The changed files pass `git diff --check`; the unrelated pre-existing `AGENTS.md` trailing-space edit is excluded and preserved.

After this verified source is committed, the managed Converse snapshot must be synchronized and checked there before its local commit. Its manifest records the source commit; its dated snapshot report records downstream validation. No new real-client or deployed-release acceptance is claimed.
