# Automatic memory: first implementation

2026-10-03. Design review against the current Conclave and Converse checkouts. No runtime behavior changed. Based on the attached `automatic-memory-proposal.md`.

## Recommended scope

Implement conversation-local commitment/correction capture, bounded activation, and an inspectable provenance ledger for Context and Agent. Keep ordinary browser Chat, cross-chat sharing, episode consolidation, learned policies, and unattended workers out of this first increment. The latter features require separate evaluation or ownership/deployment work.

The proposal's distinction between retention, warrant, and activation should become an implementation invariant. A remembered assistant estimate is still an assistant estimate. A high retrieval score cannot confirm a claim. An explicit user instruction remains binding in its scope even when rarely retrieved.

## Confirmed integration points

| Area | Current code | Required change |
|---|---|---|
| Source persistence | `src/store.js`, `src/context-repository.js` | Use new append-only memory event kinds and rebuildable views. PostgreSQL hydrates the same Store and persists generic events under a lease/sequence/revision fence. Flush the user source before any additional memory inference; do not mistake an in-memory append for hosted durability. |
| Context capture | `src/harness.js`: `ask`, `addMessage` | Capture after the user event and before review/projection. Record failure and retain the exact current message if extraction fails. |
| Agent capture | `src/agent.js`: `startAgent`, `stepAgent`, checkpointing | Agent start bypasses `ask` and initially constructs a harness with only a provider name. Save a capture job with the objective; complete critical capture before the first answer projection with the real provider and run cancellation signal. Do not repeat capture on every tool step. |
| Named state | `src/state.js`, `src/protection.js`, `Store.commit` | Existing named state has three statuses and is always protected. Add an explicit bridge for currently binding memory; keep dormant/candidate records outside snapshots. Sanction lifecycle changes in store validation. Do not give generic compaction permission to retire binding state. |
| Alternate writer | `src/harness.js`: `updateState`, `toolResult('update_state')` | Route model proposals through the same authority rules; block an assistant-sourced estimate from replacing a binding user commitment. Preserve compatibility with manual human state edits. |
| Projection | `src/harness.js`: `input`, `modelSegments`, frozen projections | Select at safe boundaries before the recent tail. Keep the chosen memory projection frozen through a tool loop. Include memory in complete native-input accounting and request breakdowns. |
| Source changes | `src/documents.js`, `src/workspace.js`, `src/service.js`: revisions/document lifecycle | Invalidate dependent heads after source revisions/removal; propagate through derived copies. Restoring an old context snapshot must not resurrect superseded or suppressed memory. |
| API and export | `src/service.js`, `src/http.js`, `src/context-repository.js` | Expose current/history/source views and fenced correction/suppression mutations. Export ledger and controller decisions with existing canonical events. |
| Converse UI | `public/workspace-editor.js`, `public/context-garden.js` | Extend the existing Memory tab: content, authority/resolution, lifecycle/activation, source, scope, previous versions, and “don't use this.” Avoid another panel. |

Actual engine checkout: `E:/Coding/converse/CLA/conclave`. Actual application checkout: `E:/Coding/converse/converse`. Implement engine changes in the former, then use `scripts/sync-converse.js`; the source-commit/hash manifest prevents independent vendor edits.

## Build sequence

1. **Ledger and lifecycle.** Add `src/memory.js` with versioned atomic records, source spans/hashes, conversation scope, attribution, independent resolution/lifecycle, correction links, and source dependencies. Replay event-backed heads. Validate source eligibility, relations, ownership, expected memory revision, and idempotency before committing a batch. Track memory revision independently of context revision; hosted sequence fences cover event-only writes too.
2. **Bounded extraction and authority.** Add `src/memory-extractor.js`. Propose deltas from one new user event and a bounded shortlist of heads. Use a bounded structured model call with a distinct purpose, token/output/time allowance, and cancellation. Require exact source wording for user commitments, including conditions and quantities. Span/hash checks validate provenance, not semantic entailment. Quoted instructions, tentative language, ambiguous corrections, and recommendations cannot automatically become binding commitments. Keep those candidates unresolved; provide both passages when a suspected correction makes old categorical reuse unsafe. Record rejected/failed/partial capture and retry only eligible uncommitted work.
3. **Activation and state bridge.** Add `src/memory-controller.js` with deterministic eligibility before scoring. Reserve space for binding commitments first, then select ordinary records by relevance, freshness and diversity within complete request capacity. Do not truncate or silently omit a binding condition. Fail explicitly when binding state cannot fit; paging/decomposition needs an execution gate that ensures relevant constraints are read before consequential action. Scores describe priority, with confidence unknown. Materialize only active binding state through a dedicated validated transition.
4. **Context/Agent wiring and inspection.** Capture before answering in both paths, share the authority gate with model state updates, save the activation decision and source pointers, and add correction/suppression/history API and Memory UI. Suppression excludes lookup/activation but does not claim to erase the original source. Manual edits append a human source and a new record version.
5. **Validation and migration.** Test in Conclave; commit verified source; migrate with `node scripts/sync-converse.js --apply`; verify `--check`; run Converse checks and focused browser flows; update both project contexts with demonstrated behavior and remaining work. Preserve unrelated application changes.

## Acceptance checks

- A budget and conditional clearance constraint survive pressure and model switches; assistant arithmetic cannot replace either.
- “Maybe $500,” an assistant recommendation, and “keep it below $500” retain distinct statuses. Quoted/document instructions gain no controller authority.
- Explicit corrections supersede before the next answer; ambiguous corrections preserve both passages and prevent categorical reuse. Conditions, entities and units prevent unsafe merges.
- Repeated paraphrases and memory recall add zero independent support. Unsupported promotion count is zero in deterministic authority fixtures.
- Message edits, current-file version changes, suppression and document removal invalidate dependent copies after restart. Context restore cannot revive an obsolete head.
- Capture retries are idempotent; stale deltas/fences fail. A hosted source commit survives extraction failure. Stop cancels memory inference; incomplete output creates no commitment.
- The projection stays frozen within tool exchanges, refreshes at the next safe boundary, keeps scope and authorship, and reports binding-capacity overflow.
- SQLite and PostgreSQL produce equivalent ledger/head/history views; service exports retain provenance. Memory edits and “don't use this” work after reload on desktop and mobile.

## Evaluation limits and later work

Offline fixtures establish invariants, not general usefulness or savings. Run bounded matched Context and Agent tasks against the current layered engine with fixed provider/model/settings/budgets. Record correction fidelity, constraint adherence, stale-memory errors, completed tasks, latency, extraction usage, request carry, cache buckets, and priced/unpriced totals. Extraction overhead may exceed its benefit on short chats.

After that evidence, add episode portfolios and resumption packets, then slow consolidation, then controller adaptation as separate increments/ablations. Do not initialize learned utility from model self-reported success. Cross-chat memory needs stable individual ownership/access semantics; the shared app password does not supply them.
