# Jev memory selection: local test of PR 3 (Conclave) and PR 22 (Converse)

Run on 2026-10-05, branch `ccr-573c3268-raip8k` in both repositories. Test instructions: `converse/docs/pr3-local-test-prompt.md`.

> **Labeler: agent.** Every label in this test was assigned by an AI agent (Claude), not by Dan. No human reviewed a sample, so there is no human agreement rate. An LLM labeler may favor the choices an LLM selector makes, which would flatter the chat models relative to Jev. Treat the numbers as provisional until Dan labels or reviews a random 20% sample.

## Answer

**Not viable yet as shipped, but the main fault is in the confidence gate, not in Jev's judgment.**

On 402 labeled paragraphs from 5 conversations:

- **Quality.** At the default 0.65 threshold Jev picked memories with 84–87% precision and 58–61% recall. Claude Sonnet 5.5, the quality reference, scored 84% precision and 88% recall. Jev is as precise as the reference but misses about 27 points of recall.
- **Fallback.** Jev was unsure about at least one paragraph in 60–63% of events. For completed assistant answers the share was 85%.
- **Cost.** Jev cost 3% of Sonnet and 4% of gpt-6.1-sol, but 91–97% of `gpt-6-luna`, the default task model. Against luna there is no cost saving.
- **Latency.** Jev answered in about 80 ms per call, against 0.9–1.0 s for luna and 1.9–2.1 s for the larger models.
- **Stability.** Jev was much more repeatable than luna between runs.

Of Jev's 61 misses in the first run, 50 were paragraphs where Jev chose the right side (keep) but its confidence in the *kind* was below 0.65. Only 2 were confident skips. An offline re-read of the same stored answers, gating on keep probability instead of four-way confidence, gives 80% precision, 86% recall and a 26% fallback rate. That would meet all three replacement criteria against Sonnet. It is an after-the-fact result on the same data and needs a fresh test before anyone relies on it.

## What was tested

| Conversation | Source | Events | Paragraphs | Required |
|---|---|---:|---:|---:|
| Homelessness policy plan | existing export | 12 | 45 | 21 |
| Pain, gender and endurance norms | existing export | 16 | 67 | 20 |
| Timeline for mapping the human brain | existing export | 18 | 93 | 35 |
| Feedback on an uploaded document | existing export | 44 | 154 | 53 |
| Cold-climate heat pumps | new, created for this test | 16 | 43 | 26 |
| **Total** | | **106** | **402** | **155** |

"Required" means labeled `keep`, `claim`, `preference` or `question`. Label counts: 199 skip, 100 claim, 34 keep, 14 question, 7 preference, 48 optional (11.9%). Of the 106 events, 54 are human turns (10 required paragraphs) and 52 are completed assistant answers (145 required).

I labeled all 402 paragraphs, which is above the 150–300 aim, because the Feedback export is a different kind of conversation and I did not want to subsample it.

## Main table

All rows cover the same 106 events with 0 failed events. US$ is the scoring script's `usd` field as run; see "Scoring bug" for the cache-aware figures.

| Selector | Precision | Recall | F1 | Kind accuracy | TP / FP / FN | Calls | Tokens in / out | Latency median ms / total s | US$ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Jev, 0.65 (run 1) | 83.9% | 60.6% | 70.4% | 90.4% | 94 / 18 / 61 | 123 | 125,781 / 19,307 | 83 / 10.8 | 0.0053 |
| Jev, 0.65 (run 2) | 87.2% | 61.3% | 72.0% | 90.2% | 95 / 14 / 60 | 123 | 125,781 / 19,303 | 75 / 10.3 | 0.0053 |
| Jev, 0.65 (run 3) | 85.7% | 58.1% | 69.2% | 90.0% | 90 / 15 / 65 | 123 | 125,781 / 19,301 | 82 / 11.1 | 0.0053 |
| Jev, 0.50 | 79.3% | 71.6% | 75.3% | 89.0% | 111 / 29 / 44 | 123 | 125,781 / 19,309 | 79 / 10.7 | 0.0053 |
| Jev, 0.80 | 93.0% | 42.6% | 58.4% | 95.0% | 66 / 5 / 89 | 123 | 125,781 / 19,305 | 81 / 11.1 | 0.0053 |
| gpt-6-luna (run 1) | 90.2% | 71.0% | 79.4% | 93.3% | 110 / 12 / 45 | 106 | 43,986 / 2,697 | 961 / 108.3 | 0.0057 |
| gpt-6-luna (run 2) | 94.9% | 60.6% | 74.0% | 93.7% | 94 / 5 / 61 | 106 | 43,986 / 2,438 | 890 / 101.2 | 0.0056 |
| claude-sonnet-5-5 (reference) | 84.0% | 88.4% | 86.2% | 97.3% | 137 / 26 / 18 | 106 | 94,443 / 4,707 | 1,890 / 234.0 | 0.2360 |
| gpt-6.1-sol (second reference) | 88.1% | 81.3% | 84.6% | 98.0% | 126 / 17 / 29 | 106 | 43,986 / 4,407 | 2,128 / 249.6 | 0.1320 |

