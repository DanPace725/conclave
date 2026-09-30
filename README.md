# Conclave

Standalone local prototype for **persistent trajectory, mutable context**. The full conversation stays in SQLite. A versioned projection determines what the next model call sees; evicted details can be retrieved from original events.

## Start

Requires Node.js **22.13+**. No package install is needed. This version uses OpenAI's Responses API and an existing `OPENAI_API_KEY`; on Windows it also reads User/Machine environment variables if the process did not inherit them. Credential values are never printed or saved by the adapter.

From `E:\Coding\converse\CLA\conclave`:

```powershell
node scripts/demo.js                 # offline demonstration, no API calls
node src/cli.js chat --model gpt-6-luna
```

The model defaults to `CONCLAVE_MODEL` or `gpt-6-luna`. Reasoning defaults to `none` and output to 1,000 tokens to keep initial calls small. There is no automatic model fallback. `node src/cli.js models` lists models available to the configured key. The adapter follows the [Responses function-calling contract](https://developers.openai.com/api/docs/guides/function-calling); model settings are based on the [GPT-6 Luna documentation](https://developers.openai.com/api/docs/models/gpt-6-luna).

The CLI prints a conversation ID. Resume with:

```powershell
node src/cli.js chat --conversation conv_YOUR_ID --model gpt-6-luna
```

Inside chat, use `/context`, `/diff`, `/history`, `/stats`, `/attention`, `/memory [query]`, `/compact`, `/pin exact constraint`, `/ingest E:\path\notes.md`, `/offload cb_BUNDLE_ID`, `/restore REVISION`, and `/quit`. Pin hard constraints explicitly; pins are protected in code. Context edits and compaction are model judgments and can still change meaning in unpinned material.

## Inspect and control

```powershell
node src/cli.js list
node src/cli.js ask "What did we decide?" --conversation conv_YOUR_ID
node src/cli.js context --conversation conv_YOUR_ID
node src/cli.js diff --conversation conv_YOUR_ID
node src/cli.js history --conversation conv_YOUR_ID
node src/cli.js search "parser architecture" --conversation conv_YOUR_ID
node src/cli.js retrieve evt_SOURCE_ID --conversation conv_YOUR_ID
node src/cli.js ingest "E:\path\notes.md" --conversation conv_YOUR_ID
node src/cli.js evict cb_BUNDLE_ID --conversation conv_YOUR_ID
node src/cli.js offload cb_BUNDLE_ID --conversation conv_YOUR_ID
node src/cli.js attention "current task keywords" --conversation conv_YOUR_ID
node src/cli.js memory "parser" --conversation conv_YOUR_ID
node src/cli.js bundle cb_BUNDLE_ID --conversation conv_YOUR_ID
node src/cli.js revisions --conversation conv_YOUR_ID
node src/cli.js restore 5 --conversation conv_YOUR_ID
node src/cli.js compact --conversation conv_YOUR_ID
node src/cli.js stats --conversation conv_YOUR_ID
node src/cli.js export .conclave\transcript.json --conversation conv_YOUR_ID
```

`evict` affects working context only. `offload` replaces a sufficiently large unprotected bundle with a small retrieval reference; the original bundle and its lineage remain indexed. `bundle` expands a current or past bundle. The layered model has an `offload_context` tool as well as `edit_context`.

`retrieve` prints the full original source locally; model retrieval returns bounded, pageable excerpts. Ingress saves an entire text file before selecting an excerpt. The default admits its first 2,000 characters; `--focus "task keywords"` chooses a matching chunk instead:

```powershell
node src/cli.js ingest "E:\path\notes.md" --focus "parser deployment" --conversation conv_YOUR_ID
```

If no chunk matches, ingress uses the initial excerpt. Selection is lexical, not a semantic relevance judgment. Search ranks overlapping chunks by distinct query-term matches and returns one matching passage per source, with exact source offsets.

Data lives under `.conclave/` (Git-ignored), or `--data DIR`. Each conversation has an inspectable `context.md`. It is a generated view: edit through the harness, not directly in this file. SQLite snapshots are authoritative and recreate the view after restart. Transformation events preserve snapshots, source IDs, parents, before/after hashes, and edit receipts. Event and snapshot tables reject UPDATE/DELETE through this connection; this is an application invariant, not protection against someone replacing the database externally.

The context index contains overlapping source chunks and current/past bundles. `node src/cli.js reindex` rebuilds both from canonical events and transformation receipts; an optional full-event FTS5 index is also rebuilt where available. Existing databases initialize the new indexes on opening without rewriting history or snapshots. CLP fields are a small derived subset; retention controls are Conclave extensions. This implementation does not claim full CLP conformance.

`memory` lists bundle content, source references, frame, revision, and proximity: **active** in the projection, **proximal** through a live reference, **indexed** outside the projection, or **archived** when superseded and outside it. These are availability states, not truth/confidence scores. Results are bounded to 50 cards; use a query or `bundle ID` for a specific item.

`restore` creates a new revision from an earlier snapshot, preserving all currently pinned/verbatim content even when those pins were added later. It does not undo events, delete later snapshots, or immediately call the model. Restoring a large snapshot can exceed the input budget; normal inference will check that budget before submitting it.

## Context modes and limits

- `--mode layered` (default): source-linked segments, model edits, automatic compaction, retrieval.
- `--mode append`: full completed history on every call; retrieval remains available, edits/compaction disabled.
- `--mode summary`: automatic rolling summaries of older material; retrieval remains available, discretionary model edits disabled.

Automatic compaction starts around 75% of the configured budget, preserving pins, verbatim-required segments, the current user request, and the most recent four segments. `--policy balanced` (default) ranks older candidates by status, task matches, and structured task state; lower-priority material is selected first. `--policy legacy` retains chronological selection. `attention` explains the current selection, budget pressure, protections, and priority 0–4 without an API call. Each actual selection is saved as an `attention_decision` event before the model performs the rewrite. Priorities are retention preferences, not probabilities. Source coverage and schema checks cannot establish semantic fidelity.

Runtime provider/model identity is supplied in every request. Compaction avoids an API call when eligible content is below 1,000 UTF-8 bytes, and commits a generated rewrite only if it reduces the full serialized projection by at least 15%. These initial engineering thresholds also apply to `/compact`; a skipped attempt reports its reason and leaves the projection unchanged. The post-generation check saves future context overhead, but the compaction call itself is still counted.

`--budget 24000` caps a conservative **UTF-8 byte proxy** for the serialized request plus the configured output reserve. This is deliberately stricter than typical token counts, is not a provider tokenizer, and does not guarantee an exact provider token limit. `/stats` distinguishes the estimate from actual reported usage. All requests, including compaction and tool continuations, are checked; overflow stops explicitly with history saved. Increase `--budget` for larger tasks. `--output`, `--recent`, `--max-calls`, and `--reasoning` are configurable. Up to three automatic compaction calls may precede the bounded answer loop; errors stop rather than retrying indefinitely.

## Small checks

```powershell
node --test test/smoke.test.js test/attention.test.js # six offline checks, no model spend
node scripts/attention-demo.js       # offline CLI walkthrough of attention/index/recovery
node scripts/live-smoke.js           # opt-in: one conversation, at most four answer calls
node scripts/evaluate.js             # opt-in: tiny append/summary/layered comparison
```

The offline demo is scripted; it demonstrates mechanics, not model quality. The live smoke exercises actual retrieval and editing. The comparison stores its fixed fixture, answers, settings, errors, and usage (including preparation) in `.conclave/evaluation/comparison.json`; caveat fidelity requires a quick human read. These small runs do not establish general quality or cost savings.

The next development steps are in [DEVELOPMENT_ROADMAP.md](<E:/Coding/converse/CLA/conclave/DEVELOPMENT_ROADMAP.md>). This version has no UI, streaming, embeddings, Jev, custom model training, or Converse integration. Local SQLite on Node 22 may print an experimental-feature warning.
