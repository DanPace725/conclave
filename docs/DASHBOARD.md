# Conclave handoff dashboard

The first dashboard is a standalone browser surface at `/dashboard` in the independent Conclave hosted service. It uses the existing Conclave browser sign-in. The signed-in account page links to it; app OAuth connections and the MCP widget retain their existing behavior. Release `28cd797` is deployed on Railway; public access checks and the sign-in gate pass. Real signed-in packet acceptance is pending. [Release evidence](archive/2026-10-07/dashboard-railway-release.md)

The [Railway release guide](DASHBOARD_RELEASE.md) describes commit-pinned deployment, public checks, real-session acceptance and rollback using the existing service.

## Try the local demo

From the Conclave checkout:

```powershell
npm run dashboard:preview
```

Open `http://127.0.0.1:3226/dashboard`. The visible demo banner identifies synthetic packets. This process does not load environment files, live accounts, local saved handoffs, model keys, or the hosted database. Stop it with Ctrl+C. The normal hosted launcher serves the dashboard against its own configured database and sign-in; deploying that change requires authorization.

## What you can do

- Read [CLAMP Clyps](CLAMP.md), see their complete-document token count, and export the exact saved ORMD revision.
- Use readable references such as `dashboard-planning--2` in URLs, copied continuations and file names. Duplicate titles get different numbers; title changes keep the reference. Existing canonical-ID links continue to open. Connected models can pass the readable reference as `handoff_id`.
- Open Connections to inspect explicit revision-pinned links between handoffs, including across projects. Project filtering includes one boundary hop to linked targets; the graph loads no linked content and makes no inferred relationships. Graphs above 100 nodes require a narrower project filter.

- Browse recent handoffs, ten per page. Search names, source labels or saved packet keywords using the existing deterministic search. Search results retain the service's relevance order.
- Filter the list by project. The chips are the exact project names apps reported when saving, each with its handoff count; a handoff's project also appears on its row and in its detail. The dashboard does not assign or rename projects.
- Select a handoff without entering its ID. Keep the result list beside complete packet detail on desktop; on narrow screens the detail follows the list, selection scrolls it into view, and “All handoffs” returns to the list.
- Read the objective, constraints, unresolved questions, decisions, next steps, context and references. Packet contents are exact text, including HTML-looking strings.
- Inspect source app/model claims, selected and latest saved revision numbers, dates, packet hashes, event IDs and previous revision event IDs. Revision history loads when opened, with older/newer pages.
- Read an older immutable revision, follow its bookmarkable fragment link, or check the latest saved version. A newer revision discovered during a history read is disclosed; reading an old version does not silently replace it.
- Compare any two saved revision numbers. The dashboard shows exact before/after fields and calls out constraints and questions removed from the second selected revision. It makes no claim about whether either version is correct.
- Copy a continuation request for another connected app, or copy the handoff ID. If clipboard access fails, the text opens and is selected for manual copying. No message is sent to an app by these actions.
- Export the currently selected complete revision as JSON with provenance, hash and completeness fields. This is a revision export, not a history backup or an importable bundle; use `mcp:backup` for supported local history backups.

Source app and model labels are reported claims. A handoff records what was explicitly saved; it cannot establish what an app presently remembers. “Latest saved” identifies the latest revision returned by that read, not an agreed canonical project state. A project name is likewise a reported label: it groups packets that carry the same exact name and establishes nothing about agreed project state. Related titles do not establish a shared project, and different packets do not establish a conflict.

## Architecture

| Piece | Existing implementation used | New work |
| --- | --- | --- |
| Packet discovery and reads | `HandoffRepository.find/get` and `HandoffService` | Recent list, deterministic keyword search, packet detail |
| History and exact comparisons | `history/compare`, immutable event lineage | Revision browsing and before/after presentation |
| Account boundary | Independent hosted signed session, verified account owner | Read-only cookie-authenticated HTTP adapter at `/dashboard/api/` |
| Browser rendering | Same-origin static resources, plain DOM APIs | `src/resources/dashboard/` HTML, CSS and JavaScript |
| Continuation and export | Existing stable packet IDs, revision numbers and receipts | Explicit local copy/download actions |

`src/handoff-dashboard.js` accepts only the four read operations, rejects extra/repeated query fields and owner overrides, and fixes service limits to ten rows and complete packet reads up to 128,000 characters. It constructs the repository from the verified session's owner. No new schema, model call, MCP token in the browser, write endpoint, dependency or migration is needed. Assets carry no account data. Pages and reads use `no-store`; data is not persisted in browser storage. The router rejects foreign Host/Origin and cross-site fetches, declares a self-only CSP and blocks framing. Errors are generic and never include underlying SQL or configuration.

The hosted package mounts this shared adapter. Source and resources are migrated to Converse for engine parity, but this increment does not add a dashboard route to Converse's chat app. The MCP widget remains a separate presentation over the same packet primitives.

Opening a handoff by ID, its history and its comparisons load only that packet's events. Discovery, search, exact-title lookup and saves still reconstruct the account's bounded pilot event history, so ten displayed rows do not imply ten database rows fetched. The 2,000-event pilot bound and response bounds remain explicit. An expression index on the packet ID and an indexed list projection are follow-up work that needs a hosted migration.

## Remaining product decisions

Recent handoffs is the first default because it requires no inferred grouping or new data model. The following need separate design and implementation:

1. **Projects:** apps now report an optional exact project name when saving ([packet contract](HANDOFF_MCP.md#tool-contract)), and the dashboard filters by it. Moving a handoff is a new revision, so it is reversible and visible in history. Still open: assigning or renaming from the dashboard (its first write action), reconciling near-duplicate names, and a per-project overview. Do not infer authoritative membership from matching titles.
2. **Canonical state and divergence:** define a named project's agreed state and any branch/parent relationships before displaying conflicts. Today's optimistic concurrency protects linear packet updates; it does not create a branch graph or merge separate packets.
3. **Editing and conflict resolution:** preserve an unsaved draft, compare against the latest revision, and explicitly review a save using `expected_revision`. An optional paid agent-assisted merge must remain reviewable and must preserve removed constraints/questions in the saved history.
4. **Timeline or graph:** build from explicit lineage and project links; a source label does not prove independent authorship, routing, or recall.
5. **Action routing:** add provider-specific deep links or explicit authorized task dispatch only where capabilities are verified. Local copy/export works across providers now.
6. **Operations:** test real signed-in dashboard use in the hosted account, deploy/restart recovery and revocation/reconnection; address event-read scaling and retention before broad distribution.

## Checks

```powershell
node scripts/test.js test/handoff-dashboard.test.js test/hosted-standalone.test.js
node scripts/test-dashboard-ui.js
node scripts/check.js
```

The HTTP tests use the actual standalone app, signed cookies, PostgreSQL-compatible fixture storage and immutable packet operations. Browser cases use synthetic packets and the real dashboard read adapter in desktop and narrow Edge configurations. These checks do not establish production readiness, native mobile/Safari compatibility, or a real user session result. See the [implementation record](archive/2026-10-07/dashboard-first-pass.md).
