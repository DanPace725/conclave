# Conclave direction

2026-10-03. This replaces the gates in [REORIENTATION.md](REORIENTATION.md) §6–§8. That document remains the record of the cost analysis, its findings still stand. Its gates and working rules no longer apply. Read this one at the start of a Conclave or Converse session instead.

## Where we are

The MVP is done. Treat these as settled and don't re-litigate them each session:

- **Persistent trajectory, mutable context works.** Across 11 real conversations the working context is about 67% smaller than full history, with lineage, retrieval, state and exports intact.
- **It does the thing on real work.** In the paired document/tool task (2026-10-02 diagnostic), layered beat harness append for both models: Sonnet 5.5 $0.147 vs $0.180, Luna frozen about $0.003–0.005 vs $0.004–0.007. All runs kept the 12-tonne correction, the inputs, the rounded results and the caveats.
- **A cheap model can do the work.** Luna completed the same task correctly for roughly **1/30–1/50 of Sonnet's cost**. In the capabilities conversation, Luna did the work and Sol and Claude checked it; the math held. That's the most important result so far, and it was easy to miss under the cost-vs-cached-append analysis.
- **The weak spot is known.** On ordinary short chat with a frontier model and warm caches, Conclave is roughly cost-neutral. Context reduction only pays clearly when a lot of material builds up (documents, tool output, long runs) or when the context window is the limit.

There will always be caveats. Note them once, briefly, and keep building.

## What's still on the table

Deferred over the last three days, grouped by what they would do for a user:

| Theme | Items | Status |
|---|---|---|
| Reach | Other providers (Gemini, OpenAI-compatible/open models, local models) | Deferred since the MVP. Context/Agent currently only reaches `api.openai.com` and `api.anthropic.com` |
| Continuity | Cross-conversation memory, user-approved and source-linked | Roadmap item 7 |
| Knowing things | Web search; better retrieval (exact phrase, filters); embeddings | Roadmap items 5, 6, 8 |
| Division of labor | Cheap model consulting a stronger one; Jev as a tool the model calls itself (the "hybrid" idea in [Next steps](Next%20steps.md)) | Never started |
| Doing things | E2B sandbox, unattended runs, model workspaces | Design only |
| Economics | Economic management trigger instead of 75% of budget | Deferred until the price report was trusted |
| Housekeeping | Standalone CLI has fallen far behind Converse's `lib/conclave` | Every change is maintained twice or drifts |

## Trajectory

The project started as "save tokens on frontier models." The data pushed back on that framing: with prompt caching, a frontier model rereading its own history is cheap, so trimming it barely moves the bill. Conclave's clear wins come from somewhere else: a bounded, recoverable context lets a **small or cheap model** sustain work it couldn't otherwise hold, and it keeps document- and tool-heavy runs from snowballing.

That's the same as the owner's goal: useful AI for people who can't pay for the top tiers or don't have the hardware. Conclave should be judged as a **capability amplifier for constrained models**, not as a discount on expensive ones. Reorientation Phase 4 asked us to choose between "cost play" and "capacity play." This is that choice: capacity, for cheap and constrained models, with cost savings as a side effect.

## The move: run Conclave on cheap and open models

Do this next. It makes the system much more useful, not marginally.

1. **One OpenAI-compatible Chat Completions adapter** in `lib/conclave/provider.js`, configured by base URL, key and model. That one adapter reaches OpenRouter (including free and very cheap models), Gemini's OpenAI-compatible endpoint, DeepSeek, Groq, Together, and local Ollama / LM Studio / llama.cpp through Converse's local server. Tool calls map onto the existing tool loop. Usage is whatever the provider reports, with unknowns left unknown, as the report already does.
2. **A "lite" profile for small models**, chosen per model:
   - Smaller tool set: search/retrieve, read/write file, calculate, update_state. The harness and Jev handle offload/compaction deterministically; the small model doesn't have to drive context editing.
   - A short system prompt. With tool schemas, a minimal request is already about 3K tokens before any conversation. The instructions are densely hedged. That's expensive on every call and too much for a small model to follow well.
   - A budget set from the model's real context window (8K–128K) rather than the 256K web default. This is where the projection stops being an optimization and becomes the thing that makes long conversations possible.
3. **Expose it in Converse's model picker** as an "Open / custom" provider, so the owner can try real conversations on it right away.

**Done means:** a long Context conversation and one Agent task run end to end on a cheap or open model through Converse, and the result is useful. A normal hands-on conversation is enough evidence. No paired benchmark is required.

## After that, in order

1. **Ask a stronger model.** An `ask_expert` tool lets the cheap model send a Conclave-built compact packet (relevant state, excerpts, the question) to a stronger model for one bounded answer or review. The owner already works this way by hand: Luna works, Sol checks. This makes it automatic and cheap, because the packet is small. Conclave's core skill, building a small faithful context, is exactly what the consult needs.
2. **Cross-conversation memory.** User-approved, source-linked entries built on the existing named state. Continuity across chats is the most noticeable feature for a daily user.
3. **Web search.** Cheap models know less, so read-only search with sources matters more for them than for frontier models.

## Housekeeping (small, do it alongside)

- **One engine.** Treat Converse's `lib/conclave` as canonical. Freeze the standalone CLI as the original prototype, or make it import Converse's engine. Stop porting changes in both directions.
- **Trim the model-facing prompt** for all models, not just lite: say what to do, drop repeated disclaimers. The assistant's replies currently mirror the hedging, which costs output tokens and reads poorly.

## Working rules (replaces REORIENTATION §8)

1. **Build toward usefulness.** A change is done when it works in Converse and is noticeably doing what it's meant to do in real use.
2. **Tests guard, they don't gate.** Keep existing tests green and add focused tests for new code. Don't add paired comparisons, benchmarks, calibration replays or evidence passes unless a specific decision is waiting on the answer.
3. **Instrumentation stays and isn't a gate.** Exports, the cost report and the Garden comparison are there to look at when something seems off.
4. **Caveats once.** State a real limitation in one line where it matters. Don't restate settled findings, and keep session reports short: what changed, what to try, anything broken.
5. **Non-negotiables:** don't lose source history, lineage or exports; don't weaken pins, named state or current-request protection; don't silently drop user constraints. Everything else can change.
6. **Prefer removing to adding** when a mechanism isn't pulling its weight. Mechanisms that add calls per turn need a reason, not a study.
7. **Prefix stability is an engineering guideline.** Keep stable content first when it's easy; it isn't a gate.