I added gpt-6.1-sol because the existing exports show Dan chatting with it as well as with Sonnet. The luna repeat and the third Jev run are also additions to the requested set.

Recorded selections from the live conversation (free, 6 events, 17 paragraphs, 11 required): the task model (`gpt-6-luna`) and Jev both scored 100% precision and 72.7% recall (8 TP, 0 FP, 3 FN). Kind accuracy was 100% for luna and 71.4% for Jev. Jev was unsure in 3 of the 6 events. This sample is too small to weigh.

### By source kind and conversation (recall / precision)

| Subset | Jev 0.65 (runs 1–3) | gpt-6-luna (runs 1–2) | Sonnet 5.5 | gpt-6.1-sol |
|---|---|---|---|---|
| Assistant answers (145 required) | 59–62% / 89–91% | 61–72% / 93–97% | 90% / 86% | 81% / 89% |
| Human turns (10 required) | 50% / 42–50% | 60% / 60–75% | 70% / 58% | 80% / 73% |
| Homelessness | 57% / 86–92% | 81% / 94–100% | 86% / 95% | 90% / 95% |
| Pain | 55–65% / 79–87% | 30–80% / 84–100% | 90% / 67% | 80% / 76% |
| Brain | 74–77% / 79–81% | 77–83% / 84–88% | 89% / 76% | 80% / 88% |
| Feedback | 45–49% / 81–89% | 47–55% / 91–96% | 85% / 90% | 70% / 86% |
| Heat pumps (live) | 65–69% / 94–95% | 65–81% / 100% | 96% / 96% | 100% / 96% |

Human turns are Jev's weak spot, though with only 10 required paragraphs the percentages move a lot per paragraph.

## Jev fallback rate

An event "needs a fallback" when Jev's confidence is below the threshold for at least one paragraph. In a hybrid setup each such event would still need a chat-model call for the whole event, so this rate is the share of events where Jev saves nothing.

| Threshold | Events needing fallback | Share | Uncertain paragraphs |
|---|---:|---:|---:|
| 0.50 (live run) | 45 of 106 | 42% | 89 |
| 0.65 (runs 1, 2, 3) | 64, 67, 67 of 106 | 60–63% | 154, 152, 159 |
| 0.80 (live run) | 80 of 106 | 75% | 215 |

Details from run 1 at 0.65:

- **By source kind:** 44 of 52 assistant answers (85%) and 20 of 54 human turns (37%).
- **By length:** 23 of 59 one-paragraph events (39%), 18 of 22 with 2–4 paragraphs, 10 of 12 with 5–8, and all 13 with 9 or more. Long research answers, which are the expensive chat-model calls, almost always need the fallback.
- **What Jev was unsure about:** 106 of the 154 uncertain answers were keep choices and 48 were skip choices. 14 of the 64 fallback events were triggered only by an uncertain skip.

Re-applying thresholds to run 1's stored answers isolates the threshold from run-to-run noise:

| Threshold | Precision | Recall | Fallback share |
|---|---:|---:|---:|
| 0.40 | 78.8% | 81.3% | 30% |
| 0.50 | 79.9% | 74.2% | 42% |
| 0.65 | 83.9% | 60.6% | 60% |
| 0.80 | 91.5% | 41.9% | 75% |
| 0.90 | 92.9% | 25.2% | 83% |

### Simulated hybrid

Rule: use Jev's selection when it has no uncertain paragraph in the event, otherwise use the chat model's selection for that event. Computed from the captured selections of run 1, with cache-aware costs.

