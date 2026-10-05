# Jev selector setup

Jev selects bounded retention actions and priorities, reranks lexical shortlists, classifies document ingress, and shadows automatic memory selection (recorded, not applied; see [automatic memory](AUTOMATIC_MEMORY.md#jev-memory-selection-shadow)). OpenAI or Anthropic supplies answers and semantic compaction.

Set `JEV_API_KEY` or `TYPESAFE_API_KEY` in the process or Windows environment.

```powershell
node src/cli.js chat --model gpt-6-luna --budget 32000 --decision-provider jev
node src/cli.js decide "current task" --conversation conv_YOUR_ID --decision-provider jev
node src/cli.js models --decision-provider jev
```

`decide` is a paid preview: it saves requests/proposals/usage and changes no projection. `/attention` provides free deterministic inspection. The CLI selector is off unless enabled.

| Setting | Default |
|---|---|
| Decision model | `jev-latest` |
| Decision budget | 8,000 conservative byte units |
| Candidates | Six bounded descriptions, configurable up to 12 |
| Confidence floor | `--jev-confidence 0.65` |
| Custom key variable | `--jev-key-env VARIABLE_NAME` |

Jev uses native Choice/Score questions. Candidate packing fits the separate guard; `--decision-output` applies to the OpenAI selector, not Jev. The engine validates IDs, revisions, protections, and actual reduction. Invalid/failed decisions fall back to deterministic attention. Raw decisions and usage remain in exports; `/stats` separates providers and purposes.

For a bounded task-provider selector, use `--decision-model MODEL`. The task model performs semantic rewriting in either case. Periodic timing checks are local and do not invoke Jev. Under pressure the engine tries deterministic pointers for routine material before paid selection; task-relevant material and explicit reviews still use the selector. Action-specific next-request costs are recorded in shadow mode, with unknown cache/recovery and price-tier coverage explicit. Service/Agent commands use Jev when credentials exist; `--no-jev` disables it. See [integration](CONVERSE_INTEGRATION.md).
