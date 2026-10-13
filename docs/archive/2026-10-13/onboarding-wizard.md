# Hosted dashboard onboarding wizard

Implemented from `conclave-onboarding-wizard-for-pre-publication-connectors--72`, revision 1. This is a local implementation; no publication, production deployment or account configuration changes were performed.

## Behavior

The hosted dashboard replaces its old first-handoff panel with Choose your AI → Connect Conclave → Save a Clyp. Empty libraries open setup automatically; existing libraries have a Connect an AI button. The flow can be dismissed and resumed. ChatGPT, Claude and Gemini have separate instructions, availability requirements, official guidance links, a copyable server address and a harmless sample prompt. The signed-in Conclave email is visible beside the reminder to use the same Conclave account across apps.

The prompt creates a Clyp about a short walk, with a random UUID in its exact title and summary. Retries ask the AI to reuse the exact test. Checking searches for that marker and reads the matching immutable revision through the existing owner-scoped APIs. It requires a complete Clyp with the exact title and summary. Missing, ambiguous, incomplete, legacy or unrelated packets cannot produce success. Users can supply the returned reference to resolve ambiguity. This proves the saved test exists in the signed-in account; neither reported source_app nor a client display name establishes provider identity.

An optional second-AI walkthrough provides the corresponding setup instructions and a continuation prompt pinned to the verified reference/revision. The user can acknowledge retrieval, explicitly labeled as a manual confirmation. No automatic provider-attribution or retrieval tracking is introduced.

## Implementation and privacy

- `src/resources/dashboard/onboarding.{html,js,css}` contains the hosted wizard. No external scripts or inline script/CSP exceptions.
- `src/handoff-dashboard.js` serves a hosted-only authenticated GET `/dashboard/api/setup` with account email, origin-derived MCP URL and an opaque account scope. Wizard reads include this scope; changing accounts in another tab returns 409 instead of verifying the other account.
- Browser storage contains only a version, random marker, provider selections, step, dismissal flag and timestamp, separately keyed per account and accepted for seven days. It contains no email, token, grant or packet text. Cached progress is never proof of a save. Setup works without persistent storage; copy failure selects text for manual copying.
- Dashboard verification remains read-only, using explicit checks rather than polling. No database migration, new model/API-key requirement, browser write endpoint or automatic installation.
- Local/unbranded dashboards and the embedded MCP library do not display the hosted wizard.

## Verification

- Source syntax, generated MCP UI and credential checks passed.
- Integrated engine suite with four-file concurrency: 377 passed, one optional skip, including owner/account binding and session expiration.
- Dashboard/PWA browser suite: 26 passed in Edge, desktop and 390px mobile emulation, including all six wizard cases and the existing installation/offline checks.
- MCP transport and consent/sign-in suite: 12 passed. Embedded MCP library: 14 desktop/mobile browser cases passed.
- Synthetic saves use an in-memory service and real dashboard read adapter. Tests cover resume with the same marker, legacy rejection, immutable revision verification, exact continuation references, manual retrieval wording, blocked storage/clipboard, expired/changed accounts, and delayed empty-library loading.
- Screenshots were reviewed for desktop and mobile layout. Windows sandbox Edge failed at launch; the synthetic browser run passed outside that sandbox.

Real provider installation, OAuth consent, cross-account isolation in real clients, iOS/Safari behavior and first-time-user completion remain separate acceptance work. Observe a small group of nontechnical users: setup availability, time to first save, step requiring help, and successful second-app retrieval. No behavioral analytics are shipped by this change.

Provider guidance checked October 13, 2026: [ChatGPT](https://developers.openai.com/api/docs/guides/custom-mcp-server), [Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [Gemini](https://support.google.com/gemini/answer/17209137?hl=en). Settings navigation can change and account eligibility must be rechecked before release. In particular, Gemini setup uses the web app and currently requires a personal US account, age 18+, English and Keep Activity enabled.

## Integration

The verified source is branch `codex/onboarding-wizard` in `E:/Coding/converse/.test-tmp/conclave-onboarding`, based on `2796e3d`. It preserves the deployed Gemini state-size compatibility fix, compact dashboard and PWA. The original development checkout remains on its earlier branch with unrelated edits preserved; the feature-only development commit is `e4cbf90`. No pending data-removal migration or unrelated edits were pulled into this integration branch. Converse receives the managed source snapshot through the normal sync script; neither repository is pushed or deployed by this work.
