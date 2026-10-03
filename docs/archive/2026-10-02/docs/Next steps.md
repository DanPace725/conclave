Here’s a Codex-facing snapshot you can drop directly into the repo/chat.

```markdown
# Conclave Research Snapshot: Interactive Context Control, Agentic CLM Mode, and Jev Delegation

## Current state

Conclave has moved beyond passive context compaction into something closer to an explicit, inspectable working-memory system.

Recent integration into Converse added a live **Context Garden** visualization showing the current working context and its relationship to preserved source history. The visualizer distinguishes ordinary working pieces, summaries, protected/anchored state, and retrieval references. Revision replay allows the user to inspect how the working context changed over time.

A recent live conversation produced an important behavioral result: after being asked conversationally to "pick a couple of interesting points and remember them," Luna directly used the exposed context-layer tools to create structured state entries. The UI visibly changed as those entries appeared. Separately, Conclave automatically offloaded older content to retrieval references when the request approached its budget.

This demonstrated two simultaneous mechanisms:

1. **Model-directed context management**
   - The model can intentionally create/update structured memory.
   - The user can request context operations conversationally.
   - Context-layer changes affect future model calls without altering source history.

2. **System-directed context management**
   - Conclave can automatically manage budget pressure.
   - Older working content can become retrieval references.
   - Original conversation/source history remains preserved.

The visualization was initially cosmetic/diagnostic, but it may be a significant product/research surface. It makes the model's explicit working representation visible and potentially negotiable by the human.

Potential interactions include:
- "Why are you keeping this?"
- "Keep this exact statement."
- "That was brainstorming, not a decision."
- "Move this back into working context."
- "What are you currently treating as settled?"
- "Forget this from working memory but preserve the source."
- "Combine these three ideas."
- Clicking nodes to inspect source, lineage, type, size, status, limitations, or retrieval pointers.
- Replaying revisions to watch the working context reorganize over time.

The important distinction is that this is not visualization of hidden model reasoning. It is visualization and control of the **explicit contextual state supplied around the model**.

---

## Relationship to Meta's Context Language Models

Meta's CLM paper defines a CLM as a model that directly controls the transition from its current context to its next context, rather than merely appending output.

Conclave currently approaches this through predefined operations such as:

- `edit_context`
- `offload_context`
- `update_state`
- history search/retrieval
- deterministic budget handling
- Jev-based bounded selection

This gives the model meaningful control, but Meta would likely classify the current design closer to **model control within a predefined action space**, because the harness still determines the available context-management operations.

A more strictly Meta-style CLM mode would expose the actual live working context as a generally editable artifact, e.g.:

```text
/context/
    context.md
    sources/
    memory/
    scratch/
    scripts/
```

The model would be allowed to arbitrarily restructure `context.md`, create helper files/functions, move material out of active context, create its own organizational schemes, etc. The resulting `context.md` would directly become the model-visible context on subsequent calls.

Conclave's distinguishing addition would be that the model could have unrestricted control over its **working context** while the underlying historical trajectory remains immutable and recoverable.

Conceptually:

```text
immutable source trajectory
        ↓
provenance / CLP layer
        ↓
model-controlled working context
        ↕
retrievable external memory
        ↓
frontier model
```

This allows the model to freely reorganize its desk without being able to rewrite the filing cabinet.

---

## Why an agent harness probably matters

A chatbot is useful for testing correctness and interaction design, but it is probably not the natural environment for measuring CLM economics.

Context management has an amortized cost.

If a context operation costs `M` tokens, removes `R` tokens from future working context, and the smaller representation survives for `K` subsequent inference calls, the rough benefit is:

```text
benefit ≈ K * R - M
```

An ordinary chat may only have a few subsequent calls after an expensive compaction.

An agent may make hundreds of model/tool calls during a single task. In that setting, one good context edit can continue paying for itself for a long time.

Meta's strongest CLM results are also primarily long-horizon agent workloads, including hundreds/thousands of turns and multi-hour runs.

Therefore Conclave likely needs a simple autonomous-agent runner for meaningful evaluation.

This does not need to become a giant agent framework. A minimal loop is enough:

```text
objective
    ↓
model
    ↓
tool/environment action
    ↓
observation
    ↓
model
    ↓