| Hybrid | Precision | Recall | Fallback share | Cost vs chat model alone |
|---|---:|---:|---:|---:|
| Jev 0.65 + Sonnet 5.5 | 82.0% | 88.4% | 60% | 82% |
| Jev 0.50 + Sonnet 5.5 | 80.8% | 89.7% | 42% | 67% |
| Jev 0.80 + Sonnet 5.5 | 84.0% | 88.4% | 75% | 94% |
| Jev 0.65 + gpt-6.1-sol | 85.3% | 82.6% | 60% | 79% |
| Jev 0.65 + gpt-6-luna | 85.6% | 72.9% | 60% | 164% |

A hybrid with Sonnet keeps Sonnet's quality and saves 18–33% of its cost. A hybrid with luna costs more than luna alone. The 42 events Jev handled alone at 0.65 were mostly one-paragraph human turns, and on them Jev's precision was 66.7% (18 TP, 9 FP, 0 FN) against Sonnet's 78.3% on the same events.

## Run-to-run stability

Three Jev runs at 0.65 over the same 402 paragraphs:

- 10–13 paragraphs changed selected status between any two runs (96.8–97.5% the same).
- The chosen kind was identical for 96.5–97.8% of paragraphs.
- Confidence differed by 0.02 on average and by at most 0.16.
- The fallback flag differed across runs for 5 of 106 events.
- Precision ranged 83.9–87.2% and recall 58.1–61.3%.

The two `gpt-6-luna` runs were far less stable: 53 paragraphs changed status, and recall moved from 71.0% to 60.6%. Any comparison against luna within a 5-point band needs repeated luna runs.

## Misses and false positives

Examples are from Jev run 1 at 0.65. "Others" shows what luna, Sonnet and gpt-6.1-sol chose for the same paragraph.

### Misses (61)

How they happened: 50 chose a keep kind below the threshold, 8 chose skip below the threshold, 2 chose skip confidently, and 1 was kept but cut by the 8-per-event cap. By label: 32 claim, 23 keep, 3 preference, 3 question.

**Pattern 1: right choice, confidence split between kinds.** Keep probability is high but the four-way confidence is low. 31 below-threshold keep answers had keep probability of 0.9 or more.

| Paragraph | Label | Jev | Others |
|---|---|---|---|
| "Keep the budget under $400" | preference | preference, confidence 0.32, keep probability 0.98 | all three: preference |
| "A couple of things have firmed up on our side: my partner has a strong preference for a ducted system … the outdoor unit cannot go on the north wall…" | preference | claim, 0.18, keep 0.99 | all three: preference |
| "Measure **sustained housing stability**, new entries into homelessness, episode duration, returns to homelessness…" | keep | claim, 0.45, keep 0.99 | all three: claim |
| "2. **Getting a suitable human brain is its own problem.** The 2024 cortex sample came from surgery…" | claim | question, 0.38, keep 1.00 | all three: claim |
| "A **100-amp service is not automatically too small—or automatically adequate**…" | claim | claim, 0.50, keep 0.94 | all three: claim |

**Pattern 2: drops statements about the limits of the evidence.**

| Paragraph | Label | Jev | Others |
|---|---|---|---|
| "(These studies are from my memory, not a search. Some are small and from decades ago…)" | keep | skip, 0.88 | none kept it |
| "I ran three searches… **Everything below comes from search-result summaries. I didn't open the full papers**…" | claim | skip, 0.54 | none kept it |
| "Yes. There are reports of this, but I've only verified part of it. My sources are mostly secondary and aggregator sites…" | claim | claim, 0.18 | all three: claim |
| "My assessment is of the uploaded design, not an independent verification of the repositories or experiments it references." | claim | skip, 0.48 | none kept it |

The chat models also miss some of these, so part of this pattern may be my labeling being stricter about provenance than any selector.

**Pattern 3: unsure about recommendations and design rules.** Lists of proposed rules read as part preference, part claim.

| Paragraph | Label | Jev | Others |
|---|---|---|---|
| "- **Explicit correction:** supersede immediately. - **Plausible contradiction:** present the conflict and clarify…" | keep | preference, 0.26 | all three: claim |
| "4. **Require funding and delivery checks before commitments.** No unsupported permanent subsidies…" | keep | claim, 0.44 | all three: claim |
| "**Economics comes after the first two.** It cannot justify dropping a binding condition…" | keep | skip, 0.28 | all three: claim |

**Pattern 4: unsure about tables.**

