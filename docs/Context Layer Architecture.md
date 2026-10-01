Persistent Trajectory, Mutable Context
A layered architecture for efficient, recoverable LLM context management
Abstract
Most conversational LLM systems conflate two distinct objects: the historical record of an interaction and the context supplied to the model for its next inference. In conventional append-only architectures, conversation history accumulates into an increasingly large prompt, causing information that remains historically relevant but immediately unnecessary to consume model attention and inference compute on every subsequent turn.
Context Language Models (CLMs) introduce an important alternative by making the model’s live context directly mutable. Rather than restricting context evolution to append-only concatenation, a CLM can edit, compact, restructure, or remove information from the context presented on future calls. The CLM paper implements this by mirroring the live context into an editable file and synchronizing model edits back into subsequent inference requests. 
This proposal extends that idea into a layered architecture in which the complete interaction trajectory remains persistently available while a smaller mutable projection is maintained as active working context. A Context Layer Protocol (CLP) provides structured metadata, provenance, lineage, resolution constraints, and retrieval affordances around information as it is transformed. A lightweight decision layer handles frequent bounded context-management choices, reserving frontier-model inference for semantic transformations that actually require high-resolution reasoning.
The result is a system in which information can leave active context without being discarded, context-management decisions can be made at multiple computational scales, and lossy compression of attention need not imply lossy storage of history.
1. Problem
The standard conversational architecture is approximately:
C(t+1) = C(t) + new interaction

Every new user message, model response, and often every tool output becomes part of the history supplied again on later calls.
This has several consequences.
First, historical persistence and active relevance become equivalent. If something must remain available, it tends to remain in the prompt.
Second, prompt growth produces cumulative inference cost. If roughly \(m\) tokens are added per turn, repeatedly processing the growing history produces approximately quadratic cumulative input volume over a long trajectory:
\[
\sum_{t=1}^{T} mt
=
m\frac{T(T+1)}{2}
\]
Prefix caching substantially reduces the actual server-side cost of ordinary append-only conversations, so this should not be confused with literal full recomputation on every turn. Nevertheless, a growing live context continues to consume context capacity, cache resources, and model attention, and becomes especially costly when long tool outputs or long-horizon agent trajectories accumulate.
Third, conventional summarization introduces a destructive tradeoff. Once history is replaced by a summary, the model gains efficiency but may lose detail, provenance, uncertainty, unresolved alternatives, or information whose future relevance was not apparent at the time of summarization.
The underlying architectural problem is therefore:
The complete record of what happened is not the same object as the information that should remain cognitively active now.

Treating them as the same object forces a system to choose between preserving information and efficiently allocating attention.
2. Existing primitives
Two existing approaches provide complementary pieces of a solution.
Context Language Models
CLMs replace append-only context evolution with model-controlled context evolution. Their implementation exposes the live context as an editable file; edits are synchronized into the actual input supplied on subsequent model calls. 
Importantly, the edited context is not merely an additional memory document accompanying the full original history. It becomes the live context itself.
This means that a model may initially receive a large observation, determine what matters, and then replace that observation with a much smaller representation for later turns. The CLM experiments demonstrate behaviors such as maintaining compact state trackers, removing irrelevant search results, preserving TODOs, and compressing larger observations into answer-relevant representations.
This creates a mutable working-memory mechanism.
Context Layer Protocol
CLP approaches context from a different direction. Its stated goal is a context-aware data layer in which context, provenance, resolution limits, and policy are first-class rather than being detached from content as information moves between systems.     Context_Layer_Protocol_(CLP)
Its central ContextBundle couples content with frame, lineage, policy, semantics, resolution information, and explanation metadata.     Context_Layer_Protocol_(CLP) CLP already anticipates portable sidecars, append-only lineage records, semantic indexes, resolvers, and references back to source material rather than requiring all information to live inside one representation.     Context_Layer_Protocol_(CLP)
CLP also explicitly models attention as a constraint. Queries can specify an attention budget while the underlying information remains richer than the representation returned to the consumer.     Context_Layer_Protocol_(CLP)
This creates a useful semantic and provenance layer around context.
The proposed architecture combines these two ideas but assigns them different responsibilities.
3. Core architectural principle
The system maintains at least four distinct informational layers:
┌─────────────────────────────────────────────┐
│ 1. CANONICAL TRAJECTORY                     │
│ Complete immutable conversation/event log   │
│ What actually happened                      │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│ 2. CLP / CONTEXT INDEX                      │
│ Meaning, lineage, dependencies, resolution  │
│ Search and retrieval structures             │
└──────────────┬──────────────────────────────┘
               │
        context policy
               │
               ▼
