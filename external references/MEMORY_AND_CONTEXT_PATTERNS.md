# Memory and Context Across the E2 Workspace: Patterns, Principles, Paradigms

*Synthesis document · 2026-09-30 · compiled from a read-through of the Emergence Engine, REAL (Phases 2–8, REAL-Neural-Substrate, REAL-EE, real_system), PAME, and the surrounding E2 framework, TMG/Aegis, and ORMD/CLP material.*

This is an extraction of what the workspace says about **memory** and **context**, organized by pattern rather than by project. It keeps implementation detail to the minimum needed to make a pattern legible. Where numbers appear, they are there because they are the evidence that a pattern holds (or fails), and each comes with the conditions under which it was measured.

---

## 0. How to read this

### Evidence tags

Every claim below carries one of these, because the workspace mixes very different kinds of support and the difference matters.

| Tag | Meaning |
|---|---|
| **[T]** | Theory or framework claim. Stated in the corpus, not tested by an experiment. |
| **[D]** | Design commitment. An architectural rule the code is built to enforce, not a finding. |
| **[S]** | Simulation or experiment result in an *authored* environment (synthetic tasks, hand-set costs). Real as a result; limited as a claim about the world. |
| **[R]** | Preregistered and adjudicated result (PAME only). Thresholds frozen before the run. |
| **[−]** | Negative, falsified, or abandoned result. Kept deliberately. |
| **[!]** | Caveat that changes how far the claim should be trusted. |
| **Reading** | My cross-source interpretation. Not stated in any single source. |

### Coverage

- **Read in full or substantially:** Phase 2 REAL spec (`learning algorithm.md`), Phase 4.5 memory revision docs, Phase 5 README/update/plan, Phase 6 integration + Emergence Engine README/Future Directions/training/tuning/architecture docs, Phase 7 (memory substrate plan, cellular memory notes, full report, Layer 2 and ATP budget reports), Phase 8 (AGENTS, vision, operational orientation, CVT-1 spec, session synthesis, slow-layer consolidation docs), REAL-Neural-Substrate (synthesis, laminated design, core patterns extraction, key laminated/carryover traces, claims-assessment review, scale summaries), real_system trace, PAME (v0.2 foundation, current state, model boundaries, claim registry, M7 status, R1/R3/R4 results), E2Core nodes (Persistence, Condition as Typed Terrain, Slow-Layer Clock Ratio, CLP, Relational Localization, Consequence Routing, Asymmetry Maintenance, Attentional Access and Formation, CCS/CRS, TCL findings, Human Remembrance, What This Work Is For), Aegis synthesis, TMG proposal and prompt-only negative control.
- **Skimmed or sampled:** Pattern Integrity over Time under Entropy, sub-threshold persistence, Relational Reserves, ORMD design philosophy, REAL-EE AGENTS, the PAME/E2 overlap inventory, Emergence Engine progress archive.
- **Not opened:** the FOSL / optical-transfer work, WAIZ, MSAF, WDW, papersearch, etymology registry, condition-map and pareto-protocol apps, TCL simulation code, the bulk of trace files (the ~110 REAL traces were sampled via their index and the ones cited here), and all code. Nothing here was verified against code; it is what the documents say.

---

## 1. The thesis in one page

The workspace converges, from several directions, on one position and a handful of corollaries.

1. **Memory is maintained constraint, not a stored record.** A past event matters to the degree that it has become built into which future states are easy or hard to enter. The test of memory is whether history changes what the system can *perceive, afford, and reach* — not whether it can be retrieved. **[T, with S support]**
2. **Memory comes in layers that differ in timescale *and* physics.** The recurring stack is constitutional prior → episodic trace → consolidated pattern → maintained substrate (REAL), or activated → stored → structural → infrastructural (PAME). The line between "remembers how to choose" and "remembers by changing what can be chosen" is the same line as tilt versus reshape. **[T/D]**
3. **Consolidation is promotion, not pruning.** What is kept is what is informative for navigation (attractors, surprises, boundaries), and only what earns maintenance becomes substrate. **[D, with S support]**
4. **Memory is metabolically priced, and the price makes a wall.** Below a resource floor, maintaining memory is a net loss and a memoryless agent does better. Above it, the advantage is large. **[S]**
5. **Memory's main effect is on access and perception.** The best-supported mechanism is that maintained history changes observation clarity and action cost, not that it supplies answers. **[S]**
6. **Context is what disambiguates, and memory should not be welded to an explicit context label.** Latent, inferred context transferred better than visible labels; context-bound memory is where transfer damage concentrates. **[S]**
7. **All memory goes stale, and staleness is the characteristic failure.** Terrain lag, stale assignment, context poison, hollowing: four names for one problem — the sign outlives the condition that justified it. **[T, S, R]**
8. **A slow layer should regulate by summary and tilt, and must never solve the task.** Every attempt to make the slow layer more forceful moved the real problem down a level. **[D, S]**
9. **The things that build and keep the memory are subject to the same rules** — coding agents, traces, tests, and the corpus itself. **[D]**

The rest of the document develops each, with the evidence and the places where the evidence is thin, contradictory, or falsified.

---

## 2. Origin: memory as constraint accumulation

**The source observation** (`Phase 2/Phase 7/cellular memory.md`). Cellular memory is not stored in any one place. It is distributed across chromatin state, feedback loops, molecular concentrations, and structural organization. Chromatin marks matter "because they sit inside a reinforcing loop," not as static records; the loop costs energy to run. The cleanest term for the mechanics is **constraint accumulation**: a past event changes what future states are easy or hard to enter, restore, and maintain. "Information" smuggles in symbolic content; "memory" tempts anthropomorphism. **[T]**

**Five invariants** were extracted as design requirements for anything that should count as memory (`memory substrate plan.md`, Phase 7 report):

| # | Invariant | Why it is required |
|---|---|---|
| 1 | **Bistability** in at least one layer | A gradient-preference system can explore; a bistable one can remember. Continuous trail scores are preferences; attractor basins are regimes that resist perturbation. |
| 2 | **Active maintenance cost** on the constraint layer | Memory that persists free is storage. The cost is what makes it real. |
| 3 | **Speed differential** between at least two coupled layers | Uniform temporal resolution cannot develop lamination. |
| 4 | **History-dependence in the transition structure**, not just state preferences | Past visits should change what transitions are *possible or probable*, not just preferred. |
| 5 | **Self-reinforcing closure** | A memory, unlike a mark, tends to be rebuilt after partial perturbation. |

**Why the existing memory failed the test** (same document). The episodic log was (a) a *library the agent consults* rather than a *field the agent partly is*, (b) flat in timescale, and (c) without any second-order signal that its own memory was degrading or over-rigid. **[T]**

**Mapping to the six primitives** gives each cellular layer a distinct job: structural organization → identity (P1); feedback-circuit bistability → dynamics (P2); chromatin/spatial architecture → causal precedence (P3); epigenetic marks → reshaping the allowed state space (P4); the information-versus-constraint debate → what is epistemically accessible (P5); canalization and buffering → self-model stability (P6). The point of the mapping is that "constraint accumulation" as a single term hides that P2-type memory (attractor dynamics) and P4-type memory (state-space reshaping) may behave differently. **[T]**

**Reading.** The word the workspace reaches for again and again — *terrain* ("a settlement that has become terrain," "condition as typed terrain," "terrain lag," the PAME "infrastructural layer") — is this same idea at different scales. Memory, condition, and infrastructure are one phenomenon read at different timescales and resolutions.

---

## 3. The layered model

### 3.1 How the stack evolved

| Stage | Memory model | What changed |
|---|---|---|
| REAL v1 (Phase 2, hardware-embedded) | **H** episodic log + **Γ** three-tier consolidation | Memory as a navigable trail. Learning is "accumulate and navigate traces," not "update parameters." |
| Phase 4.5 (March 15) | **H_e** episodic, **H_c** consolidated pattern, **M_s** maintained substrate; cost `c(a, M_s)`, observation `O(S, M_s)`, coherence `Φ(S, H_e, M_s)`, selector `Ψ(H_e, H_c, M_s)`, promotion `Γ(H_e → H_c → M_s)` | Memory stops being an optional archive and becomes present at more than one step of the loop. Triggered explicitly by the Phase 7 result. |
| Core patterns extraction (April 1) | **DNA** / H_e / H_c / M_s | Adds a constitutional prior. *DNA is not a peer domain*; later domains are interpreted against it. Binding from domain-local memory into system memory must be explicit. |
| PAME v0.2 (Aug 31) | **Activated / Stored / Structural / Infrastructural** | Same idea aimed at a communication substrate; adds the mechanistic boundary below. |

