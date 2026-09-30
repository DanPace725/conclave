# Initial implementation — 2026-09-30

The standalone CLI is working. Converse was used as a reference for native API transport/provenance patterns; its app and repository were not edited.

Implemented:

- Append-only SQLite events and context snapshots, conversation IDs, restart/resume, complete request payloads, response IDs, usage, failure receipts, transcript export.
- Model-controlled context edits, source-linked derived bundles and parents, pinned/verbatim protection, current-request protection, context view and revision diff.
- Historical search, exact/pageable retrieval, sequence-range retrieval, old-bundle resolution, bounded text-file ingress.
- Deterministic retention selection, model-written compaction, configurable budgets and call limits, append/summary/layered modes.
- OpenAI Responses adapter with existing Windows environment keys, configurable model, offline demo, and opt-in small comparison runner.

Checks kept small:

- Four offline smoke checks passed: edit/evict/retrieve/restart, invalid edits and budget failures, oversized ingress and provider failure recording, runtime identity and skipped marginal compactions. The ingress check also verifies that search excerpts contain a late matching term.
- The configured key lists `gpt-6-luna`. A three-call live conversation recovered `orchard-719` after eviction, saved it in a source-linked evidence bundle, and answered that architecture A was not conclusively rejected.
- One additional compaction call reduced the serialized projection from 3,018 to 1,890 characters while keeping “A may still work if X changes” and its source/parent links.
- Total live inference usage for these four calls: **3,694 input tokens and 253 output tokens**, including the context operation. No broad benchmark was run.

Local receipts (Git-ignored):

- [Retrieval/edit receipt](<E:/Coding/converse/CLA/conclave/.conclave/live-smoke/receipt.json>)
- [Compaction receipt](<E:/Coding/converse/CLA/conclave/.conclave/compaction-smoke/receipt.json>)

Practical limitations:

- The installed Node SQLite build lacks FTS5; this machine uses the lexical fallback. No dependencies were installed.
- The input guard uses a conservative UTF-8 byte proxy, not an exact model tokenizer. Actual provider token usage is recorded separately.
- Source/schema/pin validation protects structure; fidelity of unpinned summaries still needs judgment. Live results cover only these small fixtures.
- The user ran the small three-mode comparison: all answers preserved the exact fixture code and conditional caveat. Layered used 4,683 input tokens versus append's 3,253, including compaction overhead. Quality parity, net token savings across long tasks, billing savings, and the MVP's held-out completion criterion remain unproven.
- Other providers, Jev, embeddings, UI/integration, and full CLP infrastructure remain deferred.

Start from [README.md](<E:/Coding/converse/CLA/conclave/README.md>).

## Follow-up changes — 2026-09-30

The short conversation review prompted three practical changes:

- Every inference request supplies the configured provider/model identity, including compaction requests. Instructions keep human first-person examples and assistant self-reports attributed.
- Compaction skips an API call below 1,000 bytes of eligible content and commits a generated rewrite only when it reduces the full serialized projection by at least 15%. Skipped attempts report their reason.
- CLI search now uses the model tool's matching-passage excerpts, fixing results that previously showed only the beginning of a long source. Retrieval instructions also favor distinctive keywords and answering directly from sufficient excerpts to reduce redundant calls; this guidance is not a guarantee of model behavior.

An explicitly delegated GPT-6 Luna agent exercises the CLI in an isolated data directory. Its [live validation report](<E:/Coding/converse/CLA/conclave/.conclave/luna-cli-validation/report.md>) and [receipt](<E:/Coding/converse/CLA/conclave/.conclave/luna-cli-validation/receipt.json>) record actual coverage, usage, failures, and limits. These local artifacts are Git-ignored.

The completed run covered every named CLI command and chat slash command, with nine completed main exchanges and one answer each in append and summary modes. Pins and the revised decision survived; exact source retrieval and final export checks passed. Total live usage was 23 requests, 61,982 input tokens, and 2,102 output tokens, exceeding the intended 60,000-input cap by 1,982. Two failures were saved: a three-call limit and a compaction response truncated at output=400. The final eviction exercise removed the document excerpt but left earlier answers containing the fact, so it is not evidence of complete removal from working context.

## Attention and memory phase — 2026-09-30

The proof of concept is accepted; development now follows [DEVELOPMENT_ROADMAP.md](<E:/Coding/converse/CLA/conclave/DEVELOPMENT_ROADMAP.md>) while long-form user testing is deferred.

Implemented:

- A separate deterministic attention policy: budget/protection explanations, task/status/type priorities, recorded selection receipts, and balanced or chronological compaction selection. This is a heuristic decision function, not Jev or a learned classifier.
- Incremental, rebuildable source-chunk and context-bundle indexes. Search ranks distinct keyword matches and returns one passage per source. Catalog cards show frame, source references, revision, and active/proximal/indexed/archived proximity.
- Focused document ingress (`ingest --focus`), lossless offload to retrieval pointers (`offload` and model `offload_context`), past-bundle inspection, revision listing, and restoration as a new revision with later pins preserved.
- Existing SQLite data upgrades its derived indexes without modifying canonical events or context snapshots. No new dependencies.

Validation: six offline checks passed, plus [a CLI walkthrough receipt](<E:/Coding/converse/CLA/conclave/.conclave/attention-demo/receipt.json>) covering the new commands and [an existing-data migration receipt](<E:/Coding/converse/CLA/conclave/.conclave/attention-migration/receipt.json>). **Zero API calls** in this phase. The walkthrough's single document bundle went from 1,394 to 529 serialized bytes when offloaded; this is a mechanical example, not a token-savings benchmark.

Remaining: structured relationships/conflict handling, an optional small-model decision adapter, reusable local API, other providers, and deeper CLP resolution/policy semantics. Keyword priority is not semantic relevance; proximity is not confidence; restored projections may need compaction before inference. Long-form quality and net savings remain unmeasured.
