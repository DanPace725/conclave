# Independent hosted Conclave pilot

2026-10-07. User authorized hosted-first separation and selected `DanPace725/conclave` as Railway's source repository. Existing Git repositories remain distinct; the standalone application now has a dedicated runtime, identity, migration history and database. The Converse engine snapshot remains compatible.

## Resources and deployment

- Implementation commit: `1b76883625dd2ad8e8fb9dfd499dbeabc9a015b3`, published and remote SHA verified on `codex/conclave-hosted`.
- Railway project `8414b456-9878-4fb0-b0ec-40d0a9364aa7`, production environment `2184f8e0-6f22-47f5-9836-be3fb1428d29`, service `2958d211-36be-40b0-9426-b5bc6a2e158b`.
- First deployment `b4f7744a-090d-4db9-b872-8c9d4b554efa` reported SUCCESS in us-west2; pre-deploy migration completed and runtime reported ready.
- Origin `https://conclave-mcp-production.up.railway.app`; MCP path `/mcp`.
- Independent Neon project `morning-sunset-04725595`, main branch `br-flat-truth-ar8qk60a`, Postgres 18, us-west-2. Neon Auth enabled and the Railway origin registered as trusted.
- Private ignored `.env.hosted`; separate session secret and explicit email allowlist. Runtime/migration connection URLs transferred privately to Railway. Full TLS certificate verification made explicit after the first deployment's pg compatibility warning.

Railway follows the hosted feature branch. Nothing was merged to main. No Converse database, auth configuration, Vercel variables or deployment was changed.

## Evidence

The complete source suite passed 360 checks / one optional skip at four-file concurrency, including five standalone regressions. Syntax/resource checks passed. These tests use isolated fixtures for identity/OAuth and PostgreSQL-compatible test storage; they establish behavior, not real app-account compatibility. One earlier existing periodic-context-review test failed under high concurrency, then passed alone and in the full bounded-concurrency run.

Standalone migration applied to the live dedicated Neon database. Railway ran it again successfully before deployment. Public GET requests returned:

| Path | Result |
| --- | --- |
| `/healthz` | 200, database ready |
| `/` | 200, Conclave email-code login |
| `/styles.css` | 200, CSS |
| `/.well-known/oauth-protected-resource/mcp` | 200, correct resource and read/write scopes |
| `/.well-known/oauth-authorization-server` | 200, hosted endpoints, DCR and S256 |
| `/mcp` without bearer token | 401 with the correct resource metadata challenge |
| `/connect` without browser session | 200, Conclave sign-in instructions |

Browser inspection confirmed the deployed Conclave login with an email field and Send email code button. No code was sent and no user login/grant was simulated in the live system.

The one shared branding adapter change was migrated to Converse after source commit. Parity matched 102 files; app syntax check passed. The full app suite passed 203 checks / one optional skip with workspace-local TEMP/TMP. An initial run had seven failures involving inaccessible sandbox temp-folder renames or their HTTP consequences. No app code fix was needed. Snapshot saved on a local branch only.

## Outstanding acceptance

Email delivery and completed real Neon sign-in are unverified. Connect ChatGPT and Claude using OAuth automatic client registration, then run the cross-app save/read/update, restart and independent-revocation checklist in [the hosted guide](../../HOSTED_HANDOFFS.md). Published distribution, local packet import/sync, cleanup/retention and broader rate controls remain future work. This is an allowlisted pilot with durable account-scoped handoffs, not a claim of public production readiness.
