# Context and memory management: how the code works

2026-10-04. This describes the context-management and memory-management algorithms as they are implemented on `main` at `68ebfb5`, read from the source rather than from the design notes. It covers the six commits from 2026-10-03:

| Commit | Change |
|---|---|
| `3c8a1af` | Price context actions locally; stop periodic selector calls |
| `76bb759` | Reconcile cost forecasts with reported usage; cache tracing; bounded live trials |
| `6d8c9db` | Source-grounded automatic conversation memory |
| `626f1f1` | Memory dependency closure; duplicate correction heads |
| `41dfe2d` | Quoted and suppressed sources stay behind memory authority gates |
| `68ebfb5` | Memory correction targeting; named-state retirement; lifecycle receipts |

Main files: `src/harness.js`, `src/attention.js`, `src/economics.js`, `src/cache-trace.js`, `src/memory.js`, `src/memory-extractor.js`, `src/memory-controller.js`, `src/state.js`.

**How this was checked.** Every rule below was read from the source. The five related test files (`automatic-memory`, `memory-priority`, `converse-economic-actions`, `shadow-reconciliation`, `context-cost-trial`) pass: 49 tests, no failures. A short probe script also ran sample messages through `captureMemory` to confirm the capture rules. Its results are in [Observations](#observations-from-running-the-code), including two places where the code differs from `docs/AUTOMATIC_MEMORY.md`.

---

## Where each piece runs in a turn

`Harness.ask()` drives one user turn. In order:

1. **Log the message.** `addMessage('user')` appends the event and commits a new context revision with the message as a segment.
2. **Retry an earlier memory capture** if a previous attempt failed with a retryable error and has had fewer than three attempts.
3. **Capture memory** from the new message (`captureMemory`).
4. **Activate memory**: select which memory records go into requests this turn and log a `memory_activation` event (`activateMemory`).
5. **Review context** (`reviewContext`):
   1. price possible context actions in shadow mode (`evaluateShadow`);
   2. run `compact()`, which does nothing unless the request is over 75% of the byte guard.
6. **Answer loop**, up to `maxCalls` rounds:
   - Before each round after the first, review context again. This only happens when the projection is not frozen. The Converse service default is `freezeProjection: true`, so there it runs once per turn.
   - Build the request.
   - Fit tool exchanges, with budget recovery if needed.
   - Call the model. Each answer request is linked to its cost estimate, and the reported usage is reconciled afterwards.
   - Execute any tool calls.
7. **Save the reply** and log `turn_complete`.

Library defaults are a 24,000-byte guard, 4,096 output, four recent segments and `reviewTokens: 10000`. The Converse service overrides these with a 256,000-byte guard, 16,384 output, Jev on and a frozen projection (`src/service.js`).

---

## Part 1: Context management

### 1.1 How the request is laid out

`Harness.input()` turns the current projection into model input. In layered mode:

1. Drop superseded named-state entries, and any segment whose sources are suppressed, superseded or invalidated memory sources (see 2.6).
2. Split the remaining segments into three groups:
   - **settled**: named state, pins and verbatim segments;
   - **older**: everything else outside the recent window;
   - **tail**: everything else inside the last `recent` segments.
3. Emit:
   - one `Working context:` message containing settled + older;
   - a separate `Recent context tail:` message;
   - after the tail, the revision number, the list of protected segments and pointers to recent reasoning summaries.
4. For Anthropic, mark the settled message as a cache boundary (`cache_boundary: 'settled'`). This only happens when the last eight answer responses for that model report more cache writes than reads (`observedCache(...).boundary === 'settled-prefix'`).
5. If automatic memory is on, put a `Conversation memory:` message first, holding the records chosen by `selectMemory` (see 2.5).

Stable material comes first, so the reusable prefix survives turn-to-turn changes in the tail. Cache residency is never assumed (see 1.5).

### 1.2 Retention plan (`attention.js`, `attention-v1`)

`retentionPlan()` gives every segment a protection flag and a priority from 0 to 4. A segment is **protected** when it is:

- pinned;
- marked verbatim;
- named state;
- the current request or another explicitly protected ID;
- one of the last `recent` segments.

The harness also adds anything `contextEligibility()` reports as protected.

| Priority | Segment |
|---:|---|
| 4 | Protected |
| 3 | Objective, constraint, decision or question type; or status `unresolved`; or shares at least one term with the current query (first 12 distinct terms) |
| 2 | Summary |
| 1 | Other older working material |
| 0 | Superseded |

When `force` is set, or the measured request (payload + output reserve + tool reserve) is at least 75% of the budget, unprotected non-reference segments are walked lowest priority first, then oldest first (`policy: legacy` keeps chronological order). Each segment is either:

- added to the **compaction batch** while the batch stays within 45% of the budget; or
- if it doesn't fit and its content is over 1,000 bytes, marked **offload** (to be replaced by a pointer).

A pointer (`referenceFor`) holds the type, status, original segment reference, source IDs and the first 160 characters of the text. Its wording states that the excerpt is not a summary and that `resolve_context` recovers the full text.

### 1.3 The `compact()` ladder

`compact()` runs at most `compactAttempts` (default 3) times per call and stops at the first step that returns:

1. **Pressure check.** If the request is under 75% of the budget, return `not_needed`. This doesn't apply when forced or reviewing; `reviewContext` now always passes `review = false`.
2. **Deterministic retention plan** (1.2).
3. **Lossless pointers before any paid call.** A segment is "routine" if it is in the batch or offload list, has priority ≤ 1, isn't unresolved, and its pointer would be under half its size. If any routine segments exist (and the call isn't forced), offload all of them, log `attention_decision` with strategy `lossless-before-selection`, and **return** `offloaded`.
   - This step returns even if the request is still over 75%. The next check is at the next review point; the answer path still has its own budget recovery (`budget_recovery`).
   - `3c8a1af` moved this step ahead of Jev. Before that it ran after selection.