┌─────────────────────────────────────────────┐
│ 3. MUTABLE LIVE CONTEXT                     │
│ Compact working projection                  │
│ What the model sees now                     │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│ 4. MODEL INFERENCE                          │
│ Reasoning, synthesis, generation            │
└─────────────────────────────────────────────┘

The central distinction is:
\[
\text{trajectory} \neq \text{live context}
\]
The trajectory is persistent.
The live context is disposable and reconstructable.
The live context therefore becomes a projection over historical state rather than the historical state itself.
4. Canonical trajectory
Every meaningful interaction is first written to an immutable or append-only event log.
This includes user messages, assistant messages, tool calls, tool outputs, retrieved documents, context-management operations, agent results, and potentially model-generated context transformations.
For example:
{
  "event_id": "evt_1821",
  "type": "user_message",
  "timestamp": "...",
  "content": "...",
  "conversation_id": "conv_42"
}

The canonical trajectory serves several functions simultaneously.
It remains the source used by the user interface, so removing information from model context never removes it from the visible conversation.
It provides a recovery mechanism if a context-management policy makes a bad decision.
It provides an audit trail explaining how later summaries or beliefs were derived.
It becomes searchable external memory.
And it permits future context projections to be regenerated using improved models or policies without altering the original interaction.
This is closely analogous to event-sourced software systems: immutable events describe what occurred, while mutable projections provide efficient current-state views.
5. Context objects and lineage
Raw trajectory events can be represented or referenced through CLP-style ContextBundles.
A conversation-derived bundle might look conceptually like:
id: cb_812
frame: conversation.decision

content:
  "Use architecture B for the parser."

lineage:
  source_events:
    - evt_391
    - evt_397
    - evt_405

semantics:
  type: decision
  topics:
    - parser
    - architecture

resolution:
  confidence: 0.91

retention:
  class: task
  compressible: true
  verbatim_required: false

refs:
  raw: trajectory://conv_42/events/391-405

Some of these retention fields would be extensions to current CLP rather than part of the existing specification. The underlying fit, however, is straightforward because ContextBundles are already intended to preserve lineage, semantics, resolution, policies, and references across transformations.     Context_Layer_Protocol_(CLP)
This makes summarization or compaction a transformation rather than replacement:
raw events
   ↓
derived ContextBundle
   ↓
compact live-context representation

The original remains retrievable.
6. The mutable context projection
The CLM-style context file becomes the current working projection.
For example:
[CURRENT OBJECTIVE]
Design context architecture prototype.

[USER CONSTRAINTS]
Preserve full conversation history.
Reduce repeated frontier-model input.
Allow retrieval of discarded detail.

[ACTIVE DECISIONS]
- Canonical transcript remains immutable.
- Live context is a mutable projection.
- CLP tracks lineage between projections and sources.

[OPEN QUESTIONS]
- Decision-layer model choice
- Retrieval threshold
- Compaction evaluation metric

[RECENT INTERACTION]
...

This representation may bear little resemblance to the chronological conversation.
That is a feature.
Chronology is useful for historical reconstruction. It is often a terrible structure for working memory.
The context might instead organize information by task, unresolved question, current hypothesis, evidence, agent status, source, or some model-generated organization that proves useful.
CLMs already demonstrate that models can invent such structures when allowed to edit their live context. The proposed architecture simply stops requiring that this mutable workspace also function as the canonical record.
7. Multi-scale context management
A CLM-only architecture places context management primarily in the frontier model.
That allows very flexible behavior but carries an important cost: the expensive model must spend inference on deciding what information deserves future inference.
The proposed system therefore divides context-management work by computational difficulty.
Deterministic layer
Simple invariants should not require probabilistic judgment.
Examples include preserving required source references, respecting pinned content, enforcing policy permissions, maintaining valid schemas, calculating token budgets, preventing deletion of protected information, and recording lineage events.
Fast decision layer
A small specialized model, classifier, or Jev-like decision system handles frequent bounded questions such as:
retain?
pin?
evict?
archive?
retrieve?
compact?
priority = 0..4?
expected future relevance?
safe to remove from working context?

These operations generally require judgment but not open-ended generation.
Frontier model
The frontier model is invoked where actual semantic transformation is required:
summarize these events without losing these constraints
reconcile contradictory notes
rewrite working state
derive a higher-level abstraction
decide whether an unusual case matters

