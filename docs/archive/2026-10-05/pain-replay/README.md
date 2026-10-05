# Pain conversation: bounded cheap-model replay

The fresh-evidence repair worked in this trial, but the previous memory repair admitted malformed fragments, and Jev did not demonstrate better retrieval or lower whole-task cost. Three additional repairs are now implemented: complete-paragraph memory selection, exclusion of the pending question from history discovery, and accurate Jev response status/telemetry.

## Method and retained attempts

The ten original human prompts were extracted from the canonical Pain export. GPT-6 Luna replaced OpenAI slots; Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) replaced Opus/Sonnet slots. Both IDs were checked against native provider catalogs. Each arm used a separate conversation, alternating arm order by turn, native answers, real Jev/embeddings, and regenerated Workspace files. Baseline was `3b969ef`; the first repaired arm was `91ec005`. The original 256,000-byte guard stayed intact; output was capped at 8,192 instead of 16,384 tokens.

External evidence was frozen: five original provider-written search summaries and nine captured pages. Searches selected the nearest original query lexically; unavailable URLs returned explicit errors. This exercises the engine rather than current research/web quality. It excludes native search fees and cannot verify medical/social claims. Original answers and saved analysis files were not seeded.

The first pair used a 120-dispatch, 15-minute, $2.50 conservative reservation allowance. Each Agent objective had 24 steps, 180 seconds and 400,000 reported/estimated tokens. It reached nine prompts per arm before a timed-out dispatch with unknown usage stopped further inference. Seven turns completed in each arm; “save memories” expired in both, and synthesis exhausted the repaired run's token allowance. These are retained failures, not successful full reproductions.

Two test confounds matter. The cheap model proposed a different “last question,” changing research direction. The literal prompt “what Sonnet was doing” named a model that had been replaced by Haiku; the answerer repeatedly searched for absent Sonnet activity. Recovery used the actual cheap-model name, saved history only, separate strict call/time/spend allowances, and included the subsequent source repairs. Repaired synthesis and compaction completed; baseline synthesis expired and final compaction completed in a separate attempt. These recoveries are not a clean matched rerun or proof that the follow-up repairs caused better completion.

All 183 dispatches across the pair, failed probes and recoveries are counted: 181 have reported usage, two timed-out calls do not. Known token valuation is **$1.11146–$1.15994**, plus unknown charges for those two calls. Their pre-dispatch reservations sum to $0.07597; that is a guard estimate, not a bill or guaranteed charge ceiling. GPT/Haiku rates were rechecked against [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing); the trial keeps the dated October 2 Jev rate. No whole-task savings claim is supported.

## Initial paired results

| Check | Repaired `91ec005` | Predecessor `3b969ef` |
|---|---:|---:|
| Native dispatches, including memory and embeddings | 62 | 57 |
| Reported input / output tokens | 1,210,071 / 28,055 | 955,269 / 24,047, plus one unknown call |
| Large tool receipts with a later answer request | 30 | 38 |
| Receipts supplied as native results or fresh handoffs | 30 | 33 |
| Receipts missing those delivery forms | 0 | 5 |
| Additional terminal receipt without another request | 1 | 0 |
| Automatic assistant memory proposals | 20 | 0 |
| Proposals cutting through a word | 18 | 0 |
| Incorrect binding/authority promotions | 0 | 0 |
| Embedding requests completed | 12 / 12 | 11 / 11 |
| Paid Jev calls | 0 | 0 |
| Shadow evaluations complete / unavailable | 16 / 0 | 14 / 2 |
| Largest export build + serialization | 282 ms, 19.4 MB | 293 ms, 20.5 MB |

Supplied text is not proof that the model inspected it, understood it, or retained its qualifications. Native trajectories and evidence choices differed. The repaired run used more tokens and money in this sample. Most Claude shadow decisions lacked rates for this exact legacy Haiku ID; “complete evaluation” therefore did not establish an economic action. Local SQLite embedding success does not verify hosted Neon latency or configuration-failure cooldown in production.

## Follow-up repairs and probes