| Paragraph | Label | Jev | Others |
|---|---|---|---|
| Telemetry table ("Working-context revision 48, Latest submitted request size 89,419 bytes…") | claim | claim, 0.52 | all three: claim |
| Shadow evaluation table ("Execution: Shadow, Evaluation status: Unavailable…") | claim | claim, 0.38 | all three: claim |
| Table comparing structured state with the automatic ledger | claim | skip, 0.73 | only gpt-6.1-sol kept it |

**Pattern 5: open questions just under the threshold.** "**Next step:** Localize the draft using a jurisdiction, population baseline…" (question, 0.64), "8. **What changes if we add solar?**…" (question, 0.62), "**Suggested next steps**…" (question, 0.59). All three chat models kept each of these.

### False positives (18)

**Pattern 1: saves a human's question as an open question (7 of 18).** These are requests for the next answer, not issues to revisit.

| Paragraph | Jev | Others |
|---|---|---|
| "What about brain organoid research?" | question, 0.78 | none kept it |
| "How do you think AI could substantially speed up the process? What would need to be true?" | question, 0.85 | luna and Sonnet kept it |
| "Thanks. Which of those field results came from houses most like mine…?" | question, 0.96 | Sonnet and gpt-6.1-sol kept it |
| "Oh yeah, you do have telemetry. What can you see there?" | question, 0.66 | none kept it |

Sonnet and luna make the same mistake on several of these, so this is partly a shared weakness of the task wording for human turns.

**Pattern 2: keeps fragments and connective sentences.**

| Paragraph | Jev | Others |
|---|---|---|
| "The first can sometimes be reasonable. The second adds a threat to someone's standing…" (its referents were in an excluded paragraph) | claim, 0.75 | Sonnet kept it |
| "AI could trace neurons, detect suspicious joins, compare alternative reconstructions…" | claim, 0.76 | none kept it |
| "## What would convince me the timeline is really shrinking?" (a heading) | question, 0.79 | none kept it |

**Pattern 3: keeps the assistant restating or narrating.**

| Paragraph | Jev | Others |
|---|---|---|
| "Understood—the budget must stay **strictly below $400**. Your instruction is also visible in the supplied automatic conversation memory…" | claim, 0.72 | none kept it |
| "**Quite a bit—I just checked it without changing or compacting anything.** It exposes context sizing…" | claim, 0.76 | none kept it |
| "I can also inspect context telemetry… I wouldn't manually compact anything…" | preference, 0.77 | gpt-6.1-sol kept it |

Jev's kind errors in run 1 (8): 5 claims saved as questions and 3 preferences saved as claims.

## What-if: gate on keep probability

This is an offline re-read of run 1's stored answers. It is not the shipped rule and I changed no engine code. A paragraph is selected when Jev's top choice is not skip and its keep probability (1 minus the skip probability) is at or above the gate. It counts as uncertain when the keep probability falls between 1 minus the gate and the gate.

| Keep-probability gate | Precision | Recall | Fallback share | Kind accuracy |
|---|---:|---:|---:|---:|
| 0.50 | 77.4% | 88.4% | 0% | 86.6% |
| 0.65 | 79.8% | 86.5% | 26% | 86.4% |
| 0.80 | 87.2% | 79.4% | 49% | 85.1% |
| 0.90 | 92.2% | 69.0% | 63% | 83.5% |

At 0.65 this is 1.9 points of recall and 4.2 points of precision below Sonnet, with a 26% fallback rate. Selection is a keep-or-skip decision, and the current gate penalizes Jev for being torn between `claim` and `question`, which grading does not even require for `keep` labels. Human turns stay weak under this rule (8 TP, 11 FP at 0.65). I looked at this rule after seeing the results, so it is a lead and not a finding.

## Oversized and excluded paragraphs

- **Jev `oversized`:** none in any of the five Jev runs. No paragraph was too large for a single Jev request.
- **2,000-character paragraph limit:** 3 paragraphs were excluded, and I would keep all 3. They are the consolidated "What I saved as background facts" list in the Brain conversation (2,194 characters), and in the live conversation the sourced electrical-capacity findings (2,097) and the ducted-system analysis (2,017).
- **4,000-character prefix:** 58 paragraphs lay wholly beyond it and 13 were cut by it. I judged roughly 40 of these 71 worth keeping. Examples:
  - In the live research answer, the installed-cost figure (about $14,000) and the whole "Incentives right now" section fell beyond the prefix. Those were two of the three things the question asked for.
  - Brain: "One estimate puts it at 25–50 years" (the published estimate) and the "Updated view" summary.
  - Pain: "A study that could test this".
  - Feedback: "What I would build first".