4. **Bounded selection (Jev or the OpenAI selector).** Runs only when all of these hold: a decision adapter is configured, it hasn't been used yet in this `compact()` call, and the batch and offload candidates hold at least 1,000 bytes of content.
   - `selectionPlan()` first looks for an earlier `decision_proposal` with the same cache key and reuses it (unless forced). The key covers the policy, adapter and options, the query, and each segment's ID, content hash, status and protection.
   - Bundles the selector says to retain or escalate are protected for the rest of the call.
   - An offload that wouldn't shrink its bundle is turned into retain.
   - Compact choices fill a new batch (45% cap), lowest priority first.
   - If the revision changes during the call, or the call fails, Conclave falls back to the deterministic plan and logs `decision_rejection`.
5. **Apply offloads** chosen by the selector. Return `offloaded` if the request is now under 75%.
6. **Compaction batch.** Log `attention_decision`. Then return without rewriting if any of these hold:
   - the batch is empty (`no_change`);
   - it holds under 1,000 content bytes (`skipped`);
   - even an empty, source-linked summary couldn't reduce the projection by 15% (`skipped`, preflight);
   - the same batch already failed the 15% test (`skipped`; `/compact` retries it);
   - a paid compaction call has already happened since the latest user message. That limit is one per turn; forced compaction bypasses it.
7. **Semantic rewrite.** The main model receives `compactionPayload()`, a strict JSON schema plus attributed segments. The result must cite exactly the same set of source events as the inputs, no more and no fewer. It's committed only if the projection shrinks by at least 15%. Otherwise it's logged as `context_skip`.

A forced call (`/compact`) skips the pressure check and the lossless step, and returns after one rewrite.

### 1.4 What changed in `3c8a1af`

- **Periodic reviews are local.** `reviewContext` still works out whether a periodic review is due: cumulative reported answer input since the last `context_review` ≥ `reviewTokens`, or, for the first review, a local estimate or cumulative input ≥ `reviewTokens`. "Due" now only decides whether a `context_review` event is logged. It no longer starts a paid selector call. Paid selection now happens only under budget pressure.
- **Routine material becomes pointers before anything is paid for** (step 3 above).
- **Every review prices the alternatives in shadow mode** (1.5) and passes that evaluation to `compact()`. `economics.due` is always `false`, so the evaluation never forces an action.

