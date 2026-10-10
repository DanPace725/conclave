# Mobile OAuth return after consent

October 8, 2026. The user reported that ChatGPT mobile stays on Conclave's signed-in consent page after Allow connection, then asks them to sign in again after another tap.

## Evidence

Read-only Railway HTTP logs show repeated Android Chrome consent attempts between 15:00 and 15:05 UTC. Each first POST to `/connect` returned 303; repeated submissions returned 403. No new `/token` exchange followed those approvals in the inspected window. Production deployment `3a2c5029-1d16-4a64-97ab-45631410e4c5` is SUCCESS at `f0e5e2d`. Login and consent approval succeeded; the failure is downstream of approval. No account/grant records were modified during diagnosis.

The earlier fix allowed the validated callback origin in `form-action`. Chromium also applies this policy to redirects after that callback. An isolated browser fixture with three localhost origins reproduced the stall in the actual hosted adapter: native approval was accepted, but a callback redirect to a third origin was blocked by CSP. Desktop and mobile simulations both failed before the correction. [MDN documents the redirect behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action). The real phone's final redirect chain was not captured, so that chain remains an inferred explanation for the matching production symptom.

## Correction

Consent now finishes the same-origin native POST with a 200 completion document instead of a cross-origin HTTP redirect. A static same-origin script navigates to the exact validated OAuth callback from that new document. The document also offers a visible Return to the app link for browsers requiring a tap or running without JavaScript. Cancel uses the same return mechanism with `access_denied`. No callback is followed server-side.

Every form retains `form-action 'self'`; inline scripts remain blocked. Identity, allowlist, canonical Origin, CSRF, pending nonce, atomic single-use approval, PKCE, resource and owner binding remain mandatory. The completion document is not cached, suppresses external referrers and clears the pending cookie. It contains only the normal short-lived OAuth callback code, never bearer/refresh tokens. The standalone and shared adapters use the same completion route.

## Validation and release state

Ten focused hosted HTTP/identity/storage/OAuth checks pass. The same isolated Edge browser fixture now passes desktop and mobile automatic return through the third origin, with a successful PKCE token exchange; scriptless Cancel reaches that origin through the manual link and creates no grant. Fixture identity, storage and callback servers are synthetic; no real login, email, app grant or hosted packet was used. Run it with `node scripts/test.js packages/conclave-hosted/test/consent-browser.test.js`. Windows sandbox restrictions prevented Edge startup, so the browser fixture ran outside that sandbox after automatic approval.

Full source checks passed: 364 tests / one optional skip and syntax/resources. The synchronized Converse snapshot passed 203 tests / one optional skip and syntax/parity; all 106 managed files match. No schema migration, new dependency, main merge or Converse production deployment was performed.

## Authorized release and local progress note

After the user approved publication and deployment, source `58e8a2de7403326164cd99fccdd5853165fa28c8` and snapshot `f69af05da219dce453951e7640b27b15926b0ba8` were pushed to their existing `codex/conclave-dashboard` branches. Both remote SHAs were independently verified. Railway automatically built the source push without a commit pin or configuration change; deployment `90de52e5-8586-4413-a530-785700a16337` reached SUCCESS at that exact source commit on October 8 at 15:20:23 UTC. A same-source staging check made no changes; production has no pending patch.

Fourteen public HTTPS checks passed: readiness, dashboard access/write protections, MCP authorization and scope discovery, OAuth/PKCE metadata, login policy, the new callback script's served body/security headers, and rejection of unauthenticated approval. No real account, login email, OAuth grant or saved packet was changed by these release checks. A fresh real ChatGPT mobile connection remains the acceptance check; close the consumed approval page and start Connect again from ChatGPT. If automatic return stalls, tap Return to ChatGPT on the new completion page.

The required hosted progress packet `conv_dbf6967e-b36c-4200-8489-cff38c5d4eca` could not be updated: this session exposes no hosted Conclave tools, and plugin discovery returned no Conclave match. This section is the local handoff note required by AGENTS.md. Do not claim a hosted save or substitute local-store/direct-database writes. Once the hosted connector is available, retrieve the latest packet and reconcile this release entry using its current revision and a fresh request ID.
