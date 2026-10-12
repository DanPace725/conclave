# Sign in with ChatGPT feasibility — October 12, 2026

## Decision

Worth considering as a later hosted login option. The protocol is conventional, but this is **moderate integration work**, not an extra Google provider switch. No ChatGPT sign-in code, client registration, waitlist submission, inference access or new model credentials were added in this batch.

The immediate prerequisite is eligibility: OpenAI's current website/client-ID documentation says hosted identity sign-in is a limited trial for selected commercial partners. The client-ID page links an interest form; plugin-modal enablement also requires OpenAI partnerships involvement. The open-source client flow for ChatGPT plan usage is a separate integration and does not establish hosted Conclave eligibility. [Quickstart](https://developers.openai.com/siwc/quickstart) · [Request a client ID](https://developers.openai.com/siwc/request-client-id)

## Website implementation

Use the documented Authorization Code + PKCE + OpenID Connect flow with only `openid profile email` for identity. Obtain an approved client ID, exact callback registration and the provisioned token-endpoint authentication method. Load issuer/endpoints/JWKS from OpenAI discovery. Keep state, nonce and verifier in short-lived, browser-bound, atomically consumed server storage; verify token signature, issuer, audience, expiry and nonce before creating a Conclave session. A maintained OIDC/JWT library is preferable to handwritten verification. Discard raw identity tokens after resolving the account. [Website guide](https://developers.openai.com/siwc/website)

The main Conclave-specific work is account resolution. Handoffs currently belong to the verified Neon user ID. Store a unique external mapping keyed by issuer, client ID and OpenAI subject, pointing to that existing owner. Existing users must confirm linking through an authenticated Conclave session or an explicit proof-of-ownership flow; an email match or `login_hint` alone must never merge accounts. Decide how first-time ChatGPT users provision a canonical account while preserving pilot admission. [Account-linking requirements](https://developers.openai.com/siwc/website#7-find-create-or-link-the-local-account)

Current Neon Managed Auth documentation lists Google, GitHub and Vercel social sign-in and a fixed plugin subset. It does not document a ready-made ChatGPT provider toggle. My inference: plan for a Conclave-owned OIDC adapter and identity-mapping persistence unless Neon adds an officially supported bridge. Preserve working Neon password/Google/code authentication rather than replacing the identity system to obtain one provider. [Neon OAuth setup](https://neon.com/docs/auth/guides/setup-oauth) · [Managed plugins](https://neon.com/docs/auth/guides/plugins)

## Connector integration

ChatGPT plugin sign-in adds a second transaction: the existing outer Conclave OAuth flow grants handoff access; the inner OpenAI OIDC flow proves identity. Keep their clients, callbacks, state, codes, PKCE values and tokens separate. Save the validated outer request, complete inner sign-in/account linking, then resume Conclave consent and return only a Conclave authorization code to ChatGPT. `target_flow=chatgpt_siwc` selects the experience and `login_hint` is only a suggestion. OpenAI must enable the Continue with ChatGPT option in the plugin modal. Conclave already has durable outer OAuth state and consent, which reduces the work. [Plugin guide](https://developers.openai.com/siwc/chatgpt-plugin)

## Effort estimate and rollout

Engineering judgment, assuming approved access and a functioning test client: roughly **2–4 focused development days** for website OIDC, durable account linking, fixtures and first client checks; allow additional time for plugin-modal wiring and broader client/reconnection tests. Approval and real-account linking verification can take longer than implementation and are not estimated here. A simple prototype would take less time but would not settle account ownership, replay rejection or safe reconnection.

Suggested sequence: request eligibility/client registration; define account/link/unlink policy; implement website sign-in behind a configuration gate; test all ID-token rejection cases and account isolation; add optional nested plugin flow; validate real ChatGPT and Claude continuation with the same Conclave owner; then enable publicly. Do not show an active ChatGPT button without an approved and tested integration.

Identity-only sign-in does not provide chat history or model API access. ChatGPT-plan inference requires separate scopes and product work; Conclave's hosted handoff service currently makes no inference calls, so it does not need those permissions. [Identity and usage scopes](https://developers.openai.com/siwc/quickstart#understand-scopes)
