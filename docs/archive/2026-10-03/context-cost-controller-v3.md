# Context cost controller: reconciliation and bounded trials

2026-10-03. Builds on the [first increment](context-cost-controller.md). Economic choices remain in shadow mode; this does not enable automatic cost-triggered rewrites.

## Implemented

- `cache-trace.js` compares complete logical units of the serialized native request with the previous answer request for the same provider/model. It records eligible prefix candidates, a content hash, local token estimate, request age and default-TTL phase. Matching content and age do not establish provider residency or certify hidden framing, minimum lengths or lookup behavior. Reported read/write buckets establish observed cache usage. Defaults follow [OpenAI caching](https://developers.openai.com/api/docs/guides/prompt-caching) and [Anthropic caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching); no keepalive or expiry-wait calls were introduced.
- Answer requests link to the current user turn's estimate. Completed and partial provider responses receive optional input-cost reconciliation. Only an identical native-input fingerprint permits comparison to the keep estimate. Changed payloads have no counterfactual saving; answer-output cost and tool fees are excluded from this comparison. `read_telemetry` exposes the latest reconciliation.
- Local forecasts are reused only when request, projection/protections, output allowance, budget, policy/pricing and previous-request/TTL phase match. Processing checks a 512,000-byte allowance and a default 200 ms cooperative budget. An individual synchronous tokenizer operation can overrun that time; this is not a hard CPU deadline. Estimator or optional telemetry errors fall back to keep and cannot prevent an answer. Abort and mandatory persistence remain authoritative. Reconciliation avoids a second prefix tokenization.
- `scripts/context-cost-trial.js` prepares without model calls by default. `--live` compares the pinned pre-controller source `90640b66a9c8ece5a636277428e04e994363280c` with current source in separate synthetic conversations. It counterbalances order, counts task/selector/retrieval-triggered calls, saves canonical exports and compares exact fields/source preservation. A hard dispatch allowance, overall/per-call timeout and conservative USD reservation guard bound the run. USD reservation is an estimate, not an invoice guarantee; unknown pricing/usage stops further dispatch. Existing provider credentials are used without exporting them. Models are GPT-6 Luna and Claude Sonnet 5.5, with native Jev when available or a recorded task-provider selector fallback.

Run from the engine repository:

```sh
node scripts/context-cost-trial.js
node scripts/context-cost-trial.js --live --max-calls 48 --max-usd 1
```

## Checks and live evidence

Offline source checks: 187 passes, one optional saved-export replay skipped, no failures. Six runner cases test isolation, fidelity rejection, dispatch/spending/unknown-usage guards, repeated retrieval and the exact baseline loader. Ten reconciliation cases cover cache reuse, estimator failure/allowances, completed/partial usage, changed inputs, optional-log failure, prefix age and authoritative abort. Engine syntax and downstream parity are checked before publishing.

The first live run dispatched 36 calls, valued at $0.267323–$0.274023 using the dated public-rate table. Its original outcomes remain in [initial comparison](context-cost-live-initial.json). Twelve completed non-recovery arms preserved all fixed fields, but the original grader incorrectly required the exact phrase `X changes` rather than equivalent grammatical wording. A later review accepts only five enumerated equivalent phrases and rejects negation, extra conditions or a rejected alternative. The [review record](context-cost-live-review.json) retains both original and revised outcomes, answers, usage and retrieval offsets.

Three recovery arms stopped at the runner's three-answer-call ceiling after reading offsets 0, 1600 and 3200, leaving no call for a final answer. The fourth recovered successfully. This was a bounded-run failure, not evidence of corrupted sources. The revised recovery query requests the evidence page at offset 0 and gives each turn five answer calls; the source text is unchanged. The recovery-only rerun dispatched 18 calls under a 24-call/$0.35 guard. All four arms completed both turns, performed two original-source retrievals and preserved the fixed code, cap, seats and conditional alternative. [Recovery comparison](context-cost-live-recovery.json)

| Completed comparison | Baseline USD | Current USD |
|---|---:|---:|
| Luna warm-cache attempt | 0.001122–0.002227 | 0.001129–0.002238 |
| Luna new-prefix pressure | 0.000656–0.001212 | 0.000560–0.001112 |
| Luna correction | 0.000705–0.001401 | 0.000704–0.001400 |
| Sonnet warm-cache attempt | 0.036956 | 0.040486 |
| Sonnet new-prefix pressure | 0.022577 | 0.022493 |
| Sonnet correction | 0.026503 | 0.026493 |
| Luna revised recovery | 0.001252–0.002376 | 0.001303–0.002562 |
| Sonnet revised recovery | 0.042226 | 0.046023 |

Combined: 54 dispatches, $0.358127–$0.367209. Every dispatch had reported usage; both providers reported cache reads and writes. Model-rate uncertainty stays an interval. Selector responses in historical source can omit a status label even when the response and usage exist; the dispatch ledger records them. The initial runner omitted working context from its cost helper, so its projection-size field was wrong; the separate review recomputes that field from saved canonical exports without changing usage or original outcomes.

These short synthetic trials establish fixed-field recovery and instrumentation, not general answer quality, optimal compaction timing or savings. Some current arms cost more. Cache labels are attempts, conversation IDs affect prefixes, trajectories differ, and no cache-expiry experiment was run. Long-task calibration, summary/recovery bounds and continuation forecasting remain required before cost-only mutations are enabled.