...
until success / max steps / budget
```

Useful tools could initially be filesystem, shell/code execution, search/retrieval, and context-management primitives.

---

## Key efficiency hypothesis

The recent Conclave experiments exposed a major weakness in pure LLM-driven context management:

**Using a frontier/generative model to decide how to reduce frontier-model token use can consume a substantial fraction of the savings.**

Earlier runs showed significant context reduction, but context-management calls themselves consumed substantial input/output tokens.

Moving bounded selection to Jev improved the division of labor, but the current system still contains considerable management overhead.

This suggests context management should be treated as a hierarchy of computational difficulty:

```text
DETERMINISTIC CODE
------------------
protected?
pinned?
recent?
source resolvable?
size?
duplicate?
budget exceeded?
schema valid?

        ↓ unresolved

CHEAP BOUNDED DECISION MODEL (Jev)
----------------------------------
retain?
offload?
compact?
priority?
future utility?
worth escalating?

        ↓ semantic work required

FRONTIER MODEL (Sol/Luna)
-------------------------
summarize faithfully
reconcile contradictions
derive abstractions
rewrite working state
solve the actual task
```

The frontier model should not necessarily spend a full generative inference deciding whether chunk A or chunk B deserves to remain proximal.

---

## More interesting hybrid hypothesis

Rather than forcing the above hierarchy entirely from the harness, a more CLM-like experiment would give the frontier model **access to Jev as one of its own cognitive tools**.

For example:

```text
Sol/Luna agent
│
├── arbitrary read/write access to live context
├── immutable source history
├── normal environment tools
└── jev_decide(...)
      ├── Choice
      ├── Score
      └── bounded classification
```

Instructionally, the model could simply be told:

> You control your working context. Historical source material remains recoverable. A low-cost bounded decision model is available when useful. Manage your context to preserve task performance while minimizing unnecessary inference cost.

This preserves the CLM idea that the model determines **when and how** context should be managed, while allowing it to delegate low-resolution judgments to a much cheaper mechanism.

A possible emergent behavior would be:

```text
Sol:
"I have 40 context candidates and do not need to reason deeply
about each one."

→ calls Jev

Jev:
A retain .94
B offload .91
C uncertain .52
D retain .88
...

Sol:
retains A/D,
offloads B,
examines C itself,
then performs semantic rewriting only where needed.
```

This may be a cleaner hybrid than either extreme:

### Pure CLM
Frontier model manages essentially everything.

### Current Conclave
Harness assigns predefined management operations to deterministic logic, Jev, and LLMs.

### Hybrid CLM-Conclave
Frontier model remains sovereign over its working representation but has cheaper cognitive primitives available for delegation, while Conclave/CLP preserves provenance, history, and hard invariants.

---

## Proposed experiment

Add a minimal agent-runner and compare four modes on the same long-horizon tasks:

```text
A. Append-only
   No context management.

B. Meta-style CLM
   Frontier model directly controls/restructures live context.

C. Current Conclave
   Deterministic policy + Jev selection + predefined transformations.

D. Hybrid CLM-Conclave
   Frontier model controls live context and can optionally delegate
   bounded context decisions to Jev.
```

Measure at minimum:

- task success / quality
- total provider input tokens
- total provider output tokens
- context-management input/output tokens
- management calls as fraction of total calls
- peak active context
- final active context
- number and size of context edits
- Jev calls and escalation rate
- retrieval frequency
- offload frequency
- semantic-fidelity failures
- stale/superseded-state failures
- protected-information loss
- unnecessary/rejected compactions
- provider latency
- cache reuse / estimated FLOPs where available

The primary question is no longer merely:

> Can Conclave make context smaller?

Current tests already show that it can.

The stronger research question is:

> **What is the cheapest level of intelligence capable of allocating attention without damaging the higher-resolution cognition that follows?**

A related question is:

> **If a frontier model is given both direct control over its own context and access to a cheap bounded decision model, will it discover an efficient delegation strategy on its own?**

That seems like the most interesting next branch to preserve in the roadmap.

---

## Product/UI implication

The Context Garden may be more than a debugger.

It could become a shared context-management interface between:

- the user,
- the frontier model,
- Jev,
- deterministic policy,
- and preserved source history.

The user should eventually be able to inspect and conversationally modify the model's explicit working representation without needing to understand context engineering.

The design principle is:

> **Context should be visible, negotiable, reversible, and source-grounded.**

Do not overcomplicate the visualization yet. Its current simplicity is useful. Prefer progressive additions such as node inspection, source/lineage display, pinning, movement between proximity tiers, and revision replay.
```