### 1.5 Shadow cost controller (`economics.js`, `action-next-request-shadow-v3`)

At each review, `evaluateShadow()` estimates what the next answer request would cost under each of these options:

- keep the context as it is;
- swap one routine bundle for a pointer;
- swap all of them for pointers;
- summarise the compaction batch.

The result is only logged. It never changes context.

**Candidates** (`contextCostCandidates`). These are built from a forced retention plan:

- **Pointer candidates.** One for each unprotected, non-reference, non-unresolved bundle with priority ≤ 1 (at most six), plus one combining all of them if there are two or more.
  - Request tokens: the hypothetical next request is fully serialised and tokenised locally (`o200k_base`).
  - Recovery tokens: 0 up to the tokenised size of the whole batch, covering anywhere from no retrieval to one full retrieval.
  - Feasible only if the pointers actually shrink the projection.
- **Summary candidate.** One, for the batch from 1.2.
  - Request tokens: from the request with an empty summary, up to that plus twice the configured output.
  - Management cost: the real compaction request (input tokens + maximum output).
  - Recovery tokens: as for pointers.
  - Feasible only if the batch holds ≥ 1,000 content bytes, the compaction request fits the byte guard, and an empty summary would cut the projection by ≥ 15%.

**Pricing** (`managementEconomics`). Rates come from `resources/model-costs-2026-10-02.json`.

- **Keep.** The current request tokens priced at:
  - the cache-read rate if the cache state is warm;
  - the cache-write rate if cold;
  - if unknown, an interval from the cheapest of read/input/write up to the full input or write rate (reads are allowed only on a documented reusable prefix).
- **Long-context rates.** Where they exist, they're chosen by threshold; with no threshold, both rate tiers are included as an interval.
- **Each feasible candidate** gets an interval:
  - **low end:** the minimum request tokens at the cheapest input rate, plus the minimum recovery tokens at the cached rate;
  - **high end:** the maximum request tokens at the full input or write rate (any edit is assumed to break the cache unless a reusable prefix is supplied, and the candidates supply none), plus the maximum recovery tokens at the highest input or write rate, plus the compaction call's cost for summaries.
- **Saving** = keep cost − candidate cost, also as an interval.
- **Shadow choice.** The candidate with the lowest worst-case cost among those whose *minimum* saving is positive, meaning cheaper even in the worst case. If none qualifies, the choice is `keep`.
- **Not counted:** answer-output differences, extra answer calls caused by retrieval, quality, latency, retries.

The evaluation also has guards and caching:

- **Guards.** If the native request is over 512,000 bytes, or the evaluation passes 200 ms at a cooperative checkpoint, the result is logged as `unavailable` with `fallback_action: keep`. One synchronous tokenizer call can still run over. Errors never block the answer.
- **Caching.** An earlier complete `context_economics` result is reused when the request fingerprint, segments, protections, reserve, revision, budget, output, recent window, mode, previous request and TTL phase all match.
- **Profiling.** Each evaluation records calls/time for history loading, payload construction, candidate selection, tokenization, cache tracing and pricing, with the last/failing stage and native-input size. A read cache exists only inside that evaluation, is invalidated by writes, and is discarded on exit. `read_telemetry.shadow_performance` aggregates the last 30 instrumented evaluations. `scripts/profile-shadow.js` replays a bounded sample of export prefixes locally without provider calls. One synchronous stage can still overrun the cooperative limit.

**Cache trace** (`cache-trace.js`). This splits the native request into logical units (settings, instructions or system blocks, messages or content blocks) and compares them with the previous answer request for the same provider and model. It records:

- how many leading units are identical;
- the last identical unit that is a valid cache breakpoint;
- the hash and local token count of that prefix;
- the previous request's age against the default TTL (5 minutes for Anthropic, 30 minutes for `gpt-6` models).

The output states that matching content and age don't establish cache residency.

