# Conclave

Persistent trajectory, mutable context. This repository owns the complete Conclave engine used by Converse. SQLite or PostgreSQL stores the trajectory; a versioned working projection supplies the next model request. Offloaded details remain retrievable.

[Project context](PROJECT_CONTEXT.md) · [Development method](docs/DEVELOPMENT_METHOD.md) · [Testing](TESTING_GUIDE.md) · [Context and memory algorithms](docs/CONTEXT_AND_MEMORY_ALGORITHMS.md) · [Jev setup](docs/JEV_INTEGRATION.md) · [Converse integration](docs/CONVERSE_INTEGRATION.md) · [Embedding retrieval](docs/EMBEDDINGS.md)

The opt-in [CLP evidence broker](docs/CLP_BROKER.md) adds versioned frames, source provenance, independent-support floors, and deterministic query explanations. Run `node scripts/clp-demo.js` for the six-bundle offline example. The CLI/API exposes registration, attestation, record, link, and query operations; thin/refuted/unmeasured claims remain unresolved.

## Shareable exports

Use `export PATH --conversation ID --sanitize` or `download PATH --conversation ID --sanitize` for publication copies. HTTP export/download also accept `sanitize=1`; `action=shareable_export` exposes the sanitized service export. Copies redact recognizable credentials and carry a receipt explaining that original hashes/offsets are not replay-valid. Canonical exports remain private exact audit data. Scan fixtures before committing with `node scripts/sanitize-artifacts.js --check FILE_OR_FOLDER`; use `--write` to redact them. Labeled-evaluation outputs are sanitized automatically. [Details and limits](docs/archive/2026-10-05/jev-plumbing/README.md)

## Start

For explicit context handoffs between AI apps, see [handoff MCP setup](docs/HANDOFF_MCP.md) and [your plain-language checklist](docs/HANDOFF_SETUP.md). Local launchers work; hosted storage and OAuth account linking are prepared and locally tested, awaiting hosting access and deployment.

Requires Node.js 22.13+. Use OPENAI_API_KEY for OpenAI or ANTHROPIC_API_KEY for Claude. Credentials are read from the process or Windows User/Machine environment; offline controls need no key.

```powershell
npm ci
node scripts/demo.js
node src/cli.js chat --model gpt-6-luna
node src/cli.js chat --provider anthropic --model claude-sonnet-5-5 --stream
node src/cli.js chat --conversation conv_YOUR_ID --model gpt-6-luna
```

Model selection: --model, then CONCLAVE_MODEL, then gpt-6-luna for OpenAI or claude-sonnet-5-5 for Anthropic. CLI defaults match the shared service: layered mode, 16,384 output tokens, 16 answer calls, four recent segments, and a 256,000-unit guard. GPT uses low reasoning; Claude uses provider default. Tool loops freeze their working projection; --no-freeze-projection enables an immediately changing projection. --budget measures serialized UTF-8 bytes plus output reserve. Stats separately report local token counts and provider usage.

## Conversation and context commands

```powershell
node src/cli.js help
node src/cli.js list
node src/cli.js ask "What did we decide?" --conversation conv_YOUR_ID
node src/cli.js search "parser architecture" --conversation conv_YOUR_ID
node src/cli.js retrieve evt_SOURCE_ID --conversation conv_YOUR_ID
node src/cli.js ingest "E:\path\notes.md" --focus "parser deployment" --conversation conv_YOUR_ID
node src/cli.js export .conclave\transcript.json --conversation conv_YOUR_ID
```

| Purpose | CLI commands | Interactive commands |
|---|---|---|
| Inspect | context, diff, history, stats, attention [keywords] | /context, /diff, /history, /stats, /attention |
| Recover | search, retrieve, memory [query], bundle ID, revisions, restore REVISION | /memory [query], /restore REVISION |
| Manage | ingest PATH, evict ID, offload ID, compact | /ingest PATH, /offload ID, /compact, /pin TEXT |
| State | state, remember KEY TYPE TEXT, state-update JSON_PATH | /state, /remember KEY TYPE TEXT, /state-update PATH |
| Selection | decide [keywords] with a decision provider/model | /decide [keywords] |
| Exit | — | /quit |

Conversation commands take --conversation ID. reindex rebuilds derived indexes. Types: objective, constraint, decision, question, evidence. Reusing a state key creates a source-linked correction. JSON updates carry expected_revision, sources, status, and relationships.

