# Conclave and Converse integration

The standalone CLI lives in `CLA/conclave/src/`. Converse deploys its own engine snapshot in `converse/lib/conclave/`; the web deployment does not import the sibling checkout.

## Local use

From `E:\Coding\converse\converse`:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:3211. Choose Context or Agent and GPT or Claude. [The app guide](../../../converse/public/app-guide.md) describes controls, tools, limits, and exports.

With `DATABASE_URL`, the web app uses Neon. Without it, local development uses SQLite under `CONCLAVE_DATA_DIR` or the sibling `.conclave` directory. The CLI uses `--data DIR`; point it at the same directory to inspect local conversations. Coordinate edits when sharing a database between CLI and browser.

## Implementation boundary

| Standalone | Additional Converse implementation |
|---|---|
| OpenAI task adapter, optional Jev selection | Anthropic task adapter, streaming and reasoning summaries |
| SQLite trajectory and projections | Neon persistence, fenced leases, Vercel endpoints |
| CLI context/state/retrieval controls | Checkpointed agents, versioned workspace, manual editor |
| Local token counts and exports | Provider counting, Garden/activity, shared guide, cost reporting |
| Deterministic/bounded attention | Periodic cached reviews, scoped protections, readable handles, frozen tool projections |

Web JSON exports contain a canonical transcript and full `context_layer` audit. Native CLI exports contain the engine audit. Ordinary web Chat is browser-local and supports GPT, Claude, and Gemini; Gemini does not have a Context/Agent adapter.

When refreshing the web engine, preserve [Converse's snapshot adaptations](../../../converse/lib/conclave/VENDORED.md). [Hosted setup](../../../converse/docs/HOSTED_CONTEXT.md) covers migrations and deployment.
