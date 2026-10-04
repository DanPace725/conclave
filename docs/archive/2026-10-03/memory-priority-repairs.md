# Memory priority repairs

2026-10-03. First repair increment following the uploaded-document conversation audit in Converse.

## Changes

- `conversation-memory-v2` masks quotes/fences/blockquote data consistently before deterministic capture, correction targeting, candidate extraction and admission. Original UTF-16 offsets are preserved. Clauses with quoted conditions are skipped conservatively, not partially promoted.
- Recognizes the observed `New commitment: budget should be ...` wording and natural `I actually want ...` revisions. A narrow numeric budget identity includes named subject, USD currency and exact condition suffix. Compatible unique heads are replaced, preserving the entire source passage. An unbound pronoun or multiple targets remains a candidate. Removed the fallback that contested every retained commitment when any `actually` appeared.
- Extraction reasoning follows the existing shared model capability table, fixing the observed unsupported `none` request on `gpt-6.1-sol`. Deterministic 400/401/403/404/422 provider/configuration errors do not retry automatically. Per-source unresolved capture issues survive unrelated successful turns. Existing transient retries and cancellation remain bounded.
- Named-state retirement is a separate lifecycle action, authorized by the current human request and limited to unchanged content/type of its targeted head. It cannot rewrite or grant factual authority. Historical/quoted requests and document-edit requests cannot authorize it. Retired heads leave active input; history remains inspectable.
- State-tool receipts return requested and effective status with an adjustment reason. The prompt and bounded tool ingress preserve that result so the model cannot infer retirement from an updated key alone.
- Unavailable shadow evaluation returns a null choice and explicit `fallback_action: keep`; unknown periodic sizing is null. Mandatory pressure sizing remains independent. Telemetry exposes the working guard size and pressure threshold with the continuation/reserve scope stated.

## Verification

Nine regression cases cover the exact user budget sequence across provider switches, attribution/hash preservation, unrelated corrections, quoted displays/conditions and Unicode offsets, named budgets/conditions/multiple heads, native extraction settings, persistent non-retryable failures, retirement authorization and effective receipts, and shadow timeout isolation. The updated earlier fixture rejects the former behavior of contesting a different currency/condition.

Source full suite: 209 passes, one optional saved-export replay skipped; 36 focused cases passed, followed by 25 memory/state cases after the final reference-authorization changes. Syntax checks passed. These are offline fixtures, not live provider quality/cost claims.

## Boundaries and next work

The matcher is intentionally not a general semantic correction resolver. Ordinary conversation scope still has no inferred topic boundary. No deployment database is edited and historical conversation records are not automatically repaired. Automatic memory mutation through model tools, unified read/suppression operations, calibrated shadow performance, atomic workspace patch batches, image sharing, consolidation and cross-chat ownership remain later increments.
