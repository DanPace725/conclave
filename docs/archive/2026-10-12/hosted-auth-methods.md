# Hosted authentication methods — October 12, 2026

## Authorized scope

User requested normal password sign-in and Google SSO for hosted Conclave, retaining email codes as backup, and a feasibility review of new Sign in with ChatGPT documentation. The user selected email as the username. This batch stays on the existing local `codex/hosted-polish` branch and does not publish/deploy earlier presentation work.

## Implementation

Added a native password form, Google sign-in, distinct email-code fallback and code-based password setup/recovery. First-time invited accounts enter through Google or the existing code flow; existing users add a password through Neon's recovery API. Password authentication and hashing stay in the same dedicated Neon Auth project. Verified Neon IDs remain handoff owners; no account or handoff migration is performed.

`identity.js` shares bounded upstream request/error/verified-user handling. It accepts only invited verified emails, matching the submitted email for password/code sign-in. Raw upstream tokens never become application cookies. Errors do not echo upstream diagnostics or passwords. Existing code-sign-in tests remain compatible.

`signin.js` keeps page rendering and method routing separate from the standalone account/app adapter. Native form Origin/CSRF guards, durable per-account rate budgets and bounded request bodies remain in place. New passwords require 12–128 characters and confirmation; existing shorter passwords can still sign in. Google start has a CSRF-protected POST and an IP budget.

Google's short-lived Neon challenge is stored in the existing durable record store under a digest of fresh random state. A signed HttpOnly browser cookie binds that state to the browser; callback consumption is atomic and one-use, and survives an application restart. The returned account must be invited and verified. Google redirect targets are restricted to HTTPS Google Accounts or the trusted Auth origin. An explicit same-origin completion page avoids form-action redirect issues; the return leg repeats as a same-origin navigation before cookie exchange, preserving the existing Converse mobile/Safari strategy without sharing identities. Manual navigation works with JavaScript disabled.

Successful password recovery records a timestamp and clears the website cookie. Subsequent protected requests reject older browser cookies, including cookies from a prior release. The marker lasts longer than the maximum cookie lifetime. App grants and saved handoffs are preserved and separately revocable. Expired records are rejected but cleanup scheduling remains open work.

The support/privacy copy and active authentication guide describe all methods, first-time setup, credential handling, session versus app-grant behavior and remaining release checks. The ChatGPT feasibility report is researched only; no unapproved sign-in button, inference access or provider registration is added.

## Meaningful validation

`npm run verify` completed successfully (`.conclave/hosted-auth-full-verify.log`): syntax/resource checks; **376 engine passes, one optional skip**; **12 transport/consent/login checks** including the new desktop/mobile/scriptless login subcases; **14 embedded plus 14 dashboard browser cases**.

Minimal existing identity assertions were extended for unverified/wrong-email password rejection and an unsafe Google redirect. One combined HTTP lifecycle test verifies password errors/receipts, recovery/old-cookie invalidation, CSRF rejection, one-use browser-bound Google return, durable state across a recreated app, unchanged account ID, attempt exhaustion and absence of raw passwords/tokens in stored records. One browser scenario exercises real forms/cookies with synthetic Neon responses in desktop/mobile/scriptless modes and captures login/recovery previews. No live email, user password, OAuth grant or handoff was used.

Browser screenshots are under `.conclave/hosted-login-previews/`. They use `pilot@example.test` and synthetic codes/passwords, not production credentials. Layout and actual navigation were inspected. Scriptless mode retains the manual Google link and automatic same-origin meta return.

## Live read-only findings and remaining setup

- The actual branch's public `/open-api/generate-schema` exposes password sign-in, social sign-in/session exchange and email-OTP password-recovery endpoints with the request/response shapes used here.
- Neon CLI inspection: password auth enabled; verification method OTP; require verification false. Conclave independently insists on a verified account before issuing its session.
- Google provider is **shared**, and the hosted origin is already trusted. Production needs a Didactech-owned Web OAuth client with `{NEON_AUTH_BASE_URL}/callback/google` registered, configured in this Conclave Neon branch. No secret should be pasted into chat or committed.
- Connector-based Neon config reads requested reauthentication repeatedly; the working CLI was used read-only instead. Sandbox initially prevented CLI refresh-lock writes; the approved read-only CLI run succeeded. No Auth settings were changed.

Production Google credential setup, explicit publication/deployment approval and real-account tests remain outstanding. Confirm the same existing account's ID/handoffs across password, code and Google, actual mail delivery, recovery and old-session invalidation, then real ChatGPT/Claude reconnection. Snapshot receipt/checks are recorded in Converse after canonical commit. Earlier hosted presentation work and this authentication work are still local.

See [operational setup](../../HOSTED_AUTH.md) and [ChatGPT feasibility and official sources](sign-in-with-chatgpt.md).
