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

Full source and snapshot checks are recorded in project context after completion. Deployment and a fresh real ChatGPT mobile connection remain pending. The consumed approval page cannot be reused; start Connect again from ChatGPT after release. No schema migration, new dependency, main merge or Converse production deployment is needed.