### 3.2 The boundary that matters

PAME's official definition, which supersedes an earlier depth-based one:

> **Structural memory changes preference inside an existing option-space: it remembers how to choose. Infrastructural memory changes the option-space itself or its capacity: it remembers by changing what can be chosen.**

This is the same line as **tilt versus reshape** from TCL. One distinction doing double duty, which is a strong sign the two fields are describing the same thing. **[T]** The pathology that transfers with it is **terrain lag**: settled structure misrouting under drift (§9).

### 3.3 Timescale follows medium

The Phase 7 planning document makes a practical observation: storage media already have natural timescales, so use them rather than fighting them.

```
code / architecture       slowest   (months, structural)
config / founding biases  slow      (sessions, tunable)
database / files          medium    (cycles, persistent)
in-memory objects         fast      (within-session, live)
active computation state  fastest   (within-cycle, ephemeral)
```

The design question then becomes "how is explicit coupling wired so the slow layer actually tilts the fast layer" rather than "where do we put it." A graph is called a *snapshot* (a pairwise-relations slice), not the thing itself; the memory is "the topology of what is reachable from where, at what cost." **[T]**

### 3.4 Retrieval as perception

PAME: "The address becomes relational: not what byte contains it, but which region, channel, and pathway gives access." A query is a bias on the field, reshaping what attention locks onto next, not a lookup. This is the same stance as the cellular-memory invariants, applied to storage. **[T]**

### 3.5 Memory can live in the world

The Emergence Engine is the oldest instance of this and is easy to overlook because it predates the vocabulary. **[S/D]**

- **Trails are external memory** (stigmergy). Agents deposit and follow them. The "provenance credit" system pays agents for others reusing their trails (+0.1 chi per chi credited).
- **The signal field decays and diffuses**, with per-channel ring-buffered histories and biases that *evolve toward targets* rather than being set.
- **Resources remember being overharvested.** Orbiting drains vitality; below 0.3 a resource is uncollectible and only becomes collectible again above 0.4 — a hysteresis band in the environment itself.
- **Death feeds fertility.** Dead agents decay and release chi into soil, so the dead leave a trace that shapes the living.

Two later echoes: PAME's *infrastructure layer outlives explicit-memory resets* by design, and REAL-EE's rule that ecological mechanics stay in the world layer rather than being hidden inside the REAL core. **Reading:** some of the most durable memory in these systems is not in any agent, and the cleanest way to test agent memory is to know what the world is already remembering on its behalf.

---

## 4. Consolidation

### 4.1 What to keep

The retention rule, unchanged from Phase 2 through Phase 8 (`learning algorithm.md` §6):

- **Attractors** — entries with the highest coherence ("where the agent wants to go")
- **Surprises** — entries with the largest absolute coherence change, positive *or* negative ("a −0.15 delta is as informative as a +0.15")
- **Boundaries** — entries near a decision threshold ("where action choice mattered most")

The retention counts control the *character* of the memory: more attractors biases toward exploitation, more surprises toward sensitivity to change, more boundaries toward careful navigation of transitions. Consolidation is lossy and irreversible. The rule was "derived from observing what was actually useful," and the Phase 7 plan insists the same discipline apply to new layers: **instrument before optimizing** — run 10+ sessions, log the slow layer every cycle, and let the data say which configurations predicted future coherence. **[D]**

The hippocampal-replay analogy appears in the spec as motivation. It is an analogy, not evidence. **[T]**

### 4.2 Promotion, not pruning

Phase 4.5 reframes Γ from "prune the log" to "decide how episodic structure becomes durable constraint": keep traces for selector learning, extract recurring patterns, promote selected structure into the substrate, and support cross-session continuity. **[D]** In Phase 7 this became **constraint patterns** — compressed multi-dimensional signatures (scores + trends) with a valence (attractor or trough) and a strength that decays unless refreshed by recognition. Patterns that stop being recognized fade on their own.

**Diversity must be enforced.** Without it, all 12 pattern slots filled with near-identical attractors (>0.90 pairwise similarity). Two mechanisms fixed it: **merge gating** (similar same-polarity patterns are averaged, threshold 0.70) and **coverage-aware pruning** (when full, remove the most *redundant* pattern, not the weakest). Result: 2–5 genuinely different patterns, max pairwise similarity ~0.69. **[S]**

### 4.3 The largest lever was the handoff

| Stage (Phase 7, unlimited budget) | Coherence gain over baseline |
|---|---|
| Substrate integrated into REAL | +8.6% |
| + ATP budget, velocity tracking, patterns, diversity, per-dimension modulation | +7.8% to +8.2% (flat) |
| **+ cross-session consolidation** | **+14.5%** |

Every mechanism after integration left the advantage roughly where it was. The jump came from carrying forward three things between sessions: consolidated episodic survivors, dimension context (so pattern matching activates at once), and prior coherence (so the first delta is meaningful). Without them, the selector spent the first 10–15 cycles of each 50-cycle session in random exploration — a 20–30% cold-start tax. STABLE rate went 66.7% → 82.3%, DEGRADED 3.6% → 0.3%. **[S]**

> "In systems where sessions are discrete (sleep/wake cycles, task boundaries, context switches), the handoff between sessions may matter more than the within-session dynamics." — Phase 7 report

**[!]** Three seeds × 15 sessions × 50 cycles, in a **synthetic six-channel signal environment**. The qualitative point (handoff > new mechanism) is the durable finding; the percentages are not.

### 4.4 What failed, and why the failures are informative **[−]**

| Attempt | What went wrong | Lesson |
|---|---|---|
| Pre-decline warning patterns | Pre-decline state is indistinguishable from a normal good state; positive and negative patterns both matched everything, and the noise hurt performance (−0.017 across sessions). | Capture the *degraded state itself*, not the lead-up to it. |
| Strict consecutive-decline detection (4+ cycles) | Never triggered; coherence deltas are too noisy. | Don't build detectors on thresholds the noise floor defeats. |
| Asymmetric modulation weights (+0.08 / −0.15) | With diverse patterns producing more troughs than attractors, it created net noise bias. | Symmetric weights until asymmetry is earned. |
| Merge threshold 0.60 | Left 1–3 patterns — too few to recognize anything. | Too much compression destroys the signal. |
| Hard-coded maintenance priority in the selector | Removed in favor of letting the selector learn the value of maintenance from trail data. | Coherence must be endogenous; engineered rules hide whether the mechanism works. |

### 4.5 Consolidation in the development process itself

In Phase 8, separate "slow-layer" agents periodically read the fast-layer coding agents' traces and wrote consolidated `H_c` documents with strategic guidance (`Phase 8/slow_layer/`). Patterns they extracted were behavioral ("the primacy of locality," "metabolic constraint as the primary architect"), and several guidance items became constraints (hold the line on topology growth until transfer is solid; do not force the transfer matrix symmetric). This is covered in §11.

### 4.6 What carries, and what resets

The trace organizer (`trace_domain`) shows a clean split. **What persists across attempts is vocabulary** (the lexicon, a co-occurrence graph). **What resets is structure** (groups, assignments, engine). The second run starts at higher coherence (0.353 vs 0.320) because the vocabulary is already understood. Traces assigned rose from ~70–80 of 109 to 105 of 109 after adding persistence, a retry loop, and an endogenous "frontier" signal for unexplored territory. **[S, single-domain]** **Reading:** a practical heuristic falls out — persist the *interpretive equipment*, reset the *work product*.

---

## 5. Memory has a price

### 5.1 The metabolic wall

Phase 7 added a per-session ATP budget. Every action, including "invest in memory" and "maintain memory," draws from the same pool. **[S]**

| Budget (ATP) | Substrate coherence | vs. baseline (~0.727) |
|---|---|---|
| 2.0 | 0.658 | **−9.4%** |
| 2.5 | 0.710 | ≈ −2.3% |
| 3.0 | 0.755 | ≈ +3.9% |
| 3.5 | 0.801 | **+10.2%** |
| unlimited | 0.803 | +10.4% |

