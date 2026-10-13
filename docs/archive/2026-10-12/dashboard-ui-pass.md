# Dashboard, account pages and embedded card UI pass — October 12, 2026

## Why

A review of the hosted dashboard/PWA, account pages and MCP App at desktop and phone widths, using the synthetic previews. The main findings: a phone's first screen showed no handoffs; copy/export feedback appeared below a long handoff, out of view; signed-in account pages had no link back to the dashboard, which strands an installed window without browser controls; and the three surfaces disagreed on navigation labels, dates and several terms.

## Change

Dashboard and PWA (`src/resources/dashboard`):

- One compact header row: the heading with **Install Conclave** (when the browser offers it), **Show connections** and **Refresh**. The eyebrow line is removed and the subheading is hidden on phones. At 375px the first handoff is now on the first screen.
- **Use Conclave as an app** moves from a band above the list to a disclosure above the footer. A failed install prompt opens it and scrolls it into view.
- Navigation is Connections · Account · Help. Get started remains reachable from Help, the footer of account pages and the first-handoff prompt.
- Status messages (copied, exported, clipboard fallback, invalid link) are a toast fixed to the bottom of the window and clear after eight seconds.
- List cards carry one meta line (reported app · revision · date) and no longer print “not reported” placeholders; the reference stays to distinguish duplicate titles. Small text is 12px.
- The empty detail panel is centered on desktop and hidden on phones, where it was a 400px blank card under the list. **← All handoffs** returns to the selected card.
- Connections: `12 handoffs · 1 explicit link · All projects`, with the server's provenance note below the graph as in the MCP App. The search caveat appears only while a search is active.
- Linked context sits above the collapsible sections. Comparison headings use sentence case. “Copy ID” is **Copy reference**. User-facing “packet” wording is “handoff”. Prompts sent to models are unchanged.

Hosted account pages (`packages/conclave-hosted`, `src/handoff-hosted.js`):

- Signed-in pages show Dashboard · Connections · Account · Help; signed-out pages show Get started · Help. The footer uses the same labels (previously “How it works”/“Support” for the same links).
- The tagline appears on sign-in only, not under every title. The account page is titled **Your account** (its tab read “Conclave · Conclave”).
- Connections list a name, `Can read and save handoffs` or `Can read handoffs`, and a UTC calendar date, replacing raw scope strings and an ISO timestamp.
- The independent service's consent page no longer refers to Converse chats or canonical memory. Converse's embedded consent text is unchanged apart from “handoffs” for “handoff packets”.
- The duplicated “Verified account required” line is removed from sign-in; the footer keeps it. The dashboard link's button style is a class rather than an `href` selector.

MCP App (`packages/conclave-mcp/ui`, regenerated `src/resources/handoff-app.html`): localized dates instead of ISO strings, correct singulars, sentence-case comparison headings.

No API, schema, worker cache, manifest or dependency change. The offline page is untouched, so the worker cache version stays.

## Validation

- `node scripts/check.js`: syntax, credential checks and MCP UI bundle parity pass.
- `node scripts/test.js`: 377 passing, one optional skip.
- Transport, consent and login browser checks: 12 passing.
- `node scripts/test-dashboard-ui.js`: 18 passing desktop/mobile cases. `node scripts/test-handoff-ui.js`: 14 passing. Three assertions changed for the `explicit link` singular.
- Reviewed at 1440px and 375px in light and dark schemes, plus the sign-in, account, consent and connections pages through a temporary in-memory harness with a synthetic account. Fixtures are synthetic.

## Limits and open choice

Real-device installation, standalone navigation on iOS/Android and real ChatGPT/Claude rendering remain acceptance checks. The dashboard says “revision” and the MCP App says “version” for the same thing; that wording was left for a product decision.