- **Quoted text (not in the test brief, but large):** 129 paragraphs inside the prefix were excluded because they contain a quotation or inline code. 72 of them are 250 characters or longer, and they include main findings: the Ruttan, McDonnell and Nordgren study in Pain, "What the reports say" and "No full synapse-level map of a mouse brain exists yet" in Brain, and the recommended hybrid layout and the switchover-temperature finding in the live conversation.
- **Overall:** selectors were offered 79,835 of 152,929 characters (52%) of the labeled events. By conversation: Homelessness 79%, Pain 46%, Brain 56%, Feedback 42%, Heat pumps 56%. Five more events had no offerable paragraph at all, including the 8,924-character opening message of the Pain conversation.

I judged the excluded paragraphs from their opening 150–230 characters without applying the full rubric, so those counts are approximate. These exclusions limit every selector equally. They cap what any selector can save, and they do not change the comparison above.

## Step 1: live Jev request format

**Passed with no code change.** The live TypeSafe API accepted the memory-selection request on the first attempt. Both events of the hand-built file (8 paragraphs) returned a choice, a confidence and four probabilities for every paragraph. The response model was `jev-1.13.0`. Files are in [step1/](step1/).

## Step 2: material and live conversation

**Existing exports.** Four canonical exports from `converse/docs/conversations/`. None contained `memory_shadow` events, since they predate the PR.

**New conversation.** Eight turns through the Conclave service path (`node src/cli.js call ask`) on `gpt-6-luna` with Jev enabled, about a cold-climate heat pump retrofit. It made 14 `web_fetch` reads and 9 web searches. Export: [exports/live-heat-pump.json](exports/live-heat-pump.json). I wrote the human turns myself.

| Check | Result |
|---|---|
| `memory_shadow` events exist with `applied: false` | Pass: 6 events, all `applied: false` |
| Saved memories match only the chat model's picks | Pass: 8 saved records, all from `llm.records`. Jev made 2 picks the chat model did not, and neither was saved |
| A `memory-selection` request with provider `typesafe` | Pass: 6 requests, 6,046 input and 819 output tokens |
| Jev telemetry shows `memory_shadows` | Pass: `memory_shadows: 6`, `memory_shadow_failures: 0`, mean overlap 0.42 |
| Converse Workspace Jev panel | Pass: "Memory shadow · 6 compared, not applied · 0 failed · mean overlap 42%" and the per-capture lines, checked in the local Converse app against a copy of the test store |

In that conversation the six task-model extraction calls cost $0.0007–$0.0013 and the six Jev calls $0.00025. Jev took 113–246 ms per capture and luna 820–1,998 ms.

Extraction ran on 6 of the 16 events. One human-turn extraction was deferred because the research capture had used that turn's one-call allowance. It completed on the next turn.

## Setup notes

- **Baseline:** Conclave 250 passed and 1 skipped, syntax check passed. Converse 188 passed and 1 skipped.
- **Parity check failed at first, then passed.** `sync-converse.js --check` reported a stale manifest. All 78 committed files matched the manifest, but `service.js` and `transcript.js` had Windows line endings in both working trees. I re-checked those two files out with LF endings and the check passed with no content change. On this machine Converse is at `../../converse` from Conclave, not `../converse`.
- **Scoring bug, fixed in a separate local commit** (`7993ee4`, not pushed). The scoring script priced every input token at the base input rate and ignored cache reads and cache writes. It reported $0.236 for the Sonnet run where the cache-aware valuation is $0.156, and it slightly understated luna. The fix uses the shared `priceUsage` helper. Selection metrics are unaffected. Tests and the parity check pass after the fix.
- **Sonnet's cost depends on caching.** The $0.156 reflects cache reuse across 106 back-to-back calls. In normal use, with one extraction per turn, each call would likely pay the cache-write rate, which comes to about $0.283 for the same work.
- **Observation-only capture.** The scoring reports keep scores but not per-paragraph decisions, so I ran the script with a preload ([capture.mjs](capture.mjs)) that records what each selector returned. It changes no engine or scoring code, and scores recomputed from the captures match the official reports.
- **Spend:** about $0.37–$0.40 at public token rates ($0.33 for scoring, $0.04–$0.08 for the live conversation). Not included: OpenAI web-search tool fees for 9 searches, embedding calls, and one automatic title call made when I opened the conversation in Converse. The total is well under the $3 cap.
- **Credentials** came from environment variables. A scan of this folder found no key values.

