# Conclave hosted handoff pilot

Conclave's next product increment prioritizes hosted continuity between ChatGPT and Claude. Both apps connect to the same account-scoped MCP service. Other MCP clients can use the same protocol and tools without adding model adapters or provider API keys.

The Conclave and Converse repositories remain distinct. Converse keeps its existing UI, engine snapshot, sign-in and database. The independent Conclave service uses `packages/conclave-hosted/`, its own Neon project and Railway deployment. It does not run conversations, inference, embeddings or agents, and does not require model API keys.

## Deployment

Deployed from `codex/conclave-hosted` in `DanPace725/conclave`:

| Resource | Configuration |
| --- | --- |
| Railway project | Conclave, `8414b456-9878-4fb0-b0ec-40d0a9364aa7` |
| Railway production environment | `2184f8e0-6f22-47f5-9836-be3fb1428d29` |
| Railway service | conclave-mcp, `2958d211-36be-40b0-9426-b5bc6a2e158b` |
| Origin | `https://conclave-mcp-production.up.railway.app` |
| MCP URL | `https://conclave-mcp-production.up.railway.app/mcp` |
| Neon project | conclave, `morning-sunset-04725595`, AWS us-west-2 |
| Neon branch | main, `br-flat-truth-ar8qk60a` |

Railway service settings: Dockerfile at the repository root; start `node packages/conclave-hosted/src/server.js`; pre-deploy `node packages/conclave-hosted/src/migrate.js`; healthcheck `/healthz`, 120 seconds; one us-west2 replica; 0.5 GB RAM and 1 vCPU limits; sleep disabled; restart on failure with three retries; 30-second draining. Railway's connector rejected the older `railwayConfigFile` setting as deprecated, so these settings are applied directly to the service rather than through `railway.json`. Future infrastructure-as-code work should use the current Railway format.

The new Neon compute is fixed at 0.25 CU, with the plan-default suspend setting (`0` in the current API); live metadata confirmed it suspends while idle. Startup fails if required configuration or handoff tables are absent. `/healthz` checks database readiness and accepts Railway's probe Host only on that route. Shutdown drains requests and ends the pool.

See `packages/conclave-hosted/.env.example` for required variables. Actual `.env.hosted` is ignored, is never bundled in Docker or committed, and uses a separate session secret. Railway holds its own copies of the variables. Runtime uses the pooled URL; migrations use the direct URL. Existing Converse credentials and configuration are not deployment inputs.

The independent migration adds only handoff events, OAuth records and lock rows, with a checksum-controlled history under `conclave_hosted`. It refuses a database containing Converse conversation or provider-key tables before modifying it. Re-running it preserves existing packets. Do not use Converse's full migration command on this service.

The first standalone dashboard is implemented on the local `codex/conclave-dashboard` branch at `/dashboard`, with a link from the signed-in account page. It uses the same browser account and existing saved packet operations; it is not yet deployed. See [dashboard usage, synthetic preview and remaining decisions](DASHBOARD.md).

## Sign in and connect

