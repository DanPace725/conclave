# Conclave: MVP roadmap

2026-09-30 — initial local prototype implemented. See [implementation status](<E:/Coding/converse/CLA/conclave/IMPLEMENTATION_STATUS.md>) for what is working and what remains unproven.

The user has accepted this as a proof of concept and authorized broader development before additional long-form testing. The original evaluation targets below remain open research questions; they no longer gate the next implementation phase. See [development roadmap](<E:/Coding/converse/CLA/conclave/DEVELOPMENT_ROADMAP.md>).

## Goal and scope

Build a standalone local harness that preserves the complete interaction history while giving the model a smaller, mutable working context. Demonstrate that information removed from the prompt can be recovered, without silently changing decisions, constraints, or uncertainty.

Start with a single conversation and one explicitly selected provider/model. Run storage, orchestration, inspection, and tests locally; use existing hosted model APIs for inference. Local model serving and Converse UI integration can follow later.

Recommended starting stack: Node.js, SQLite, and a CLI. Adapt Converse's provider transport and usage/provenance handling into this independent repository. Its current `chat()` accepts user/assistant text and supplies its own speaker-identity prompt; context editing, configurable instructions, and retrieval tool calls need an extended adapter contract. Establish one provider end to end before adding the others.

## Build sequence

### 1. Persistent history and a working baseline

- Create an append-only event store with stable conversation/event IDs, timestamps, actor/model attribution, original content, and call outcomes. Record input before inference; record requests, responses, retrieval results, and context operations as they occur. Preserve failures without treating failed partial answers as completed conversation turns.
- Add a simple interactive CLI and scripted fixture runner. Provide transcript inspection and an append-only inference mode.
- Save each actual inference request and its context revision, settings, provider-reported usage, and response/model IDs when available. Keep credentials outside recorded payloads and Git.

**Gate:** complete a conversation, restart the process, and resume it with the same historical record. Every call is traceable to exactly what was submitted.

### 2. Mutable projection with a small CLP-derived schema

- Introduce versioned context segments with source event IDs, parent bundle IDs, content hashes, type/frame, and explicit unresolved or superseded status. Add Conclave retention fields for pinning and verbatim preservation; label them as extensions, not existing CLP fields. Leave unsupported confidence values unset.
- Let the model propose edits to the working projection through a bounded edit interface. Begin with objective, constraints, decisions, open questions, recent turns, and retrieval pointers as a useful layout. Keep trusted system instructions outside the editable projection.
- Validate edits and commit the new snapshot plus transformation receipt atomically. Record inputs, outputs, model/policy version, and before/after hashes. Show a readable context file and diff. The **next request must actually use the edited projection**, with only required new interaction/tool messages added.

**Gate:** an evicted passage disappears from the next provider payload, remains intact in history, and can be traced through the transformation receipt. Invalid edits preserve the last valid projection; restart restores the committed revision.

### 3. Retrieval and inexpensive context management

- Add SQLite full-text search plus exact retrieval by event ID/range and bundle resolution. Results carry original source IDs and fit a retrieval budget. The model can request detail and then release it from subsequent context.
- Start with deterministic retention rules: preserve pins and the current request, keep a recent window, select older segments for compaction or eviction, and retain source pointers. The model performs semantic rewriting. The decision interface can later accept a small model or Jev without changing storage.
- Enforce a configurable input budget including instructions, tools, projection, new input, and retrieved material, with an output reserve. Count in code; identify estimates where exact provider accounting is unavailable. If protected material cannot fit, return an explicit budget failure. Never silently trim it.
- Include one oversized-document case: store the full observation first, index chunks, and admit bounded excerpts to the model. This tests ingress control without building a general document pipeline.

**Gate:** recover a deliberately evicted exact fact, continue using it, and compact again. Rebuild disposable indexes from persisted events/bundles. Rejected summaries and retrieval failures leave an inspectable, recoverable state.

### 4. Evaluate the complete loop

Use small fixtures for exact recall after eviction, changed decisions, caveats/unresolved alternatives, oversized observations, and restart/recovery. Compare append-only, rolling-summary, and layered modes using the same model, task stream, settings, and declared tool allowances. Report common-budget overflow explicitly; do not silently truncate the baseline. These are our own fixtures and a CLM-inspired implementation, not a reproduction of published CLM benchmark results.

Measure task answers separately from storage recoverability. Report critical constraint/caveat losses, exact retrieval accuracy, maximum prompt size, retrieval frequency, latency, and total input/output usage **including context edits, compaction, decision calls, and retrieval-driven inference**. Record cached usage where exposed; input-token reduction alone does not establish lower billing or FLOPs.

**MVP completion:** the integrity/recovery checks pass, critical distinctions survive the fixtures, and at least one long case shows lower total inference input without worse task results. Freeze the policy before a small held-out run. If overhead or quality defeats the savings, keep that finding and revise the policy before expanding scope.

## Defer until the loop earns it

Full CLP conformance, signed/federated registries, vector databases, learned retention, Jev integration, reinforcement learning, suffix-cache serving changes, multi-agent orchestration, dashboards, deployment, and Converse integration. CLI inspection, context diffs, and exported run receipts are enough for the first prototype.

## Reading basis

- [Architecture proposal](<E:/Coding/converse/CLA/conclave/Context Layer Architecture.md>): source of the persistent-trajectory/mutable-projection design. Follow its final instruction to implement from our specification and published ideas rather than copying CLM source.
- [CLM paper](<E:/Coding/converse/CLA/conclave/external references/2609.37725v1.pdf>), especially §§4 and 6 and Appendices A, D–E, and G: actual context mutation, exact-retention/retrieval tests, cache-aware accounting, and limits of model token-count awareness. [Official repository](https://github.com/facebookresearch/context-language-models) provides the published project overview.
- [CLP v0.2 source](<E:/Coding/e2-core-framework/E2Core/Context Layer/Context Layer Protocol (CLP).ormd>): use lineage, references, unresolved state, and disposable indexes as the initial subset.
- [TypeSafe primitives](https://docs.typesafe.ai/primitives) and [confidence guidance](https://docs.typesafe.ai/confidence): a possible later adapter for atomic typed retention decisions. Its confidence signal is not evidence that a summary is faithful; fitness and savings need local measurement.
- [Workspace memory/context synthesis](<E:/Coding/converse/CLA/conclave/external references/MEMORY_AND_CONTEXT_PATTERNS.md>), especially §§7, 9, and 11–14: motivates stale-decision tests, caveat preservation, and enforced structure. Its underlying simulation findings were not independently revalidated here and are not Conclave performance evidence.