**Reconciliation** (`reconcileEconomics`). After each answer response, including partial ones:

1. The reported input and cache usage is priced, with output cost excluded.
2. If the request's native-input fingerprint matches the one the estimate was made for, the actual cost is compared with the predicted keep cost.
3. Otherwise the saving is recorded as unmeasured.

The result is saved as `context_cost_reconciliation` and is visible through `read_telemetry`.

### 1.6 Delegation cost gate (used by the newer code, predates these commits)

`delegationCost()` decides whether a bounded Jev call is worth it, using an upper bound on the selector's cost (its byte budget treated as input tokens, plus its output allowance). It's used for:

- **Document ingress classification.** Only for documents of at least 8,000 characters that have a focus.
- **Search reranking.** Only when there are more than four candidates and the top two match equally well.

The call goes ahead only if the estimated saving, `avoidedTokens × task input rate` (the cached rate when reads have outnumbered writes), is more than 1.25 × the selector's worst-case cost. A Jev result that is cached under the same key is reused.

---

## Part 2: Automatic memory

### 2.1 Storage

Memory is an **event-sourced ledger**, kept separate from context snapshots.

- **Events.** Every change is a `memory_delta` event: new `records` plus `changes` to existing records. `memoryView()` replays them in order, and each delta raises the memory revision by one. Writes must supply the current revision, or they fail with 409.
- **Restore and compaction can't undo memory.** Restoring or compacting a context snapshot can't bring back a superseded record or undo a suppression.

**Record fields** (`memory-record-v1`):

- **Identity:** `memory_id`, `version`, `canonical_key`, `idempotency_key`.
- **Content:** `kind` (commitment, preference, claim or question) and `content`, the exact source span with no rewording.
- **Provenance:**
  - `source_refs`: event ID, content and span hashes, UTF-16 offsets;
  - `attribution`.
- **Authority and state:** `authority`, `resolution`, `lifecycle`, `binding`, and `confidence: null`. Confidence is always null.
- **Relations:** `conflicts_with`, `supersedes`, `depends_on`, `target_slot` (budget records).
- **Scope:** the conversation; for Agent runs, also the objective event.

**Invalidation on replay.** A record becomes `invalidated` if any of its sources:

- is missing or removed;
- was revised by a later user message;
- is a workspace file that is no longer the latest version.

This propagates transitively: anything that `depends_on` an invalidated, suppressed or superseded record is invalidated too.

### 2.2 Deterministic capture (`memory-extractor.js`, `conversation-memory-v2`)

Capture reads only human user messages and Agent objectives, not manual-state entries.

1. **Mask quoted material** (`captureText`). Code fences, inline code, straight and curly quotes, single-quoted strings (not contractions) and `>` blockquotes are replaced with spaces. Character positions don't move, so UTF-16 offsets into the original stay exact.
2. **Split into clauses.** Splits happen at newlines, `!`, `?` and `.`, except a period between two digits. Two kinds of clause are skipped:
   - any clause where masking changed the text;
   - any clause containing a reporting word: says, said, suggests, recommended, example or quote.
3. **Strip correction prefixes** (`correction:`, `actually,`, `instead:`, `update:`) and classify:
   - **Binding commitment.** Nothing masked, no tentative word (maybe, perhaps, might, could, consider, hypothetical, suppose, what if, …), no reporting word, and the clause starts with a directive. Directives: keep, do not, don't, never, must, always, only, require, use, avoid, make sure, ensure, remember, my budget/limit/requirement, the budget is/must/should, the limit/requirement is/must, we must/need to/will/decided, I (actually) want/need/require/decided/choose/prefer. An optional `New commitment:` or `please` may come first.
   - **Preference** (not binding). Starts with `I prefer`, `my preference` or `maybe $`, optionally after maybe or perhaps, and didn't qualify as binding.
   - **Claim** (not binding). Had a correction prefix but no directive.
   - Anything else is not captured.