This leads to an important distinction:
\[
\textbf{selection} \neq \textbf{transformation}
\]
Deciding that 8,000 tokens should be compacted may be cheap.
Producing a faithful 800-token replacement may not be.
There is little reason to pay the same computational price for both.
8. Ingress and retention
Context reduction can occur at two different boundaries.
Ingress management
Large external observations need not automatically enter frontier-model context in full.
Suppose a tool produces 40,000 tokens.
A preprocessing pipeline can chunk, classify, index, and score that observation before deciding what reaches active context:
40K tool result
      ↓
index + metadata
      ↓
cheap relevance/decision stage
      ↓
7K candidate material
      ↓
frontier model
      ↓
2K maintained representation

The complete 40K observation remains available externally.
This is ingress compression:
\[
external\ information \rightarrow working\ context
\]
Retention management
Once information has entered active context and influenced reasoning, the system asks whether it needs to remain there.
new user turn
      ↓
frontier model processes it
      ↓
context policy evaluates persistence
      ↓
keep / compact / index / evict
      ↓
next live context

This is retention compression:
\[
current\ context \rightarrow future\ context
\]
CLM primarily provides a strong mechanism for retention management. A broader layered architecture can apply similar logic before information enters expensive cognition at all.
9. Retrieval and cognitive proximity
Removing something from live context should not mean forgetting it.
The architecture should therefore distinguish at least:
active
proximal
indexed
archived

An item may no longer deserve hundreds of tokens in every model call but can remain represented by a tiny pointer:
[ARCHIVED CONTEXT]
- Early discussion of architecture A → ctx://decision/14
- Full benchmark comparison → ctx://evidence/81
- User reasoning on provenance → turns://218-237

This introduces a useful conception of context management as cognitive proximity management.
The relevant question becomes not:
Should this information exist or be deleted?

but:
How close to active cognition does this information currently need to be?

That substantially reduces the stakes of context eviction.
10. Retrieval loop
During inference, the model can request historical detail through explicit tools:
search_history("why did architecture A get rejected?")
retrieve_turns(218, 237)
resolve_context("decision_14")
expand_bundle("cb_812")

Retrieved material temporarily re-enters working context.
The model may then update the current projection and allow the retrieved detail to fall out again.
Thus memory becomes cyclical:
archive
   ↓ retrieve
working context
   ↓ reason
updated projection
   ↓ offload
archive

The CLM paper explicitly distinguishes context management from external memory in similar terms: context determines what is visible during a model invocation, while external memory stores information outside that context and can later return it. The proposed system elevates this distinction into the primary architecture rather than treating it as an auxiliary capability.
11. Context transformations as accountable operations
A major danger of aggressive context management is silent epistemic drift.
Consider:
Original:
"We tried A twice. It may still work if X changes,
but B currently looks easier."

Summary:
"We rejected A and chose B."

The summary is shorter and superficially useful but changes the epistemic state.
CLP provides a useful mechanism for treating transformations as accountable objects rather than invisible prompt engineering.
A compaction event could record:
transform: summarize

inputs:
  - evt_201
  - evt_202
  - evt_203

output:
  - cb_91

preserve:
  - unresolved_alternatives
  - user_constraints
  - source_refs

resolution_delta:
  certainty_increase_allowed: false

dropped:
  - redundant_examples

performed_by:
  model: frontier_model_x

The CLP specification already contains an append-only lineage model for transformations and derived objects.     Context_Layer_Protocol_(CLP)
This could become particularly important for model-edited context because the CLM paper itself recognizes that later context can cease to contain the original inputs under which earlier actions were generated.
The historical trajectory therefore acts as epistemic ground truth for what was observed, while the mutable context represents the current interpretation of what matters.
12. Attention budgets
The original CLP design already treats model and human attention as constrained resources and allows queries to specify an attention budget.     Context_Layer_Protocol_(CLP)
That idea can be generalized into an operational context budget.
For example:
context_budget:
  total: 32000

allocation:
  task_and_rules: 4000
  recent_interaction: 6000
  active_state: 5000
  retrieved_evidence: 12000
  reserve: 5000