- The crossover sits at roughly **2.5–3.0 ATP**. Below it the substrate is actively harmful: the selector keeps trying to invest, none of it crosses the bistable threshold, ATP is wasted, observation noise is maximal, and the agent rests 59% of the time.
- The transition is sharp *because* of the bistability: partial investment that doesn't cross the threshold is wasted.
- Above the wall the system **self-limits**: 3.5 ATP and unlimited give nearly identical results, because it builds ~4 active dimensions and stops.
- The baseline is **budget-insensitive** — robust under scarcity, unable to use abundance.
- **Mature agents operate below the wall that new agents face.** An established slow layer needs maintenance (cheap), not investment (expensive); history subsidizes the present budget. The wall is highest for fresh agents.

**[!]** The budget sweep was run *before* cross-session consolidation was added, and the report notes the warm start "may shift the wall lower." Not re-run in the documents reviewed.

### 5.2 The same shape elsewhere

- **TCL** (`Temporal Constraint Lamination - What We Found`): under any meaningful metabolic cost, steady oscillation is impossible — the system must *breathe*. **Regulation costs more than exploration**: the slow layer's continuous maintenance drain outweighs the fast layer's transition spikes. And the killer is not scarcity but **entrenchment**: valleys too deep to escape. **[T/S, model-class-specific]**
- **Sub-threshold persistence** (staged): below a resource threshold, the computed optimum is to ignore memory and react to the present, so memoryless reactivity is "the computed optimum below threshold," not a degraded form of the good thing. **[T]** **[!]** The document itself flags that this external anchor "entered the corpus through a conversation summary rather than through direct reading of the paper" and must be checked against the primary source before it bears load.
- **Persistence as accumulated stance-with**: for actively maintained configurations, persistence across a window implies accumulated maintenance expenditure, `A(W) = ∫ m(t) dt`. But the integral is *not* duration, identity, or value. Passive storage, dormancy, and restartable patterns can persist with near-zero expenditure *at the focal layer* while costs sit at other layers or times. Maintenance can be **displaced across a boundary**, so the ledger must record who pays. **[T]**
- **Asymmetry maintenance (AMM)**: "A maintained gradient is not a stored state. It is a perishable structure." Usable difference must be continuously held open; when margin falls, systems collapse onto *cheap attractors* (certainty, outrage, compliance, premature closure). **[T]**
- **PAME's metabolic layer** (M8-prep): a shared reserve in which basal activity, observation, action, communication, and memory compete. A 4,140-arm map located where the reserve binds (48 cold, 88 warm) and reported that **5 of 12 cost weights are unidentifiable** because the task never exercises them. **[S, authored costs]** That last result is a useful discipline: a cost the task cannot exercise should be reported as unidentifiable, not fitted.

### 5.3 A result that cuts the other way **[−]**

PAME's preregistered **R3** predicted an interior "generative window": moderate capacity should beat both scarcity and abundance on transfer and organization (a cross-substrate replication of a TCL finding). The adjudicated result (96 arms, 24 matched groups) was **falsified**:

| Capacity | Transfer | Organization |
|---|---|---|
| near-zero | 0.319 | 0.267 |
| scarce | 0.634 | 0.291 |
| moderate | 0.748 | 0.365 |
| abundant | 0.926 | 0.923 |

Abundance beat moderate in **24 of 24** matched groups. Capacity monotonically improved persistence and transfer. The result is scoped: one authored fixed-policy held-out-transfer simulation; it does not disprove every scarcity window. **[R, !]**

**Reading.** Two different claims have been circulating under the name "scarcity helps": (a) *entrenchment* kills adaptive cycling (TCL; survives), and (b) *moderate* capacity outperforms abundant capacity for abstraction (R3; not replicated here). They should be kept apart. The Phase 7 wall ("too little is worse than nothing") is compatible with R3's falsification ("more is better") — the wall is a floor, not a window.

---

## 6. Memory shapes perception and access

### 6.1 The mechanism that carried the result

The Phase 7 substrate does not help by storing more information. It helps because **dimensions with slow-layer support are observed with less noise** (clarity scaled 0.35–0.97), and recognized attractor patterns sharpen perception further. The report's own summary:

> "The agent doesn't remember what to do; it becomes the kind of agent that perceives the world in a way that makes good actions legible."

The design analogue is chromatin accessibility: *not a different environment, just different epistemic access to the same environment.* The recognition→clarity→coherence→behavior→recognition loop is the pattern-level form of invariant 5 (self-reinforcing closure). **[S]**

Four dimensions gained (differentiation +0.277, accountability +0.271, reflexivity +0.110, vitality +0.037) and two lost (continuity −0.026, contextual fit −0.036). The losers are the dimensions that reward *behavioral consistency*; the winners reward *diversity*. The substrate shifted the balance toward diversity. **Reading:** memory that changes behavior will move consistency-rewarding and diversity-rewarding measures in opposite directions, and a single composite score hides the trade.

### 6.2 Corroborating statements

- **Phase 8 (native substrate):** a historically reliable connection is "seen" more clearly than a novel, noisy one. Durable learning is written into structure that makes a behavior *cheaper* (e.g., firing a proven connection costs 0.01 ATP instead of 0.05). "Hebbian learning merged with epigenetic constraint maintenance." **[D]**
- **Attentional Access and Formation (AAF):** repeated episodes change *future access policy* — Lean (standing relevance slope), Gate thresholds, Alert readiness, Hold duration. Formation is of an access policy, not merely accumulation of preferred objects. Terrain is what makes routes easier or harder before the current episode. **[T]**
- **REAL as an inference-side slow layer (Phase 5):** a transformer during inference is "all fast layer"; the context window is its only temporal persistence; the hypothesis is that a slow regulatory layer across ~20-token segments, using bounded tilt (temperature ±0.1/cycle, prefix injection), supplies what the model structurally lacks. Early results: the entropy signature separating competing-constraint prompts strengthens with model scale (Pythia-2.8B, p = 0.047; the preregistered acceptance criterion was *not* formally met), and the loop runs but the coherence function is uncalibrated. **[S, preliminary]**

### 6.3 Recognition and prediction are different jobs

The 2026-03-18 anticipation proposal adds a structural point: memory should do two things — **recognize** that a situation resembles prior ones and **predict** what will happen if an action is taken — and the engine should keep them as separate responsibilities with a measurable **prediction error** as the bridge to consolidation. The protocol document repeats this as a rule: recognition, prediction, and comparison must not collapse into one opaque selector. **[D]** **[!]** The claims review notes the prediction mechanisms showed weak measured influence on outcomes at the tested session lengths.

### 6.4 Seeing better is not the same as acting better

Phase 6 (REAL inside the Emergence Engine) produced a clean negative. After redesigning the contextual-fit score and adding deliberate signalling plus short-lived attention commitments, the system got better at *perceiving structure* but not at turning that perception into **consequences that stay legible long enough to be attributed**. More agents alone made things worse (scarcity, more constraint-mode, fewer signals); more agents *plus* more resources helped. **[S, exploratory]** **Reading:** memory that improves perception can still fail to close the loop if the world doesn't hold the action's consequences open long enough to be read back. This is the EE version of the PAME "score the world, not the story" rule.

---

## 7. Context

"Context" is used in at least five ways across the workspace. They are connected, but conflating them causes errors.

| Sense | Where | Working definition |
|---|---|---|
| **Disambiguating variable** | REAL CVT-1 | The hidden variable that changes what the correct response to the same input is. |
| **Active working surface** | PAME agent tuple (`C` vs `M`) | The small, salience-gated part of memory currently behaviorally live. |
| **Carried frame** | CLP / ORMD | The frame, lineage, policy, resolution limits, and explanation that travel with content. |
| **Observer-indexed position** | Condition trace, Relational Localization | Who is reading, from where, at what resolution, over what window, with what evidence. |
| **Access terrain** | AAF | Which differences can currently gain influence on a resolution, shaped by history. |

### 7.1 Explicit vs. latent context (the strongest empirical thread)

In CVT-1, the same 4-bit input must be transformed differently depending on a context bit. The context is either **visible** (given) or **latent** (inferred from packet flow and downstream feedback). **[S]**

