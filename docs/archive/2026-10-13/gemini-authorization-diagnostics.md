# Gemini app authorization investigation — October 13, 2026

Google now documents custom MCP apps in the consumer Gemini web app, with use
after linking on web/mobile. Current requirements are a personal account, US,
age 18+, English, and Keep Activity enabled. Setup uses Connected Apps → Custom
apps → MCP URL; dynamic registration is supported.

Source: https://support.google.com/gemini/answer/17209137 (read October 13).
This establishes a documented installation route, not Conclave compatibility.

## Observed production behavior

The user repeatedly receives “Account linking is required to use this custom
app. Try again.” without reaching Conclave sign-in or seeing a blocked popup.
Read-only Railway HTTP logs show repeated Google discovery requests returning
200, unauthenticated MCP requests returning the expected 401, and OpenAuth
registration requests returning 201. At 16:33:37, 16:34:14, and 16:35:50 UTC,
browser requests to `/authorize` return 302 without subsequent `/connect`
requests. This strongly suggests rejection during authorization, but HTTP logs
do not contain the redirect destination or query parameters and cannot identify
the exact validation failure. No successful Gemini consent or token exchange
was observed. The SDK redirects OAuth validation errors to the client, which
explains why a 302 alone does not establish success.

Browser inspection failed to initialize with “failed to write kernel assets:
The system cannot find the path specified. (os error 3)” in both available JS
runtimes. No browser interaction or account approval was performed.

## Prepared locally

`src/handoff-hosted.js` records rejected authorization redirects using fixed
error categories and booleans for required parameter presence/compatibility.
It never logs request URLs, callback URLs, state, challenge values, client IDs,
tokens, passwords, arbitrary error descriptions, or handoff content. Successful
authorization is silent. The diagnostic sink cannot change authorization
outcomes if it throws. Existing authentication requirements remain enforced.

Validation: all five `test/handoff-hosted.test.js` cases pass, including real
local HTTP OAuth/consent/PKCE/MCP/revocation coverage, added missing-resource,
missing-challenge and unsupported-scope diagnostics, and checks that sensitive
parameter values are absent from diagnostic output. Source syntax check passes.
These are local fixture checks, not real Gemini acceptance.

On the current production baseline, the complete root suite passes 377 tests
with one optional skip at four-file concurrency, and `npm run check` passes.
Tests use a workspace-local temporary directory: the first run in Windows'
sandbox temporary directory hit filesystem rename EPERM errors. Regenerating
the embedded UI resolved checkout line-ending differences; its tracked bytes
are unchanged and it is not part of this release.

The user explicitly approved publishing and deploying this diagnostic change
on October 13. It is applied to the current production source `f642970` in an
isolated checkout, excluding the canonical checkout's pending data-removal work
and unrelated edits. Production verification remains pending. After deployment
and a fresh Gemini attempt, inspect
`conclave.oauth.authorization_rejected` runtime events before choosing a fix.
Do not relax PKCE, scopes or resource binding based on the generic UI error.
