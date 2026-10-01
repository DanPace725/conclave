# Jev integration and conversation follow-ups

2026-09-30. The core context reduction is demonstrated by the longer conversation. Jev now supplies an optional native decision layer; Luna still answers and performs semantic rewriting.

Update after live conversation review: retain/escalate decisions now protect their bundles across every compaction pass and the remainder of the answer turn, including tool-budget recovery. The original 0.65 confidence floor is unchanged. Basic local Converse testing and complete browser exports are available; see [CONVERSE_INTEGRATION.md](<E:/Coding/converse/CLA/conclave/CONVERSE_INTEGRATION.md>) and [CONVERSATION_COMPARISON.md](<E:/Coding/converse/CLA/conclave/CONVERSATION_COMPARISON.md>).

## Enable it

Run from `E:\Coding\converse\CLA\conclave`. The adapter reads `JEV_API_KEY` or `TYPESAFE_API_KEY` from process or Windows User/Machine variables; no key is written to project files.

```powershell
node src/cli.js chat --conversation conv_2af6bb45-b273-4524-9d1c-55756a881c3a --model gpt-6-luna --reasoning low --budget 32000 --decision-provider jev
```

Jev is used under context pressure, not on every message. `/decide task keywords` requests a paid preview; `/attention` remains free. Normal chat with this flag submits bounded candidate excerpts to TypeSafe. The default selector remains disabled unless explicitly enabled.

Options: `--decision-model jev-latest`, `--decision-budget 8000`, `--decision-candidates 6`, `--jev-confidence 0.65`. A custom credential variable can be selected with `--jev-key-env VARIABLE_NAME`. `models --decision-provider jev` lists account models. `--decision-output` applies to the OpenAI selector, not Jev.

## Architecture

The [native API](https://docs.typesafe.ai/api) accepts typed questions. Each eligible candidate receives an action Choice and importance Score in one request. Candidate details are supplied directly to each question; the shared state contains the current task. The adapter maps answers back to known bundle IDs and rounds priority upward to 0–4. It reduces candidate count if the complete request exceeds the separate byte budget.

Code keeps control over pins, named state, current/recent context, source coverage, byte arithmetic, actual offload savings, and revisions. Jev cannot invent bundle IDs, write summaries, or delete sources. Malformed responses, failures, stale revisions, and oversized requests fall back to deterministic selection.

The provisional 0.65 confidence floor applies to both action and priority. Below it, the candidate escalates and remains in context. A non-shrinking offload is also retained. Raw distributions, confidence, returned model, payload, usage, and proposals are recorded. These are **selection signals**, not factual-confidence values; structured state confidence remains `null`. The floor is an engineering starting point requiring experience with real conversations, consistent with TypeSafe's [confidence guidance](https://docs.typesafe.ai/confidence).

## Implemented follow-ups

- **Retrieval budget:** additional planning headroom, bounded temporary excerpts, and lossless offload recovery before submitting a continuation. Full tool outputs stay in history. Recovery preserves call IDs, reasoning, pins, named state, current request, and the recent window; an impossible protected projection still stops explicitly.
- **Compaction overhead:** skip mathematically impossible 15% reductions before inference; avoid automatically repaying for an unchanged rejected batch. `/compact` permits a deliberate retry. Ignore offload proposals that cannot shrink their bundle.
- **State usability:** `/remember KEY TYPE TEXT` creates/corrects a named entry without JSON or inference. Example: `/remember program.budget constraint Original grant is $15,000.` Reuse the key to supersede its prior generation. Questions stay unresolved by default; richer conflicts/limitations use `update_state` or JSON.
- **Answer fidelity:** instructions now emphasize durable named planning state, checking all active constraints in complete reports, and keeping tentative choices distinct from approved decisions. This remains model guidance, not verified semantic enforcement.
- **Accounting:** `/stats` separates observed usage and model versions by provider, alongside decision/compaction totals and budget-recovery counts.

## Small checks and findings

Twelve offline checks cover existing behavior and the new native contract, confidence/fallback handling, tool-budget recovery, and manual state correction. A CLI walkthrough created and superseded a named constraint without inference.

An offline replay imported the actual export into a fresh isolated store. Its reconstructed continuation, with the updated instructions, went from **29,896 to 27,904 estimated input units**. Adding the 4,096 output reserve fits exactly within 32,000. Two older bundles were offloaded and two temporary tool outputs shortened; the pin and original sources remain intact. No provider was called, and the user's database was not edited. This verifies a fitting request, not the quality of a resulting answer. [Replay receipt](<E:/Coding/converse/CLA/conclave/.conclave/budget-replay-Cpm3nK/receipt.json>).

One live Jev preview used entirely synthetic color/shape fixtures: **992 input tokens, 134 output tokens, 193 ms recorded API time**, returned model **jev-1.13.0**. Typed results validated, uncertainty was retained, the pin was excluded, and the preview changed no context. It did not demonstrate live automatic offloading or end-to-end savings. [Live receipt](<E:/Coding/converse/CLA/conclave/.conclave/jev-smoke-c35hV8/receipt.json>).

TypeSafe currently lists Jev at **$0.042 per million input tokens, with output free**. That is provider pricing, not a measured reduction in the complete system's cost. [Model/pricing reference](https://docs.typesafe.ai/models).

Optional commands: `node scripts/replay-budget.js` for the offline continuation replay; `node scripts/jev-smoke.js` for one paid synthetic preview. Both use fresh isolated data directories.

## Next useful integration targets

1. Observe the selector in ordinary longer chat and tune its confidence floor/criteria from actual proposals. Avoid a broad benchmark as a prerequisite.
2. Add optional Jev reranking of a small lexical retrieval shortlist before excerpts enter Luna's context. Keep exact source resolution and byte limits in code.
3. Explore bounded ingress/state classification, leaving free-text extraction and rewriting to Luna. Keep arithmetic and structural invariants deterministic, as advised in the [Jev limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13).

The reusable local service and Converse integration remain separate later steps.
