# Simple Clyp graph and ChatGPT presentation

Implemented locally on `codex/clyp-graph`, October 10, 2026. No push, production deployment or real ChatGPT UI acceptance in this increment.

The dashboard's Connections view and the MCP Apps card now share a small DOM/SVG renderer (`src/resources/dashboard/graph.js` and `graph.css`). Connected components are laid out together; unlinked handoffs are collapsed separately. The selected dashboard handoff is highlighted. Narrow screens use a vertical layout. Names are rendered as inert text and nodes open using readable references. No new graph dependency, model call, schema migration or inferred relationship.

Nodes describe latest saved revisions. Arrows describe explicit reported Clyp relationships; Linked revisions opens the exact source/target revisions recorded on an edge. Existing owner boundaries, outgoing project-boundary hop and 100-node capacity failure remain unchanged. Stable idea/project identities and more elaborate graph exploration are follow-ups.

`get_handoff_graph({project?})` is a read-only data tool with no widget attached. `open_handoff_library({view:"graph",project?})` is the display tool; structured results remain useful without UI. The card previews up to eight connected nodes, explicitly reports omitted nodes/links, and requests fullscreen only after the user opens it. Hosts without fullscreen receive the full bounded graph inline. Hosts without tool calls can inspect labels but cannot navigate. Clicking a node or pinned revision only reads; it never sends a chat message. The existing explicit Continue action remains separate.

ChatGPT's current documentation supports an inline result and fullscreen canvas through MCP Apps, and recommends separate data/display tools. The existing content-addressed HTML resource, standard bridge and empty external CSP domain lists are retained. No account data is built into the resource. [Official UI guide](https://developers.openai.com/plugins/build/chatgpt-ui) · [Metadata reference](https://developers.openai.com/plugins/reference)

## Validation

- 27 focused source checks passed: Clyps, dashboard/hosted owner/scope behavior, SDK UI output validation, real stdio/HTTP transport and generated integrations.
- Ten dashboard and twelve MCP Apps browser cases passed using synthetic data in desktop and narrow Edge. After the responsive adjustment, the four affected graph cases passed again. Checked inline/fullscreen presentation, exact project filtering with a boundary node, latest node versus older pinned revision, readable references, disabled navigation on a view-only host, absence of automatic chat messages, and no page overflow. Screenshots were inspected.
- Source syntax/resource checks passed. No internal tests were added beyond one browser scenario; existing assertions were adjusted for the added graph tool and shared view.
- Source commit precedes migration; the Converse snapshot's parity/check/test results are recorded in its migration receipt.

## Review locally

Both previews are synthetic, in memory, and load no environment files, real packet store, hosted account, model key or database:

- Dashboard: `http://127.0.0.1:59618/dashboard?view=graph#handoff=demo-workstream-11--24` (PID 65304).
- MCP Apps card: `http://127.0.0.1:59619/?view=graph&inline=1` (PID 46048). This is an SDK-backed host fixture, not ChatGPT itself.

Default launchers remain `npm run dashboard:preview` (port 3226) and `npm run mcp:ui:preview` (3214). Environment variables `CONCLAVE_DASHBOARD_PREVIEW_PORT` and `CONCLAVE_UI_PREVIEW_PORT` select other ports.

For real ChatGPT acceptance after authorized publication/deployment, refresh the Conclave connection's tool definitions, start a fresh conversation, and ask “Show my Conclave connections graph.” Verify rendering, expansion, project filtering and pinned reads against the signed-in account. Local fixtures do not establish native mobile/Safari behavior, live host rendering or the pending ChatGPT ↔ Claude model pilot.
