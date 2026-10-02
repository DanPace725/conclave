# Conclave reorientation

2026-10-02. This document resets the project's direction after a review of 11 Converse conversations exported to `converse/docs/conversations/` and analyzed with `E:\Coding\converse\conclave_report.py`. It takes precedence over the sequencing in [DEVELOPMENT_ROADMAP.md](<E:/Coding/converse/CLA/conclave/docs/DEVELOPMENT_ROADMAP.md>) and the Converse [roadmap](<E:/Coding/converse/converse/docs/roadmap.md>) until its gates are met. Earlier documents remain the record of what was built and why.

## Summary

Conclave works mechanically: the trajectory is preserved, lineage resolves, retrieval works, and the working context shrinks. **It does not yet reduce what users pay.** Counting only tokens, layered mode sent an estimated 23% less answer input than append mode. Once provider prompt caching is counted, it probably cost **more** than plain append-only chat with caching. The machinery used to reduce context, the format of the context itself, and the way edits break the cache together outweigh the reduction.

The idea itself isn't refuted. The working assumption that "smaller context = smaller cost" was too compressed. Context reduction remains a primary goal and works: across the 11 conversations the final working context is **67% smaller than the full append-only history** (561K → 183K characters). The gap is that this reduction isn't yet reaching the bill. The next phase keeps context reduction as a headline measure and adds cost as an equal goal, so the two are tracked side by side and improvements to one aren't paid for by the other.

## 1. What Conclave is for

From the [architecture proposal](<E:/Coding/converse/CLA/conclave/docs/Context Layer Architecture.md>): the record of what happened is not the same object as what the model needs to see now. Keep the complete trajectory; give the model a smaller, mutable, recoverable projection.

The objective, as the proposal states it, is

> minimize compute cost, subject to task performance, information recoverability, epistemic fidelity, and context budget,

not "minimize context length." Its three hypotheses:

1. Bounded active context with external history needs substantially fewer frontier-model input tokens than a comparable append-only conversation.
2. Separating cheap selection from expensive transformation reduces frontier inference further.
3. Provenance and retrieval reduce the quality loss normally caused by summarization.

Conclave therefore has two primary, co-equal measures:

1. **Context reduction:** how much smaller the working context is than the full append-only conversation, and where each piece of history went (kept verbatim, condensed into a summary/state/excerpt, reduced to a pointer, or left in history only). This is the direct test of "persistent trajectory, mutable context," and it is already working.
2. **Cost:** what the user is billed compared with append-only chat with caching enabled, counting management calls.

Fidelity (constraints, decisions and caveats survive) and recoverability (removed detail can be retrieved) are the constraints on both.

The MVP gate was: *at least one long case shows lower total inference input without worse task results, counting all management calls.* That gate was waived when the proof of concept was accepted. **The context-reduction half is met. The cost half has not been met, and it is now the first gate again, restated in cost terms.**

## 2. The corrected model of "context" and cost

"Context" in the original model meant everything sent to the model. The bill is made of more distinct parts than that:

| Part | What it is | Who controls it |
|---|---|---|
| Instructions and tool schemas | Fixed per request, sent on every call | Harness |
| Working projection | The mutable view Conclave maintains | Conclave policy and model edits |
| Tool exchanges | Calls and results within one turn, resent on every continuation | Agent loop |
| Output reserve | Counted against the byte guard, not billed | Settings |
| Uncached input | Billed at the full input price | Depends on prefix stability |
| Cached input | Repeated prefix, billed at a steep discount (often ~10%) | Depends on prefix stability and provider settings |
| Cache writes | Some providers charge a premium to create a cache entry | Provider settings |
| Management calls | Selection (Jev or OpenAI), compaction, title | Conclave policy |
| Call count | Number of model calls per user turn | Agent loop and tool use |

Cost of a conversation, over every call including management:

```
cost ≈ Σ [ p_in · uncached + p_cache · cached + p_write · cache_writes + p_out · output ]
```

The comparison that matters is **Conclave against append-only with caching enabled, at equal quality.** Without caching, reducing context is almost always a saving. With caching, it often isn't:

- Carrying R tokens for K more calls costs about `K · R · p_cache` once cached. At `p_cache ≈ 0.1 · p_in` that's cheap.
- Removing them costs management (`M`) plus re-sending everything after the edit point uncached once (`S · (p_in − p_cache)`), plus any cache-write premium.
- Removal pays only when `K · R · p_cache > M + S · (p_in − p_cache)`. In ordinary chat, K is small and S is most of the prompt, so it rarely pays.
- **Keeping material out of context in the first place (ingress) always pays.** It avoids the first full-price send as well as every later carry. Mutations near the *end* of the prompt are cheap; mutations near the *start* are expensive.

The proposal anticipated this ("prefix caching substantially reduces the actual server-side cost of ordinary append-only conversations"). The CLM paper's cache-aware accounting appendix was listed as required reading. The implementation didn't carry it through.

## 3. Evidence (11 conversations, 2026-10-02)