- **Stage-1 (visible) tuning created a shortcut.** The fast layer used the explicit bit to bind returned credit to context-specific memory — the breakthrough that enabled transfer — and a later architectural-review trace (written by a different coding agent, GPT-5.2-Codex) warned it was a "known bridge convenience" with high risk of shortcut learning.
- **Removing the bit caused an observability cliff.** Transfer tuning that worked in Stage 1 actively hurt Stage 2, because strongly committed context-indexed priors were useless once the label vanished.
- **Commitment speed is a dial with two sides.** Cold-start stability wanted fast commitment to an inferred context; transfer wanted slower commitment (over-committing to the wrong context before evidence arrived). The fix was to **split the regime**: a higher inference threshold specifically during transfer adaptation.
- **Latent beat visible under transfer.** After reducing the commitment streak 3→2 and tightening the confidence threshold 0.75→0.78: Task B latent cold start 4.0→8.6 exact matches; A→B latent transfer 7.0 vs visible 6.2. The cost: Task A latent fell 3.0→2.2 (false-positive commits). Hidden Task A→B transfer reached 8.2 exact / 0.644 bit accuracy.
- **Why:** latent supports are *indexed without a context label*, so they cannot carry the wrong label into a task where the mapping changed. Latent carryover is **transfer-safe by construction**; visible carryover is **geometry-sensitive**.

**[!]** Latent is not uniformly better. On the ambiguity-heavy C-family, visible carryover helped (+0.051 exact, one seed) while latent carryover *hurt* (−0.157). Latent cold start is weaker than visible on A and B families. The defensible statement is regime-dependent.

### 7.2 Where damage concentrates: context-bound memory

The transfer landscape is structured, and the structure is the most transferable insight in the REAL work:

| Transfer | Shared transform | Changed transform | Outcome |
|---|---|---|---|
| A→B | ctx0 keeps `rotate_left_1` ✓ | ctx1 changes | positive |
| B→C | ctx1 keeps `xor_0101` ✓ | ctx0 changes | positive, weaker |
| A→B→C | ctx1 reinforced by B ✓ | ctx0 stale from A+B | equals A→C (7.6 exact) by a different mechanism |

- **Shared transforms always give positive delta; changed transforms always give drag** proportional to how strongly that context was reinforced.
- **Two kinds of support:** *edge supports* (routing topology) are task-agnostic and always help; *action supports* (transform preferences) are context-bound and can poison.
- **The scrub experiment** (B→C, seeds 13/23/37): carrying everything made things worse than starting cold (9.0 vs 10.67 exact). Carrying everything *except* context-indexed action supports, context-credit accumulators, and promoted context-transform patterns made things much better (15.33 exact, 0.85 bit accuracy). Scrubbing the *substrate only* while dropping episodic state was worse (8.33). So: **the poison is stale structural context-binding; the episodic/other carried state still contains value once the poison is removed.** **[S, 3 seeds]**
- **Full carryover initially lost to cold start** on Task B (≈3.4 vs 5.2). What repaired it: contradiction debt (decay accumulated bias when contradicted), gating the selector's trust in episodic history on whether the *maintained substrate still endorses it*, and — the decisive step — **positive branch-context evidence** in addition to debt, because "warm full no longer learns only by retreat." Final 12-seed A→B: ≈10.5 exact / 0.70 bit accuracy vs cold 3.9 / 0.47.

### 7.3 Collapse modes of context

- **One-context collapse.** On B2S2 task_c a run reached 0.707 aggregate bit accuracy while `context_0` sat at 0.018 (produced `identity` 882/892 times) and `context_1` at 0.982. Aggregate accuracy is the right stop metric and the wrong *recovery* metric. The slow layer gained explicit asymmetry features and a differentiation reframe, which fired but did not hold: "the reframe is episodic; the failure is structural." **[S]**
- **Evidence dilution.** Source-side evidence dilutes over time, the main bottleneck when context is inferred. **[S]**
- **Local coherence ≠ global truth.** Nodes trapped in a failing B→A transfer reported *higher* local coherence than nodes in a successful A→B run, because each is coherent along its preferred routes while the network fails the task. **[S]**
- **Compression loss in messages** (PAME M5, authored): the simulator holds both the pre-compression and transmitted state, so loss is measured exactly. The pathology: a summary that keeps the conclusion and drops the caveat, and a receiver whose declared prior treats absence as confirmation — recipient closure exceeds sender localization. **[S, authored prior]** The model boundaries doc is explicit that this shows the apparatus *computes* the pathology, not that real agents summarize this way.

### 7.4 Active context versus persistent memory

PAME separates persistent memory `M` from active context `C`, governed by a **salience function** that decides which distinctions stay behaviorally active under pressure. The scale recursion: *inside an agent*, large latent memory serving a small active context; *inside PAME*, large distributed state serving a small global workspace (a scarce, contested, occupancy-limited set of high-reach channels — "a GCO given a body"). Same problem at two grains: **how does a small active surface use a vastly larger latent state?** Predictions held in the holding pen (A3): task-relevant distinctions that remain behaviorally active predict performance better than raw context size, and a usable-context regime exists rather than monotonic benefit. **[T, unadjudicated]**

### 7.5 Context that travels with content

**CLP / ORMD** is the most developed account of context as something that must accompany data. A `ContextBundle` couples content with frame, lineage, policy, semantics, **resolution limits**, and explanation. Design commitments worth extracting: **[D]**

- Answers return **with their limits and causes attached.**
- **Resolution floors:** if minimum support or separation isn't met, *do not guess* — return the item as **unresolved**. "Unresolved" is an honest result state, not a bug.
- **Diversity over count:** multiple supports from the same domain count as one (echo-chamber guard).
- **Exploration floor:** maintain 5–10% exploratory recall to avoid brittle certainty.
- **Attention budget:** bound explanation verbosity to the reader's capacity.
- Registries hold hashes, pointers, events, and signatures — not content. Indexes are disposable and rebuild from files + registry.

**Condition as Typed Terrain** generalizes the same discipline: a settled configuration may be treated as a condition only with a recoverable trace of *terrain, referent, register, position, resolution, evidence, and time state*. "Trust is low" is a state fragment; "trust between the two partners, assessed from the facilitator's position using the last three referral decisions, bearing on whether the referral loop can be sustained this quarter" is a condition claim. **Relational Localization** adds a hard bound: *a closure cannot validly commit more precision than the resolution that feeds it*, and "laundering = claimed assignment precision − achieved localization resolution," a gap that is conserved and lands as remainder on someone else. **[T; schema-discrimination tests only]**

**Reading:** CLP, the condition trace, and the localization trace are three formulations of one rule — *context is part of the claim, and a claim stripped of its position, resolution, and time state is a fragment*.

### 7.6 Context at collective scale

The CCS/CRS documents treat collective cognition as a substrate with its own coherence conditions. The memory- and context-relevant ones: **[T, none empirically tested in this workspace]**

- **Spectral richness** (diversity of distinct signals propagating). *Dialect calcification* — AI-influenced text saturating the training environment so evaluators reward the emergent register — is spectral collapse.
- **Temporal integrity:** whether the substrate has bandwidth to metabolize meaning. When compression outruns resolution capacity (`R · C_eff > R_max`), observability collapses and drift becomes invisible because each step is locally reasonable.
- **Closure locality:** the share of closure operations staying local rather than displaced into external systems.
- **Meaning metabolic rate:** generation must exceed decay (`η·f(A,R,C) > λ_eff·M(t)`); proxied by intergenerational knowledge transfer and narrative coherence.
- **Developmental bypass:** external systems performing intermediate abstraction stages produce competent output while the capacity atrophies.

The translation-architecture document states the same concern as **hollowing**: "the sign remains; the path back breaks." E² is framed as a practice of keeping abstractions able to lead back to what they compress. This is the collective-scale twin of staleness (§9).

---

## 8. Transfer, interference, and forgetting

Consolidated from Phase 8 and the REAL-Neural-Substrate scale work. **[S]** unless noted.