4. **Canonical key.** Lowercase; dollar amounts become `<usd>`; below/under/less than/no more than/at most become `limit`. Records with the same key are treated as the same instruction.
5. **Correction flag.** Set by a correction prefix, `New commitment:`, or a clause starting `I actually want/need`.
6. **Budget slot** (`budgetSlot`). A narrow parser for budget limits and ranges in US dollars. It records:
   - the subject: up to three words + "budget", or `it`;
   - the currency: `usd` or `unspecified`; other units return nothing;
   - any trailing conditions.
7. **Correction peers** (`correctionPeers`). The records a correction can apply to: same canonical key, or a compatible budget slot. Compatible means:
   - the same subject, or `it` pointing at any budget;
   - identical conditions;
   - the same currency, or an unspecified currency correcting a USD record.

`captureMemory` then commits each clause:

- **Correction with exactly one peer:** it supersedes that peer.
- **Correction with several peers:** it becomes a non-binding claim that conflicts with all of them.
- **`it` budget with no currency and no target:** it becomes a claim, so it can't become a new operative budget on its own.

### 2.3 Commit rules (`commitMemory`)

Each proposal is checked, then committed in a single `memory_delta`.

**Checks:**

- **Source.** Must be a user, document or completed assistant message in this conversation. It can't be removed, revised or an old file version.
- **Span.** Must lie inside the source, cover 1–2,000 characters and match any supplied content exactly. Automatic captures from user messages can't include masked (quoted) text.

**Binding:** only a `commitment` from a human user message whose span matches a deterministic explicit commitment exactly (or a manual edit). Any other commitment is rejected.

**Corrections:**

- An automatic correction must target the unique peer in the same scope. A target that's already superseded, suppressed or invalidated is a 409.
- The new record takes `version + 1`, inherits the old one's scope and budget slot, and marks the old record `superseded`.

**Repeats and conflicts:**

- **Exact repeat.** The same human text, kind and key, with no dependencies and no correction, adds a source reference to the existing record. It doesn't create a new record or add support.
- **Same key, different text, no correction.** The new record and the earlier ones are all marked `contested` and linked through `conflicts_with`. A changed number without a correction cue therefore contests the old one instead of replacing it.

**Dependencies:** at most eight, and each must point at a live record.

**Idempotency:** the key is a hash of event, span, content, policy and canonical key. A capture that has already been committed is skipped.

**Authority, resolution and lifecycle** of a new record:

| Source | `authority` | `lifecycle` | `resolution` |
|---|---|---|---|
| Binding human commitment | `user_committed` | `retained` | `reported`, or `contested` if conflicts exist |
| Other human text | `user_reported` | `candidate` | `unresolved` / `contested` |
| Completed assistant reply | `model_proposed` | `candidate` | `unresolved` / `contested` |
| Document | `externally_reported` | `candidate` | `unresolved` / `contested` |

Later lifecycle states: `superseded` (corrected), `suppressed` (user chose "Don't use this"), `invalidated` (source gone or changed). `selectMemory` also filters out a `dormant` state, which nothing currently sets.

### 2.4 Optional model extraction

**When it runs.** All of these must hold:

- `memoryModel` is on (production local and hosted services; off by default in library and injected-provider setups);
- the message produced **no** deterministic captures;
- the message is ≤ 4,000 characters;
- its masked text contains one of: preference, constraint, budget, requirement, remember, correction, decided, decision.

**Limits:**

- one call per turn, shared with retries; a second attempt is logged as `deferred`;
- uses the task model with no tools;
- 12,000-byte request guard, 600 output tokens, 15-second timeout;
- reasoning effort `none` where the model supports it, otherwise `low` (OpenAI);
- shows up as `memory-extraction` in usage.

**Input:** the masked message plus up to four existing live records in the same scope (500 characters each).

**Output:** at most eight `{kind, span_start, span_end}` items, where kind is only preference, claim or question. The schema is checked strictly. Spans that overlap masked text are dropped. The rest go through `commitMemory`. These proposals can never be binding, because commitments aren't in the allowed kinds.

**Failures.** Every attempt logs a `memory_capture` event with status `completed`, `deferred` or `failed`.

