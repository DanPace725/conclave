# Conclave MCP Apps UI increment

October 7, 2026, `codex/conclave-handoffs`. Local implementation and verification; hosting choice remains open.

## Result

Added `open_handoff_library` as a sixth, read-only display tool, separate from the five data tools. Its static content-addressed MCP Apps HTML resource provides a compact card and a host-requested expanded browser. The browser searches/paginates metadata, reads complete packets, copies references, reads earlier immutable revisions, compares exact field changes, and can ask the host chat to retrieve the selected ID/revision after a user click.

The shared MCP server/resource migrate into Converse. Source UI, build tools and synthetic preview stay in Conclave. The official UI SDK 1.7.5 is a development dependency compatible with the retained MCP SDK 1.32.1; esbuild 0.28.2 and Playwright 1.63.0 are development-only. The runtime serves committed HTML and adds no production dependency. `npm run check` also verifies the bundle matches its source. Detailed design/platform citations live in [PLUGIN_UI.md](../../PLUGIN_UI.md), and simple user instructions remain in [HANDOFF_SETUP.md](../../HANDOFF_SETUP.md).

## Boundaries

- Original data operations still work without UI. Factory `ui:false` omits the display tool and resources capability.
- The display output schema includes a structured error envelope, which is validated by an actual SDK client.
- The resource contains no account packets or credentials and declares empty external connection/resource/frame lists. All browsing is mediated by the host's authenticated MCP connection; server ownership/scope checks remain binding.
- Save is model-only metadata; the UI has no write action. Host metadata does not replace authorization.
- Packet text uses DOM text nodes. No arbitrary markup, network fetching, persisted browser credentials or direct database access.
- Clipboard failure selects the reference for manual copying; chat-message and display-mode features are capability-gated. Unsupported navigation is disabled with an explanation.
- Continue sends a selected ID/revision retrieval request, not a transcript or saved packet. Source app/model labels remain unverified claims, and earlier versions are visibly identified.
- The preview binds loopback and uses synthetic in-memory data, a read-only whitelist and Host/Origin/request-size checks. It is not a production connector or a real chat account.

## Verification

| Check | Result |
| --- | --- |
| Source `npm test` | 350 passed; one optional saved-export replay skipped |
| Source syntax/credential checks | Passed |
| Generated UI source/bundle check | Passed |
| Focused SDK UI + hosted + transport tests | 12 passed, including four separate transport cases |
| Browser UI suite | 10 passed: five flows each on desktop and 390px narrow Edge layouts |
| Bundle/screenshots | Compiled app exercised through official App/AppBridge and SDK client; compact and packet screenshots visually inspected |

Browser cases cover search/pagination, complete constraints/questions, exact older-version reads/comparisons, selected-version continuation, dark/light changes, keyboard Enter, clipboard denial, absent host messaging/tools, inert malicious-looking titles, failed reads/retry and compact-to-fullscreen requests. The sandbox deliberately omits `allow-forms`; initial native form search failed, and explicit button/keyboard actions fixed it. A string-replacement bundling issue and SDK error output-schema mismatch were also caught and repaired before final passing checks.

Restricted Windows browser launch initially failed before application execution. The approved elevated run used a fresh test profile and workspace temporary directory; no signed-in browser or account credentials were involved. Raw local logs/screenshots stay under ignored `.conclave/`.

## Remaining work

Real ChatGPT/Claude rendering, account OAuth and actions; Gemini CLI connection; native mobile/Safari behavior; dedicated public ChatGPT UI origin and submission metadata; privacy/support/operations; deployment and live database migration. No public listing, sidebar/composer extension, packet editor, hosted synchronization, push or deployment was performed. The active guide sequences reviewed editing, tags/projects, branching and prompt shortcuts as future increments.
