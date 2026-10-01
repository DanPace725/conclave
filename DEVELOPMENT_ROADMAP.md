# Conclave: beyond the proof of concept

2026-09-30. The user accepted the initial loop as a proof of concept and asked to advance the larger architecture before more long-form testing. Demonstrating net savings remains an open measurement, not a prerequisite for this development phase.

## 1. Attention, indexed memory, and recovery — implemented

- Separate bounded selection from semantic transformation. A deterministic policy ranks older material by task relevance, structured state, and supersession; pins/current requests/recent turns stay protected. Keep the policy interface replaceable by a cheap decision model later.
- Keep source chunks and past context bundles in rebuildable local indexes. Distinguish active, proximal, indexed, and archived material.
- Admit a task-matching document excerpt rather than always its beginning. Offload a bundle to a retrieval pointer without a model rewrite.
- Restore earlier context as a new revision, keeping later pins and original events.

Verification: six offline checks, one small CLI walkthrough, and an index upgrade with canonical records unchanged. No hosted inference was used for this phase. This does not establish semantic fidelity or savings.

## 2. Structured task state and accountable changes — implemented

Make objectives, decisions, questions, evidence, and supersession explicit rather than relying on a prose summary to carry all relationships. Add source attribution and resolution limits to derived state; retain conflicting/unresolved alternatives. Support correcting a derived claim through lineage without rewriting history. Keep this a declared CLP-derived subset, with unknown confidence left unset.

Implemented named source-attributed entries, explicit limitations/unknown confidence, supersession/support/conflict references, effective unresolved status, guarded corrections, state inspection, and protection from generic attention operations. Sources and prior generations remain retrievable. Relationships are declared, not inferred by a semantic conflict detector.

## 3. Optional bounded model decisions — implemented

Add a separate adapter for retain/offload/compact/escalate decisions and priority, using small candidate descriptions and a separately bounded budget. Record its input, decision, usage, and validation failures. Fall back conservatively to deterministic selection; do not add a decision call to every turn by default. Jev is one future adapter option, not a required dependency.

Implemented a provider-independent selector contract with OpenAI and native Jev paths, bounded candidate excerpts, separate limits, proposals and usage receipts, deterministic fallback, and guarded automatic application. Disabled by default; manual `decide` previews do not apply edits. Jev Choice/Score confidence gates preserve uncertain candidates; no semantic rewriting or extra inference is triggered by escalation.

## Testing checkpoint — before step 4

The user completed a longer conversation and accepted substantial working-context reduction as demonstrating the core idea. The [findings](<E:/Coding/converse/CLA/conclave/LONG_CONVERSATION_FINDINGS.md>) led to continuation-budget recovery, compaction preflight/cooldown, simpler named-state updates, and stronger report/state guidance. Native Jev is now enabled optionally; twelve offline checks, an isolated replay of the failed continuation, and one small synthetic live Jev preview cover the new mechanics. See [JEV_INTEGRATION.md](<E:/Coding/converse/CLA/conclave/JEV_INTEGRATION.md>) for results and limits. Net end-to-end savings and complete report fidelity remain open.

Next Jev work should focus on observing/tuning selection in real chat, then optional retrieval reranking and bounded ingress classification. This advances the cheap decision layer without making Jev responsible for free-text transformation.

## 4. Reusable local service and Converse integration — basic local scope implemented

The user completed another conversation and authorized the next phase. A transport-independent service now handles local conversation creation/resume, answers, Markdown ingress, manual state, projection/state/usage inspection and complete exports. Converse's local server exposes it behind the existing access guard; a small optional composer panel supplies the browser controls. SQLite remains canonical, with an automatic JSON audit copy and complete Converse downloads including every source event and snapshot. Jev retention decisions now survive subsequent compaction passes and the rest of the answer turn. See [CONVERSE_INTEGRATION.md](<E:/Coding/converse/CLA/conclave/CONVERSE_INTEGRATION.md>).

Other provider adapters, layered streaming, advanced recovery controls in the UI, JSON import and hosted persistence remain later steps. Current fidelity and savings limitations still apply; arithmetic/source guidance is not semantic enforcement.