1. Open [Conclave](https://conclave-mcp-production.up.railway.app). Request an email code using an explicitly allowed pilot address, then enter the code. Neon Auth proves identity; Conclave issues its own host-scoped signed browser cookie. No provider key is needed.
2. Add a custom MCP server in ChatGPT's plugin setup using the MCP URL above. Select OAuth and dynamic/automatic client registration. Install the resulting private plugin and enable it in a conversation. Current [OpenAI setup](https://developers.openai.com/api/docs/guides/custom-mcp-server) and [authentication](https://developers.openai.com/plugins/build/auth) documentation describe the flow.
3. In Claude, open Customize → Connectors → Add custom connector, enter the same MCP URL, choose sign-in and **Register automatically** for the OAuth client. Complete sign-in and consent using the same Conclave account. Enable the connector in a conversation. See [Claude's current remote connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
4. The first version supports dynamic registration, public clients (`none`) and `client_secret_post`, OAuth discovery, resource binding, S256 PKCE, refresh rotation, read/write scopes and connection revocation. It does not advertise Client ID Metadata Document support. Choose automatic registration rather than a published-client identity for this pilot.

Conclave's browser login is separate from each AI app's OAuth grant. Sign in at the root in the tab opened by consent, then return to the consent page and continue. Signing out of the website keeps app grants active. Use [Connections](https://conclave-mcp-production.up.railway.app/connect) to revoke an individual app.

For saving and updating, the consent page must say the app can **read and save** handoffs. Claude connections made before the scope-discovery correction on October 7 may have only `handoffs:read` and show five tools. Disconnect Conclave in Claude and connect again, approve read and save, then open a new conversation. The tool list should include **Save a Conclave handoff**, which creates packets and appends updates. Existing grants keep their original permissions; an explicit read-only request still cannot discover or invoke save, and refresh cannot add write access. See the [scope correction](archive/2026-10-07/hosted-claude-write-scope.md).

If an old approval page stays visible or reports that the submission expired, start a fresh Connect attempt from the AI app and approve once. A browser callback-policy issue was corrected on October 7; an earlier accepted request cannot be resubmitted. Login forms remain self-only, while each consent form permits only its validated callback origin. See the [callback correction and browser evidence](archive/2026-10-07/hosted-consent-callback-fix.md).

## Acceptance check in your accounts

In ChatGPT, ask:

> Use Conclave to save a handoff called Hosted pilot. Our objective is cross-app project continuity. Keep the constraint Ask before publishing and the open question Which app should we add next? Return its ID.

In Claude, ask:

> Use Conclave to retrieve handoff [ID]. Tell me the objective, exact constraints and open questions. Read the current version and save an update adding our next step.

Retrieve that ID again in ChatGPT, confirm its increased revision, and compare the versions. Restart/redeploy the service and retrieve it again. Revoke Claude's connection and confirm Claude requires a new grant while ChatGPT still works. Automated SDK fixtures do not establish these actual app-account results.

## Boundaries and future extensions

The shared six-tool contract is in [HANDOFF_MCP.md](HANDOFF_MCP.md). App-specific setup instructions and plugin packaging sit outside packet storage, identity and OAuth. New MCP clients should need endpoint/auth configuration and a compatibility check, rather than a new copy of the server or a model-provider integration. New identity providers can implement the injected verified-owner contract while preserving ownership; email alone is not an account migration key.

The local bridge remains available but is not the current development priority. Local SQLite packets do not sync to this hosted store. Hosted import, direct PostgreSQL catalog/version reads, permanent deletion/retention, expired-record cleanup, broader rate controls and CIMD support are future increments. The private pilot has explicit allowed emails, 64 KB packets and a 2,000-event account cap. It replays that bounded account history in transient SQLite; no persistent Railway volume is required.

This deployment is a private account pilot, not a public directory listing. Published distribution and its operational lifecycle remain separate work. The implementation is deployed from the hosted branch; automatic redeployment on GitHub pushes remains unverified and should be checked before relying on continuous deployment.

## Verification

`node scripts/test.js test/hosted-standalone.test.js test/handoff-hosted.test.js` covers standalone migration idempotency/refusal, private sessions, secure cookies, CSRF, verified identity, database readiness, two independent OAuth clients, restart persistence, exact constraints, independent revocation, sign-out semantics and sign-in budgets. Existing transport and portability cases remain in the full suite.

The full root suite passed 360 checks with one optional skip at four-file concurrency, and syntax/resource checks passed. An earlier highly parallel run failed one existing periodic-context-review count; that file passed independently, and the complete bounded-concurrency rerun passed. Converse parity matched all 102 files, its syntax checks passed, and its suite passed 203 checks with one optional skip using a workspace-local Windows temporary directory. The validated Converse snapshot is published on review branches; its production deployment is unchanged.

Live Neon migration and Railway deployment succeeded. Public HTTPS readiness, login page, stylesheet and both OAuth discovery documents returned 200; unauthenticated MCP returned 401 with the correct resource metadata challenge. Database URLs explicitly use `sslmode=verify-full`. A native-browser sign-in Origin regression was corrected and deployed; an authorized real email-code request was accepted by Neon, reached the code entry screen, and the user confirmed inbox receipt. The user subsequently tested ChatGPT and Claude. Read-only Neon inspection confirmed four durable revisions labeled ChatGPT → Claude → ChatGPT → Claude, a valid version chain and exact original-constraint preservation. Claude's renewed grant includes read/write. [Live account evidence](archive/2026-10-07/hosted-account-roundtrip.md) distinguishes this result from the separate real-app revocation and restart/redeploy recovery checks. See the [deployment evidence](archive/2026-10-07/hosted-independent-pilot.md), [sign-in correction](archive/2026-10-07/hosted-signin-origin-fix.md) and [Claude scope correction](archive/2026-10-07/hosted-claude-write-scope.md).
