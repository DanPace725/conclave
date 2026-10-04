# Memory tools, atomic patches and shadow profiling

2026-10-03. Next increment following the uploaded-document conversation review. Semantic matching is reserved for a later embeddings-based increment. Image sharing and cross-chat features are deferred.

## Implemented

- `read_memory`: both automatic and named stores, as exact JSON pages of up to 8,000 characters. Both revisions are required for later pages; stale reads restart at zero. Live entries include authority/sources/scope/conflicts/dependencies. Suppressed/obsolete/unavailable entries retain identifying metadata with text omitted. Human inspection/export still retains originals.
- `suppress_memory`: 1–8 automatic IDs/named keys and both revisions, backed by the latest human source explicitly targeting every entry. Quoted/historical/reported/document-edit requests and protected named entries are rejected. Automatic suppression and named retirement commit together, with effective-status receipts. This cannot rewrite, promote or restore automatic memory, or permanently erase history. Frozen/native/pending exchanges refresh immediately; Agent persists that boundary across instances. Earlier inspection/history/file-read receipts cannot be replayed through model receipt retrieval; eligible canonical sources/current files remain readable. Named source suppression survives working-snapshot restore; a later human named-state edit can reintroduce it.
- `workspace_patch_batch`: 1–16 unique, non-overlapping find/replace operations against one fully read original file version, with one resulting document version and a per-patch receipt. Every match/version/output-size guard passes before mutation. Source, indexes and context snapshots commit in one local transaction; hosted event/snapshot persistence uses the existing PostgreSQL fence/transaction. Unmatched text and canonical prior versions remain intact; the new version requires complete readback.
- Shadow profiling: stages for history/payload/selection/tokenization/cache/pricing, usable candidate count, input bytes and failure stage. `read_telemetry.shadow_performance` covers the last 30 evaluations with cache hits, unavailable/overrun counts and elapsed-time percentiles. The history read cache exists only during one evaluation and invalidates on writes/rollback. Costs stay shadow-only; Stop remains authoritative.

## Verification

Source suite: **218 passed, one optional saved-export replay skipped**; syntax and whitespace checks passed. New fixtures cover full multi-page reads/stale revisions, mixed-store suppression, rejected authority, rollback after failed persistence, obsolete receipt/source exclusion, snapshot restore, exact patch success/failure/overlap/cascade/size/readback, history cache invalidation and profiler summaries. An existing quote test now checks actual memory content, avoiding false failures when random IDs happen to contain `900`.

Hosted PostgreSQL-compatible fixture flows exercise OpenAI Context and Claude Agent through read-memory → suppress both stores → read file → batch patch → readback → final report, using fresh services/repositories and saved Agent checkpoints. Six mocked answer calls complete each flow; no provider calls or new database migration.

## Profiling the reported conversation

Command: `node scripts/profile-shadow.js export.json profile.json 3`. The runner reconstructs three evenly sampled canonical prefixes in a disposable in-memory store and evaluates the current policy with 200 ms, 2,000 ms and repeated 200 ms allowances. It never contacts a provider or imports into a live chat. The replay uses a 256,000-byte guard and current tools/projection policy; it is not an exact replay of the historical request.

| Request sequence | Before scoped cache, initial 200 ms | After scoped cache, initial 200 ms | After, expanded evaluation | After, repeated evaluation |
|---|---|---|---|---|
| 8 | Complete, 24.2 ms | Complete, 15.6 ms | Complete/cache hit, 1.0 ms | Complete/cache hit, 0.8 ms |
| 318 | Unavailable, 297.6 ms | Complete, 154.4 ms | Complete/cache hit, 22.0 ms | Complete/cache hit, 21.1 ms |
| 614 | Unavailable, 797.3 ms | Unavailable, 207.5 ms | Complete, 193.6 ms | Complete/cache hit, 54.1 ms |

Before caching, the two late expanded evaluations also exceeded 2,000 ms. Their largest measured stages rebuilt context/loaded history repeatedly, rather than tokenizing. Removing repeated SQLite reads/JSON decoding made both expanded evaluations finish in the observed run. These are exploratory timings on one machine, with warm-up/cache/order effects, not a controlled general latency or savings benchmark. Individual synchronous stages can still overrun 200 ms; unavailable choice/null plus keep fallback remains necessary.

Saved profiles: [before](shadow-profile-before-cache.json), [after](shadow-profile-after-cache.json). They contain timings, sizes and canonical request identifiers, not the conversation text.

## Remaining work

Embedding-assisted semantic matching, consolidation, controller calibration/long-task quality trials, image sharing and cross-chat ownership remain unapplied. Batch patches cover one file, not a transaction spanning several files. Suppression follows declared source lineage; arbitrary old prose summaries without lineage cannot be guaranteed to disappear. No historical conversation or deployment database was automatically repaired.