The allocation need not remain static.
A research task might devote most context to evidence.
A coding task might devote more to files and execution state.
A long conversation might retain very little chronology but substantial relational or decision state.
A decision model could continually adjust these allocations without requiring the frontier model to explicitly reason through token accounting on every turn.
13. Failure handling
The architecture should assume context management will occasionally be wrong.
The design therefore favors recoverability over perfect prediction.
If relevant information is evicted, semantic or lexical search can retrieve it.
If a summary is defective, lineage identifies its source.
If a context projection becomes corrupted, it can be regenerated from canonical history.
If two summaries conflict, both can be traced to their inputs rather than forcing one to silently overwrite the other.
If the decision layer is uncertain, it can escalate rather than compress.
This suggests a useful design principle:
Prefer reversible reductions of attention over irreversible reductions of information.

That may be the single clearest distinction between this proposal and naive conversation summarization.
14. Computational hypothesis
The architecture makes a fairly concrete empirical prediction.
For sufficiently long interactions, a system that maintains bounded active context while preserving external history should require substantially fewer frontier-model input tokens than a comparable append-only conversation, while retaining most or all of the recoverability of the original transcript.
A second hypothesis is that separating context-management decisions from semantic transformations can reduce frontier-model inference further.
A third is that explicit provenance and retrieval pointers will reduce the performance degradation normally associated with aggressive summarization.
So the goal is not merely:
\[
\text{minimize context length}
\]
It is closer to:
\[
\min C_{compute}
\]
subject to constraints on:
\[
task\ performance,
\]
\[
information\ recoverability,
\]
\[
epistemic\ fidelity,
\]
and
\[
context\ budget.
\]
That is a much more interesting optimization target than “make the prompt shorter.”
15. Minimal prototype
A useful first implementation does not require reinforcement learning, custom models, or exotic infrastructure.
It could use the existing CLM harness as the mutable-context mechanism, while adding four components:
1. an append-only SQLite/JSONL conversation event store;
2. a lightweight CLP-derived metadata/index layer with source pointers and lineage;
3. a small decision function or model that assigns retention actions to new context segments;
4. retrieval tools allowing the CLM to search and restore historical material.
The mutable file supplied by CLM would then contain only the current working projection.
Every edit could be recorded as:
previous context
      ↓
context transformation
      ↓
new context
      +
lineage receipt

The first experiment could deliberately avoid cleverness.
Run the same long-horizon task under:
A. append-only context
B. vanilla CLM
C. CLM + persistent transcript
D. CLM + transcript + cheap decision layer
E. CLM + CLP lineage + decision layer

Then compare task success, frontier-model input tokens, inference FLOPs where measurable, retrieval frequency, context size, information-loss errors, and the ability to recover facts deliberately removed from active context.
That would tell you whether the extra machinery is actually buying anything rather than constructing a magnificent cathedral around summary.txt, an occupational hazard in AI architecture.
16. Broader framing
The larger idea here is that an LLM context window should perhaps not be treated as the system's memory.
It is better understood as the system's current attentional field.
The system's memory can be much larger, persistent, heterogeneous, structured, and historically faithful.
Under that framing:
Trajectory       = what happened
CLP              = what the information means and where it came from
Index / memory   = what remains available
Decision layer   = what deserves cognitive proximity
CLM context      = what is cognitively active
Frontier model   = what receives high-resolution processing

The architecture therefore replaces the conventional assumption
\[
memory = context
\]
with:
\[
context = projection(memory,\ task,\ state,\ attention\ budget)
\]
That equation is probably the conceptual center of the whole proposal.
CLM supplies the mechanism that allows the projection to be mutable. CLP supplies machinery for preserving context, lineage, resolution, and relationships through representational change. A fast decision layer supplies an economical allocation mechanism. An immutable trajectory supplies persistence and reversibility.
Combined, they suggest a model of context management in which forgetting from attention does not require forgetting from history, and in which expensive cognition is allocated according to relevance rather than simply according to what happened most recently.

DESIGN_PROVENANCE.md

2025-09:
CLP v0.2 developed independently.

2026-09-30:
Reviewed Shao et al., Context Language Models.
Identified overlap around mutable context.

2026-09-30:
Developed Persistent Trajectory / Mutable Context
architecture:
- immutable canonical transcript
- CLP-derived context representation
- bounded decision layer
- mutable model working context
- reversible retrieval
- ingress + retention management

External inspirations:
- Context Language Models, Shao et al.
- Jev / bounded decision models
...

We will create a new repo for the architecture:
Persistent Trajectory
        ↓
CLP Context Index
        ↓
Decision / attention layer
        ↓
Mutable Context Projection
        ↓
Frontier Model

Write it from our own specification and from the published architectural ideas rather than copying CLM source code.