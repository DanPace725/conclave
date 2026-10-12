# Conclave dashboard PWA — October 12, 2026

## Change

Implemented on isolated branch `codex/conclave-pwa` from `9ec00699138e68e90a6ce080a5ae9058fe3ab538`. Existing edits to the primary Conclave checkout, including reference work and alternative branding images, are excluded.

- Stable manifest identity and launch URL `/dashboard/`, standalone display, existing branding encoded as 192/512 PNGs, maskable PNG and Apple touch icon. App navigation scope `/` keeps account sign-in, connections and help in the installed window; the worker's offline scope remains `/dashboard/`.
- Browser-driven install button, fallback instructions for browser menus/Safari, hidden install guidance in standalone mode.
- Public installation resources remain available after sign-in expiry, behind the existing host/origin/method checks. Authenticated HTML and APIs retain their existing account checks and `no-store` headers.
- `/dashboard/` worker stores only six public offline resources. Network-first dashboard navigation falls back only on network failure; API errors and authentication redirects are not replaced. Account pages, OAuth and MCP remain outside the worker scope. No handoffs or signed-in pages are written to Cache Storage.
- An offline reconnect page explains that saved handoffs need the network. No new dependencies, database changes or inference calls.

## Validation

- `npm test`: 377 passing, one optional skip, zero failures (378 total). The four dashboard HTTP/access tests include manifest MIME type, PNG dimensions, anonymous asset access, host/origin controls and authentication enforcement.
- `npm run check`: syntax, evaluation credential checks and MCP UI resource check pass. A fresh Windows checkout converted the embedded UI template to CRLF; normalizing that local template and regenerating restored the exact existing bundle. No embedded MCP UI content change is included.
- `node scripts/test-dashboard-ui.js --workers=2`: 18 passing desktop/mobile Edge checks, including the four new PWA cases. Search, history, export, graph and recoverable-error flows pass alongside manifest checks, cache allowlist inspection, offline API failure, reconnect, expired-session rejection and browser-driven install controls.
- A separate isolated persistent (non-private) Edge profile reports `installabilityErrors: []`. Playwright's ordinary private contexts report only `in-incognito`, which is explicitly separated from application errors in the test. Neither run installs the app at OS level.
- Reviewed the mobile install layout; screenshots captured for the desktop/mobile install state and offline screen. Fixtures contain only synthetic demo handoffs.

## Release limits

The user approved Conclave-only publication/deployment after local verification. Fast-forwarded remote main from `9ec0069` to `b4ee297c38ea34ad53dadd82953e2db1ad5c8940`; independent `git ls-remote` confirmed the exact main SHA. Railway's existing main-following trigger deployed it as `194c2397-62b6-493e-82c2-dc2f233160fc`, SUCCESS at `2026-10-12T21:13:26.522Z`. Source still follows main without a pin, and production has no staged/applying work. No service/Auth/variable/domain setting was changed.

All **22 live public checks** passed at `2026-10-12T21:14:14.662Z`: database readiness; dashboard sign-in and anonymous find/get/history/compare rejection; method/origin controls; MCP authorization/scope metadata; exact source bytes, MIME and no-store headers for all nine public PWA resources; manifest identity/start/scope/display; and public worker origin/write refusal. The script and full SHA-256 receipt are retained in ignored `.conclave/check-pwa-release.mjs` and `.conclave/pwa-public-release.json`.

This documentation receipt has no runtime/package changes from the verified implementation. Any subsequent documentation-only main deployment must be observed separately; the hosted progress log records the final verified head/deployment.

Browser validation uses synthetic fixtures; native OS installation, iOS/Android standalone sign-in and real-device account acceptance remain pending. Converse synchronization was completed locally before the user narrowed the remaining work to Conclave; no Converse push, merge or deployment was performed.
