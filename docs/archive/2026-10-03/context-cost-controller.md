# Context cost controller: first increment

2026-10-03. Implements the first stage of the [Converse proposal](../../../../../converse/docs/archive/2026-10-03/compaction-cost-policy.md).

## Behavior

- `src/economics.js`: `action-next-request-shadow-v2` prices keep, specific pointer batches and proposed summaries using the dated model table. Cache read/write and uncertain rate tiers produce intervals. The pending next request is the only horizon; observed pricing samples no longer stand in for future reuse.
- `src/harness.js`: previews the full serialized native payload without inference or context mutation. Candidate summaries reuse the actual compaction request builder, so their input and configured maximum output can be priced even without historical summary calls. The shortlist is bounded to six routine pointer candidates, one combined pointer batch and one summary batch.
- Every existing review boundary records `context_economics` with revision, candidate bundle IDs, local count basis, recovery assumptions, pricing date, exclusions, per-action component costs and a shadow recommendation. Automatic mutations based only on these costs remain disabled (`due: false`). Runtime cache validity is unknown; no reusable prefix is assumed. Historical cache buckets are reported but do not certify a new payload's hit probability.
- Periodic timing reviews remain auditable local checks. They no longer invoke a paid selector merely because the cumulative-input interval elapsed. Under pressure, deterministic pointers for routine material run before paid selection, including oversized offload candidates. Jev still handles task-relevant pressure candidates and explicit reviews; semantic rewriting and hard capacity guards remain available.
- All original source records, exact protections and revision checks remain authoritative. Explicit `/compact`, model-requested context tools, source recovery, frozen projections, signed continuations and Stop behavior retain their existing paths.

## Limits

These are local estimates of context and management costs, not billed savings or complete task costs. Summary projection size uses an empty-summary lower estimate and an uncalibrated output-envelope estimate; provider framing/tokenizer differences remain. Recovery spans zero to one full selected batch and excludes additional answer calls, repeat retrievals, retries and output changes. These assumptions do not justify automatically executing a shadow winner. Production savings and fidelity have not been measured.

Future work: exact surviving cache-boundary telemetry; calibrated summary/recovery/continuation intervals; reuse of unchanged local forecasts; later-request/waiting comparison; matched live validation; then conservative promotion of supported action choices. No background review or cache-keepalive calls are introduced.

## Verification

Focused coverage includes first-use summary pricing; warm versus cold cache costs; source-recovery expense; unknown rates/recovery/counts; unverified long-context tiers; no sample-count horizon; repeatable native previews with unchanged audit; zero inference calls for periodic checks; and pressure offload before Jev with exact pins/current request and retrievable originals.

The existing chat/Agent periodic fixtures now require zero selector calls. Existing selector-under-pressure fixtures use task-relevant content, preserving coverage of selector token ceilings, missing usage, retained advice and source recovery. Separate tests establish that routine pressure content uses no selector.

Final source checks: **171 passed, one optional saved-export replay skipped**, zero failures; syntax checks passed. Eleven dedicated action-pricing tests include preserved warm boundaries and recovery crossing a known long-context tier. All provider responses in these tests are fixtures; no paid provider calls or live savings claims.