1. **Transfer is directional and asymmetric.** A→B and A→C transfer well; B→A barely reaches parity with cold. "Launchpad" tasks versus "sticky trap" tasks.
2. **The asymmetry has a metabolic explanation.** Task B cost +1.61 ATP more per exact match to learn. A structure that was expensive to form leaves a deeper imprint and is harder to unwind. The slow layer instructed the fast layer to **stop tuning for symmetry** — the asymmetry is a valid feature of the cost model.
3. **The trap is structured conflict, not clinging.** Stuck nodes were *not* exploring randomly (0.97 guided vs 0.02 fluctuation); multiple conflicting branch-transform habits stayed simultaneously active and competing. Adding selector-side arbitration did not fix it; the constraint pressure had to move to the coherence signal.
4. **No catastrophic forgetting observed; graceful specialization instead.** A→B→C equals A→C on exact matches; B training adds ctx1 specificity at the cost of ctx0 specificity instead of erasing A. Multi-step substrate compounds beyond single-step (B→C from a cold B substrate: 6.0 exact vs 7.6 for A→B→C), because edge support carries across tasks.
5. **Hygiene beats volume.** The slow layer should prefer *summary-level, compatibility-checked* carryover over raw context-bound carried structure (the laminated v0 design rule).
6. **More runtime does not help.** Stretching the cycle budget 1.5× and 2× on an unsolved task changed nothing (runtime-slack probe). Memory and structure are the bottleneck, not time.
7. **Sample efficiency (with a caveat).** An Elman RNN needed roughly 8–9× more examples (~144–162) to hit the criterion REAL reached in one 18-packet session; a stateless latent MLP never reached it. **[!]** Online predict-then-update neural analogues on a synthetic task; the REAL-NS claims review cautions against reading this as general superiority.
8. **Morphogenesis is a warm-substrate amplifier, difficulty-correlated.** Growth helps where routing headroom is large (Task B +7.4 exact on the large topology) and disrupts where performance is already high (A −1.6, C −1.0). Earned growth rose from 20% (6 nodes) to 100% (10 nodes). Its benefit is the gap between current performance and the topology's ceiling.

---

## 9. Staleness, drift, and recoverability

Staleness is the most consistent failure across the corpus, and it has the most developed vocabulary.

### 9.1 Names for the same failure

| Name | Where | Definition |
|---|---|---|
| **Terrain lag** | PAME | Settled structure misrouting under drift; penalty proportional to settlement depth. |
| **Stale assignment** | Relational Localization | The sign remains after the localization moved. "Injustice with a valid receipt." |
| **Sign–localization decoupling** | PAME | A convention that outlives its task structure. |
| **Context poison** | REAL Phase 8 | Stale context-bound support carried into a task where the mapping changed. |
| **Hollowing** | Human Remembrance / Persistence | The sign remains after the interior that gave it meaning is drained. |
| **Sub-threshold persistence** | staged | Systems that persist after failing the conditions for meaningful existence. |

### 9.2 Evidence from PAME's structural memory (M7) **[S, authored mechanism fixtures]**

| Condition | Mean on-time rate |
|---|---|
| Cold | 0.319 |
| Valid warm | 1.000 |
| **Stale warm** | **0.208** |

Stale warm memory was *worse than having no memory* (by 0.111). Local evidence challenged and discounted it (memory recovered in round 3 in 8/8 comparisons), but full task recovery happened in only 2/8. Under heterogeneous noisy training (M7.2), stable warm gain was flat (+0.625) across capacity, and post-drift harm fell with capacity (deficit 0.244 at near-zero/scarce to 0.022 abundant). A divergence guard that sees only live-outcome-versus-expectation divergence (never a regime label) helped at low capacity. **[!]** The authors are explicit that M7.1's effect sizes are "deliberately strong" because training traffic was assigned one-to-one; they are not estimates of independent learning.

### 9.3 Design responses

- **Freshness triggers.** Every operational condition trace includes a re-localization trigger: elapsed time, maintenance-loop change, threshold crossing, boundary change, contradictory observation, or stakes exceeding the evidence window. **Un-promotion** is possible: a condition whose maintenance loses funding may move back into visible, unstable consequence.
- **The staleness trace.** PAME's model-boundaries doc specifies that any persistent structural item must record the configuration, its referent, the observer position, justifying evidence, creation and last-validation ticks, maintenance cost and decay, and a retirement trigger. No final scalar is asserted.
- **Local challenge.** Memory carries provenance (supporting event IDs, creation and last-validation ticks) so local contradictory evidence can reverse or discount it.
- **Decay as default, renewal as work.** Read-time decay changes effective weight without silently rewriting stored state; maintenance adds fresh provenance.

### 9.4 Recoverability and the null problem

The deepest methodological idea is the **invertibility invariant**, independently derived five times in the corpus: *a compression earns trust to the degree the generative structure remains recoverable from it.* PAME tests it at three scales: infrastructure (settled terrain as compression of interaction history), message (summary as compression of sender localization), and agent (the surrogate as compression of agent behavior). The critical revision: recoverability must be measured **above structural nulls** — untrained networks, randomized topologies, degree-preserving shuffles, channel-randomized, and matched-capacity ahistorical — otherwise "any persistent structure can be read post hoc as meaningful residue."

What the M9 development work found **[S, authored single fixture]**: a topology-only decoder recovered the generating history 1.0 for trained structures, 0.0 for untrained and matched-capacity nulls, 0.29 for randomized topology, 0.81 for degree-preserving rewires, and 1.0 for channel-randomized (expected, since that null preserves the topology the decoder reads). Across 126 structures, recoverability correlated with *stable* performance (0.54) and with *larger* cost under traffic shift, and its relation to *shifted* performance was weighting-sensitive (−0.07 instance-level, +0.39 family-level). **Reading:** a memory that predicts good performance under the conditions it was formed in may simultaneously predict worse adaptation when conditions change. This is stale-warm harm seen through the recoverability lens.

### 9.5 Reports and traces are lossy registers

Staged work on self-report reframes a verdict question ("does the report match internals?") into a *characterization* question: a report is a translation register; characterize what state types it resolves, under what conditions, with what systematic distortions. **Reading:** the same applies to any trace, summary, or memory note — it is a register with a resolution profile, not ground truth.

---

## 10. Lamination: how slow layers should regulate

### 10.1 The rule

The laminated REAL design (`temporally_laminated_real_v0.md`) is built on TCL's tilt/reshape distinction. Hard rules: **[D]**

1. The slow layer consumes only a compact **summary** of a bounded slice. It may not see raw episodic traces, node logs, or full carryover payloads.
2. It may **bias, gate, filter, or stop**. It may not execute task solutions or prescribe routes/transforms.
3. `SessionCarryover` is not a laminated interface.
4. "If a slice cannot be summarized compactly, the slice is too large."
5. Prefer tilt to reshape.

Negative tests are explicit: raw-state explosion between layers, a hidden centralized planner, a global loss path, or slow-layer output that solves the task all fail review.

### 10.2 What the debugging sequence taught **[S, single-author trace sequence]**

The March 26–27 traces record a repeated pattern: *the first temptation when the system fails is to make the slow layer more forceful; the best progress came from restoring the separation of roles.*

1. **The bug was where the memory lived.** An audit found that node-level carryover (substrate, episodic, prior coherence) was intact, but the laminated mode switch rebuilt the *system-level* runtime — topology, pending growth, latent trackers, capability state, queues — from the original scenario. Growth had been destroyed by a continuity break above the node-memory layer, and the growth "lock/hysteresis" was a defensive patch compensating for it. **Reading:** when memory seems to fail, check which *layer* lost it before adding memory.
2. **Growth was split into request and authorization.** The fast layer emits compact growth requests; the slow layer returns `authorize` or `hold`; `initiate` is a distinct case where chronic structural need persists without a request. `hold` suppresses new growth but preserves accumulated progress.
3. **The slow layer needed to see asymmetry** before it could respond to one-context collapse (§7.3).
4. **Discrete named policies gave way to a gradient controller** with adaptive slice duration, rescue-only branching, and winner-takes-state semantics.
5. **Layer 2 began learning regulatory structure, not task structure** — "let Layer 2 learn regulatory structure, not task structure."

Reported outcome **[!]**: the laminated runs settled many cases the single-pass ceiling benchmark did not (e.g., every tested B2 scale/task pair, 14 in all, settled at ≥0.8; C3S1–S3 settled where no method had reached 0.8), while C3S4 plateaued at 0.556 and B2S6 needed 194 slices. The comparison document itself notes that laminated runs used a single seed and iterative slices against single-pass three-seed means, and that B-family comparisons vary different dimensions — so it supports "iteration with regulation reaches criterion more often," not a controlled win.

