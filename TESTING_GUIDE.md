# Testing Conclave

Run from the Conclave repository with Node.js 22.13+ and installed dependencies.

## Offline checks

```powershell
npm test
npm run check
node scripts/demo.js
node scripts/attention-demo.js
node scripts/state-demo.js
```

Walkthroughs use isolated directories under `.conclave/`. Check edit/offload/retrieve/resume, state supersession and conflicts, pins, restoration, guard failures, selector fallback, and saved token counts.

The suite includes the engine regressions promoted from Converse, PostgreSQL/PGlite persistence checks, standalone CLI restart/Agent checks, the local HTTP API, and migration parity/drift rejection. Test stores use the checkout's ignored `.conclave/test-temp` to support atomic writes in Windows sandboxes. The optional historical saved-export replay skips when its local artifact is absent.

For an existing export ending in a tool continuation, run `node scripts/replay-budget.js PATH`. It reports whether the current engine fits the recorded guard; newer tools/metadata can require a larger guard. An explicit third argument supplies a comparison guard without changing the original record. No provider calls are made.

## Conversation trial

```powershell
node src/cli.js chat --model gpt-6-luna --budget 32000
node src/cli.js chat --conversation conv_YOUR_ID --model gpt-6-luna --budget 32000
```

Track a numerical constraint and conditional decision with `/remember`. Correct the same key; inspect `/state`. Pin exact wording with `/pin`. Offload older material, retrieve its original, and compare `/context` with `/history`. Request `/compact`, inspect `/diff`, and check `/stats` for all call purposes and usage.

Export the evidence:

```powershell
node src/cli.js state --conversation conv_YOUR_ID
node src/cli.js stats --conversation conv_YOUR_ID
node src/cli.js export .conclave\trial.json --conversation conv_YOUR_ID
```

## Optional live checks

```powershell
node scripts/live-smoke.js
node scripts/jev-smoke.js
node scripts/evaluate.js
```

These spend provider tokens. The evaluation writes fixture/settings/answers/errors/usage under `.conclave/evaluation/`. [Jev setup](docs/JEV_INTEGRATION.md) describes selector previews.

For project evidence, record task completion, corrected constraints, source recovery, answer arithmetic, request size, complete usage, and cost. Update [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) with the result and archive the detailed report.