- **Memory:** models previously calculated character offsets. Exact-span validation accepted arbitrary fragments. Policy v4 now offers numbered complete, unquoted source paragraphs; code maps selected IDs to exact UTF-16 spans and preserves paragraph qualifications. Cut prefix tails, duplicate selections and invalid IDs are excluded. GPT-6 Luna admitted two paragraphs and Haiku admitted five from the actual failed source; all match offered paragraphs and remain unresolved, nonbinding model proposals. Selection quality, factual truth and later utility still require review. The 4,000-character prefix can omit later findings; quoted paragraphs can be conservatively missed. Existing v3 records are not rewritten.
- **History discovery:** the pending question could fill a shortlist with its own query terms. Chat and Agent now exclude that current event from both lexical and semantic discovery; older human evidence and explicit source reads remain available.
- **Jev status:** the native TypeSafe response omitted a status field. The adapter now records successful responses as completed. Historical typed responses are visibly received, with inferred completion counted separately, instead of displaying “no response.”

The final controlled corpus probe used six exact original E² documents, live Jev, and GPT-6 Luna. Jev judged five matching candidates, made confident positive decisions, and confirmed the same top four. The subsequent identical query reused the decision cache: **one paid call, one cache hit, zero changed selections**, 2,532 input / 174 output tokens, 198 ms reported latency. The native version was `jev-1.13.0`. The model used targeted `search_source` reads, saved `pain-corpus-probe.md`, read it back and completed. Manual inspection found the requested distinction between conceptual overlap and empirical evidence in the saved document. This demonstrates functioning delegation/cache/telemetry and a bounded completed task, not added retrieval value or optimality. Two earlier corpus attempts exhausted a six-answer-call ceiling and are retained; the final attempt allowed ten.

## Export and remaining weaknesses

Re-exporting the original 67.0 MB Pain record took **1.634 seconds**, including isolated SQLite hydration; building and serializing the download itself took **0.583 seconds**, with one history decode. Canonical events and all 38 snapshots matched exactly. Compact JSON reduced whitespace, not canonical evidence. These are local backend timings; hosted transfer and the user's click-to-save browser interval were not measured.

The same original-record shadow evaluation still exceeded its cooperative 200 ms allowance at 211 ms. History projection took 65 ms; repeated candidate payload/tokenization work is now a material remaining cost. It failed open without inference or context mutation. The live repaired pair stayed within its shadow allowance, but the original-sized record remains borderline.

Jev did not receive a paid task in the unforced replay, and its corpus probe improved no selection. Explicit source reads and lexical selection often already suffice; enabled Jev is not evidence of useful delegation. The next evaluation should anchor ambiguous follow-up questions and model aliases, use a fixed relevant corpus plus realistic distractors, and compare Jev-on/off completion, source fidelity, recovery calls, latency and total usage across repeated matched tasks. Unsupported model rates, long loops/repeated reads, catalog skimming, memory semantic relevance and the remaining large-history shadow allowance are still open.

## Reproduce and inspect

Scripts are prepare-only until `--live` is supplied. `scripts/replay-pain.js --file <canonical-export>` prints the workload without credentials or inference. Add `--live --directory <isolated-output>` for a bounded pair. `scripts/analyze-pain-replay.js <output>` performs offline analysis. `scripts/probe-pain-repairs.js` and `scripts/recover-pain-replay.js` retain focused checks and bounded recovery separately.

Full local evidence is preserved under `.conclave/pain-replays/`: `paired-2026-10-05`, `repair-probes-2026-10-05`, `repair-probes-recovery-2026-10-05`, `repair-probes-final-2026-10-05`, `recovery-final-2026-10-05`, and `baseline-compaction-2026-10-05`. Canonical exports/full native payloads remain local. The first failed corpus probe retained its usage and selection report but did not export its in-memory answer audit; subsequent probes save the audit on failure as well. [Committed metrics](analysis.json) exclude full human prompts/transcripts.

Validation: 246 source tests passed, one optional replay skipped; syntax passed. The full suite was rerun with workspace temp directories after sandbox rename failures. Focused tests cover Unicode/exact paragraphs, quotes/cut tails, invalid IDs, authority, self-retrieval, legacy Jev status, native adapter status and replay spending/cancellation guards.
