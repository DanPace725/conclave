# Conclave code and documentation review

2026-10-12. Reviewed source at `c903780c0a07c74664ea15e5e972040cb13f1c36`.
This is a focused first pass, not an exhaustive correctness or security audit.
No runtime code, saved user data, deployment, or Converse snapshot was changed.
The existing edits to `AGENTS.md` and the untracked reference image were left alone.

The pass traced handoff save/read/retry/history, Clyp rendering and backup,
hosted repository and OAuth boundaries, dashboard/MCP adapters, and relevant
image, workspace, agent, provider, and context-persistence paths. Findings below
separate locally reproduced defects from simplification proposals. No production
database, model API, or real ChatGPT/Claude connection was exercised.

## Reproduced defects

### 1. P2: An old image selection overrides a new upload

Location: [image selection](../../../src/images.js#L76), with selection events
written by [view_image](../../../src/harness.js#L1237).

`imageInput()` finds the latest eligible `image_selection` anywhere in the
conversation and gives it unconditional priority over the current user's
attachment. That selection can be from an earlier turn.

Reproduction: upload A, upload B, use `view_image` to select A, then send a new
message with upload C. The saved answer request contains A's immutable image
reference instead of C's. The probe used the real service/request-building path
with a fixture provider; distinct attachment/event IDs establish the wrong
selection even though the synthetic PNG bytes were identical.

Impact: a request asking about a new image is supplied the wrong pixels. The
model might recover by calling `view_image`, but correct initial input should
not depend on that recovery.

Repair direction: give a current-turn upload priority over an older selection;
a `view_image` call made after that upload may override it. Preserve selected
images for image-free follow-ups, signed-continuation refresh, suppression,
removal, and message-revision exclusion. One regression covering the upload /
selection / new-upload sequence would be sufficient alongside existing cases.

### 2. P2: A valid near-limit Clyp can fail backup restore

Location: [regeneration and budget check](../../../src/handoff-portability.js#L64),
[ORMD lineage](../../../src/clyps.js#L43), and
[backup inspect/dry-run](../../../packages/conclave-mcp/src/backup.js#L38).

Saving and backup validation accept a valid document, but restore regenerates
its ORMD with fresh handoff and previous-event IDs. UUID strings of equal byte
length can have different o200k_base token counts. Thus the new metadata can
push an unchanged packet over the 1,500-token limit.

Reproduction: a saved **1,499-token** Clyp exported and passed bundle validation.
An ordinary restore attempt produced **1,501 tokens** and failed with `capacity`.
A second probe selected a valid generated UUID and reproduced **1,503 tokens**.
The latter fixture retains the exact backup and target ID for deterministic
replay. Restore rolled back completely: zero destination conversations remained.

Impact: backup availability depends on randomly regenerated identity metadata.
`inspect` / `import --dry-run` reports `valid: true` after structural/checksum
validation without exercising this restore constraint.

Repair direction: specify a restore representation that preserves accepted
packet text and the bound independently of regenerated identifier costs. A
reserved metadata allowance can protect future saves, but cannot by itself
repair already accepted near-limit backups. Consider preserving the original
bounded document while recording new import identity/provenance separately.
This requires an explicit backup/ORMD compatibility decision; silently trimming
content, retrying UUIDs until one fits, or removing the bound would be poor fixes.
Dry-run should either validate restore constraints or clearly distinguish
structural validity from restorability. Preserve fresh destination IDs, original
packet hashes, unverified import lineage, idempotent import, and atomic rollback.

## Simplifications worth doing

| Priority | Change | Evidence and behavior to preserve |
|---|---|---|
| First | Reuse a packet's events within each handoff read. | [Metadata](../../../src/handoffs.js#L61) reloads history to recover the first event on repeated calls. Reading a 20-item page from a synthetic 100-revision handoff made **22 SQL history reads and decoded 2,222 event rows**. The existing [Store.withReadCache](../../../src/store.js#L103) reduced that operation to **one history SQL read**. Start with operation-scoped read caching or a per-operation first/latest/revision index; preserve ordering, readable IDs, exact hashes and current-revision checks. This measures repeated work, not production latency. |
| Next | Resolve credential availability once within a service operation. | [environment()](../../../src/provider.js#L12) starts PowerShell for every missing Windows environment variable. Three successive lookups of a synthetic absent variable took **370 / 219 / 217 ms**. Found values are cached in `process.env`; misses are repeatedly expensive. Reuse an availability result within one operation, while rechecking on later operations and respecting explicit credential overrides. Do not introduce a permanent negative cache that hides newly configured keys. |
| Next | Add one documented complete offline verification command. | [scripts/test.js](../../../scripts/test.js#L9) discovers only top-level `test/*.test.js`. The four package transport cases and the consent-browser test require separate commands. Retain the fast engine suite; add an aggregate command that explicitly includes package suites and reports browser prerequisites. This reduces uncertainty about what “all tests passed” means without adding many tests. |
| Next | Compact `PROJECT_CONTEXT.md` into current state, open work, and evidence links. | It still calls CLAMP local/unpublished while newer entries describe merged/main work, and its “last verified production” entry precedes the current source commit. [The development method](../../DEVELOPMENT_METHOD.md) already says to replace superseded entries and archive detail. Preserve historical evidence in the archive; avoid treating old release statements as live status. Update active setup docs where “prepared” and older tool signatures conflict with later sections. No live deployment claim should be inferred from this review. |

The handoff API also repeats packet constraints across Zod, domain validation,
Clyp validation, and prose. Sharing field limits and contract examples would
reduce drift. Keep authoritative domain checks: direct library, backup, local
MCP, and hosted callers all need them. A broad rewrite of `harness.js` is a
lower priority than the measured, bounded changes above.

Expired OAuth records and retained lock rows are already documented operational
debt in [HANDOFF_MCP.md](../../HANDOFF_MCP.md). They were
not counted as a newly discovered defect. Cleanup must retain cross-instance
serialization; deleting active lock rows casually can introduce write races.

## Validation and review artifacts

- `npm test`: **373 passed, one optional skip**, no failures.
- `npm run check`: syntax, compiled MCP UI/source parity, and credential-artifact
  checks passed.
- Package MCP transport suite: **four passed**, including independent-client
  restart, simultaneous identical retries, HTTP authentication, and invalid
  authentication configuration.
- Synthetic consent browser: desktop, mobile, and scriptless callback cases
  passed (**one parent test and three subtests**). The first sandbox
  attempt failed to launch Edge; the same test passed outside the sandbox.
- Relative file-link check across **28 active Markdown documents** found no
  missing file targets. Anchor correctness and external URLs were not checked.
- The two defect probes and simplification measurements used isolated,
  in-memory stores and fixture providers; they made no paid inference calls.

Local ignored evidence, retained in this checkout:

- [Defect probe](../../../.conclave/audit-probes-2026-10-12.mjs)
- [Defect results](../../../.conclave/audit-probe-results-2026-10-12.json)
- [Boundary backup and target-ID fixture](../../../.conclave/audit-clyp-fixture-2026-10-12.json)
- [Simplification measurements](../../../.conclave/audit-simplification-results-2026-10-12.json)
- [Engine test log](../../../.conclave/audit-tests-2026-10-12.log)
- [Source-check log](../../../.conclave/audit-check-2026-10-12.log)
- [Transport and initial browser log](../../../.conclave/audit-extra-tests-2026-10-12.log)
- [Successful consent-browser log](../../../.conclave/audit-consent-browser-2026-10-12.log)

Suggested sequence: fix image precedence; decide the backward-compatible Clyp
restore contract; reduce repeated handoff reads; compact current-state docs and
document complete verification. Runtime fixes should begin in Conclave and
follow its existing source/test/snapshot workflow. Publication and deployment
are separate steps.
