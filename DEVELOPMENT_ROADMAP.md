# Conclave: beyond the proof of concept

2026-09-30. The user accepted the initial loop as a proof of concept and asked to advance the larger architecture before more long-form testing. Demonstrating net savings remains an open measurement, not a prerequisite for this development phase.

## 1. Attention, indexed memory, and recovery — implemented

- Separate bounded selection from semantic transformation. A deterministic policy ranks older material by task relevance, structured state, and supersession; pins/current requests/recent turns stay protected. Keep the policy interface replaceable by a cheap decision model later.
- Keep source chunks and past context bundles in rebuildable local indexes. Distinguish active, proximal, indexed, and archived material.
- Admit a task-matching document excerpt rather than always its beginning. Offload a bundle to a retrieval pointer without a model rewrite.
- Restore earlier context as a new revision, keeping later pins and original events.

Verification: six offline checks, one small CLI walkthrough, and an index upgrade with canonical records unchanged. No hosted inference was used for this phase. This does not establish semantic fidelity or savings.

## 2. Structured task state and accountable changes — next

Make objectives, decisions, questions, evidence, and supersession explicit rather than relying on a prose summary to carry all relationships. Add source attribution and resolution limits to derived state; retain conflicting/unresolved alternatives. Support correcting a derived claim through lineage without rewriting history. Keep this a declared CLP-derived subset, with unknown confidence left unset.

## 3. Optional bounded model decisions

Add a separate adapter for retain/offload/compact/escalate decisions and priority, using small candidate descriptions and a separately bounded budget. Record its input, decision, usage, and validation failures. Fall back conservatively to deterministic selection; do not add a decision call to every turn by default. Jev is one future adapter option, not a required dependency.

## 4. Reusable local service and provider adapters

Expose the working core through a small local API for conversations, ingestion, projections, retrieval, and recovery. Separate transport from orchestration and add other providers behind the existing request/provenance contract. Keep credentials server-side. Converse integration can consume this service later.

## 5. Longer user testing after these capabilities settle

Use real long-form conversations to inspect current decisions, lost caveats, attribution, recovery, and total inference usage. A matched full-context comparison can then assess savings. Add targeted fixes from actual failures; avoid building an extensive benchmark framework now.
