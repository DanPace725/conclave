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
on October 13. The first diagnostic release `1edaae7`, based on production
`f642970` in an isolated checkout, is verified live in Railway deployment
`be51986e-4a9f-41d8-beb1-c6ba7fc8e32c` (SUCCESS). All 16 public checks pass,
and an intentional synthetic missing-resource request produced the expected
structured `invalid_target` diagnostic. Converse snapshot `f4e2d45` remains
local/unpushed, with 121-file parity, checks and 203 tests passing/one skip.
Hosted progress revision 17 records that release. After a fresh Gemini attempt,
inspect
`conclave.oauth.authorization_rejected` runtime events before choosing a fix.
Do not relax PKCE, scopes or resource binding based on the generic UI error.

## Real retry and diagnostic refinement

October 13 retries at 17:24:25 and 17:25:08 UTC reached `/authorize`, with
structured diagnostics reporting `invalid_request`. Response type, challenge
presence, S256 method, resource presence/exact match, supported scopes and state
presence all pass. The browser screenshot's report-only script policy messages,
blocked Gemini manifest and GPU warnings do not identify this OAuth rejection.

The first diagnostic omitted the remaining provider bounds: S256 challenge
format and a 1,000-character state cap. A diagnostic-only refinement records
challenge validity and state length, without raw values or authorization
behavior changes. Local fixture coverage distinguishes an oversized 2,048-
character state from a malformed challenge and checks neither value is logged.
The actual Gemini size/format failure remains unestablished until the refined
diagnostic is deployed and another real request is observed. Do not treat the
synthetic over-limit test as a measured Gemini state size.

## Confirmed cause and prepared compatibility fix

After the refined deployment, real Gemini retries at 17:32:31 and 17:32:56 UTC
show `code_challenge_valid: true` and state lengths 1,367 and 1,371 characters.
All other required-field/resource/scope/method checks pass. These requests
exceed Conclave's hardcoded 1,000-character bound in `HandoffOAuthProvider`
and are rejected before a pending consent request can be created. This confirms
the size cap is the blocker for reaching consent, not the browser console
manifest/GPU messages. Later Gemini consent, callback and tool behavior remain
unverified.

The prepared local fix accepts opaque state up to 4,096 UTF-8 bytes and preserves
the exact value. It keeps a finite storage bound and retains PKCE, resource,
client, callback, scope, nonce, consent and owner validation. The existing local
HTTP round trip now exercises a 1,380-character state through consent, callback,
code exchange, MCP and revocation. Tests reject 4,097 ASCII bytes, exercise the
4,096-byte boundary for ASCII and multibyte state, and reject multibyte input
over that byte bound. Raw state values remain excluded from diagnostics.

The user approved diagnostics; this authentication compatibility change needs
separate production approval. It is prepared locally and not deployed.
