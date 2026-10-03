# Conclave project context

Updated 2026-10-03. Mutable project state. [CLI usage](README.md) · [Development method](docs/DEVELOPMENT_METHOD.md) · [Archive](docs/archive/README.md)

## Current capabilities

- Source of truth for the complete engine deployed in Converse. Shared changes start here, are tested/committed, then migrate with a hash manifest and drift checks. [Workflow](docs/CONVERSE_INTEGRATION.md)
- OpenAI/Anthropic task providers, native streaming/reasoning summaries, explicit provider/model provenance, signed Claude continuations and token-count controls. Jev advises bounded attention/reranking/ingress separately from the task model.
- Context/Agent prompts explain shared conversations across model switches: engage with earlier models' contributions and preserve authorship, clarifying identity when requested or relevant instead of routinely interrupting the discussion.
- Append-only SQLite or PostgreSQL trajectory, immutable snapshots, restart/resume, complete request/response/failure records, JSON exports, and rebuildable working views. Hosted leases and fenced writes preserve progress across service instances.
- Append, summary, and layered modes; source-linked edits, compaction, eviction, lossless pointers, protections, stable S/E handles, frozen tool-loop projections, cached/periodic reviews, and explicit refreshes.
- Indexed source chunks and historical bundles, lexical search with bounded Jev reranking, pageable exact retrieval, bounded ingress, memory tiers, and index rebuilding.
- Named objectives, constraints, decisions, questions, and evidence with source attribution, supersession, explicit support/conflict links, key/handle relationships, manual correction, and unknown confidence retained.
- Opt-in CLP broker: immutable versioned frames/validators, source-origin and copy-lineage attestations, typed records, support/refute/supersede links, conservative independent-source floors, scoped/paged queries, deterministic per-result explanations, and explicit unresolved results. SQLite/PostgreSQL, CLI/API, exports and a read-only model tool share the implementation. [Usage and limits](docs/CLP_BROKER.md)
- Checkpointed Agent start/step/stop/resume with bounded adaptive limits, duplicate-step guards, batches of up to 16 tools, precise diagnostics, and saved pending exchanges. Stop cancels active provider/page requests, skips remaining tools and calls, saves a stopped checkpoint, and retains completed actions without promoting unfinished text to a reply. Cancelling an active HTTP Agent stream also stops its run.
- Versioned workspace text files, uploads, exact patches, removal/restoration, current-file authority/readback checks, arithmetic/formulas, native web search, and public HTTP page retrieval with preserved canonical sources.
- Settled context ordering, compact tool receipts, cache-aware economic reviews, purpose/provider usage, local token-count coverage, preflight counts, audit/replay, full-request comparisons on a like-for-like tool baseline, and per-part request breakdowns with the unexplained reported remainder.
- CLI context and complete service operations, local/hosted HTTP API, and library exports. Converse supplies the browser UI; its engine modules and managed integration wrappers match this source.

## Demonstrated results

| Result | Evidence |
|---|---|
| Agent interruption: six cancellation checks passed, including local and hosted PostgreSQL HTTP streams, active OpenAI/Anthropic calls, late-response guards, and preservation of completed writes. Full source suite: 158 passes, one optional replay skipped. | [Stop implementation](docs/archive/2026-10-03/agent-stop.md) |
| CLP broker: all six acceptance cases passed; six-bundle toy admitted one supported claim and withheld thin/refuted claims. 152 offline checks passed, one optional replay skipped; CLI restart, full model-tool turn and hosted PostgreSQL API persistence covered. | [CLP increment](docs/archive/2026-10-03/clp-broker.md) |
| Engine promoted from Converse; 138 offline checks passed with one optional local-export replay skipped, including the hosted HTTP/PostgreSQL path. CLI Agent restart, shared HTTP operations, PostgreSQL persistence, and migration drift refusal are covered. | [Parity work](docs/archive/2026-10-03/engine-parity.md) |
| Live retrieval recovered `orchard-719` after eviction; one compaction reduced projection text 3,018 → 1,890 characters while retaining a conditional alternative and lineage. | [Initial results](docs/archive/2026-10-02/docs/IMPLEMENTATION_STATUS.md) |
| Initial three-mode fixture retained the code and condition; layered consumed 4,683 input tokens vs append's 3,253. | [Initial results](docs/archive/2026-10-02/docs/IMPLEMENTATION_STATUS.md) |
| Robotics discussion completed 20 answers before a budget stop. A comprehensive report omitted the fee cap and clearance requirements despite their presence in input. | [Long conversation](docs/archive/2026-10-02/docs/LONG_CONVERSATION_FINDINGS.md) |
| Retreat discussion completed 12 asks with source recovery; an incorrect budget calculation was promoted into state. | [Conversation review](docs/archive/2026-10-02/docs/CONVERSATION_COMPARISON.md) |
| Native Jev preview returned typed decisions and saved usage without changing the projection. Token-counting increment recorded 17 passing standalone tests. | [Jev check](docs/archive/2026-10-02/docs/JEV_INTEGRATION.md), [counting checks](docs/archive/2026-10-02/docs/NEXT_ITERATION_2026-10-02.md) |
| Integrated Converse: 67.4% less saved working text across 11 conversations. Small document trials cost less than harness append; ordinary layered chat could cost more. | [Converse results](../../converse/PROJECT_CONTEXT.md) |

These are recorded checks and workloads. Context reduction, source recovery, answer correctness, and billed cost are separate results.

## Work not yet applied

- CLP: portable bundles/sidecars, signed trust/frame/resolver registries, policy membranes and unresolved review, vector/graph brokerage, exploratory recall, measured confidence/separation and coherence/attention telemetry remain unapplied. Current independence grouping is conservative declared provenance, not proof of truth or editorial independence.
- Exact/filter-aware and semantic retrieval; embeddings tied to source versions; heading/TOC lookup and search within files.
- Declared-state resolved/archive lifecycle, confirmation/proposal status, semantic conflict detection, and revision-conflict diffs.
- Portable JSON import/restore and explicit cross-conversation memory with ownership/corrections.
- Broader controls and file lifecycle: rename/version diffs, model/user pin changes, private scratch workspaces and artifact handoffs.
- JavaScript rendering and PDF extraction; longer native-search/page fidelity checks and hosted live verification.
- Calibrate cache/economic horizons and delegation on matched long tasks; measure source recovery, correction fidelity, useful completion, management overhead, and comparable total cost.
- Durable unattended workers, isolated execution, and permanent erasure across canonical sources/copies/exports.