- **Configuration errors** (provider 400/401/403/404/422, unsupported model or setting, bad API key) are not retried.
- **Other failures** retry at the next user turn, up to three attempts per source.
- **Stop or abort** passes straight through and doesn't count as a failure.
- **Lasting issues.** Per-source problems remain in `memoryView().capture_issues` (last 20) until resolved.

### 2.5 Selection and placement (`selectMemory`)

**Allowance:** 20% of the request byte guard, clamped to 800–16,000 bytes. That's 4,800 bytes with library defaults and 16,000 in the Converse service.

1. **Eligible** records aren't superseded, invalidated, suppressed or dormant. They're either conversation-scoped, or scoped to the current Agent objective. Records whose dependencies aren't all eligible are dropped repeatedly until nothing changes.
2. **Binding records go first, every time.** All binding records are deduplicated by content and resolution, then expanded to include their dependencies and conflict partners. If that set exceeds the allowance, the request **fails** with a capacity error rather than silently dropping a commitment. Inspection views pass `memoryCapacityInspect` and get the error reported instead.
3. **Optional records** (not binding) are ranked by how many query terms they contain, then by recency. Only records with at least one matching term are considered. Each one is added together with its dependency and conflict closure if the whole cluster fits. The cap is 20 records in total.
4. **What each record carries into the prompt:** id, kind, content, authority, resolution, binding, the latest source reference plus a source count, conflicts, dependencies, scope and `confidence: null`.

`activateMemory` runs the selection once per turn and logs `memory_activation`. `input()` repeats the selection for each request and places the result first (1.1). When the projection is frozen, the first input of the tool loop is reused for the whole turn. The request breakdown shows these bytes under its Memory category.

### 2.6 Suppression and source gating

`suppressedMemorySources()` collects the source events of every suppressed, superseded or invalidated record. It then repeatedly adds events derived from them:

- assistant replies, through `turn_complete` links;
- reasoning, assistant and tool-result events whose `user_event_id`, `revises_event_id` or `source_event_ids` point at an excluded event.

Those sources are then excluded everywhere the model can reach them:

- context projection (segments citing them are dropped);
- `retrieve_event`, `retrieve_range` and `resolve_context`;
- `update_state` sources.

Human inspection and exports still show them. Suppression can be reversed with **Use this again**, unless the record has since been superseded.

### 2.7 Named-state authority gate (`gateStateAuthority`)

This applies when the model calls `update_state`.

**Retiring an entry.** A `superseded` update must:

- target its own entry, with type and content unchanged;
- be backed by the **latest** human message.

