# Conclave and Converse integration

CLA/conclave is the source of truth for the complete engine. Converse deploys a self-contained copy under converse/lib/conclave; it does not import the sibling checkout at runtime.

## Ownership

| Conclave owns | Converse owns |
|---|---|
| Providers, streaming, reasoning attribution, token counts | Browser shell, chat UI, editors, Context Garden presentation |
| Trajectory, state, references, projections, attention, economics, Jev | Ordinary multi-model chat and application-specific title generation |
| Agents, workspace tools, arithmetic, search, page retrieval | Vercel deployment/configuration and connection provisioning |
| SQLite/in-memory stores, PostgreSQL repository, schema/migrations, leases, fenced writes | Deployment database connection lifecycle |
| Context HTTP protocol, portable local/hosted handlers, session helpers | App-specific entrypoint wrappers |
| Shared engine guide, effort table, export filename helper, rate snapshot | Other application assets |

src/ contains the portable engine and its resources. The CLI is a standalone entrypoint; integrations/converse/ contains thin wrappers preserving Converse's existing import paths. drizzle/ contains the same database schema history. API/CLI users can inspect or change all engine operations; browser UI stays in Converse.

## Change sequence

1. Implement the engine change in Conclave, including required resources, dependencies, tests, or migrations.
2. Run npm test and npm run check in Conclave. Commit the verified source.
3. Run node scripts/sync-converse.js --apply from Conclave. Use --target PATH for a different Converse checkout.
4. Run node scripts/sync-converse.js --check. Every managed runtime file and resource must match byte for byte.
5. In Converse, run npm run check and npm test; update its lockfile if migration adds dependencies. Commit and push the snapshot.

The manifest at converse/lib/conclave/manifest.json records the Conclave commit, required dependency ranges, and hashes of all migrated files. Converse's scripts/check-engine.js verifies that receipt without requiring a sibling checkout. Migration refuses downstream edits that differ from both the last receipt and current Conclave; port such edits into Conclave before applying the migration. New unmanaged engine modules also fail verification. The one-time promotion uses --apply --bootstrap; later changes use ordinary --apply.

The initial parity migration promotes Converse's engine at commit 81c7ccc5e08c91a21549c698e1567385d3e22fce, including its web-search/page integrations, into Conclave. Subsequent engine work moves only from Conclave into Converse.

## Local and hosted use

Conclave provides npm run serve, its CLI, and reusable classes/handlers. Converse retains npm run dev and its web UI. Both support GPT/Claude Context and Agent flows, workspace documents, inspection, and the same persistence behavior.

For standalone storage use .conclave/, CLI --data DIR, or CONCLAVE_DATA_DIR. Converse's local wrapper preserves its existing sibling .conclave location unless configured otherwise. Coordinate mutations when sharing a local database. With DATABASE_URL, the portable server and Converse use the shared PostgreSQL repository. Existing databases retain their schema and audit records; promoting the engine does not itself run migrations or modify saved conversations.
