# Hosted account sign-in

The hosted service offers email/password and Google sign-in, with email codes as a backup. Email is the username. Authentication stays in the existing dedicated Neon Auth project; the verified Neon account ID remains the handoff owner. This does not change local plugins, Converse sign-in or connected apps' OAuth permissions. The implementation deployed October 12 at `df75f9a`; public page/security checks passed. Google production credentials and real-account sign-in/recovery acceptance remain outstanding. [Release evidence](archive/2026-10-12/hosted-polish-main-release.md)

First-time admitted users create their account with Google or an email sign-in code. They can then choose **Set or reset your password**, receive a recovery code and set a 12–128 character password. Existing code-only and Google accounts use that same recovery flow to add a password. This avoids creating an unverified password account with a different handoff owner.

## Account admission: restricted or public

The prepared public-signup change makes `CONCLAVE_ALLOWED_EMAILS` an explicit admission choice:

- A comma-separated list such as `alice@example.com,bob@example.com` keeps sign-in restricted to those accounts.
- Exactly `*` admits any valid, **verified** email account through Google, email codes or password sign-in. It does not permit anonymous access or change handoff/OAuth ownership.
- Missing/empty configuration and mixing `*` with addresses fail startup. Public signup must be intentional.

Deploy the supporting source before changing Railway's variable to `*`: the earlier deployed code rejects wildcards and would fail startup. Existing account IDs, saved handoffs and app grants need no migration. Reverting the variable to an address list blocks browser sign-in/session use for accounts outside that list; it does not revoke their already-issued app grants. Revoke those separately if needed.

The login and public pages reflect the selected mode. Code/recovery sends share a durable ten-per-hour IP budget across addresses and methods, in addition to the five-per-hour account/method budget. Password/code/recovery verification shares a sixty-per-hour IP budget, with existing account/method limits retained. Google start remains twenty per hour per IP. Shared-network users share their IP budget; upstream Neon mail/auth limits also apply.

Google's OAuth client must permit the intended audience (External for users outside a Workspace organization), and Neon must allow account creation. Keep Google permissions limited to identity (`openid`, email and profile). Google's current documentation gives identity-only sign-in an exception to the usual Testing test-user restriction; requests for additional scopes can have different restrictions. Workspace administrators can independently block an app. Conclave's own email allowlist is separate from those Google settings. [Google app state and identity exception](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)

Public policy URLs are `/privacy` and `/terms`, with `/get-started` as the information homepage. Google brand verification requires an owned, verified domain for the homepage and policy links; a hosting-provider URL is not proof of domain ownership. [Google brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)

## Security and behavior

- Password/code requests are relayed from native same-origin forms to Neon's documented API. Password hashes stay managed by Neon. Raw passwords, codes and upstream session tokens are neither saved in Conclave records nor returned to browser JavaScript.
- Password sign-in requires a verified email matching the returned identity and the configured admission policy. Existing shorter passwords can still sign in; the 12–128 character policy applies to new/replacement passwords.
- Sign-in/recovery forms retain Origin plus signed-cookie CSRF checks, bounded bodies and durable attempt budgets. Passwords are never repopulated after an error. Google start uses a CSRF-protected POST and an IP attempt budget.
- Google uses the Neon challenge/verifier exchange. A signed, HttpOnly, Lax temporary cookie binds random state to a ten-minute durable record. A callback consumes that record atomically once, across server restarts. Redirect targets must be HTTPS on Google Accounts or the configured Neon Auth origin.
- A same-origin completion document starts external Google navigation, with a manual link for scriptless browsers. The returning browser repeats the callback as a same-origin navigation before setting the Conclave session, following the existing tested Converse return pattern. The two services do not share cookies or users.
- Password recovery invalidates earlier Conclave website sessions through a reset timestamp retained for eight days (longer than the seven-day cookie). Connected-app grants remain active and can be revoked under Connections. Changing a password does not erase saved handoffs.

## Production Google setup

Read-only inspection on October 12, 2026 found email/password auth enabled, verification method `otp`, and the hosted origin already trusted. Google is configured with Neon's **shared development** credentials. No production Auth settings were changed.

1. In Didactech Industries' Google Cloud project, configure the OAuth consent screen and a **Web application** client for Conclave. Complete any Google audience/testing or verification requirements that apply.
2. Add the exact redirect URI **`{NEON_AUTH_BASE_URL}/callback/google`**, using this Conclave branch's Auth URL from the Neon Console. The app's `/signin/google/return` is a different, later return address; do not substitute it for Google's authorized redirect.
3. Configure that client's ID and secret in **Conclave's** Neon Auth Google provider. Enter the secret in the provider console/secret workflow, not in chat, source files or this repository's public plugin package. Preserve other provider and branch settings. Do not copy Converse credentials by assumption.
4. Keep `https://conclave-mcp-production.up.railway.app` in Neon trusted domains. The app returns to `/signin/google/return` with one-use state. Existing `NEON_AUTH_BASE_URL` and `CONCLAVE_SESSION_SECRET` settings remain in use; no new application secret or database migration is required.
5. After explicit release approval, deploy the source and check the actual live SHA, health, all sign-in methods, first-time account creation, password setup/reset and old-session invalidation. Test one existing account through code/password/Google and verify its saved handoffs and account ID remain the same. Real identity linking and mail delivery cannot be established by fixtures.

Neon documents [Google production configuration](https://neon.com/docs/auth/guides/setup-oauth), [email-code password recovery](https://neon.com/docs/auth/guides/plugins/email-otp), and the [production checklist](https://neon.com/docs/auth/production-checklist). The implementation was also checked against this branch's public `/open-api/generate-schema`; only that read-only endpoint and configuration inspection touched the real service.

## Sign in with ChatGPT assessment

See the dated [feasibility review](archive/2026-10-12/sign-in-with-chatgpt.md). It is researched, not enabled or implemented in this batch.
