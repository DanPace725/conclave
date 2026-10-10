# Railway follows main: CLAMP release

October 10, 2026. The user reported that Railway missed the recent PR merge,
then explicitly authorized production to follow `main` and deploy the change.

## Cause and correction

PR [#11](https://github.com/DanPace725/conclave/pull/11) merged the CLAMP branch
into `main` at `41bf608dd5209dfcc5abf5889626bef1b1b8b458`, containing the published
source head `da5eb70`. Railway still followed `codex/conclave-dashboard`, whose
head was `04b7e52`. Redeploy `ebd94257-27fb-4840-ae2f-8bd50d1358c2` correctly rebuilt
that older branch; it did not incorporate the main merge.

Reviewed the empty production staged patch, staged the source switch, and
reviewed again before explicit user approval. Patch changed only this service's
source: same repository, branch `main`, no image or commit pin. No variable,
domain, volume, build/start command, replica, limit or database setting changed.
Applied through the Railway connector, scoped to production.

- Project `8414b456-9878-4fb0-b0ec-40d0a9364aa7`, service
  `2958d211-36be-40b0-9426-b5bc6a2e158b`, environment
  `2184f8e0-6f22-47f5-9836-be3fb1428d29`.
- New deployment `564a34ce-fc63-4f71-a604-45ae1ecce3f0`: SUCCESS at exact commit
  `41bf608dd5209dfcc5abf5889626bef1b1b8b458`, branch `main`.
- Live source config follows `main` without a pin. One replica is online;
  no pending operations, recent failures, active warnings or criticals.
- Previous accepted build: `ebd94257-27fb-4840-ae2f-8bd50d1358c2` at `04b7e52`.

## Verification and limits

`node scripts/check-hosted-dashboard.js https://conclave-mcp-production.up.railway.app`
passed all ten checks: database readiness, dashboard sign-in gate, anonymous
find/get/history/compare refusal, write refusal, foreign-origin refusal,
unauthenticated MCP challenge and read/write scope discovery.

Actual hosted connector read `conv_cb0095d1-155a-4e69-b29d-af4fad6656df` revision 1
by canonical ID and by `clyp-clamp-updates-and-readable-handoffs--30`, preserving
the original packet SHA-256. This is authenticated named retrieval, not a native
ORMD save or real-model continuation result. Updated that compact legacy packet
to revision 2 with released status and remaining work. Hosted progress log
`conclave-hosted-progress-log--7` is revision 7 and preserves prior history.

The connector's imported schema still lacks `packet.clamp` in this conversation.
Refresh its connection discovery and start a fresh chat before native CLAMP
saves/ORMD reads. Real ChatGPT ↔ Claude pilot and signed-in dashboard export/
graph acceptance remain pending. Following main is configured; no new push was
manufactured to test a future merge-triggered deployment. No Converse production
deployment or local-preview change was performed. The user's separate AGENTS.md
edit remains local and outside the release receipt.