## Recommendation

Against the default criteria, using Sonnet 5.5 as the reference and Jev at 0.65:

| Criterion | Result | Met? |
|---|---|---|
| Recall within 5 points of the reference | 58–61% against 88% | No |
| Precision no more than 5 points lower | 84–87% against 84% | Yes |
| Fallback on under 30% of events | 60–63% | No |
| Cost under 10% of the chat model's | 3% of Sonnet, 4% of gpt-6.1-sol, 91–97% of gpt-6-luna | Yes for the larger models, no for luna |
| Hybrid: confident picks at 90% precision or better | 84–87% at 0.65; 92–93% at 0.80 | Only at 0.80 |

**Replacement: not viable yet.** Recall and fallback rate both fail by a wide margin.

**Hybrid: viable only on paper.** At 0.80 Jev's confident picks clear 90% precision, but 75% of events still need the chat model and the simulated saving is 6% of Sonnet's cost. At 0.65 the saving is 18% with precision just under the bar.

**Specific failure patterns:**

1. The confidence gate measures certainty about the kind, not about keeping. This accounts for 50 of 61 misses.
2. Jev saves human questions as open questions.
3. Jev is unsure about tables, recommendation lists and statements about evidence limits.
4. Long answers nearly always contain one uncertain paragraph, so the event-level fallback fires on the calls that cost the most.
5. Jev's request repeats the instructions and criteria for every paragraph. It used 2.9 times luna's input tokens (313 against 109 per paragraph), which is why it costs the same as luna despite a lower rate.

**What I would do next:**

1. Test the keep-probability gate on fresh labeled data. It is the one change that looks able to meet the replacement criteria.
2. Decide which model Jev is meant to replace. If it is luna, cost is not the argument. Speed and repeatability are.
3. Tighten the human-turn task wording so a request for the next answer is a skip.

**Criteria I would change:**

- Name the reference model in the criteria. The cost test passes or fails depending on that choice alone.
- Measure the fallback rate on the events production actually sends for extraction (research answers and cue-word human turns). On assistant answers it is 85%, not 60%.
- Require repeated runs of the reference. Luna's recall moved 10 points between two runs, which is twice the 5-point band.
- Score human turns and assistant answers separately.

## Caveats

- **Labeler.** All labels are by an AI agent, with the possible bias described at the top. Many borderline calls went to `optional`, and a different labeler could move several points of precision or recall.
- **Blinding.** The four existing exports were labeled before any selector ran on them. For the live conversation the shadow had already run. I did not open the recorded file before labeling, but my status scripts printed per-event pick counts, which for three one-paragraph human turns reveals whether each selector picked the paragraph. I had written those turns as plain preference statements, and I labeled them `preference` by the rubric.
- **Sample size.** 402 paragraphs, 155 required, 5 conversations, 1 labeler. Human turns contribute only 10 required paragraphs. Per-conversation figures rest on 20–53 required paragraphs each.
- **Scope of events.** The offline runs score every human turn and every completed assistant answer. Production sends far fewer: explicit commitments such as "Keep the budget under $400" are captured by rule and never reach a selector, and research answers are sent only after three or more source reads or a save request.
- **Related memories.** Offline runs pass no previously saved memories, so Jev's duplicate rule and the chat model's related-heads context were not exercised.
- **Labels grade selection, not truth.** A paragraph labeled `claim` may be factually wrong.
- **Out of scope.** This says nothing about answer quality or whole-task cost.
- **The what-if and the hybrid figures are simulations** on stored answers from one run, not live results.

## Files

- Labels: [labels-all.json](labels-all.json) (combined), `labels-<name>.json` per conversation, and the hand-written label maps in [label-maps/](label-maps/).
- Official scoring reports: [reports/](reports/). Captured per-paragraph decisions: [captures/](captures/).
- Analysis: [analysis.json](analysis.json) from [analyze.mjs](analyze.mjs), and [whatif-keep-probability.json](whatif-keep-probability.json) from [whatif.mjs](whatif.mjs).
- Excluded paragraphs: [excluded/](excluded/).
- Live conversation: [live/](live/) (turn inputs, driver script, checks) and [labels-live.recorded.json](labels-live.recorded.json).