### 10.3 The clock ratio

The Slow-Layer Clock Ratio node gives the diagnostic for when something is actually a slow layer: `ρ = τs/τf`, with stability across several fast cycles, bounded drift, and adaptation time shorter than harm time (`Ta < Th`). Four regimes: co-moving controller (ρ≈1), candidate slow layer, **lagging instability** (high latency without stationarity), and **rigidity** (extremely large ρ). The pithy version: *"Clock separation without stationarity is delay; stationarity without timely adaptation is rigidity."* It is a provisional metric with designed positive and negative controls; it does not transfer TCL's numerical constants. **[T; 4/4 designed controls classified as expected]**

### 10.4 Where tilt versus reshape is tested

TCL's original simulation found tilt coupling robust and reshape coupling fragile (delay killed oscillation in 97.5% of marginal configurations under reshape, 0% under tilt). PAME's preregistered **R1** tried to reproduce the reshape wall in a different substrate: 3,584 arms, 512 matched rate ladders. Result: **falsified** — mean slow-delay coherence collapse −0.00013; 0/128 slow-delay ladders collapsed — even though delay produced strong latency-linked staleness (+0.526 stale-on-arrival rate). **[R, !]** The authors' registered framing is that absence of a wall is an informative outcome; it refutes the wall for that finite authored apparatus, not in general.

---

## 11. Memory for the builders (the meta-substrate)

The workspace applies its own memory model to the people and agents building it. This is deliberate ("we are participants in the REAL architecture itself") and is among the most transferable sections.

### 11.1 The practice (Phase 8 AGENTS.md, REAL-NS AGENTS.md) **[D]**

| Layer | How it is implemented in the workflow |
|---|---|
| **H_e** (episodic) | Dated, model-attributed trace documents of *why* code was attempted: hypotheses tested, results, friction. Explicitly "unpolished," so later consolidation can find recurring failure. Timestamps are in the filename *and* the human-visible title. |
| **H_c** (consolidated) | Slow-layer agents periodically read traces and write consolidated pattern documents with strategic guidance. |
| **M_s** (maintained) | Stable decisions are promoted into structural files (AGENTS.md) and — critically — **bound to the codebase with automated tests.** "The tests *are* the metabolic cost of maintaining the substrate." |
| **Index** | A regenerable trace index (`INDEX.md` + `index.json`), used *before* broad searching; new traces require regenerating it in the same pass. |
| **Rule** | "Do not rely on LLM context windows to remember these rules over long coding sessions." |
| **Pacing** | Small, testable loops; recognize slow-layer work (architecture) versus fast-layer work (a syntax fix). The latency of feedback is a real constraint. |

The codebase is also *scored* against the six primitives rather than LOC/coverage: continuity (does it break prior function?), vitality (is the module actually called or dead code?), contextual fit (clean interface?), differentiation (merge or prune redundancy), accountability (traceable data flow?), reflexivity (are docs and tests updated?).

### 11.2 Receipt discipline (PAME)

Every run directory carries a receipt hashing the implementation source. Change any top-level module and every previously recorded run stops verifying. The rationale: the receipt makes a run a claim about *one specific implementation*, not about "the simulator." Practical consequences: tooling that must not disturb recorded evidence goes in a new top-level directory (the artifact viewer lives outside the hashed package for this reason); after landing code, re-run and re-verify the evidence set and update cited paths. Preregistration extends this: the manifest, the prediction text, and a hash of the source tree are frozen *before* the first adjudicating run; a result cannot be rescued by changing thresholds or pooling development runs. **[D]**

### 11.3 Prompt language is not a substrate **[S, negative control]**

In the TMG cost-aware proof of concept, prompting OpenAI, Anthropic, and Gemini models with "REAL-style" cost-aware language mostly **cost more tokens and changed the action path little or not at all**; in one Gemini run it degraded behavior (repeated log inspection, no terminal decision). The interpretation recorded is: prompt language is not a substrate; the model is still the selector; the budget is text rather than a regulating mechanism; evidence obligations are described, not enforced; memory does not persist across runs. **Reading:** this is the workspace's clearest empirical support for the claim that memory and cost awareness must live *outside the model's prose*, in enforced structure. It is a small, preliminary, expected negative control, and the document says so.

### 11.4 Aegis: trace as the coupling medium **[T/D, provisional draft]**

Aegis applies the same lamination to agent safety: fast agents act on reversible abstraction layers; impedance rises with consequence, irreversibility, uncertainty, and accountability burden; "memory posture is trace-mediated continuity." The operational ideas that touch memory:

- **Trace artifacts are compression for the slow layer** — "small enough for slow layers to metabolize, rich enough to preserve continuity." Without traces, fast agents create entropy faster than slow layers can integrate. **No trace, no escalation toward reality.**
- **Reshape budgets**: limits on how much decision-landscape alteration may occur before integration is required (files touched, refactors integrated, schema changes).
- **Breathing cycles**: explore → act in representation → emit trace → review → integrate → adjust mandate → continue. Explicit states for "too many traces unread," "slow layer overloaded."
- **Reversibility-first**: delete→archive, overwrite→versioned save.
- **A rule of separation**: agents may act but may not finalize beyond mandate, and may not alter their own mandate.

### 11.5 The cost-aware framing (TMG proposal)

The proposal's central claim is that long-horizon agent systems treat cost as an externality, making **the human the missing metabolic layer** (budget monitor, context compressor, escalation judge, stop condition). Its hypothesis is that agents with persistent, inspectable control state — substrate memory, carryover, uncertainty, resource pressure — are more steerable than agents whose memory is prompt/log mediated, because interventions can target endogenous variables. A correction recorded in the prompt-only interpretation is worth keeping: "Cost-aware does not mean cheaper." Cost is pressure; a REAL-style system should sometimes spend more when it resolves load-bearing uncertainty or prevents low-value repetition. **[T; proposal stage]**

### 11.6 The system-of-systems layer (`real_system`)

The root `real_system` package treats the whole workspace as one developing organism with `DNA` (Phase 1 as constitutional prior, *not a peer domain*), `H_e`, `H_c`, `M_s`; standardized domain adapters (`inventory/observe/signals/capabilities/evidence`); cross-domain fusion and contradiction detection; recommendation-only proposals; and **history-aware prioritization** (repeated contradictions boost persistent bottlenecks). Two design choices are memory-relevant: **benchmarks are anchors, not drivers** (strong benchmark evidence coexisting with weak integration is itself a flagged contradiction), and downward guidance is capped (30% maximum influence) so integrative guidance cannot erase domain-local learning. **[D; unit-tested, recommendation-only]**

### 11.7 The corpus as a memory system

The E2 corpus runs its own promotion pipeline: material enters **staged work** by date, receives an **Integration Review**, and is promoted (or not) into `E2Core` by a separate process; consolidated documents carry `parents:` lineage and dated `archive/` snapshots preserve pre-consolidation forms; registry, index, and summary files sit above. "Staged" does not mean "settled." Three statements in the corpus bear directly on the risk that this kind of consolidation hollows what it keeps:

- PAME v0.2 closes with: *"A consolidation is itself a compression; if the source documents cannot be recovered from this one where it matters, file that against the editor."*
- *What This Work Is For*: each consolidation "made something available for further thought. It also risked concealing distinctions that had been visible in the longer route"; the work requires "preserv[ing] access to what a summary leaves behind."
- The Human Remembrance document names the anti-hollowing function: can this abstraction still lead back to the reality it compresses?

**Reading:** the invertibility invariant (§9.4) is the corpus's own answer to whether its consolidations are trustworthy. A consolidated node should be judged by whether its parent structure is recoverable from it.

---

## 12. Evidence ledger

What is actually supported, and under what conditions. Ordered roughly by how far each can be trusted.

