# Releasing the dashboard on Railway

Use the existing independent Conclave Railway service. The dashboard runs in the same process as `/mcp`, uses the existing browser sign-in and owner-scoped Neon packet store, and needs no new database migration, variable or service. Keep Converse's Vercel application and production configuration unchanged.

## Inspected configuration

Read-only Railway inspection on October 7, 2026 confirmed one service and one production environment, with no preview environment or staged changes:

- Project: `8414b456-9878-4fb0-b0ec-40d0a9364aa7` (Conclave).
- Service: `2958d211-36be-40b0-9426-b5bc6a2e158b` (conclave-mcp).
- Environment: `2184f8e0-6f22-47f5-9836-be3fb1428d29` (production).
- Origin: `https://conclave-mcp-production.up.railway.app`.
- Start: `node packages/conclave-hosted/src/server.js`; pre-deploy: `node packages/conclave-hosted/src/migrate.js`; healthcheck: `/healthz`.
- Previous successful deployment: `52deb270-d20a-471d-9f17-da6db6c7abe8`, commit `40128be2c325299c20a00ef145a8d61d35cc6b7a`, labeled `codex/conclave-hosted`.

The service config reports the GitHub repository but not its branch or commit pin. Deployment metadata supplies the prior commit/branch; do not infer that pushing a branch will redeploy it. Inspect live settings immediately before releasing.

The Dockerfile copies `src/` (including all dashboard assets) and the hosted package, then starts the independent server. No build-time UI bundle or CDN is needed for the standalone dashboard. The container build itself must be confirmed through Railway's build result.

## Release sequence

1. Inspect clean local source and snapshot state, the intended delta, and existing tests. Dashboard implementation has passed the source suite, focused signed-session/owner-isolation tests and desktop/narrow browser cases. Confirm migration parity and Converse checks.
2. Publish `codex/conclave-dashboard` in both repositories and verify their remote SHAs. Open review PRs against the matching hosted branches so the dashboard increment is isolated from earlier hosted work. Attach each created PR to the Codex task.
3. Get the environment's staged changes. Stage only Conclave's GitHub source in this environment, pinned to the published, tested source commit. Re-read the staged diff and verify no variables, domains, volumes, unrelated services or database settings are changing. Explicit user approval for publishing/deploying is required; automatic approval review rejected the initial push because the request did not expressly authorize publication.
4. Apply the reviewed source change. Confirm the new deployment reaches SUCCESS and its `commitHash` matches the intended source SHA. Keep the prior successful deployment ID for rollback. Do not count Git publication as deployment.
5. Run the public release checks:

   ```powershell
   node scripts/check-hosted-dashboard.js https://conclave-mcp-production.up.railway.app
   ```

   The script checks readiness, anonymous dashboard/API rejection, write refusal, foreign-origin rejection, and preserved MCP authentication/read-write discovery. It sends no login code and does not read or write saved packets.
6. Open `/dashboard` in a browser with the owner's real Conclave session. If signed out, have the user sign in; sending a real sign-in email requires explicit authorization for that request. Inspect the user's chosen packet, earlier revision and exact comparisons without logging private packet text. Confirm the account link and connection-management page still work. Public checks and signed-cookie fixtures do not establish this real browser result.
7. Record the deployment ID, exact deployed SHA, meaningful checks, remaining account work and rollback reference in the local project context and hosted Conclave progress log after verified pushes. Preserve the log's existing decisions/constraints/history and use its current revision when saving. A failed hosted save must be reported, not replaced with a local/direct-database write.

## Rollback

If the new build fails to become healthy, check whether Railway retained the previous live deployment before taking further action. For a successful deployment that has a regression, redeploy the prior successful build `52deb270-d20a-471d-9f17-da6db6c7abe8` in the same service/environment and verify readiness and the MCP challenge again. This uses the existing database; do not restore or erase packet history.

Also reconcile the configured source pin to the accepted release or rollback commit so a later deploy does not unexpectedly reintroduce the rejected build. Preserve the domain, account secrets, Neon configuration, OAuth grants and Converse deployment settings. Do not automatically repeat a failed deployment or resend email codes.

## Deferred work

Explicit project grouping and agreed canonical state need a data-model decision. Branch/merge handling and task routing remain separate increments. Validate the hosted dashboard first, then choose the next product feature from [the dashboard guide](DASHBOARD.md). A separate staging environment and indexed account read projections remain operational follow-ups.
