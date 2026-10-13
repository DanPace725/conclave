# Website navigation and help organization

October 13, 2026. User requested a minimal plain-language Getting Started tab, a technical Docs tab, and Connections under Account with a circle profile button at the top right. Scope is Conclave only; pushing is authorized.

Implemented on `codex/conclave-navigation` from published main `2796e3d524c0af85e9faf8a559298bfbe2364345` in an isolated checkout. Unrelated canonical-checkout edits and the pending data-removal release were excluded.

- Shared website header: Dashboard, Getting Started, Docs, and a 44px circular Account link with an accessible name, keyboard focus and current-page indication. Phones put the profile button beside the brand and navigation on a second row.
- `/get-started`: connect apps using the same Conclave account, save a handoff, and retrieve it elsewhere. Two copyable example prompts and a server address; connection details link to Docs.
- `/docs`: detailed setup, OAuth/Streamable HTTP, account choice, permission scopes, tool names, optimistic revision handling, retries, library/graph behavior and troubleshooting.
- `/account`: account identity, Connections → Manage connections, password and sign-out controls. Existing root account and connection/consent routes remain available. Sign-out and revocation retain their existing semantics.
- The embedded MCP App and unbranded dashboard presentation retain their navigation. No schema, dependencies, authentication rules, worker, manifest or API changes.

Validation uses synthetic local data and mocked authentication, not live account acceptance:

- `npm run check`: syntax, generated resources and credential checks pass. The fresh Windows checkout needed a local UI rebuild to settle CRLF formatting; Git reports no generated-bundle content change.
- `node scripts/test.js test/handoff-dashboard.test.js test/handoff-hosted.test.js`: 9 focused HTTP/storage/access-control tests pass.
- `node scripts/test.js test/hosted-standalone.test.js`: 9 tests pass, including public Docs, account routing, two OAuth clients and owner isolation.
- Existing consent/login browser suites: 8 checks pass across desktop, mobile and JavaScript-disabled pages. The login suite traverses real Account → Manage connections → Account routes before sign-out.
- `node scripts/test-dashboard-ui.js --workers=2`: all 20 desktop/mobile dashboard/PWA browser cases pass. The changed navigation case follows Getting Started → Docs → troubleshooting → privacy → Account → Connections → Dashboard and checks active tabs, a round 44px profile target and no horizontal overflow. A final two-case visual rerun passes after settling theme-transition screenshots.
- Light/dark desktop and mobile screenshots reviewed under `.conclave/dashboard-test-results`; production-shaped Account screenshots are under `.conclave/hosted-login-previews`.

Browser launches required execution outside the filesystem sandbox because Edge exited during sandbox startup. No application failure remained after rerunning there. An old HTTP assertion expecting connection instructions on Account was updated to verify its new Connections entry. Public support remains available through the footer and Docs.

Publication is a Conclave feature-branch push. Production deployment and real signed-in device acceptance remain pending; Converse was not changed or synchronized at the user's request.
