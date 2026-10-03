# Conclave

Persistent trajectory, mutable context. SQLite stores the full conversation; a versioned working projection supplies the next model request. Offloaded details remain retrievable.

[Project context](PROJECT_CONTEXT.md) · [Development method](docs/DEVELOPMENT_METHOD.md) · [Testing](TESTING_GUIDE.md) · [Jev setup](docs/JEV_INTEGRATION.md) · [Converse integration](docs/CONVERSE_INTEGRATION.md)

## Start

Requires Node.js 22.13+ and `OPENAI_API_KEY`. Credentials are read from the process or Windows User/Machine environment.

```powershell
npm ci
node scripts/demo.js                 # offline
node src/cli.js chat --model gpt-6-luna
node src/cli.js chat --conversation conv_YOUR_ID --model gpt-6-luna
```

Model selection: `--model`, then `CONCLAVE_MODEL`, then `gpt-6-luna`. CLI defaults: layered mode, reasoning `none`, 4,096 output tokens, five answer calls, four recent segments, and a 24,000-unit guard. `--budget` measures serialized UTF-8 bytes plus output reserve. `/stats` separately reports local token counts and provider usage.

## Commands

```powershell
node src/cli.js help
node src/cli.js models
node src/cli.js list
node src/cli.js ask "What did we decide?" --conversation conv_YOUR_ID
node src/cli.js search "parser architecture" --conversation conv_YOUR_ID
node src/cli.js retrieve evt_SOURCE_ID --conversation conv_YOUR_ID
node src/cli.js ingest "E:\path\notes.md" --focus "parser deployment" --conversation conv_YOUR_ID
node src/cli.js export .conclave\transcript.json --conversation conv_YOUR_ID
```

| Purpose | CLI commands | Interactive commands |
|---|---|---|
| Inspect | `context`, `diff`, `history`, `stats`, `attention [keywords]` | `/context`, `/diff`, `/history`, `/stats`, `/attention` |
| Recover | `search`, `retrieve`, `memory [query]`, `bundle ID`, `revisions`, `restore REVISION` | `/memory [query]`, `/restore REVISION` |
| Manage | `ingest PATH`, `evict ID`, `offload ID`, `compact` | `/ingest PATH`, `/offload ID`, `/compact`, `/pin TEXT` |
| State | `state`, `remember KEY TYPE TEXT`, `state-update JSON_PATH` | `/state`, `/remember KEY TYPE TEXT`, `/state-update PATH` |
| Selection | `decide [keywords]` with a decision provider/model | `/decide [keywords]` |
| Exit | — | `/quit` |

Conversation commands take `--conversation ID`. `reindex` rebuilds derived indexes. Types: objective, constraint, decision, question, evidence. Reusing a state key creates a source-linked correction; JSON updates carry `expected_revision`, sources, status, and relationships. `scripts/state-demo.js` supplies examples.

## Modes and context operations

- `--mode layered`: source-linked edits, retrieval, attention, and compaction.
- `--mode append`: completed history on each call; retrieval remains available.
- `--mode summary`: rolling summaries and retrieval.

`evict` removes a working bundle. `offload` replaces it with a smaller retrieval pointer. `restore` creates a new revision from a prior snapshot while retaining later pins. Originals remain in history. Search ranks lexical chunk matches; retrieval supports bounded pages. Focused ingress stores the full file and admits a matching excerpt.

Pins, exact-text segments, named state, the current request, and the recent window receive protection. Compaction starts near 75% of the guard, skips eligible content below 1,000 bytes, and commits a rewrite only with at least 15% projection reduction. Automatic attempts suppress unchanged failed batches. Continuation recovery shortens temporary excerpts and offloads eligible material; full outputs stay in the audit.

Options include `--policy balanced|legacy`, `--tool-reserve`, `--recent`, `--max-calls`, `--reasoning`, and `--output`. Optional bounded selectors have separate budgets; see [Jev setup](docs/JEV_INTEGRATION.md).

## Storage and counts

Data lives in `.conclave/` or `--data DIR`. SQLite events/snapshots are authoritative; `context.md` is a generated view. Use the CLI/service to edit state. Sources, parents, transformation receipts, requests, responses, failures, and usage survive resume and export.

Memory tiers describe availability: active in the projection, proximal through a pointer, indexed outside it, archived when superseded. `/stats` includes persisted o200k counts and fingerprints for submitted/saved requests, historical count coverage, and provider usage. Local counts include serialized instructions/tools; provider framing remains estimated. Stats makes no remote counting call.
