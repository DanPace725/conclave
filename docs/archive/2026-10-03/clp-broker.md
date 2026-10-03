# CLP broker first increment — 2026-10-03

Source: CLP v0.2, Daniel Pace, 2025-09-18, at `E:\Coding\e2-core-framework\E2Core\Context Layer\Context Layer Protocol (CLP).ormd`, referenced by the archived [CLP path](../2026-10-02/external%20references/CLP%20path.md). Engine changes were implemented in Conclave first. [Usage, API and limitations](../../CLP_BROKER.md)

## Implemented

- Conversation-local, immutable versioned frame registration, required fields and type/one_of validators.
- Origin/parent source attestations, typed records, immutable content hashes, directed support/refute/supersede links.
- Independent support from conservative domain, exact-text and original-event grouping with copy lineage. Unknown origins and generated text do not manufacture independence.
- Strictest frame/record/query support floors. Confidence/separation remain unmeasured; requesting positive floors withholds claims.
- Frame-scoped lexical/date-filtered queries, deterministic ordered explanations, exact frame/event citations, separate unresolved clusters and candidate pagination.
- Lifecycle exclusions for removed/current-version/superseded sources and contested support. Large model receipts retain admission/withholding status and retrieve the full canonical receipt.
- CLI service calls, library exports, authenticated local/hosted HTTP actions and opt-in read-only model query tool. Existing task state is independent.
- Append-only persistence in existing SQLite/PostgreSQL events, including restart, hosted repository hydration and canonical exports; no new database migration.

## Verification

| Check | Observed result |
|---|---|
| CLP six-bundle toy | 1 admitted claim; 2 unresolved (`support<3 (1)`, `refuted (1)`); 3 evidence records excluded from claim scope. |
| Six CLP v0.2 acceptance checks | Pass: frame scoping, resolution withholding, deterministic why order, <=3 low-attention why lines, repeated-domain support collapse, exact frame version/event references. |
| Additional CLP checks | Pass: copy lineage/exact-text collapse, unknown/derived origins, stored/default floors, required/enum fields, source lifecycle, supersession, contested evidence, unsupported-feature rejection, paging/isolation, restart/CLI and a full model-tool turn. |
| Local/hosted HTTP | Pass: registration, source attestation, records, support/refute links, query and registry/record readback; hosted operations hydrate fresh PostgreSQL service instances. |
| Complete Conclave suite | 152 passed, 1 optional historical-export replay skipped, 0 failed (153 tests). |
| Syntax and patch whitespace | Pass. |

The checks use synthetic sources and fixture model responses. They establish the implemented broker behavior, not claim accuracy, editorial independence, statistical confidence, wall-time budgets, production database behavior or retrieval quality on general workloads.

## Remaining CLP work

Portable CLP wire envelopes and `.ormd.json` import/export; ed25519 signatures and trust/frame/resolver registries; effective/raw policy membranes, redaction and review queues; vector/graph brokerage and exploration; measured confidence/separation; coherence/attention telemetry. Publisher grouping currently uses the last two domain labels and can undercount multi-label public suffixes. Unrecorded copying or paraphrases remain undetected. The registered broker is manual/opt-in rather than automatic extraction of arbitrary conversation claims.
