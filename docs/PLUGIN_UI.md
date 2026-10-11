# Developing Conclave plugins and chat UI

ChatGPT UI documentation rechecked October 10, 2026; other platform research checked October 7. This is the active design and development guide. The [plain-language setup checklist](HANDOFF_SETUP.md) explains what you need to do on your computer.

## What the platforms support

| Platform | Verified documentation | Conclave approach | Still needs an account test |
| --- | --- | --- | --- |
| ChatGPT | MCP Apps UI resources and bridge; optional OpenAI extensions | Shared card and expanded handoff browser | Resource rendering, OAuth, host theme/size behavior and actions |
| Claude | Interactive connectors use MCP Apps, with inline/fullscreen presentation | The same standard UI and authenticated tools | Custom connector rendering and mobile/desktop behavior |
| Codex desktop/CLI/IDE | Shared MCP configuration and plugin packaging | Shared data tools plus bundled save/resume skills | Local installation verified; fresh conversation invocation and widget rendering not established |
| Claude Code CLI/local desktop | MCP configuration and skills/MCP plugin packages | Same tools and namespaced save/resume skills | Actual Code installation and desktop invocation |
| Gemini CLI | MCP tools, resources, prompts and slash-command invocation | Structured/text tool results; prompt shortcuts are a next increment | Actual CLI connection and interaction |
| Consumer Gemini chat | A general custom MCP UI route has not been verified here | No claim that a Conclave widget installs there | Verify a supported integration before writing installation promises |
| Other MCP clients | UI is an extension whose host support varies | Keep every essential workflow usable through tools | Client-specific permissions, discovery and UI support |

