# Steps 2–3: local testing

The longer conversation has been reviewed. Its budget/state follow-ups and optional native Jev selector are implemented; step 4 (local service/provider expansion) remains separate. See [JEV_INTEGRATION.md](<E:/Coding/converse/CLA/conclave/JEV_INTEGRATION.md>) for the current setup and small-check findings.

## Start or resume

```powershell
cd E:\Coding\converse\CLA\conclave
node src/cli.js chat --model gpt-6-luna --budget 32000
# Resume the ID printed by the CLI:
node src/cli.js chat --conversation conv_YOUR_ID --model gpt-6-luna --budget 32000
```

The optional decision model is off. To exercise it, resume with:

```powershell
node src/cli.js chat --conversation conv_YOUR_ID --model gpt-6-luna --budget 32000 --decision-model gpt-6-luna
```

This uses Luna for both roles, exercising separation without claiming a cheaper-model advantage. Selection has a separate default budget of 8,000 conservative input units plus its reserved output within that budget, six short candidates, and 600 output tokens. It is invoked only under compaction pressure with enough older eligible material. `/decide task keywords` explicitly requests a paid preview; it saves receipts but does not change the projection. `/attention` is free deterministic inspection.

To use Jev for bounded selection while Luna continues answering:

```powershell
node src/cli.js chat --conversation conv_YOUR_ID --model gpt-6-luna --reasoning low --budget 32000 --decision-provider jev
```

This reads `JEV_API_KEY` or `TYPESAFE_API_KEY`. Jev uses native Choice/Score questions rather than generated JSON; `--jev-confidence 0.65` retains uncertain decisions. Its candidate count fits the separate budget, and `--decision-output` does not apply. `/stats` shows provider-specific usage and returned model versions. The small live preview validated transport and conservative decisions; automatic long-form behavior still needs practical observation.

## Useful things to try

- Ask the assistant to track a goal, decision, constraint, evidence, and open question as named structured entries. Inspect `/state` and `/context`; ordinary chatting need not create an entry for every message.
- To update state directly without JSON or an API call, use `/remember program.budget constraint Original grant is $15,000.` Reuse `program.budget` to correct that entry. `/remember program.format question Is a noncompetitive showcase approved?` records an unresolved choice. Use the richer model/JSON tool for explicit conflicts and conditional relationships.
- Change a decision. Ask it to update the same key, preserve the old source, and retain any conditional alternatives. `/state` should show the current entry; `bundle OLD_ID` should still show the prior one and its source IDs.
- Present conflicting reports. Ask it to link the conflict rather than pick a winner. `/state` should report unresolved status, unknown confidence, limitations, and source actors.
- Pin a critical caveat using `/pin TEXT`. Continue the conversation and request `/compact`. Structured state and pins are protected; ordinary older context may be rewritten or offloaded.
- Use `/memory query` and `/history` to compare current working state with original sources. A bundle or source reference permits exact expansion. Ask about a missing detail and check whether the answer actually retrieves it rather than inventing it.
- Inspect `/stats`: total usage includes selection and compaction, and decision usage is also listed separately. A preview costs an API call even when it proposes retaining everything.

Relationships and source attribution are inspectable structure, not proof that the model interpreted a source correctly. Pay attention to stronger claims appearing in a summary, lost uncertainty, incorrect attribution, unnecessary tool calls, and budget failures.

## Keep a receipt

```powershell
node src/cli.js state --conversation conv_YOUR_ID
node src/cli.js stats --conversation conv_YOUR_ID
node src/cli.js export .conclave\long-form-test.json --conversation conv_YOUR_ID
```

Original history remains in `.conclave/conclave.sqlite`. Exports include requests, responses, transformations, decisions, state, and usage through the current snapshot/events; credentials are not recorded. If a projection becomes unhelpful, `revisions` and `restore REVISION` can create a new revision from an older snapshot, retaining later pins.

If protected state fills the budget, inference stops explicitly. Increase `--budget` or correct overly verbose state entries; generic compaction cannot delete them. The estimate uses UTF-8 bytes, not a provider tokenizer.

Tool continuations first attempt bounded excerpt projection and lossless offloading of eligible older material. `/stats` reports `budget_recoveries` and `tool_projections`; exports retain full tool outputs and actual submitted requests. Compaction also skips impossible or unchanged low-yield batches before another paid rewrite. These measures reduce avoidable failures without guaranteeing an indefinitely growing conversation will fit a fixed budget.

Optional free walkthrough: `node scripts/state-demo.js`. It writes example state-update JSON files with real event/bundle IDs under `.conclave/state-demo` and exercises corrections, conflict preservation, inspection, and index rebuilding.
