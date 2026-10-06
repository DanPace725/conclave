This report is actually considerably more encouraging than the headline “not viable yet” makes it sound. The short version is:

**Jev mostly understands the keep/skip decision. The current integration is asking the wrong confidence question and then punishing Jev for uncertainty about a secondary classification.**

That is the thing to keep in your head.

At the shipped `0.65` threshold, Jev looks mediocre on recall: about 58–61% versus Sonnet's 88%. But when Codex inspected the misses, **50 of Jev's 61 misses were things Jev actually thought should be kept**. It rejected them because it wasn't sufficiently confident whether the thing was a `claim`, `question`, `preference`, etc. :chatgpt-content-reference{index="0"}

That's almost comically important.

Imagine Jev says:

> “98% sure this belongs in memory. I'm only 32% sure whether you call it a preference or a claim.”

The current system effectively replies:

> “Sounds uncertain. Throw it away.”

Which is not really testing whether Jev can decide what to remember.

The examples make this painfully obvious. “Keep the budget under $400” had a **0.98 keep probability**, but only 0.32 confidence in its exact memory kind. Another preference had **0.99 keep probability** but low category confidence. Several claims were at 0.94–1.00 keep probability while missing the gate because Jev was torn between labels. :chatgpt-content-reference{index="1"}

When Codex re-scored the exact same outputs using **keep probability rather than four-way category confidence**, the picture changes dramatically:

- 79.8% precision
- 86.5% recall
- 26% fallback
- 86.4% kind accuracy

Sonnet was 84.0% precision / 88.4% recall. So Jev comes within **4.2 points precision and 1.9 points recall**, while dropping fallback below the desired 30%. That satisfies all three proposed replacement criteria. :chatgpt-content-reference{index="2"}

Now, huge asterisk: that's a **post-hoc analysis on the same test data**, not fresh validation. So we absolutely should not declare victory. But it strongly suggests the model isn't the main problem.

### There are really four different things tangled together here

**1. Jev's semantic judgment looks pretty decent.**

Its precision is already comparable to Sonnet, and it's remarkably stable. Three Jev runs agreed on selected status for roughly 97% of paragraphs, whereas Luna changed its mind on 53 paragraphs and its recall swung about ten percentage points between runs. :chatgpt-content-reference{index="3"}

That's actually attractive for a decision subsystem. You want the boring infrastructure model to be boring.

**2. The confidence mechanism is badly matched to the actual decision.**

The important first-order question is:

> Keep this or don't?

Only *after* that should we care:

> What kind of memory is it?

Those should probably be separate decisions:

```text
P(keep) = .98
    ↓
KEEP

then

claim      .44
preference .39
question   .12
other      .05

kind = uncertain
```

You don't discard the memory because the taxonomy is fuzzy.

So I would think of Jev as producing two confidence layers:

```text
selection:
    keep_probability

classification:
    kind
    kind_confidence
```

And only `keep_probability` governs whether the passage survives.

**3. The fallback mechanism is also making Jev look worse than necessary.**

Right now if **one paragraph** in an event is uncertain, the whole event falls back to the expensive chat model. That's why long research answers are catastrophic: almost every long answer contains at least one weird paragraph. All 13 events with nine or more paragraphs triggered fallback. :chatgpt-content-reference{index="4"}

That's not really how I'd structure the hybrid.

Instead:

```text
20 paragraphs
     ↓
Jev
     ↓
17 confident decisions ─→ accept
 3 uncertain decisions ─→ escalate those 3
```

Not:

```text
20 paragraphs
     ↓
Jev uncertain about #17
     ↓
THROW AWAY ALL JEV WORK
     ↓
send all 20 to Sol/Sonnet
```

The current event-level fallback is almost deliberately optimized to erase savings from long answers, which are precisely where the expensive model costs the most.

**4. The preprocessing is currently kneecapping everybody.**

This jumped out at me almost as much as the confidence issue.

The selectors were only shown **52% of the labeled text**.

Why?

- 4,000-character prefix cutoff
- 2,000-character paragraph maximum
- paragraphs containing quotes or inline code excluded

And those exclusions removed obviously meaningful things. In the heat-pump conversation, the installed-cost figure and incentives section were beyond the prefix, even though they directly answered the user's question. Important research findings, recommendations, tables, and sourced claims were excluded elsewhere. :chatgpt-content-reference{index="5"}

That's not Jev failing. That's the ingestion pipe saying, “Please select the important memories from this conversation. Also you may inspect roughly half the conversation.”

I'd fix that separately.

### The economics are subtler

Against Sonnet or Sol, Jev is **ridiculously cheap**: about 3–4% of their cost.

Against Luna, it currently costs roughly the same. :chatgpt-content-reference{index="6"}

But that's partly because Jev's request format is inefficient. It repeats the instructions and criteria for every paragraph, causing **2.9× Luna's input tokens per paragraph**. The report explicitly flags that. :chatgpt-content-reference{index="7"}

So there are really two possible value propositions.

Against a frontier model:

> **Jev saves money.**

Against Luna:

> **Jev may save latency and provide much more deterministic behavior.**

Jev is around **80 ms** versus roughly **900–1,000 ms for Luna** and ~2 seconds for Sol/Sonnet. :chatgpt-content-reference{index="8"}

And if you reduce its bloated prompt/input format, it may eventually beat Luna economically too.

### There are also some very fixable task-definition problems

Jev tends to save human questions such as:

> “What about brain organoid research?”

as persistent **open questions**.

But that's usually just the user asking for the next response, not a durable unresolved issue. The larger models make this mistake too, which suggests the rubric itself isn't sufficiently explicit. :chatgpt-content-reference{index="9"}

So the distinction should probably be something like:

```text
transient_query:
user asks assistant to answer now
→ SKIP after addressed

persistent_open_question:
issue explicitly left unresolved / planned for later
→ KEEP
```

Again, bounded classification. Very Jev-shaped.

### So my interpretation of the report is:

The experiment **did not show that Jev is a bad decision model**.

It showed that the implementation currently has at least four architectural handicaps:

```text
wrong confidence target
        +
event-level rather than item-level fallback
        +
inefficient repeated prompt
        +
aggressive preprocessing exclusions
```

And despite all four, Jev still got **84–87% precision**, was extremely stable, and on post-hoc keep-probability scoring got within a couple points of Sonnet's recall at a fraction of the cost. :chatgpt-content-reference{index="10"}

That's actually a pretty good result for the first real test.

The next experiment almost writes itself:

```text
Fresh labeled corpus
        ↓
better passage eligibility
        ↓
Jev predicts KEEP probability
        ↓
confident keep/skip applied directly
        ↓
only uncertain passages escalate
        ↓
kind classification handled separately
```

Then compare against Luna, Sonnet and Sol.

If **that** fails, I'd start questioning Jev.

Right now I'd question the plumbing first. Which, given the saga so far, is becoming something of a Converse tradition.