| Claim | Status | Conditions / caveats |
|---|---|---|
| Carried-over maintained structure speeds adaptation on related tasks | **Supported [S]** | CVT-1 synthetic tasks; A→B ≈10.5 vs cold 3.9 exact over 12 seeds; direction asymmetric. |
| Cross-session handoff is the largest single lever | **Supported [S]** | Phase 7 synthetic environment; 3 seeds; cold-start tax ≈20–30% of a 50-cycle session. |
| Memory is a net loss below a resource floor | **Supported [S]** | Phase 7 only; wall ≈2.5–3.0 ATP; swept before cross-session consolidation; hand-set costs. |
| Stale context-bound memory harms transfer; scrubbing it recovers | **Supported [S]** | B→C, 3 seeds; one of the clearest effects in the set. |
| Latent context transfers more safely than visible | **Supported, regime-dependent [S]** | Reverses on C-family ambiguity lane (one seed). |
| Morphogenesis helps where routing headroom is large | **Supported [S]** | Topology-size threshold; harmful on small topologies. |
| No catastrophic forgetting across A→B→C | **Supported [S]** | 3-task chain on a fixed small benchmark. |
| Substrate outperforms baseline on coherence (+14.5%) | **Supported but narrow [S, !]** | Synthetic 6-channel environment, 3 seeds. |
| Latent approach ≈8–9× more sample-efficient than online RNN | **Suggestive [S, !]** | Synthetic task; predict-then-update harness; not a general claim. |
| Near-MLP performance on occupancy | **Overstated in first framing [!]** | Dataset is *synthetic room-occupancy*, not external real-world; MLP and REAL use different split protocols; 3-seed mean warm F1 ≈0.936 (0.952 is best seed); efficiency ratio 0.9915 means near parity, not a warm advantage. V1 harness bug (feedback suppressed in eval) had produced F1 0.032 before repair. |
| Laminated regulation reaches criterion more often | **Suggestive [S, !]** | Single seed vs multi-seed single-pass means; C3S4 and B2S6 remain hard. |
| Prediction/anticipation adds value | **Not established [!]** | Weak measured influence at tested session lengths. |
| Interior "generative window" (moderate capacity best) | **Falsified [R]** | PAME R3; abundance beat moderate in 24/24 groups; scoped to that apparatus. |
| Reshape-rate wall under delay | **Falsified for this apparatus [R]** | PAME R1; staleness appeared, collapse did not. |
| Spatial substrate gives stronger specialization than matched control | **Inconclusive [R]** | PAME R4; 69/108 positive pairs against an 81 support threshold. |
| Recoverability above nulls predicts performance | **Partial, development-only [S]** | M9.0–9.2 single authored fixture; relation to post-shift performance not robust. |
| "Prompt language substitutes for substrate" | **Contradicted [S, small]** | Prompt-only runs cost more, changed little, sometimes degraded. |
| REAL v1 developmental arc (reflexivity 0.567→0.857, GCO-STABLE 0→50 cycles) | **Observed, single agent [S, !]** | One hardware-embedded agent, ~20 sessions / ~1,500 cycles; no control. |
| Trail-following and cooperation emerge via stigmergy (EE) | **Observed [S]** | Also observed: frozen strategies, reward hacking, 64.6% of weights collapsed in 4-agent runs. |
| Sub-threshold persistence: memoryless is optimal below threshold | **Unverified anchor [T, !]** | Flagged in source as needing primary-source check. |
| Everything in CCS/CRS, AAF, Persistence, Condition, Clock Ratio, Custody | **Theory [T]** | Preliminary tests discriminate schemas (e.g., 16/16 designed expectations) and do not show empirical adequacy. |

### Recurring caveats worth stating once

- **Authored environments.** PAME's own documents stress this most rigorously: deterministic replay proves reproducibility, not realism; results are Tier-1 simulation. Evidence does not silently promote between strata (interpretation → authored prior → simulation → fitted surrogate → real agent → physical).
- **Symbolic ATP.** The ALife reviews rightly noted that hand-tuned scalar ATP is a controllable viability currency, not physically grounded cost.
- **"No credit assignment" is too strong.** What the system has is path-local, success-conditioned feedback that writes into substrate, which is a credit-assignment mechanism — local, sparse, non-gradient.
- **Small seed counts** (3–5 typical for the headline transfer results).

---

## 13. Tensions and open questions

These are the places where the material disagrees with itself, or where an answer would change how memory should be designed.

1. **Floor versus window.** Phase 7 and TCL say too little capacity makes memory a net loss and entrenchment kills cycling; R3 says more capacity keeps helping. Is there a real interior optimum anywhere, or only a floor and a ceiling on entrenchment? (§5.3)
2. **Entrenchment versus stability.** The same property — strong commitment, deep basin — is what makes memory work (bistability), what makes transfer fail (sticky trap), and what TCL identifies as the killer of adaptive cycling. The workspace has mechanisms to soften it (contradiction debt, decay, scrubbing) but no account of how much entrenchment is the right amount.
3. **Fixed or learned consolidation.** Attractor/surprise/boundary ratios are fixed parameters; "consolidation policy learning" is listed as a next step and was not reached. Is the ratio itself something the system should tune by transfer outcome?
4. **Local coherence as a misleading signal.** Nodes can be locally coherent while the network fails. What does a memory system use as its *honest* second-order signal of its own degradation? Phase 7's own plan named this as the missing P6 handle on the memory layer; the laminated asymmetry features are a partial answer for one failure type.
5. **Consistency versus diversity.** Memory that changes behavior moved consistency-rewarding and diversity-rewarding dimensions in opposite directions. A scorer that "rewards adaptive flexibility rather than trend consistency" was proposed and not built.
6. **Who pays for maintenance.** Persistence-as-stance-with says maintenance can be displaced across layers and parties; the PAME reserve is a single shared pool. The workspace has a vocabulary for displaced cost but no experiment where the payer is a different entity from the beneficiary.
7. **Is "memory as constraint" distinguishable from learned parameters?** The ALife reviewers pressed on this. The working answer is structural: durable learning is written into *cost, access, and reachable state* with explicit maintenance and decay, not into an opaque weight, and the comparison to gradient methods is on sample efficiency and transfer. That answer is asserted more often than it is tested head-to-head.
8. **Context commitment timing.** Fast commitment helps cold start; slow commitment helps transfer; the split-regime fix is a patch. Is there a principled signal for "how much evidence should the current context commitment require"?
9. **The position of the corpus's own summaries.** Consolidated nodes are compressions. The invertibility test is stated for agents, messages, and infrastructure; it has not been applied to the framework's own consolidation pass.
10. **Information versus constraint versus memory.** The cellular-memory note leaves open when each term should be used. The working resolution is functional (constraint for mechanics, memory for what it does at higher levels), but it is a P5-type boundary that may not be fully decidable from inside the system.

---

## 14. Portable pattern catalogue

Short statements, each usable outside this workspace. Ordered from foundational to operational. Source pointers are to sections of this document.

### Foundations
1. **Test memory by what it changes, not what it retrieves.** If history does not alter cost, access, or reachable state, it is an archive. (§2, §6)
2. **Require a maintenance cost.** Free persistence is storage. The cost is also what lets a system discover what is worth keeping. (§2, §5)
3. **Require a speed differential.** At least two coupled layers at different clock rates; a single layer cannot be laminated. (§2, §10)
4. **Ask which layer owns each function.** "Changes preference within options" (structural) and "changes the options" (infrastructural) are different memories with different risks. (§3.2)
5. **Put memory where its timescale already lives.** Code, config, database, in-memory, and in-flight state are a natural ladder. (§3.3)
6. **Check the world for memory before adding any to the agent.** Trails, hysteresis, and fertility are memory. (§3.5)

### Formation
7. **Keep attractors, surprises, and boundaries**, not the top-N. (§4.1)
8. **Consolidate by promotion**: only patterns that keep being recognized and maintained become structure; others fade. (§4.2)
9. **Enforce diversity in what you keep**, or the memory fills with one good idea repeated. (§4.2)
10. **Instrument before optimizing consolidation.** Derive the policy from logged outcomes. (§4.1)
11. **Invest in the handoff.** Cold-start cost is usually larger than any in-session gain you will find. (§4.3)
12. **Persist interpretive equipment; reset work product.** (§4.6)
13. **Do not hard-code what the system should learn to value.** Hidden scripted maintenance hides whether the mechanism works. (§4.4)

### Cost
14. **Price memory and report the wall.** Know the budget below which infrastructure is a liability, and make the agent budget-aware there. (§5.1)
15. **A cost the task cannot exercise is unidentifiable**; report it, don't fit it. (§5.2)
16. **Distinguish floor, window, and entrenchment** when someone says "scarcity helps." (§5.3)

