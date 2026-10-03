# Next Conclave iteration

October 2, 2026. This is a practical follow-up to [REORIENTATION.md](REORIENTATION.md), incorporating the current Converse checkout `29a1271` and newer exports. Treat the reorientation's capacity and cost objectives as priorities; its phase gates are useful checkpoints rather than a reason to freeze unrelated useful work.

**Goal:** measure context reduction and total inference cost together with preserved task quality, then remove the largest demonstrated overhead. Keep the trajectory, retrieval, lineage and inspectable working state. Smaller context remains useful, but is not sufficient evidence of a smaller bill.

**Implementation follow-up:** the user authorized this iteration and timestamped exports. The [completed iteration report](../../../converse/docs/reports/conclave-iteration-2026-10-02.md) records shared cost analysis, prompt changes, offline replay, paid comparisons and the revised next steps. The recommendations below describe the starting plan; that report is the current handoff.

## What this pass established

- Read the reorientation, architecture proposal, earlier development/MVP roadmaps, integration/status/Jev notes, comparison findings, current Converse roadmap and repair reports, both report implementations, and relevant current code. The CLM paper's actual cache accounting is in **Appendix C**; its context-length-awareness analysis is in Appendix G. It explicitly accounts for re-prefilling after edits. Its server-side suffix-cache results do not establish a discount available through our provider APIs. [Primary paper](https://arxiv.org/html/2609.37725v1)
- The [current master report](../../../converse/docs/conversations/master_report.md) includes **11 conversations, 103 user turns, 341 inference requests and 7 separately logged title generations**. It reports **5,024,187 known input / 188,098 known output**, with 2 missing/partial calls. REORIENTATION.md's 101-turn/324-call/4.84M snapshot is older. Its counterfactual cost percentages remain hypotheses, not a calibrated bill comparison.
- Converse's repair round already implements scoped protection/inspection, unchanged-selection caching, bounded automatic compaction, actionable state-key/handle relationships, and readable source handles. Its [repair notes](../../../converse/docs/reports/context-repairs-2026-10-02.md) report 103 passed backend tests, one skipped live Neon test and browser checks. Those are prior recorded results, not tests rerun during this pass. The offline replay demonstrates shrinking saved state and original retrieval; it does not establish production savings or semantic quality across tasks.
- The current request still starts its projection with `Working context revision N`, serializes rich segment metadata, and adds a changing runtime status line to instructions. It rebuilds the projection on tool continuations. These remain concrete opportunities to improve prefix stability. OpenAI caching is already automatic; an absent `prompt_cache_key` does **not** mean caching is disabled. Anthropic's native adapter still has no cache breakpoints. See the [pricing/caching correction](MODEL_COSTS_2026-10-02.md).
- `conclave_report.py` and Converse's JavaScript report differ in export selection and normalization. In particular, the Python helper adds Anthropic cache buckets to input, while Conclave exports already normalize them into input. With cache reads/writes present this would double-count. Fix the boundary before pricing Claude runs.

## Delivered in this pass

Standalone Conclave now reuses Converse's `input-size.js` and `gpt-tokenizer` dependency. Each inference request saves a local count with scope, encoding, requested model/provider and fingerprint. `/stats`, service views and exports expose the saved next request's local count and historical count coverage. It includes instructions and tools; it excludes output settings/reserves. The provider payload, byte guard and management scheduling are unchanged. No remote count calls or changing token hints are added to the prompt.

Local counts precisely tokenize the selected encoding's serialized text; provider framing and other model encodings remain estimates. Old requests without metadata stay visibly uncounted. The copied module also retains Converse's provider-count helper for future adapter work, but standalone has no new remote-count command or provider counter in this increment.

All **17 standalone tests passed**, including two new checks for counting scope/fingerprint invalidation and persisted counts without changing request payloads or guard behavior. The service preview uses the saved model settings; a CLI smoke check also verified the configured OpenAI model and a positive local count with zero remote calls. Request counting adds no extra event-log read. The catalog was read through Converse's actual picker function. [Cost reference](MODEL_COSTS_2026-10-02.md), [rate JSON](model-costs-2026-10-02.json), and [catalog snapshot](model-inventory-2026-10-02.json) cover 17 picker IDs plus the existing Jev selector. The exact older Sol long-context rate remains unverified. Jev's rate was subsequently verified at $0.042/MTok input and free output; see the updated cost reference. These changes are local; no paid inference replay or deployment was performed.

## Recommended next build

### 1. Make one cost report authoritative

Use Converse's current pure `analyzeConversation()` path and canonical JSON exports as the starting point. Add a small shared usage/pricing module that reads the rate snapshot. Keep `conclave_report.py` usable as an entry point if desired, but have it delegate to the same analysis or explicitly reconcile its semantics. Do not maintain two independent cost calculations.

For each call, report provider/requested/reported model, purpose, total input, uncached input, cached reads, writes by TTL, output, price basis, known USD subtotal and missing-price/usage reasons. Separate answer and tool continuations from selection, compaction and title. Preserve billed partial responses. Keep unknown costs unknown, when usage or model rates are absent; show priced coverage. Re-tokenizing old payloads may improve a local estimate but must not rewrite their historical measurement provenance.

