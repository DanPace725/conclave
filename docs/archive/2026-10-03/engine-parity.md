# Conclave engine parity — 2026-10-03

Converse's engine at 81c7ccc5e08c91a21549c698e1567385d3e22fce was promoted into the Conclave repository. The complete engine is now portable there: GPT/Claude providers, streaming/reasoning, native search/page retrieval, agents/workspaces, context controls, Jev/economics, inspection/counts, and SQLite/PostgreSQL persistence.

Runtime imports were made internal to the engine. Shared guide/rates live with the source; PostgreSQL schema/migrations, the repository, HTTP protocol, and local/hosted adapters also live in Conclave. Existing Converse import paths become thin wrappers. The browser application stays in Converse.

Standalone CLI gains provider/streaming options, saved agents, workspace access, and generic service calls. A localhost API exposes the shared HTTP protocol with SQLite or PostgreSQL. Old standalone context modes and source records remain supported. Existing SQLite/PostgreSQL user stores were not migrated or rewritten by this work.

Migration: scripts/sync-converse.js copies managed files/resources, records source commit/hash/dependency coverage, preserves application-only files, and refuses independent downstream changes. scripts/check-engine.js validates the receipt without a sibling checkout. Engine ownership is explicit in both AGENTS.md files, development methods, and current project contexts.

The promoted tests exposed a preview-count mismatch after web tools were introduced. The preview now includes the same web-tool configuration as the counted/submitted workspace request. Local token-count coverage from standalone is retained alongside Converse's richer usage telemetry. Historical fixtures now understand settled-prefix/recent-tail projections and scoped rather than permanent Jev retention.

Verification before migration: 138 tests passed, one optional local saved-export replay skipped; syntax passed. Hosted HTTP streaming/workspace/export passed against PostgreSQL/PGlite. Offline recovery, state-correction/reindex, and attention/offload/restore walkthroughs passed. The historical 32,000-unit continuation replay requires more space with the larger current tool schema; its report now preserves the original guard and reports fits/failure rather than asserting success. Downstream checks are recorded after migration. Source/target Git attributes preserve LF for managed files so hashes survive Windows/Linux checkout.

No CLP behavior is implemented in this change. Next work starts with evidence resolution and independent-source accounting, followed by frames/scoped queries and EXPLAIN. Signed registries, policies, and portable bundles remain separate later work.
