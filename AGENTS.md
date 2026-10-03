Start with [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) and [the development method](docs/DEVELOPMENT_METHOD.md).

Maintain project state in PROJECT_CONTEXT.md; keep detailed planning and results in docs/archive/. Technical usage docs stay active.

This repository is the source of truth for the complete Conclave engine, including providers, streaming, agents, workspaces, web tools, context management, and hosted persistence. Implement and test engine changes here first. Commit the source, then migrate into Converse with `node scripts/sync-converse.js --apply`; verify `--check` and run Converse's checks before committing its snapshot. See [the migration workflow](docs/CONVERSE_INTEGRATION.md). Keep Converse application UI and deployment configuration in Converse.