Modes: --mode layered uses edits/retrieval/attention/compaction; append sends completed history; summary uses rolling summaries. evict removes a working bundle; offload replaces it with a retrieval pointer; restore creates a new revision retaining later pins. Originals remain in history. Source search is lexical with optional Jev reranking. Focused ingress stores the complete file and admits an excerpt. Pins, exact-text requirements, named state, current requests, and recent context receive scoped protection. Jev retention advice does not permanently lock an older bundle.

## Agents, workspaces, and service operations

The standalone engine supports the same checkpointed agents, workspace/version controls, native search, public-page retrieval, streaming, token-count controls, audit/replay, and context-management behavior as Converse.

```powershell
node src/cli.js workspace-upload .\notes.md --conversation conv_YOUR_ID
node src/cli.js agent-start "Read notes.md and write a short report.md" --conversation conv_YOUR_ID --no-jev
node src/cli.js agent-step --conversation conv_YOUR_ID --stream
node src/cli.js agent-status --conversation conv_YOUR_ID
node src/cli.js agent-stop --conversation conv_YOUR_ID
node src/cli.js workspace-list --conversation conv_YOUR_ID
node src/cli.js workspace-read report.md --conversation conv_YOUR_ID
node src/cli.js count-tokens --conversation conv_YOUR_ID
node src/cli.js download .\conversation.json --conversation conv_YOUR_ID
```

Each agent-step performs one bounded inference/tool step and resumes the saved run across CLI processes. Continue stepping until completion or a stop. Agent start uses adaptive limits unless fixed limits are supplied with --max-steps, --duration-seconds, or --max-tokens. Failed steps preserve receipts and diagnostics.

call METHOD JSON_PATH --conversation ID exposes the complete service API, including ask, saveDocument, changeDocument, saveContext, saveState, sourceEvent, contextBundle, modelInput, and name. Supply the exact service input shape in JSON, including revision/version guards for edits. --input PATH also supplies advanced inputs to named service commands. call status, call list, and call create JSON_PATH need no conversation. Service commands use Jev when configured; --no-jev disables it for named agent starts. --stream emits newline-delimited events for service calls.

## Local API and hosted storage

```powershell
npm run serve
# http://127.0.0.1:3212/api/conclave?action=status
```

The API exposes the same GET/POST actions and streaming protocol as Converse. It uses SQLite in .conclave/ or CONCLAVE_DATA_DIR, or the fenced PostgreSQL repository when DATABASE_URL is set. PORT changes the default 3212. With APP_PASSWORD, POST { "password": "..." } to /api/session and send the returned session cookie. The server binds to localhost.

For a new PostgreSQL database, set DATABASE_URL_UNPOOLED and run npm run db:migrate; use DATABASE_URL for runtime. Existing Converse databases need no new migration for engine parity. Library consumers can import stores, services, providers, workspace/agent harnesses, and local/hosted HTTP handlers from src/index.js.

## Develop and migrate

Engine changes start here, then migrate into Converse. Run npm test and npm run check, commit the source, then npm run sync:converse -- --apply. npm run sync:converse -- --check verifies exact parity. Migration preserves application files, records hashes/source commit, and refuses independent downstream engine edits. See [the workflow and boundary](docs/CONVERSE_INTEGRATION.md).

## Storage and counts

Data lives in .conclave/ or --data DIR. SQLite events/snapshots are authoritative locally; PostgreSQL is authoritative when using ContextRepository. context.md is a generated view. Sources, parents, receipts, requests, responses, failures, and usage survive resume/export. JSON exports include the complete engine audit; download adds the attributed transcript/workspace attachments.

Memory tiers describe availability: active in the projection, proximal through a pointer, indexed outside it, archived when superseded. Stats retain local o200k counts, fingerprints, count coverage, provider usage, and purposes. Local counts include serialized instructions/tools; provider framing remains estimated. count-tokens explicitly requests provider preflight counting; stats make no remote counting call.

Layered Context/Agent capture user commitments and corrections into a separate event-backed ledger with bounded selection and source-linked inspection. User/model authority, unresolved candidates, correction history and reversible suppression are independent of availability tiers. See [automatic memory](docs/AUTOMATIC_MEMORY.md) for grammar, model-call bounds, service/API operations and limits.

Model tools `read_memory` and `suppress_memory` inspect both memory stores and execute current-human-authorized suppression with revision/authority guards. `workspace_patch_batch` saves up to 16 non-overlapping replacements against one fully read file version, atomically. Shadow stage timings and recent summaries appear in `read_telemetry`; profile an exported conversation without provider calls using `node scripts/profile-shadow.js export.json profile.json 3` (1–8 sampled prefixes).

## Licence

[MIT](LICENSE).