### Context
17. **Do not weld memory to an explicit context label** unless you will keep the label. Bind to evidence of context, carry the binding loosely, and scrub context-bound structure before transfer. (§7.1, §7.2)
18. **Shared structure transfers; changed structure drags.** Separate task-agnostic support (edges) from context-bound support (actions). (§7.2)
19. **Watch the worst context, not the aggregate.** Aggregate accuracy can hide a dead branch. (§7.3)
20. **Return "unresolved" instead of guessing** below a resolution floor. (§7.5)
21. **A claim carries its trace**: referent, position, resolution, evidence, time state, and a re-localization trigger. (§7.5)
22. **A summary must not claim more than it resolved.** Keep conclusions attached to the caveats that license them. (§7.3, §7.5)

### Maintenance and failure
23. **Plan for staleness.** Give every stored item provenance, a last-validated time, a decay rule, and a retirement trigger. Let local contradictory evidence discount it. (§9.3)
24. **Stale warm memory can be worse than none.** Guard with divergence between live outcomes and the expectation that justified the memory. (§9.2)
25. **Measure recoverability against nulls.** "It remembers something" means nothing without shuffled ghosts to compare to. (§9.4)
26. **When memory seems to fail, locate the layer that lost it** before adding more memory. (§10.2)

### Regulation
27. **Slow layers see summaries, emit tilt, and never solve the task.** If the slice cannot be summarized compactly, it is too large. (§10.1)
28. **Separate request from authorization.** Local pressure requests; the slower layer adjudicates. (§10.2)
29. **Test for real slowness**: stable across several fast cycles *and* able to adapt before harm. Latency alone is not a slow layer. (§10.3)
30. **Breathe.** Cycle explore, trace, review, integrate. Unread traces and overloaded reviewers are states the system should be able to name. (§11.4)

### Building and keeping it
31. **Promote decisions into enforced structure** (tests, types, lints), not into reminders. (§11.1, §11.3)
32. **Trace the why, with a timestamp and model attribution**, including failed hypotheses. Index the traces and use the index first. (§11.1)
33. **Bind evidence to the implementation that produced it**, and freeze predictions before running them. (§11.2)
34. **Treat consolidation of your own documents as lossy**, and test whether the parents are recoverable. (§11.7)

### If applied to an LLM-agent memory system (*Reading*, not a finding)

The workspace never built this directly, but its evidence suggests:

- Keep **persistent notes outside the context window** and make them *enforceable* where possible (checks, hooks, tests), not merely present.
- Store the *why and the conditions* of each fact, with a last-verified date; treat recalled items as background to check, not instructions.
- Distinguish **what the agent may tilt** (preferences, priorities, phrasing) from **what it may reshape** (its own mandate, tools, stored rules), and require slower authorization for the latter.
- Consolidate by **promotion with pruning of the stale**, not by appending; include a periodic pass that merges duplicates and retires items whose referents have moved.
- Prefer **summary-level handoff between sessions** that carries what reduces cold-start cost and leaves behind context-bound specifics that could poison a new task.
- Expect **prompting alone to be a weak substrate**.

---

## 15. Source map

Paths are relative to the E2 root.

**Origin and theory of memory**
- `Phase 2/Phase 7/cellular memory.md`, `memory substrate plan.md`
- `Phase 2/Phase 4/docs/phase_4_5_memory_revision.md`, `20260315 - Phase 4.5 Memory Update.md`
- `Phase 2/learning algorithm.md` (formal REAL spec), `Phase 2/PROGRESS.md`, `Progress_Phase 3.md`
- `REAL-Neural-Substrate/REAL Core Patterns - Extracted Protocol.md`

**Evidence for maintained memory and its cost**
- `Phase 2/Phase 7/Phase 7 Full Report.md`, `Layer 2 Report.md`, `ATP Budget Report.md`

**Context, transfer, and native substrate**
- `Phase 2/Phase 8/AGENTS.md`, `vision.md`, `operational_orientation.md`, `first_computational_experiment_spec.md`
- `Phase 2/Phase 8/docs/20260317_phase8_session_synthesis.md`, `project_overview_cross_phase.md`
- `Phase 2/Phase 8/slow_layer/20260316_H_c_consolidation*.md`
- `REAL-Neural-Substrate/docs/reports/SYNTHESIS.md`, `lamination_vs_original_comparison.md`
- `REAL-Neural-Substrate/docs/summaries/20260324_cross_family_scale_summary.md`
- `REAL-Neural-Substrate/docs/traces/2026-03-24 1033 - B to C Carryover Bridge.md`, `2026-03-18 2054 - Runtime Slack Probe.md`, `2026-03-18 2122 - Real Core Anticipation Proposal.md`

**Lamination and the slow layer**
- `REAL-Neural-Substrate/docs/temporally_laminated_real_v0.md`
- `REAL-Neural-Substrate/docs/traces/2026-03-26 1430 - Laminated Growth Continuity Audit.md`, `2026-03-26 1645 - …Context Collapse and Differentiation Reframe.md`, `2026-03-27 1700 - Laminated Trace Sequence Summary.md`
- `REAL-Neural-Substrate/docs/20260330 Redesign.md`
- `Phase 2/Phase 5/README.md`, `20260312 - Update.md`, `plan.md`

**Claims review and honesty**
- `REAL-Neural-Substrate/docs/reports/alife_submission/reviews/review_claims_assessment.md`
- `tmg/cost-aware-poc/prompt_only_results_interpretation.md`

**Ecology and world-side memory**
- `Phase 2/Phase 6/REAL_Integration_Summary.md`, `2026-03-13 - Progress Update.md`
- `Phase 2/Phase 6/EmergenceEngine/docs/architecture/SIGNAL_FIELD_SYSTEM_OVERVIEW.md`, `DECAY_SYSTEM.md`, `tuning/RESOURCE_VITALITY_SYSTEM.md`, `training/analysis/F_vs_R_comparison.md`, `Future Directions.md`, `docs/archive/PROJECT_PROGRESS_OVERVIEW.md`
- `REAL-EE/AGENTS.md`

**Applied / integrative**
- `REAL-Neural-Substrate/docs/traces/2026-04-01 - Trace Organizer Frontier Sense and Slow Layer.md`
- `real_system/docs/traces/2026-04-01 1043 - REAL Integrated System v1 Workspace Native Core.md`
- `tmg/cost_aware_agentic_substrates_proposal_core.md`, `real_system_portability_gap_analysis.md`
- `aegis/aegis_laminated_agent_substrate_synthesis.md`

**PAME**
- `pame/docs/foundation/photonic_adaptive_memory_ecologies_v0_2.md`, `MODEL_BOUNDARIES.md`, `CLAIM_REGISTRY.md`, `PAME_PLAIN_ENGLISH_OVERVIEW.md`, `pame_e2_overlap_inventory.md`
- `pame/docs/status/CURRENT_STATE.md`, `milestones/M7_IMPLEMENTATION_STATUS.md`, `M9_IMPLEMENTATION_STATUS.md`
- `pame/docs/research/r1/R1_PILOT_RESULT_20260903T143321Z.md`, `r3/R3_PILOT_RESULT_20260902T145022Z.md`, `r4/R4_PILOT_RESULT_20260902T045734Z.md`

**E2 framework nodes** (`Phase 1/Core Framework/E2Core/`)
- `Semantic Substrate/`: `Persistence as Accumulated Stance-With.md`, `Condition as Typed Terrain.md`, `Slow-Layer Clock Ratio.md`, `Context Layer Protocol (CLP).md`, `Relational Localization.md`, `Consequence Routing.md`, `Asymmetry Maintenance.md`, `Attentional Access and Formation.md`, `Collective Cognitive Substrate.md`, `Collective Relational Substrate.md`, `Temporal Constraint Lamination - What We Found.md`
- Top level: `E² as a Translation Architecture for Human Remembrance.md`, `What This Work Is For.md`
- Staged: `staged work/20260910-conceptual-development/sub_threshold_persistence.md`, `staged work/20260807/session_synthesis_self_report_substrate_v0_1.md`
- ORMD: `Phase 1/github_repos/ormd/ormd/planning/design_philosophy.md`

---

*Compiled 2026-09-30. A consolidation is itself a compression: where a claim here matters, go to the cited source, since this document omits most of the experimental detail and every caveat that did not fit.*