Conclave exported Anthropic input and ordinary-chat native Anthropic input need separate normalization paths. Capture OpenAI cache writes as well as reads. Pin rate dates and processing tiers; current prices are a labelled valuation unless historical effective prices are available. The fetched OpenAI tables do not establish a numeric short/long boundary, so treat unresolved tier selection as uncertainty.

Add a counterfactual cached-append estimate using complete request scaffolding, realistic tool exchanges, cache eligibility/expiry, and explicit assumptions about output and call count. Publish a small range if cache matching is uncertain. Distinguish a same-trajectory estimate from an actual append run, since context management can change outputs and calls. Compare an idiomatic plain chat baseline as well as the existing harness append mode, whose source headers/retrieval tools add their own overhead.

**Reviewable result:** an export produces a priced call table, purpose totals, coverage and a labelled baseline range; no claim of savings depends on a missing rate being zero. Add focused arithmetic/normalization fixtures. Optionally record per-turn database reads, writes and transactions with a compact debug counter to quantify the separate traffic concern.

### 2. Remove obvious prompt overhead and preserve stable prefixes

First move changing telemetry out of instructions and early prompt content. Keep provider/model identity and fixed instructions stable. Use existing S/E handles in the model-facing serialization and omit hashes, full UUIDs and uninformative false flags. Keep epistemic status, attribution, constraints and actionable protection information when needed; canonical lineage remains in storage and tools.

Make stable state/settled context precede the recent append-only tail. Changes to named state are real invalidations and should be measured rather than hidden. Add Anthropic cache breakpoints at stable boundaries for both layered and append comparisons. Keep OpenAI's current supported default caching behavior and verify observed reads/writes; a key alone cannot repair an unstable prefix.

Then trial freezing the model-facing projection during one tool loop, applying saved edits to the next turn. Receipts and tools must make staged changes clear, retain usable handles/revisions and permit inspection of current state. Provide an explicit refresh when newly saved context is needed, and a logged exception when the byte guard requires rebuilding. Preserve Claude's signed native tool exchanges while doing this. This is a separate behavior change from telemetry counting.

**Reviewable result:** compare serialized tokens and common-prefix lengths before/after on saved short-chat and tool-heavy requests. Demonstrate preserved source retrieval, state corrections, revision safety and multi-step tool results offline; then check real cached usage through Converse. Do not require layered to be smaller on every first turn: extra recovery tools have a real fixed cost that should be justified over the task.

### 3. Run a small paired user trial

Use Luna for low-cost arithmetic/cache calibration, then the same workload with the user's normal answer model, such as GPT-6.1 Sol or Sonnet 5.5. Keep models, effort, tools, output limits and objective matched within each pair. Start with one ordinary chat and one document/tool-heavy task. Test Jev off for the first matched baseline, then on for a dedicated comparison without changing the application's global default.

Before inference, prepare the replay messages, projected call/token/cost ceiling, export destinations and a brief quality checklist: constraints preserved, uncertainty preserved, arithmetic right, removed facts recoverable, useful final artifact. Run under a concrete agreed cap when the paid calibration is authorized. Replaying only user messages changes the trajectory; record generated assistant/tool exchanges and success, rather than treating it as an exact repeat.

**Reviewable result:** actual per-call usage agrees with the cost calculation within a stated tolerance; the observed cache share is compared with the estimate; quality is assessed alongside cost. One paired task is an initial calibration, not evidence of general savings. If costs rise, use the breakdown to select the next fix.

## After that evidence

Prioritize ingress if large document/tool results dominate: store full originals and admit task-relevant excerpts plus retrieval pointers. Account for indexing, selection and later retrieval costs; ingress is promising, but its net benefit is conditional on fidelity and total work.

Replace fixed budget-pressure management with an economic policy only after priced usage is dependable. Evaluate removal against expected remaining carry cost, transformation/selection cost and re-caching. Keep the hard guard for safety. Measure Jev by changed useful decisions and net cost, rather than by how often it is called. Avoid a new prediction mechanism merely to optimize the existing mechanisms.

Continue practical test-bench fixes as needed. Larger retrieval, memory and sandbox features can wait for a concrete task that needs them, rather than an absolute prohibition. Keep the cost/quality/capacity framing open until paired user-run evidence supports a choice.

**Next session's bounded scope:** build the normalized cost report first, then remove changing prompt headers and unnecessary serialized metadata. Leave economic triggering and the paid comparison for the following checkpoint once the report and replay are reviewable.

## Cost-focused continuation

The next build has now delivered shared reports, compact projections, Claude caching, timestamped exports, and bounded comparisons in Converse. New Context/Agent runs also use a persisted stable tool-loop projection and a whole-formula calculator. See the [cost reduction plan](https://github.com/DanPace725/converse/blob/main/docs/reports/conclave-cost-plan-2026-10-02.md) for the current prioritized work and mobile trial. New conversations will be analyzed when the owner returns.
