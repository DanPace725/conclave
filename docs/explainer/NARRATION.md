# Conclave explainer: narration script

Voiceover for `conclave-explainer.html` (about 4:48). The animation's clock is built from these lines at 150 words per minute, so a narrator at that pace stays in sync. The timecodes below mark where each line starts. Matching captions are in `narration.srt` and `narration.vtt`. The page's script panel also highlights the current line during playback, so it can serve as a teleprompter.

To change the wording, edit the `NARRATION` list in `conclave-explainer.html`; the animation re-times itself around it. Then regenerate the caption files:

```
node scripts/render-explainer.mjs captions docs/explainer/narration
```

The conversation, byte counts and Jev probabilities are illustrative. The order of steps follows `src/harness.js` (`ask`, `compact`, `selectionPlan`) and `src/jev.js`.

## Recording notes

- Read numbers naturally: "86%" is "eighty-six percent", "0 to 4" is "zero to four".
- "Jev" rhymes with "rev". "SQLite" is "S-Q-L-ite" or "sequel-ite"; pick one and keep it.
- Pause for a beat at each scene change. The timing already allows one second.

---

## Intro · 0:00

**On screen:** The title card. The blank paper fades in.

> **0:00** Here's what Conclave does with a conversation, between the moment you send a message and the moment the model replies.

## 1 · The log · 0:10

**On screen:** Entries are written onto the paper one at a time, each with its role and event ID.

> **0:10** It starts with a log. Every message, document and tool result is written to an append-only SQLite record before anything else happens.
>
> **0:19** Each entry gets an event ID. Nothing in this log is ever edited or deleted.

## 2 · Bundles · 0:27

**On screen:** A box is drawn around each entry. Green marks named state, pink a pin, amber the recent turns, and grey an ordinary bundle.

> **0:27** Conclave groups the log into context bundles. Each bundle remembers which events it came from.
>
> **0:34** Some bundles are protected. Named task state, like the fixed budget and the irrigation decision, is outlined in green. Pins are pink. The four most recent turns are amber.
>
> **0:46** Everything else is an ordinary bundle that can be reshaped later.

## 3 · Two copies · 0:52

**On screen:** The boxed bundles lift off as cards and move into the right column. The paper shrinks and slides left. The two columns are labelled Trajectory and Live context.

> **0:52** Now the split. Each bundle is copied out of the log, and the log itself slides to the left.
>
> **1:00** On the left is the trajectory: the full record, exactly as it was. On the right is the live context, a versioned projection of what the model will see on its next call.

## 4 · Budget · 1:15

**On screen:** The question bubble appears and is logged as `evt_012`. Its card joins the live context as "current request", and evt_008 loses its amber border. The byte meter fills to 20,600 of 24,000. Locks appear on protected cards. Dashed outlines mark the five candidates.

> **1:15** Then a new question arrives: what did the survey say about the east fence?
>
> **1:22** It's logged first, then added to the live context as the current request. The recent window slides forward by one.
>
> **1:30** The live context has a byte budget, with room held back for the model's answer. This next request would use 86% of it.
>
> **1:41** Past 75%, Conclave manages attention before it answers. Pins, named state and the last four bundles, including your question, are locked. The five older, ordinary bundles are candidates.

## 5 · Jev decides · 1:54

**On screen:** The Jev node appears and moves top right. A request panel fills with five candidate excerpts flown in from the cards, plus "not sent: 7 protected bundles". It's sent to Jev, and an answer table replaces it: action probabilities, an importance score and a minimum confidence for each candidate. evt_006 is flagged at 0.58 against the 0.65 floor and becomes ESCALATE. Verdict chips land on the cards. Then a panel lists what Jev cannot do.

> **1:54** Deciding what to do with each candidate is a small, frequent judgment. Conclave can hand that job to Jev, a typed decision model from TypeSafe, and keep the main model for the hard work.
>
> **2:09** Jev receives the task and at most six candidates. Each is a short excerpt with its type, its status, and whether a pointer would make it smaller. Protected bundles are never sent.
>
> **2:22** For every candidate, Jev answers two typed questions. Which action: retain, offload, compact or escalate. And how important it is, on a scale from 0 to 4.
>
> **2:35** Each answer comes back as a probability distribution with a confidence.
>
> **2:40** Then code checks every answer. The vendor quotes came back at 58% confidence, below the 65% floor, so they are escalated instead. Escalated and retained bundles stay protected for the rest of this turn.
>
> **2:55** Jev only chooses. It can't write summaries, invent bundle IDs or delete sources. If its answer is malformed, fails, or refers to a stale revision, Conclave falls back to its own ranking.

## 6 · Compaction · 3:10

**On screen:** The survey card collapses into a pointer, and the meter drops to 77%, still over the line. evt_002 and evt_004 merge into one summary card that cites both. The meter drops to 54%. Receipt notes appear in the middle, and receipt rows are added under the log.

> **3:10** Now the plan is applied. The site survey becomes a small pointer to its original in the log. That alone leaves the request at 77%, so Conclave keeps going.
>
> **3:23** The two older assistant turns are compacted. The main model rewrites them into one summary that cites both sources.
>
> **3:31** The rewrite is kept only if it shrinks the projection by at least 15%. This one roughly halves it. Every step left a receipt in the log.

## 7 · Inference · 3:44

**On screen:** The request envelope fills with Instructions, Tools and the Projection. The budget check reads "8,924 B + 4,096 reserve ≤ 24,000 B ✓ send", and the request goes to the model.

> **3:44** With the context back under budget, the answer request is assembled: instructions, tools, and the current projection, which ends with your question.
>
> **3:54** Before anything is sent, the request plus the output reserve is checked against the budget.

## 8 · Retrieval · 4:01

**On screen:** The model returns `retrieve_event("evt_003")`. A line runs to the survey on the paper, which lights up. A highlighted excerpt travels into the envelope as temporary tool output. The second call returns the reply. The reply's card joins the live context, the tool output disappears, and evt_009 leaves the recent window.

> **4:01** The survey is only a pointer now, so the model calls a tool to read the original.
>
> **4:09** A bounded excerpt comes back from the log and is added to this request only.
>
> **4:16** The model answers. The answer joins the live context, the excerpt stays in the log, and the recent window slides forward again.

## 9 · Recap · 4:26

**On screen:** A summary: 26 events in the trajectory, revision r11 of the live context, the division of labour between Jev, code and the main model, and the source-ID link between them.

> **4:26** So Conclave keeps two records. The trajectory is permanent and complete. The live context is small, rebuilt for every call, and can be restored to any earlier revision.
>
> **4:38** Summaries and pointers keep their source IDs, so an original is always one tool call away.
