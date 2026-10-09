# CLAMP Clyps: first increment

2026-10-09. User accepted CLAMP (Context Layer and Memory Protocol), Clyps and
Clypping as the direction for standardized bounded model handoffs, ORMD storage
and dashboard relationships. Obsidian remains a possible later client.

Implemented on local branch `codex/clamp-clyps`:

- Opt-in CLAMP 1.0 profile through existing MCP save/project/read tools;
  model instructions recommend Clyps for new handoffs.
- A complete ORMD revision must fit 1,500 o200k_base tokens. Objective and next
  action are required, lists have at most eight items, explicit links at most six.
  Overflow and invalid links roll back atomically, without truncating text.
- Immutable event content stores ORMD, with a structured packet index and
  separate document SHA-256. Legacy packet revisions/hashes stay unchanged.
- Link targets pin an existing same-account revision. The graph uses explicit
  reported relationships and one project-boundary hop, with a hard 100-node cap.
- Dashboard token counts, original ORMD downloads, directed connections and
  pinned-revision navigation. Data stays inert and routes stay read-only.
- Backups retain normalized histories and regenerate ORMD with fresh identity
  and declared import lineage. Unresolved external IDs are never auto-fetched.

Validation:

- `node scripts/test.js`: 371 passes, one optional skip, zero failures.
- `node scripts/test.js test/clyps.test.js packages/conclave-mcp/test/transport.test.js`:
  ten passes, including a subsequent explicit 100-node capacity check.
- Hosted PGlite/dashboard tests cover raw document persistence, JSONB hash
  stability, foreign-owner link rejection and atomic failed saves.
- `node scripts/test-dashboard-ui.js`: ten desktop/mobile cases pass, including
  complete downloads, token display, cross-project pinned graph navigation,
  inert HTML-looking text, old revisions, errors and late-response guards.
  Desktop and mobile screenshots inspected; page-width checks pass.
- Syntax, generated MCP resource consistency and `git diff --check` pass.

The existing preview port was occupied, so browser tests now select an available
port without interrupting that preview. Edge could not launch under the sandbox;
the authorized synthetic browser run outside it passed. The stalled failed test
runner and its identified child were stopped without touching the other preview.

No push or deployment. Tests use synthetic packets and separate fixture storage;
no live packets, environment credentials or account data were modified.
Converse snapshot parity and checks are recorded after source commit below.

Remaining: real ChatGPT/Claude Clyp acceptance and useful budget measurement;
independent idea/project identities; arbitrary ORMD parse/edit/import; explicit
promotion and lifecycle for durable memory. CLAMP is an initial Conclave profile,
not an externally adopted standard or a replacement for CLP evidence thresholds.