ChatGPT recommends the shared MCP Apps bridge first and capability detection for optional extensions. Keep data operations separate from rendering so ordinary calls do not repeatedly launch a widget. [OpenAI UI implementation guide](https://developers.openai.com/plugins/build/chatgpt-ui)

Claude documents inline cards and fullscreen interactive connectors using the existing connection's permissions, sandboxed iframes and declared CSP. Documentation establishes platform support, not that this custom Conclave connector has passed its real account tests. [Claude interactive connector guide](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude)

Gemini CLI discovers tools/resources and can expose MCP prompts as slash commands. Its terminal workflow is a useful fallback; a supported consumer Gemini UI integration remains an open research item. [Gemini CLI MCP guide](https://geminicli.com/docs/tools/mcp-server/)

Coding clients use the same packet workflow. Generated local packages, the installed Codex connection, Claude Code desktop instructions and remaining checks are documented in [CODING_INTEGRATIONS.md](CODING_INTEGRATIONS.md). MCP/plugin support alone does not establish custom UI support in those coding surfaces.

## The current UI increment

Implemented locally: `open_handoff_library` is a separate read-only display tool. Seven data tools remain useful without UI, including `get_handoff_graph`. The server supplies a static, self-contained HTML resource through `resources/read`; its URI changes with the content hash so hosts do not reuse an outdated bundle.

An inline card shows a brief entry point and offers an expanded browser when the host advertises fullscreen support. Packet cards preserve a visible reference and explicitly label source claims as unverified. Constraints and questions can be expanded without truncating their contents. The expanded browser supports:

- Search by name or keywords, with result pagination.
- Show an explicit Clyp graph, filter by exact project name, and open linked revisions. The dashboard and MCP card share the renderer. Connected components stay together; unlinked handoffs are collapsed separately. Narrow screens use a vertical layout.
- Read complete packets, including constraints, unresolved questions, decisions, next steps, context and references.
- Copy a stable handoff ID, with manual selection if the host blocks clipboard access.
- Browse immutable versions, read an older packet and compare exact changed fields.
- Ask the current conversation to continue from a selected ID and revision, only after clicking the action and only if the host advertises text-message support. Otherwise use the provided continuation text.

The browser does not edit packets. Saving continues through the existing explicit save tool. It makes no model calls itself and does not read an entire conversation, upload files, store tokens in browser storage, or contact a database from the iframe. Browsing uses the host's current MCP connection and account permissions.

### Graph in ChatGPT

Ask “Show my Conclave connections graph,” or “Show the connections for project Conclave.” The display call is `open_handoff_library({view:"graph", project:"Conclave"})`; omit `project` for all projects. Normal graph reads use `get_handoff_graph` without opening UI.

The inline graph shows at most eight linked nodes and discloses any omitted nodes/links. “Open connections graph” requests fullscreen when supported; the expanded view offers the complete bounded graph and project filtering. A host without fullscreen gets the full graph inline instead. View-only hosts retain labels and linked-revision information with navigation disabled. Clicking a graph node reads its latest revision as labeled; “Linked revisions” opens the exact pinned revisions. Neither action sends a message or saves context. Graphs above 100 nodes return a capacity error and require a narrower project.

The graph initially fits its canvas. Use **+**, **−** and **Fit** to inspect it, drag to pan, or pinch with two fingers to zoom and pan. Ordinary mouse-wheel or trackpad scrolling over the graph zooms around the pointer without requiring Ctrl/Command. Scrolling outside the canvas remains available to the page. Pixel, line and page wheel deltas are normalized, with each step bounded. With the canvas focused, use +/− to zoom, arrow keys to pan, and 0/Home to fit. Node taps and Enter/Space navigation remain available; tabbing to an offscreen node reveals it. Camera controls work locally even in view-only hosts. Zoom percentages are relative to the fitted view (50–800%). Canvas resizing preserves the relative zoom and graph center; Fit recenters it. [Wheel change and checks](archive/2026-10-10/graph-scroll-zoom.md)

These camera controls pass synthetic desktop/mobile Edge checks in both the dashboard and the sandboxed MCP App, including native two-touch input and fullscreen transitions. The mobile-feedback Clyp records the user's Android graph-rendering observation; the new gestures still need testing in real ChatGPT Android, whose container may intercept them. The buttons remain a fallback. [Camera implementation and validation](archive/2026-10-10/graph-zoom-fit.md)

This is a prepared MCP Apps integration, not real ChatGPT acceptance. After authorized publication/deployment, refresh Conclave under ChatGPT Plugins, start a fresh conversation, and verify graph rendering, expansion, project filtering and pinned reads using the signed-in account. ChatGPT documents inline cards and fullscreen canvases; it also recommends keeping ordinary reads separate from display tools. [Official UI guide](https://developers.openai.com/plugins/build/chatgpt-ui)

Local synthetic preview: `http://127.0.0.1:3214/?view=graph&inline=1`. Add `tools=0&expand=0` to inspect capability fallback. This SDK-backed fixture is explicitly labeled and does not prove actual ChatGPT behavior. [Local implementation and checks](archive/2026-10-10/clyp-graph.md)

## Practical design rules

Start with a compact card and move detailed navigation into a larger view. Keep no more than two primary inline actions; avoid nested scrolling, deep card navigation and a duplicate chat composer. Use native fonts, host theme variables, readable contrast and visible keyboard focus. Make loading, empty, failed and disconnected states understandable. [OpenAI UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines)

For Conclave specifically:

1. Keep decisions, constraints, open questions and the selected revision visible. A short display must disclose omitted material and offer the full packet.
2. Preserve packet text exactly. Render it as text, never executable HTML; source app/model labels remain claims.
3. Browse without saving. An eventual editor must show what will change before its explicit save action; dismissing it must not write anything.
4. On a version conflict, retain the unsaved draft and ask the user to review the latest packet. Do not silently replace a concurrent update.
5. Send conversation context only when an action needs it. The current Continue action sends the ID/revision and a retrieval request, rather than copying all packet text into a host message.
6. Separate UI state from authoritative packet state. An open card is a view, not evidence that a save occurred.
7. Respect missing capabilities. Clipboard, message sending and expanded display must have usable fallbacks.
8. Keep actual-account results separate from local browser fixtures. Screen-size emulation is not evidence for a native mobile app or Safari.
9. Use explicit button actions and keyboard handlers for search. A host sandbox can block native form submission even when the page would normally handle it with JavaScript.

## Protocol, permissions and build choices

The UI uses the official `@modelcontextprotocol/ext-apps` App bridge. `_meta.ui.resourceUri` links only the display tool to its resource. The MIME type is `text/html;profile=mcp-app`. Read tools are visible to the model and app; `save_handoff` is model-only for the current read-only browser. Host metadata is a hint, so the server still enforces OAuth scopes and account ownership. [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)

The static resource's declared connection, external resource and frame domain lists are empty. The iframe obtains private data only through host-mediated tool calls. It contains no user packets or secrets. The resource includes a short description and supported display modes; public ChatGPT submission will require a dedicated widget origin and verified metadata for that deployed configuration. [OpenAI component metadata reference](https://developers.openai.com/plugins/reference)

The current build pins the compatible 1.x UI SDK (`1.7.5`) while retaining the tested MCP SDK `1.32.1` and protocol `2025-11-25`. Build dependencies stay development-only; the migrated hosted server serves the committed HTML bundle. This avoids combining UI work with a major MCP SDK upgrade. New UI source lives in `packages/conclave-mcp/ui`; `scripts/build-handoff-ui.js` produces `src/resources/handoff-app.html`. No React dependency or external CDN is needed for this increment.

## Development and verification

From the Conclave checkout:

```powershell
npm run mcp:ui:build
npm run mcp:ui:check
node scripts/test.js test/handoff-ui.test.js test/handoff-hosted.test.js packages/conclave-mcp/test/transport.test.js
npm run test:mcp:ui
npm run mcp:ui:preview
```

Preview address: `http://127.0.0.1:3214`. The preview is an explicit local demonstration using synthetic packets in memory and the official host bridge. It does not load `.env`, your local handoff directory or the hosted account. Stop it with Ctrl+C. Its fixture server permits only read operations and rejects foreign Hosts/Origins. Do not publish this test host as the production connector.

Server checks cover UI resource metadata, headless fallback, output-schema validation including error responses, read-only authorization, and owner isolation. Browser checks exercise the compiled UI through the real App/AppBridge messaging and an SDK client connected to fixture storage. Include desktop/narrow layouts, theme changes, keyboard interaction, clipboard denial, failed requests, older versions, escaped malicious-looking text, and compact-to-expanded behavior. Real ChatGPT/Claude tests remain a separate setup checkpoint.

Shared runtime changes start in Conclave, are committed after verification, and migrate into Converse with the existing hash manifest. Regenerate/check the UI bundle before migrating. Keep application-specific hosting settings in the chosen hosting project.

## Next feature increments

| Feature | User benefit | Work needed before calling it ready |
| --- | --- | --- |
| Reviewed packet editor | Correct a handoff without relying entirely on a model | Structured draft form, exact before/after preview, explicit save, revision conflict recovery and write-scope checks |
| Projects and tags | Find related work across many packets | Versioned packet schema/storage/index changes, compatible backup migration and filters |
| Branch from an older version | Explore alternatives while retaining the original | Explicit new-packet action and unverified source-revision lineage |
| Prompt shortcuts | Prepare/resume handoffs quickly in terminal clients | Register bounded MCP prompts, test ownership and discover them in actual Gemini CLI |
| Share/export selection | Carry selected packets to another installation | Explicit scope and private-data preview; never share account credentials or grant another person access implicitly |
| Sidebar and conversation panel | Keep the handoff library open next to chat | Optional host extension, capability/availability checks, dedicated origin and real host tests |
| Composer mentions | Pick a named handoff while composing a message | Search/selection integration that returns stable IDs and preserves ownership |
| File viewer | Inspect a portable backup before restoring it | Strict format validation, scope preview, explicit import confirmation and no automatic memory promotion |

ChatGPT documents extensions for sidebar apps, conversation panels, settings, file viewers, model/app context, composer mentions and rich forms. These are optional layers after the shared UI. Availability varies; its documentation currently limits extension composer mentions to the desktop app and describes some web availability as forthcoming. [OpenAI plugin extensions](https://developers.openai.com/plugins/build/extensions)

No sidebar entrypoint, composer extension, file handler, public listing or cross-account sharing has been registered by this increment. Public release still needs the hosting/sign-in decision, operational maintenance, privacy/support information, dedicated UI origin where required, platform review and real account verification.