| Measure | Value |
|---|---|
| Conversations / turns / API calls | 11 / 101 (8 failed) / 324 |
| **Final working context vs. full append-only history** | **183K vs. 561K characters: 67% smaller** (31–84% per substantial conversation) |
| Where history items ended up | 104 verbatim, 89 condensed, 8 pointer-only, 84 left in history only |
| Input / output tokens | 4.84M / 184K |
| Answer-input reduction vs. append mode, raw tokens (estimated) | 23% saved |
| Same, with cache discounts applied to both sides (cached price 10% / 25% / 50% of full) | about 145% / 71% / 18% **more** than cached append |
| Cached share, first call of each turn | 0–10% |
| Cached share, Claude calls | ~0%: no `cache_control` is set; OpenAI `prompt_cache_key` is also unset |
| Answer input from within-turn tool continuations | 76% |
| Share of working-context bytes that is metadata (hashes, IDs, flags, attribution) | ~33% |
| Layered request vs. append estimate, ordinary chat turns | usually 3–14% *larger* until a compaction lands |
| Where raw savings came from | Two document/tool-heavy conversations (+38%, +52%) |
| Jev enabled / actually called | 10 / 4 conversations; outputs mostly retain/escalate; net-negative in the two shorter runs |
| Failed turns | 5 Claude signed-continuation overflows, 2 OpenAI 400s (`reasoning: none` on `gpt-6.1-sol`), 1 byte-guard overflow |
| `update_state` rejections | Present in 4 conversations, mostly "Unknown bundle" (keys passed where bundle IDs are expected) |
| Pins used | 0 conversations |

These cache-adjusted figures are an offline reconstruction. Turns were usually close together (86% of gaps under 5 minutes), so append mode would normally hit the cache. The direction is consistent across the plausible price range, but the size needs one paid calibration run (Phase 0).

Two notes from the history:

- The first three-mode comparison on 2026-09-30 already showed layered at 4,683 input tokens against append's 3,253. The signal was present early but wasn't treated as a gate.
- Issues reported from hands-on use and not visible to agent self-tests: Jev never called even under budget pressure; prior state becoming uneditable after Jev retention applied; excessive database traffic; tool failures.

## 4. What is working: keep it

- **Persistent trajectory, snapshots, lineage, receipts and complete exports.** The audit trail is what made this review possible.
- **Retrieval and offload to pointers.** "Leaving attention without leaving history" works.
- **Named, source-attributed state as a concept.** Its ergonomics need work (§5).
- **Converse as the test bench.** Long conversations and agent runs driven by the user, outside the coding agents' token budgets and outside their own test loops. This is how the problems above were found. The integration, agent mode and hosting exist for this purpose and are justified by it.
- **The Context Garden.** Visible, inspectable working state is valuable regardless of how the cost question resolves.

## 5. What is holding the project back

1. **Context size was tracked; cost wasn't.** "The working context got smaller" was accepted as success, which is right for goal 1. But nothing tracked whether that reduction reached the bill, so the mechanisms around it (management calls, metadata, cache-breaking edits) grew unchecked.
2. **The projection defeats prompt caching:**
   - The model-facing message begins `Working context revision N:`, so the cacheable prefix ends right after the instructions.
   - Provider caching is not enabled.
   - Mid-turn `update_state` / `edit_context` rewrite the first message, so every later continuation in that turn starts uncached. Continuations are 76% of answer input.
