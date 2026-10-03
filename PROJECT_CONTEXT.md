# Conclave project context

Updated 2026-10-02. Mutable project state. [CLI usage](README.md) · [Development method](docs/DEVELOPMENT_METHOD.md) · [Archive](docs/archive/README.md)

## Current capabilities

- Local Node CLI and reusable service using OpenAI Responses. Jev or a bounded OpenAI selector can advise attention separately from the answer model.
- Append-only SQLite trajectory, immutable snapshots, restart/resume, complete request/response/failure records, JSON exports, and a generated working-context view.
- Append, rolling-summary, and layered modes. Layered mode supports source-linked edits, compaction, eviction, lossless pointers, protected pins/exact text, and restoration as a new revision.
- Indexed source chunks and historical bundles, lexical search, matching excerpts, exact/pageable retrieval, focused document ingress, memory tiers, and index rebuilding.
- Named objectives, constraints, decisions, questions, and evidence. Corrections retain sources and supersession; support/conflict relationships remain inspectable.
- Deterministic attention selection, bounded candidate decisions, confidence gating, fallback receipts, compaction reduction preflight/cooldown, and continuation-budget recovery.
- Local o200k token counts with request fingerprints, model/provider/scope metadata, persisted count coverage, separate provider usage, and a conservative byte-plus-output guard.
- Converse contains an independently deployed engine snapshot with additional providers, streaming, agents, workspaces, hosted persistence, and controls. Those additions are not CLI capabilities. [Integration](docs/CONVERSE_INTEGRATION.md)

## Demonstrated results

| Result | Evidence |
|---|---|
| Live retrieval recovered `orchard-719` after eviction; one compaction reduced projection text 3,018 → 1,890 characters while retaining a conditional alternative and lineage. | [Initial results](docs/archive/2026-10-02/docs/IMPLEMENTATION_STATUS.md) |
| Initial three-mode fixture retained the code and condition; layered consumed 4,683 input tokens vs append's 3,253. | [Initial results](docs/archive/2026-10-02/docs/IMPLEMENTATION_STATUS.md) |
| Robotics discussion completed 20 answers before a budget stop. A comprehensive report omitted the fee cap and clearance requirements despite their presence in input. | [Long conversation](docs/archive/2026-10-02/docs/LONG_CONVERSATION_FINDINGS.md) |
| Retreat discussion completed 12 asks with source recovery; an incorrect budget calculation was promoted into state. | [Conversation review](docs/archive/2026-10-02/docs/CONVERSATION_COMPARISON.md) |
| Native Jev preview returned typed decisions and saved usage without changing the projection. Token-counting increment recorded 17 passing standalone tests. | [Jev check](docs/archive/2026-10-02/docs/JEV_INTEGRATION.md), [counting checks](docs/archive/2026-10-02/docs/NEXT_ITERATION_2026-10-02.md) |
| Integrated Converse: 67.4% less saved working text across 11 conversations. Small document trials cost less than harness append; ordinary layered chat could cost more. | [Converse results](../../converse/PROJECT_CONTEXT.md) |

These are recorded checks and workloads. Context reduction, source recovery, answer correctness, and billed cost are separate results.

## Work not yet applied

- Port selected Converse improvements to the standalone engine: compact S/E projections, frozen tool loops, scoped protection inspection, cached reviews, actionable state relationships, and periodic Jev scheduling.
- Add standalone Anthropic/other task providers, streaming, remote token-count controls, and CLI access to agent/workspace operations where useful. These already exist in part in Converse.
- Add exact/filter-aware and semantic retrieval, Jev shortlist reranking, and bounded ingress/state classification.
- Add broader interactive context controls and conversational inspection/correction; the existing UI lives in Converse.
- Develop declared-state lifecycle, semantic conflict detection, and fuller CLP resolution semantics.
- Add portable JSON restore/import and explicit cross-conversation memory.
- Apply cache-aware economic management and settled-state ordering; evaluate deterministic, model-directed, Jev, and hybrid attention strategies on matched long tasks.
- Measure fidelity after corrections, recovery of offloaded facts, management overhead, and comparable total cost using user workloads.

