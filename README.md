# Conclave

Standalone local prototype for **persistent trajectory, mutable context**. The full conversation stays in SQLite. A versioned projection determines what the next model call sees; evicted details can be retrieved from original events.

## Start

Requires Node.js **22.13+**. No package install is needed. This version uses OpenAI's Responses API and an existing `OPENAI_API_KEY`; on Windows it also reads User/Machine environment variables if the process did not inherit them. Credential values are never printed or saved by the adapter.

From `E:\Coding\converse\CLA\conclave`:

```powershell
node scripts/demo.js                 # offline demonstration, no API calls
node src/cli.js chat --model gpt-6-luna
```

The model defaults to `CONCLAVE_MODEL` or `gpt-6-luna`. Reasoning defaults to `none` and output to 4,096 tokens. There is no automatic model fallback. `node src/cli.js models` lists models available to the configured key. The adapter follows the [Responses function-calling contract](https://developers.openai.com/api/docs/guides/function-calling); model settings are based on the [GPT-6 Luna documentation](https://developers.openai.com/api/docs/models/gpt-6-luna).

The CLI prints a conversation ID. Resume with:

```powershell
node src/cli.js chat --conversation conv_YOUR_ID --model gpt-6-luna
```

Inside chat, use `/context`, `/diff`, `/history`, `/stats`, `/attention`, `/memory [query]`, `/state`, `/remember KEY TYPE TEXT`, `/state-update PATH`, `/decide [task keywords]`, `/compact`, `/pin exact constraint`, `/ingest E:\path\notes.md`, `/offload cb_BUNDLE_ID`, `/restore REVISION`, and `/quit`. Pin hard constraints explicitly; pins are protected in code. Context edits and compaction are model judgments and can still change meaning in unpinned material.

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
node src/cli.js state --conversation conv_YOUR_ID
node src/cli.js remember program.budget constraint 'Original grant is $15,000.' --conversation conv_YOUR_ID
node src/cli.js state-update .conclave\update.json --conversation conv_YOUR_ID
node src/cli.js compact --conversation conv_YOUR_ID
node src/cli.js stats --conversation conv_YOUR_ID
node src/cli.js export .conclave\transcript.json --conversation conv_YOUR_ID
node src/cli.js export .conclave\transcript.json --conversation conv_2af6bb45-b273-4524-9d1c-55756a881c3a

```

`evict` affects working context only. `offload` replaces a sufficiently large unprotected bundle with a small retrieval reference; the original bundle and its lineage remain indexed. `bundle` expands a current or past bundle. The layered model has an `offload_context` tool as well as `edit_context`.

`retrieve` prints the full original source locally; model retrieval returns bounded, pageable excerpts. Ingress saves an entire text file before selecting an excerpt. The default admits its first 2,000 characters; `--focus "task keywords"` chooses a matching chunk instead:

```powershell
node src/cli.js ingest "E:\path\notes.md" --focus "parser deployment" --conversation conv_YOUR_ID
```

If no chunk matches, ingress uses the initial excerpt. Selection is lexical, not a semantic relevance judgment. Search ranks overlapping chunks by distinct query-term matches and returns one matching passage per source, with exact source offsets.

Data lives under `.conclave/` (Git-ignored), or `--data DIR`. Each conversation has an inspectable `context.md`. It is a generated view: edit through the harness, not directly in this file. SQLite snapshots are authoritative and recreate the view after restart. Transformation events record source IDs, parents, before/after hashes, and edit receipts; the snapshot row holds the segments, and the receipt's `after_hash` binds it to that snapshot. Receipts written before this change also embed the segments, and both forms are read. Event and snapshot tables reject UPDATE/DELETE through this connection; this is an application invariant, not protection against someone replacing the database externally.

The context index contains overlapping source chunks and current/past bundles. `node src/cli.js reindex` rebuilds both from canonical events and transformation receipts; an optional full-event FTS5 index is also rebuilt where available. Existing databases initialize the new indexes on opening without rewriting history or snapshots. CLP fields are a small derived subset; retention controls are Conclave extensions. This implementation does not claim full CLP conformance.

`memory` lists bundle content, source references, frame, revision, and proximity: **active** in the projection, **proximal** through a live reference, **indexed** outside the projection, or **archived** when superseded and outside it. These are availability states, not truth/confidence scores. Results are bounded to 50 cards; use a query or `bundle ID` for a specific item.

`restore` creates a new revision from an earlier snapshot, preserving all currently pinned/verbatim content even when those pins were added later. It does not undo events, delete later snapshots, or immediately call the model. Restoring a large snapshot can exceed the input budget; normal inference will check that budget before submitting it.

## Context modes and limits

Named task entries hold objectives, constraints, decisions, questions, and evidence. In layered chat, ask the model to track these explicitly; it uses `update_state`. Reusing a key creates a new bundle that supersedes the prior one, with original sources and parents retained. Declared conflicts stay unresolved. `/state` shows both declared and effective status; a conflict can make an otherwise active entry effectively unresolved. Attribution describes the source's recorded actor/kind, not proof of authorship or truth. Resolution confidence stays `null`, and limitations are explicit.

Structured entries are protected from generic edits, offloading, and compaction. Correct them through `update_state` or `state-update`, rather than editing a generated file. A pinned state entry cannot be replaced. Historical entries remain inspectable with `bundle` and `memory`, and their supersession chain remains available after index rebuild. These are Conclave fields inspired by CLP; full CLP conformance and semantic conflict detection are not implemented.

The simplest manual path is `/remember KEY TYPE TEXT`, for example `/remember program.budget constraint Original grant is $15,000.` It records your text as a source and creates or corrects that named entry without an API call. Reuse the key to supersede an old entry. Types are objective, constraint, decision, question, or evidence; questions default to unresolved, other explicit manual entries to active. For tentative choices, use a question entry or the richer JSON/model tool. The model is also instructed to maintain compact durable planning state and cross-check active constraints in comprehensive reports; those instructions do not guarantee fidelity.

For manual updates, JSON contains `expected_revision` and `updates`. Each update has `key`, `type`, `content`, `source_event_ids`, `status`, `supersedes`, `conflicts_with`, `supports`, and `limitations`; unused relationship arrays may be empty. Relationships use bundle IDs, sources use event IDs. Batch size is at most eight; content is at most 2,000 characters per entry. `scripts/state-demo.js` creates working example files with real IDs.

- `--mode layered` (default): source-linked segments, model edits, automatic compaction, retrieval.
- `--mode append`: full completed history on every call; retrieval remains available, edits/compaction disabled.
- `--mode summary`: automatic rolling summaries of older material; retrieval remains available, discretionary model edits disabled.

Automatic compaction starts around 75% of the configured budget, preserving pins, verbatim-required segments, the current user request, and the most recent four segments. `--policy balanced` (default) ranks older candidates by status, task matches, and structured task state; lower-priority material is selected first. `--policy legacy` retains chronological selection. `attention` explains the current selection, budget pressure, protections, and priority 0–4 without an API call. Each actual selection is saved as an `attention_decision` event before the model performs the rewrite. Priorities are retention preferences, not probabilities. Source coverage and schema checks cannot establish semantic fidelity.

Runtime provider/model identity is supplied in every request. Compaction avoids an API call when eligible content is below 1,000 UTF-8 bytes, and commits a generated rewrite only if it reduces the full serialized projection by at least 15%. These initial engineering thresholds also apply to `/compact`; a skipped attempt reports its reason and leaves the projection unchanged. The post-generation check saves future context overhead, but the compaction call itself is still counted.

Preflight also skips a batch when even an empty source-linked replacement cannot meet the 15% threshold. A batch that failed that threshold is not paid for again automatically until its bundle IDs change; `/compact` permits an explicit retry. Offload proposals are checked for actual byte reduction before application.

`--budget 24000` caps a conservative **UTF-8 byte proxy** for the serialized request plus the configured output reserve. This is deliberately stricter than typical token counts, is not a provider tokenizer, and does not guarantee an exact provider token limit. `/stats` distinguishes the estimate from actual reported usage. All requests, including compaction and tool continuations, are checked; overflow stops explicitly with history saved. Increase `--budget` for larger tasks. `--output`, `--recent`, `--max-calls`, and `--reasoning` are configurable. Up to three automatic compaction calls and one optional bounded selection call may precede the bounded answer loop. If protected state fills the budget, inference stops explicitly; it is not silently deleted.

Automatic planning leaves additional retrieval headroom (`--tool-reserve 2000`, capped at 10% of the budget). If a continuation overflows, the harness shortens temporary retrieval excerpts and, when needed, offloads older eligible bundles to source-linked pointers. Full tool outputs remain in history; actual shortened inputs and `tool_projection`/`budget_recovery` receipts are recorded. Call IDs, reasoning items, pins, named state, the current request, and the recent window remain protected. A request still fails explicitly if these measures cannot make it fit. `/stats` reports recoveries and usage by provider.

## Optional bounded decisions

The decision adapter is off by default. Enable it explicitly in layered mode:

```powershell
node src/cli.js chat --conversation conv_YOUR_ID --decision-model gpt-6-luna
node src/cli.js decide "current task keywords" --conversation conv_YOUR_ID --decision-model gpt-6-luna
node src/cli.js chat --conversation conv_YOUR_ID --budget 32000 --decision-provider jev
node src/cli.js decide "current task keywords" --conversation conv_YOUR_ID --decision-provider jev
```

It sees at most six eligible candidate descriptions by default (180-character excerpts), with a separate `--decision-budget 8000` and `--decision-output 600`. `--decision-candidates` permits 1–12. Pins, structured state, current requests, recent turns, and references are excluded. Automatic use occurs only under compaction pressure with substantial eligible material, at most once per context-management invocation. It selects retain/offload/compact/escalate and priority; the main model still performs semantic rewriting. Unsubmitted candidates retain deterministic selection. `escalate` preserves material for later judgment and does not spawn another model call.

`decide` and `/decide` are previews: they record their actual API request/response/proposal and usage but do not apply edits. Invalid, incomplete, failed, stale, or oversized decisions fall back to deterministic selection with a rejection receipt. Protected state and source validation remain enforced in code. `/stats` includes decision calls and usage within total usage, and reports decision usage separately. Using Luna for both roles exercises separation; it does not establish a cheaper-model advantage.

`--decision-provider jev` enables TypeSafe's native typed API with `jev-latest` and `JEV_API_KEY` or `TYPESAFE_API_KEY`. Choice selects the action; Score supplies priority. `--jev-confidence 0.65` gates uncertain decisions to escalation/retention. Candidate count is reduced when necessary to fit the separate input budget. Jev has no generation output cap, so `--decision-output` applies only to the OpenAI selector; native requests reserve zero generated output units. Probabilities/confidence are saved as selection metadata, while factual state confidence remains unknown. Main replies and semantic compaction continue through OpenAI. See [JEV_INTEGRATION.md](<E:/Coding/converse/CLA/conclave/JEV_INTEGRATION.md>) for setup, findings, and next integration targets.

## Small checks

```powershell
node --test test/smoke.test.js test/attention.test.js test/state-decision.test.js test/jev-budget.test.js # twelve offline checks
node scripts/attention-demo.js       # offline CLI walkthrough of attention/index/recovery
node scripts/state-demo.js           # offline CLI walkthrough of structured state/correction
node scripts/replay-budget.js        # offline replay of the exported final tool continuation in a fresh store
node scripts/jev-smoke.js            # opt-in: one Jev request using synthetic color/shape fixtures
node scripts/live-smoke.js           # opt-in: one conversation, at most four answer calls
node scripts/evaluate.js             # opt-in: tiny append/summary/layered comparison
```

The offline demo is scripted; it demonstrates mechanics, not model quality. The live smoke exercises actual retrieval and editing. The comparison stores its fixed fixture, answers, settings, errors, and usage (including preparation) in `.conclave/evaluation/comparison.json`; caveat fidelity requires a quick human read. These small runs do not establish general quality or cost savings.

Steps 2 and 3, the long-conversation follow-ups, and the optional Jev selector are implemented. Basic local Converse integration now provides browser chat, reasoning/Jev controls, saved-chat resume, manual state, context inspection and full JSON audit exports through a reusable service. See [CONVERSE_INTEGRATION.md](<E:/Coding/converse/CLA/conclave/CONVERSE_INTEGRATION.md>), [TESTING_GUIDE.md](<E:/Coding/converse/CLA/conclave/TESTING_GUIDE.md>) and [DEVELOPMENT_ROADMAP.md](<E:/Coding/converse/CLA/conclave/DEVELOPMENT_ROADMAP.md>). Layered streaming, other providers, embeddings, custom training and hosted integration remain later work. Local SQLite on Node 22 may print an experimental-feature warning.
