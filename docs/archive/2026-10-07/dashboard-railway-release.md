# Conclave dashboard Railway release

Date: October 7, 2026 (October 8 UTC). Branches: `codex/conclave-dashboard` in both repositories.

The user explicitly approved publishing both dashboard branches and deploying Conclave to its existing Railway production service. The initial push attempt was rejected by automatic approval review because the earlier “next steps” request did not expressly authorize publication. No alternate route was used to bypass that rejection; publication and deployment proceeded only after the explicit response.

## Published release and deployment

- Source release commit: `28cd7973c5d2d66d0008f26b8164160afd5129a9`, remote SHA verified after push.
- Matching Converse snapshot: `ef58de2457ac624ce60d8a3a8d4f37f60b0ca1b5`, remote SHA verified after push. All 106 files match canonical source; the release-guide commit changes no runtime bytes from the previously tested implementation.
- Draft [Conclave PR #10](https://github.com/DanPace725/conclave/pull/10) and [Converse PR #27](https://github.com/DanPace725/converse/pull/27), both targeting their existing `codex/conclave-hosted` branches and attached to the Codex task. No main merge or Converse deployment.
- Railway service `2958d211-36be-40b0-9426-b5bc6a2e158b`, production environment `2184f8e0-6f22-47f5-9836-be3fb1428d29` in project `8414b456-9878-4fb0-b0ec-40d0a9364aa7`.
- Staged diff reviewed: only source branch and exact commit pin. No variable, account, domain, database, volume or unrelated service change.
- Deployment `f8051a5a-60d3-4c13-94c6-06fb7709a00f`: SUCCESS, exact commit `28cd7973c5d2d66d0008f26b8164160afd5129a9`, us-west2. Docker build copied source/assets and the hosted package; production dependency install reported zero vulnerabilities. Existing standalone pre-deploy migration reran successfully; no new schema migration was added.
- Live dashboard: `https://conclave-mcp-production.up.railway.app/dashboard`.
- Previous successful build for rollback: `52deb270-d20a-471d-9f17-da6db6c7abe8` at `40128be2c325299c20a00ef145a8d61d35cc6b7a`.

The source is explicitly commit-pinned. Later documentation pushes do not change this release; do not infer deployment from branch publication. See [the release/rollback guide](../../DASHBOARD_RELEASE.md).

## Verification and limits

`node scripts/check-hosted-dashboard.js https://conclave-mcp-production.up.railway.app` passes all ten checks:

- Database readiness 200.
- Dashboard 303 to sign-in, with no-store and framing protection.
- All four anonymous packet reads 401, with no-store and the expected sign-in response.
- Dashboard write attempt 405; foreign-origin read 403.
- Unauthenticated MCP 401 with resource metadata; read/write discovery 200 with the expected resource/scopes.

Browser navigation to the dashboard independently redirected to the normal Conclave email-code sign-in page. No code was sent by the agent and no signed session was fabricated. The user chose to test the signed-in dashboard later; real packet acceptance remains deferred to that test. Public checks establish deployment and the account gate, not signed-in packet presentation or app recall.

Prior code validation remains: Conclave 362 passes / one optional skip, seven focused dashboard/standalone HTTP cases, six desktop/narrow synthetic Edge cases with visual inspection, Converse 203 passes / one optional skip, syntax checks and 106-file parity. The current release adds a checked public smoke script and operational documentation; runtime behavior is unchanged from that tested code.

Project grouping, agreed canonical state, branch merges, task routing, real native mobile/Safari and broader read scalability remain follow-up work. No production packet, grant, credential or account was changed to diagnose or verify this release. The hosted progress log will record the verified final push batch and this deployment separately.
