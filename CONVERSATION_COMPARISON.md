# Conversation comparison: live Jev integration

Reviewed September 30, 2026. New conversation: `conv_aece3e54-3b53-4823-a144-116cc885c3b1`.

**The core context reduction holds up, and live Jev selection works. The main remaining problems are fidelity and carrying Jev retention decisions through multiple compaction passes.** All 12 conversational asks completed. The shorter retreat discussion is a useful comparison with the previous robotics discussion, but not a controlled benchmark.

## Evidence and usage

Read [new export](E:/Coding/converse/CLA/conclave/.conclave/transcript2.json), saved database events/snapshots, and the implementation; compare with [previous findings](E:/Coding/converse/CLA/conclave/LONG_CONVERSATION_FINDINGS.md). The new export's 147 events and final revision 32 match the database. Snapshot source IDs and remaining offload references resolve. The extra user record is a manual state entry, not an unanswered ask.

Both runs used Luna with low reasoning, a 32,000-unit local budget and 4,096 output reserve. The new selector used native Jev, returned model `jev-1.13.0`.

| Measure | Previous run | New run |
|---|---:|---:|
| Completed answers | 20 | 12 |
| API calls, including management/tool continuations | 50 | 26 |
| Reported input / output tokens, all providers | 162,863 / 26,335 | 83,618 / 9,342 |
| Luna input per completed answer | 8,143 | 5,388 |
| All-provider input per completed answer | 8,143 | 6,968 |
| Selector mean recorded API latency | 3,846 ms | 136 ms |
| Compactions committed / discarded | 6 / 7 | 2 / 2 |
| Offload operations / bundles | 5 / 9 | 5 / 7 |
| Failed turns | 1 | 0 |
| Manual / model-created named state entries | 0 / 0 | 1 / 0 |

New usage splits into Luna answers **57,861 input / 4,550 output**, Luna compaction **6,797 / 1,749**, and Jev selection **18,960 / 3,043**. Luna's 9,987 cached input and 231 reasoning tokens are already included; Jev cache usage is unreported. No dollar estimate was calculated.

Observed Luna input per completed answer fell **34%**, and combined input fell **14%**. Different content and conversation lengths prevent attributing these changes solely to Jev. Management still consumed **30.8% of combined input**, versus 27.1% previously; it shifted work away from Luna. Two rejected compactions still consumed 2,514 input and 584 output tokens.

## Context reduction and budget

Final active content was **5,810 characters versus 21,559 original source characters: 73% reduction**, comparable to the previous 72%. This excludes metadata, tools and retrieval exchanges.

The final actual answer request was **20,182 UTF-8 bytes**. Replacing its working input with full source history while holding other settings/tools fixed gives **30,670 bytes**: the layered request is approximately **34% smaller**. This is a reconstructed comparison, not a paid full-context run or provider token count. With the 4,096 reserve, the actual request fits; that full-history reconstruction exceeds 32,000.

Peak submitted input plus reserve was 27,623, leaving 4,377 units. No budget recovery was needed, so this run does not validate recovery during a real overflow.

## Two important problems

**Budget arithmetic became an active constraint.** The consolidated plan at event 456 says $500–$150 remains after venue and food, and identifies 30 attendees as the tighter case. At the $75 fee cap, the correct calculation is:

| Attendees | Revenue minus $1,500 venue and $20/person food |
|---|---:|
| 20 | **−$400** |
| 25 | **−$125** |
| 30 | **+$150** |

The original user figures were available in that answer's input; the earlier correct table had been offloaded. The evidence establishes an answer arithmetic error, not that context reduction caused it. Compaction at event 485 then copied the incorrect remainder into an active `constraint`, giving an assistant-derived mistake continuing influence. Source lineage preserved the ability to trace it, but did not enforce correctness.

**Jev escalation was lost within one compaction cycle.** At event 477, all six queried candidates escalated for retention under the confidence gate. The first pass compacted other candidates. The next pass rebuilt deterministic selection without carrying those escalations forward; event 482 selected all six for rewriting, committed at 485. Original sources remain saved, but the integration did not honor its retention policy across passes. Zero fallback/error counters conceal this behavioral bug.

Across eight Jev proposals, there were 47 candidate assessments, including repeats: seven offload decisions and 40 escalations, 39 imposed by confidence gating. Fix the carryover bug before tuning the confidence floor.

## State, recall and next work

The manual `theme.topic` entry, “Next Step, Not a Blueprint,” survived every subsequent snapshot. Speaker uncertainty and optional sharing remained appropriately tentative. The final food recall correctly returned $20/person for five meals from active context. Autonomous `update_state` use remained zero.

One search and one bundle resolution supported the session-outline answer, but retrieved material included the current question and an older, mostly budget-focused excerpt. Retrieval targeting remains weak. New pin, ingestion, restore, state-conflict and paging behavior was not demonstrated; unlogged CLI inspection cannot be assessed from this transcript.

Next focused changes:

1. Preserve Jev retain/escalate exclusions throughout the complete compaction cycle.
2. Keep user-supplied quantities distinct from assistant calculations; check budget arithmetic before promoting derived claims into constraints.
3. Improve automatic named-state adoption and retrieval targeting, then revisit low-yield management calls.

This review made **no API calls or code changes**. The comparison document is the only new artifact.