That message has to ask for retirement (remove, suppress, forget, retire, get rid of, stop using, don't use) and name a word from the entry. The phrase "all memories" also counts. Requests that mention documents, files, sections or tables don't count. Retiring adds no authority.

**Replacing an active human constraint or decision** is allowed only with the user's exact new wording from a different message. That wording must be:

- a manual edit;
- a revision of the original message; or
- an explicit correction whose single peer is the entry being replaced.

Anything else is rejected with "A model interpretation cannot replace a binding user constraint".

**Constraints citing a binding memory source** must quote the source text exactly.

**Everything else.** A constraint or decision that isn't an exact explicit human commitment is saved as `unresolved`, with a limitation noting that the user hasn't accepted it.

**Tool receipts** report the requested and effective status of each update, and the reason when they differ (`state.js` and `ingress.js`). The model therefore can't assume a key was accepted or retired just because it was updated.

### 2.8 Human edits

Two service operations change memory.

**`saveMemory`** (Memory editor → Edit):

1. Logs a `manual-memory` user event holding the new text.
2. Commits it, with `manual: true`, as the next version of the edited record; the old record is marked superseded.
3. Re-activates memory.

**`memoryLifecycle`** (Don't use this / Use this again) toggles `suppressed` against the record's previous lifecycle. Both operations require the current memory revision.

### 2.9 Model inspection and authorized suppression

`read_memory` pages a unified JSON inspection of automatic and named records, with both independent revisions checked across pages. Unavailable entries retain identifying metadata but omit content. `suppress_memory` checks 1–8 targets against both revisions and the latest human removal request, then atomically suppresses automatic heads and retires named state. It cannot grant authority, rewrite or restore automatic records. Pins/verbatim state remain human-controlled.

Suppression appends a lifecycle audit, refreshes the frozen projection and native continuation, and replaces the caller's retained pending exchanges with a bounded handoff. Earlier inspection/history/file-read receipts cannot be replayed via model retrieval. Named source exclusion persists across working-snapshot restores until a later human named-state edit. The source history and human exports remain complete. See [automatic-memory tool contract](AUTOMATIC_MEMORY.md#inspect-and-edit).

---

## Observations from running the code

A probe sent short sequences of messages through `captureMemory` with the deterministic path only:

| Messages | Result |
|---|---|
| "Keep it below $500." then "Keep it below $700." | Both kept as binding commitments, both `contested`. A new number without a correction cue doesn't replace the old one. |
| "Keep it below $500." then "Correction: keep it below $700." | The $500 record is superseded; the $700 record is version 2. |
| "The budget is under $500." then "I actually want to make it a range, between 400 and 500." | The range supersedes the limit. |
| "Keep the venue budget under $500.", "Keep the food budget under $200.", then "Correction: keep it under $300." | The correction becomes a non-binding claim, and **both** budgets become `contested`. Clarification is now required before either is used for consequential action. |
| "Never charge a fee." twice | One record with two source references. |
| "Maybe we keep it under $300." | Nothing captured. Without a cue word (e.g. "budget") the model extractor isn't called either. |
| "I prefer weekend workshops." | Captured as a **binding** `user_committed` commitment. |

Points worth flagging:

1. **Plain "I prefer …" is binding.** `docs/AUTOMATIC_MEMORY.md` previously said tentative preferences stay unresolved; it now describes this behaviour. In the code, `prefer` is in the directive pattern, so "I prefer X" becomes a binding user commitment. The non-binding preference path only applies when a tentative word disqualifies the binding path first, as in "Maybe I prefer …". If preferences are meant to stay soft, `prefer` should be removed from that pattern.
2. **An ambiguous correction contests every candidate.** Besides the non-binding conflict candidate, every original head it matched becomes `contested`. `docs/AUTOMATIC_MEMORY.md` now says so.
3. **`dormant` is filtered but never assigned.** It looks reserved for future decay or consolidation.
4. **Cost choices are logged, never acted on.** `economics.due` is hard-coded `false`, and the review's "due" flag only controls whether a `context_review` event is logged.
5. **The lossless pointer step ends `compact()` early.** It returns even when the request is still above 75%. Further reduction waits for the next review, or for answer-time budget recovery. With the Converse default `freezeProjection: true` there's one review per turn.
6. **The extraction cue list includes "decided".** `docs/AUTOMATIC_MEMORY.md` now lists it.
7. **Jev's retain/escalate protection now lasts only one `compact()` call.** `ask()` no longer adds `decision_retained_bundle_ids` to the turn's protected IDs; the system prompt calls these recommendations advisory. `docs/JEV_INTEGRATION.md` and the app guide already describe them as advisory. The explainer narration (cue `j5`) said they lasted for the rest of the turn; it has been corrected. In practice an unchanged context reuses the cached proposal, which retains the same bundles again.

## Limits (from the code)

- **No semantic matching.** Corrections are matched by syntactic keys and one narrow dollar-budget parser. Paraphrases of the same instruction don't count as the same instruction, and never add support.
- **Capture is narrow.** It reads human messages and objectives only. The ledger can validate assistant and document reports, but nothing captures them automatically.
- **One scope.** No topic boundaries are inferred within a conversation, and nothing is shared between conversations.
- **Cost estimates are local and shadow-only.** Request size is estimated with the local tokenizer and priced at the dated public rates. Cache hits are never assumed. Recovery costs are bounded but not calibrated.
- **Nothing here measures truth.** Priority, selection order and authority describe retention and instruction status, not factual confidence (`confidence` is always null).
