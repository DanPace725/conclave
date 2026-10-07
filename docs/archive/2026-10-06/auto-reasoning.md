# Automatic reasoning with OpenAI Decisions

Experimental branch: `dev/decisions-reasoning` in Conclave and Converse. Local development only.

Context and Agent accept `reasoning: "auto"`. Before each answer inference, the Decisions API (`gpt-6-luna`) chooses among the target model's supported effort levels from bounded current-request/recent-context text. It does not change the target model. Explicit manual effort makes no selector call. Compaction and memory management never receive the literal `auto` setting.

Selection uses the service's account-scoped OpenAI provider, including for Claude tasks. Missing OpenAI credentials never fall back to a deployment key. Unknown model support, failures, refusals, malformed coverage or uncertain choices omit the effort override and retain the provider default. The experimental acceptance gate requires confidence at least 0.5 and a strict probability majority; it is not production-calibrated. Requests with images use model-default effort without a selector call because this text-only experiment does not evaluate pixels. Opaque reasoning is excluded. Non-reasoning models receive no reasoning override or encrypted-reasoning include.

Every selector request/response uses normal persisted inference events with purpose `reasoning-selection`, reported usage, deadline and cancellation. A linked `reasoning_selection` receipt records the model, allowed levels, confidence, probabilities, evidence fingerprint and fallback reason. Agent usage includes selection and rechecks the answer reserve afterwards. Stop cancels in-flight selection. Transcript reads preserve the receipt, including through the direct PostgreSQL display projection, without any new inference.

## Verification

- Final full source suite: 329 passes, one optional skip. All 15 Auto tests and five PostgreSQL row-cache/transcript tests passed. Syntax checks passed. Converse's 203 tests passed with one optional skip; migration covered 91 files. Six focused desktop/mobile browser cases passed, covering Auto Context/Agent and reload plus manual Claude controls. Windows sandbox launch failures were resolved by running the fixture browser outside the sandbox. The new mobile test closes the settings dialog before sending, matching the real interaction.
- Fixtures cover manual bypass; valid choices; refusal, malformed and uncertain output; missing-key scoping; unknown capabilities; excluding image/opaque data; native endpoint; Agent budget/Stop; effort changing after a tool step; duplicate messages and read-only inspection; and reload through PostgreSQL.
- Live four-task selector probe: copying → None, short explanation → Low, concurrency diagnosis → High, distributed protocol design → XHigh. The last confidence was 0.46 and would trigger default fallback. Direct probe latency on the successful trial: 103–204 ms. These are single synthetic observations, not a latency benchmark.
- Two actual Context answers on `gpt-6-luna` applied None and High and completed. High produced a concurrency/idempotency answer with 2,163 reported output tokens (1,365 reasoning tokens). Six selector calls in the successful trial used 2,885 input tokens, a $0.0002885 base input valuation at the documented Decisions rate. Answer usage is separate in the artifact.
- The initial trial used a 1,024 output-token cap; the difficult answer exhausted it. The retry used 8,192 and completed. The initial failure artifact is retained; its failed-answer usage was not retained by the first script, so the successful trial's cost is not the cost of all attempts.

[Successful trial](auto-reasoning-live.json) · [Initial trial](auto-reasoning-live-initial.json) · [Runnable smoke](../../../scripts/auto-reasoning-smoke.js) · [Unit/Agent fixtures](../../../test/auto-reasoning.test.js) · [Hosted reload fixture](../../../test/converse-row-cache.test.js)

Official sources: [Decisions API](https://developers.openai.com/api/docs/guides/decisions), [reasoning effort](https://developers.openai.com/api/docs/guides/reasoning), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra).

Task difficulty prediction is implemented. Optimal effort, answer-quality benefit, calibrated thresholds, total cost savings, native Claude selection quality and production behavior remain unmeasured. The next useful evaluation compares Auto with fixed Low/Medium/High on the same labeled tasks, counting selector overhead and incomplete/retried answers.
