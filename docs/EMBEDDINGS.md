# Embedding-assisted context and memory

Conclave combines existing keyword retrieval with OpenAI `text-embedding-3-small` vectors. Hosted deployments store 1,536-dimensional vectors in Neon/PostgreSQL with `pgvector`; local deployments use a rebuildable SQLite index and exact cosine comparison. Both GPT and Claude use the same embedding index. No new provider credential is required.

## Behavior

- `search_history` merges keyword and semantic candidates using reciprocal rank fusion, returns at most four source excerpts, and retains optional bounded Jev reranking. Exact `retrieve_event` recovery remains canonical.
- Automatic-memory activation can include semantically relevant non-binding candidates. Binding records, dependency/conflict closure, source authority, objective scope, capacity guards and frozen projections retain their existing rules. Similarity cannot capture a commitment, correct a record, merge identities, or change truth/confidence. Named state remains in the existing working projection; it is not independently vector-indexed in this increment.
- Every lookup excludes removed/suppressed/revised sources and obsolete workspace versions. Memory lifecycle/objective filters run before vector ranking; returned keys are checked again against the canonical current catalog. Historical versions remain recoverable through explicit source IDs when existing removal/suppression rules permit.
- Vectors have a conversation-local key covering provider model, chunk policy, source identity/version, offsets and exact text hash. No cross-conversation search is enabled. Vectors and metadata are derived indexes, separate from immutable source/audit tables. They are not included in canonical exports; restore/index rebuilding needs the originals and embedding provider.

## Bounds and operation

Indexing happens only during inference that needs semantic retrieval, never during saved-chat opening, inspection, uploads, manual saves or suppression/restoration. Each Chat turn or Agent step indexes at most 32 missing items and makes at most three embedding calls, with an eight-second timeout per call. Sources use existing 1,600-character chunks with 160-character overlap; memory entries retain their exact source spans. Query input is bounded to the first 1,024 characters. Memory entries precede recent source chunks in backfill priority. Unchanged entries reuse stored vectors; query vectors are cached within the inference request.

Large histories are partially indexed and accumulate coverage across inference requests. `embedding_index` records indexed/pending counts. This is a bounded lazy backfill, not a background worker or whole-history-completion guarantee. Until later batches run, keyword retrieval remains available for unindexed passages. Existing stored-key metadata is currently scanned per lookup; vectors remain in PostgreSQL and only matching result metadata returns to the application.

Exact cosine search is the initial PostgreSQL path, with a B-tree index on conversation/model/policy/kind. Add HNSW only after measuring scoped corpus size, latency and recall. Approximate filtering needs its own evaluation. Similarity >= 0.3 is a provisional relevance cutoff, not measured confidence; the first smoke query is not a calibration benchmark.

`embedding_request`, `embedding_response`, `embedding_index` and `embedding_failure` preserve purpose, provider/model, native usage, coverage, elapsed time and fallback errors. Embedding tokens are separately exposed in `metrics.embeddings` and Agent diagnostics; generation-only cost tables do not value them. Agent run limits include reported embedding input tokens. Failed/unreported calls retain a conservative UTF-8 byte reserve under `reserved_unknown_tokens`, never represented as native billed usage. Failure disables further embedding attempts in that inference request and falls back to keywords. User cancellation still aborts the run.

## Setup

1. Apply the normal database migrations, including `drizzle/0002_embeddings.sql`, on the intended branch with `DATABASE_URL_UNPOOLED`. It enables `vector` and creates the derived `conclave.embeddings` table. Runtime does not run schema changes.
2. Keep the existing server-side `OPENAI_API_KEY`. Embeddings default on for the production service when OpenAI is available, including Claude conversations. `CONCLAVE_EMBEDDINGS=off` disables them without deleting the derived index. Dependency-injected fixture services default off and can opt in with `embeddingEnabled`, `embeddingFactory` and `embeddingBackend`.
3. Implement/commit changes here, migrate with `node scripts/sync-converse.js --apply --target ../../converse`, check parity, and validate Converse before deploying. Deploy only after the target branch migration succeeds.

Useful checks:

```powershell
node scripts/test.js test/embeddings.test.js
node scripts/embedding-smoke.js --live --out docs/archive/2026-10-04/embedding-smoke.json
node scripts/profile-hosting.js --out docs/archive/2026-10-04/hosting-profile.json
```

The native smoke makes one bounded OpenAI call when the fixture passes. Set the provider credential through the normal environment; never include it in command text.

## Recorded evidence and remaining work

2026-10-05 repair: the database configured in Converse's `.env` was missing `conclave.embeddings`. Its existing migration completed successfully; a direct read verified the table and vector extension. This confirms that configured database's schema, not a hosted retrieval-quality result. Wrapped SQL schema/permission/authentication failures now record their SQLSTATE and use a two-minute conversation-local cooldown across harness reloads. Retrieval stays lexical during that interval and retries afterward; ordinary transient failures still retry on the next inference request.

Eight focused fixtures cover response validation, paraphrased lookup, exact-source recovery, cache/restart reuse, memory authority and suppression, workspace versions/removal/restoration, isolation, backfill/call bounds, fallback/unknown usage, PostgreSQL persistence and Agent usage accounting. The native smoke recovered a source and memory with zero keyword matches in one call/42 reported input tokens. [Record](archive/2026-10-04/embedding-smoke.json).

The PostgreSQL path passed with PGlite's real pgvector extension. A live migration attempt against the configured disposable Neon `converse-hosting-check` branch failed authentication before executing schema changes. Production migration and hosted live retrieval remain unverified. Broader retrieval-quality evaluation, durable indexing jobs, semantic correction targeting, named-state vector indexing, cross-chat ownership and approximate index tuning remain open.

Primary references: [Neon pgvector](https://neon.com/docs/extensions/pgvector), [pgvector search/index/filter behavior](https://github.com/pgvector/pgvector), [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings).
