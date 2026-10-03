# Longer conversation findings

Reviewed 2026-09-30. Conversation: `conv_2af6bb45-b273-4524-9d1c-55756a881c3a`.

The context layer supported a useful, evolving robotics-program discussion through **20 completed answers**, then stopped on the final shelving question. Important corrections and restrictions survived. The main gaps are expensive context management, insufficient headroom for retrieval, incomplete comprehensive answers, and structured state that remained unused.

## Evidence and scope

Read [transcript.json](E:/Coding/converse/CLA/conclave/.conclave/transcript.json), the conversation's SQLite events/snapshots, and the current implementation. The export's **268 events and revision 53** match the database; there are 53 saved snapshots. Every snapshot's source IDs resolve to saved events. The 22 user records include one explicit pin, 20 answered messages, and one failed message. No new model calls or code changes were made for this review.

Settings recorded in requests: **GPT-6 Luna, layered mode, 32,000 local budget units, 4,096 answer/compaction output tokens, low reasoning**. Optional selection also used Luna, with reasoning disabled, an 8,000-unit budget, and 600 output tokens.

## Token usage

| Purpose | Calls | Input tokens | Output tokens |
|---|---:|---:|---:|
| Answers and tool continuations | 25 | 118,793 | 8,255 |
| Attention selection | 12 | 11,394 | 4,404 |
| Compaction | 13 | 32,676 | 13,676 |
| **Total** | **50** | **162,863** | **26,335** |

All 50 submitted requests have recorded responses and usage. Cached input: **16,870 tokens**, already included in input totals. Reasoning: **1,706 tokens**, already included in output totals. Recorded API latency totals **269.8 seconds**, excluding human pauses and other CLI work. Dollar cost was not calculated.

Context management consumed half the calls, **27.1% of input tokens and 68.7% of output tokens**. Seven paid compactions were discarded for failing the 15% minimum projection reduction; those calls used **14,207 input and 6,895 output tokens**. Six compactions committed, reducing their respective complete projections by approximately 18–44%.

Final active content contained 10,497 characters versus 37,156 in original user/assistant history, but this excludes metadata, tool definitions, and retrieval exchanges. There is no matched full-context run, so this test does **not establish net token savings or superior answer quality**.

## Why the final turn stopped

The error is an application budget check, not a provider context-limit rejection or cumulative usage allowance. The counter measures serialized request **UTF-8 bytes**, then adds the configured output reserve; it is not a tokenizer.

| Final-turn stage | Estimated input units |
|---|---:|
| Initial answer request after context management | 26,041 |
| After resolving a storage bundle | 27,033 |
| After the subsequent history search | 29,390 |

The last continuation required **29,390 + 4,096 = 33,486**, exceeding 32,000 by **1,486 units**. Reconstructing it from saved requests and tool results reproduces the error exactly. It was blocked before submission; the two preceding answer calls still incurred usage.

Retrieval exchanges added 3,349 units. The answer loop retains these exchanges and does not rerun compaction between tool calls. A recent 6,520-character report remained protected by the recent-context window; the last attempted compaction offered only 0.1% reduction and was discarded. History and the unanswered question remain saved.

The shelving question also introduces a $10,000 budget without explaining its relationship to the pinned $15,000 grant and restricted $2,000 supplement. No shelving unit prices were supplied. A successful answer should clarify those points before calculating a purchase quantity.

## Recall and answer quality

The report retained the updated grant and equipment restriction, seven dependable laptops and their failure breakdown, Priya's Weeks 1–3 availability, Jordan's Weeks 4/9 absences, Sam's conditional clearance, access needs, fixed teams, and the Week 5 room change. Budget arithmetic remained coherent.

However, the comprehensive report at event sequence 282 omitted **the $25/student fee cap and cabinet dimensions/18-inch valve clearance**. Both were present in its submitted context at sequence 280. This is incomplete use of available memory, rather than loss of source history. The later reply also recommends an explicitly noncompetitive format after the user said they were only “leaning” away from competition; that recommendation should remain distinct from an approved decision.

## Feature coverage

| Capability | Evidence from this conversation |
|---|---|
| History, receipts, export, revisions | Export/database agreement; source links resolve; 53 snapshots. |
| Attention and automatic compaction | Exercised; six committed rewrites and seven discarded rewrites. |
| Optional model selection | 12 calls; four rejection/fallback events: three non-shrinking offload proposals and one response truncated at 600 output tokens. Chat continued afterward. |
| Offload, bundle resolution, memory tiers | Five committed offload operations; nine references remain. Historical bundles were resolved. Memory-tier inspection itself is not evidenced. |
| Search and retrieval | Two searches and three bundle resolutions. Some retrieval revisited the initial clarification rather than useful current facts. Final search mixed obsolete and current budget excerpts. Event/range retrieval and paging were not exercised. Search backend was lexical fallback. |
| Pins | `$15000 budget` remained unchanged in every snapshot from its introduction at revision 24. |
| Structured task state and relationships | **Zero updates and zero named entries.** Typed compaction summaries are separate from structured state. Corrections, supersession, conflicts, attribution, and state protection were not exercised here. |
| Manual edits, eviction, restore, ingestion | No recorded manual edits/evictions/restores or ingested documents; focused document loading was not exercised. |
| CLI inspection and utilities | Read-only commands such as context/diff/history/stats/attention/state/memory/bundle/revisions/help/list/models are not logged, so their usage cannot be established from this export. Reindex usage is likewise unrecorded. |

## Updating state in the next session

“Update the plan” produced prose rather than named state. Ask explicitly, for example:

> Use update_state to track named entries for program.budget, equipment.supplement, staffing.availability, and storage.clearance. Cite the original user events, preserve restrictions and uncertainty, and keep recommendations separate from approved decisions. Reuse these keys when facts change.

Then inspect `/state`. Manual `/state-update PATH` requires a JSON file with the current revision, actual source IDs, and the fields documented in [README.md](E:/Coding/converse/CLA/conclave/README.md); [scripts/state-demo.js](E:/Coding/converse/CLA/conclave/scripts/state-demo.js) provides an offline example. Editing generated `context.md` does not update state.

## Recommended next work

1. Reserve headroom for complete tool exchanges and recover from continuation overflow before another paid call.
2. Reduce repeated, low-yield compactions and improve selection proposals; retain their usage accounting.
3. Make named state easier to create and update, and check comprehensive answers against active constraints. Preserve tentative decisions explicitly.

Increasing the CLI budget would allow more room temporarily, but would not address these causes. This run supports the proof of concept while exposing useful limits to address before broader integration.