3. **The projection is heavy.** Hashes, full UUIDs, `pinned:false`, `verbatim_required:false`, parent lists and attribution objects are serialized to the model on every call.
4. **Management is triggered by budget, not economics.** Compaction and selection start at 75% of a byte budget, regardless of whether they will pay back over the remaining calls.
5. **Jev isn't earning its place yet.** It's rarely triggered, mostly says retain/escalate (the 0.65 gate escalates about 40%), and its retention protections reportedly block later state edits. It's judged by calls made, not by decisions changed.
6. **Provider surface area is costing reliability.** Each provider adds continuation rules (Claude signed thinking can't be compacted in place), reasoning-setting validity, and different caching rules.
7. **Model-facing APIs that models misuse.** `update_state` relationship fields confuse state keys with bundle IDs. Pins are unused.
8. **Process: the "why" gets lost across agent sessions.** Coding agents build a mechanism, test it with their own tests, and finish confident. Hands-on use then finds the mechanism doesn't serve the goal. Agent tests confirm a mechanism *runs*; they don't confirm it *helps*.

## 6. Revised plan

Each phase has a gate measured on user-run conversations through `conclave_report.py`, not on agent-authored fixtures.

### Phase 0: Measure both targets

- Keep the full-history vs. working-context comparison as the lead section of `conclave_report.py` (implemented 2026-10-02): characters of text on both sides, a breakdown of what each side contains, where every history item ended up, and the same comparison turn by turn. Any other report generator should keep this comparison rather than replace it.
- Add priced, cache-aware cost to `conclave_report.py`: a per-provider price table (input, cached input, cache write, output), cached share per call, cost against a cached-append estimate, and the cost of management calls.
- Calibrate once: replay the user messages of one recorded long conversation in append mode with the same model and settings, with caching enabled. Compare its actual bill with the estimator, then fix the estimator.
- Record database operations per turn in the event log or a debug counter, so "excessive DB traffic" becomes measurable.

**Gate:** the report states, per conversation, both the context reduction and Conclave cost vs. estimated cached-append cost, and one paid replay agrees with the cost estimate within a stated margin.

### Phase 1: Stop paying for overhead

- **Enable caching:** Anthropic `cache_control` breakpoints and OpenAI `prompt_cache_key`. Both modes benefit, so append comparisons must use it too.
- **Cache-friendly layout:**
  - Stable material first: instructions, tool schemas, named state, settled summaries.
  - Then an append-only tail of recent turns.
  - Revision labels and volatile pointers (e.g. reasoning source pointers) at the end, not the start.
- **Apply mid-turn edits at the next turn boundary.** Within a turn, `update_state`, `edit_context` and offloads record their changes, but the projection sent on continuations stays fixed unless the byte guard requires otherwise.
- **Compact model-facing view.** Short handles (`[b12]`), type and status only where informative, no hashes or false flags. Lineage stays in the store and remains resolvable through tools.
- **Fix the known failures:** reasoning-setting validation per model, Claude signed-continuation overflow handling, and `update_state` key/ID confusion. Accept keys in relationship fields, or reject with a corrective message the model can act on.

**Gate:** in ordinary chat, layered request size is at or below the append estimate from the first turn. First-call cached share is comparable to cached append. Context reduction does not fall, and there are no regressions in recovery or fidelity checks.

### Phase 2: Make management economic

- Replace the 75%-of-budget trigger with an expected-value check: act only when `K · R · p_cache` (estimated remaining calls × removed tokens × carry price) exceeds management cost plus re-caching cost. The byte guard remains a hard safety limit, not the policy.
- **Batch mutations into infrequent "epochs"** rather than many small edits, and prefer edits near the tail of the prompt.
- **Jev:**
  - Call it only when the expected value check says management is worthwhile *and* there are enough candidates for selection to matter.
  - Measure it by decisions that changed the outcome relative to the deterministic policy, and by net cost.
  - Fix retention protections so they never block legitimate state corrections.
  - If it doesn't change outcomes enough to pay for itself, disable it by default.

**Gate:** management cost is net-positive in the report for long conversations, and Jev's changed-decision rate and net effect are reported.

### Phase 3: Ingress and agents, where the economics favor Conclave

- Bound tool outputs and documents before they enter the context: index the full output, admit an excerpt plus a pointer. This is where savings hold up even with caching, and where the two strongest conversations got theirs.
- Use Converse's agent runner for long tasks where K is large. Compare append-with-caching against Conclave on the same objectives, measuring cost, task success, and recovery of removed facts.

**Gate (restated MVP):** at least one long, user-run agent task where Conclave's priced cost is lower than cached append, with equal or better task results and no critical constraint loss.

### Phase 4: Decide the product framing

After Phase 3, decide explicitly whether Conclave is:
- **a cost play**, if the gate is met clearly;
- **a quality / capacity / control play**: bounded context on runs that would exceed limits or degrade, an auditable history, and the Context Garden as a user-facing memory interface. This value exists even at cost parity;
- **or both.**

Resume roadmap features (retrieval quality, web search, cross-conversation memory, embeddings, E2B) according to that decision.

## 7. Defer until Phase 3's gate is met

- New providers or provider-specific features beyond what testing requires.
- New management mechanisms that add calls per turn.
- Web search, cross-conversation memory, embeddings, E2B, unattended runs.
- Context Garden expansion beyond inspection and the controls needed for testing.

Test-bench needs (exports, reports, agent runner fixes, reliability) are not deferred.

## 8. Working rules for coding agents

These address the failure mode in §5.8:

1. **State the goal metric.** Every change says which measure it is expected to move (context reduction, priced cost, cached share, failures, fidelity) and roughly how much. A change that improves one primary measure must report its effect on the other.
2. **Don't remove measurements the owner relies on.** The full-history vs. working-context comparison is a primary result. Report generators may add caveats or better units, but not drop it.
3. **Agent tests are necessary, not acceptance.** A mechanism is accepted when user-run conversations show its effect in `conclave_report.py`.
4. **Count every token a mechanism costs.** Any feature that adds model calls, tool schema bytes, or projection bytes must report that overhead.
5. **Don't change the prompt prefix casually.** Anything that alters early prompt content per call or per turn needs justification against cache cost.
6. **Prefer removing mechanisms to adding them** when a measure is flat or negative.
7. **Report honestly.** End a session with what was *not* verified in real use, not just what passed.
8. **Re-read this document** at the start of any Conclave or context-layer session.

## 9. Open decisions for the project owner

- The price table source and which models stay in the regular test loop (fewer providers means faster iteration).
- Whether Phase 0's paid calibration replay is acceptable and on which conversation.
- Whether Jev stays enabled by default during Phases 1–2 or only in dedicated runs.
- The fidelity check to use alongside cost. A short human checklist per long run (constraints kept, decisions not overstated, arithmetic correct) is the current suggestion.
