# Hosted Conclave session handoff

Updated October 7, 2026 (the rollout and commits occur on October 8 UTC).

## Start here

Conclave is becoming an independent cross-app continuity service. Prioritize hosted ChatGPT/Claude interoperability and extensibility; local development is secondary. Keep Converse's existing integration and production configuration intact. The hosted service uses its own Neon database/Auth and Railway runtime; no model API keys are needed for handoff tools.

Both repositories are on `codex/conclave-hosted`. Conclave source: `E:\Coding\converse\CLA\conclave`; Converse snapshot: `E:\Coding\converse\converse`. Both hosted branches are published. Converse's existing `codex/conclave-handoffs` review branch is also advanced by fast-forward to the tested snapshot. No merge into main or new Converse deployment was requested.

- [Conclave PR #9](https://github.com/DanPace725/conclave/pull/9): login, browser consent callback and scope-discovery corrections. Hosted foundation is already on Conclave main. Review/merge the source fixes before the snapshot.
- [Converse PR #26](https://github.com/DanPace725/converse/pull/26): existing handoff integration plus validated engine updates. The hosted Conclave service is independent; Converse's MCP routes remain disabled without explicit configuration.

## Live service and last verification

MCP endpoint: `https://conclave-mcp-production.up.railway.app/mcp`. [Setup, infrastructure IDs and boundaries](HOSTED_HANDOFFS.md).

Railway project `8414b456-9878-4fb0-b0ec-40d0a9364aa7`, service `2958d211-36be-40b0-9426-b5bc6a2e158b`, production environment `2184f8e0-6f22-47f5-9836-be3fb1428d29`. Latest verified successful runtime deployment: `52deb270-d20a-471d-9f17-da6db6c7abe8`, commit `40128be2c325299c20a00ef145a8d61d35cc6b7a`. Later commits update documentation only. Recheck Railway and remote heads rather than treating this snapshot as permanently current. Push-triggered automatic redeployment remains unverified.

Neon project `morning-sunset-04725595`, main branch `br-flat-truth-ar8qk60a`. Private configuration is in ignored `.env.hosted` and Railway variables; never print, commit or copy its values into packets. Runtime uses the pooled connection; migrations use the direct connection. Use the standalone migration command, not Converse's full migrations.

- Full source suite: 360 passed / one optional skip; syntax/resource checks passed.
- Converse suite: 203 passed / one optional skip; syntax and 102-file engine parity passed. Manifest references runtime source `40128be`; later source commits are documentation only.
- Public readiness 200; MCP unauthenticated 401 includes resource metadata with no read-only scope hint; metadata advertises read/write.
- The user confirmed delivery of one explicitly authorized email code and subsequently tested ChatGPT and Claude. Read-only Neon inspection confirmed four durable revisions labeled ChatGPT → Claude → ChatGPT → Claude; the revision chain is valid, original constraint is preserved, and Claude's renewed grant includes read/write. No real packet or grant was changed during diagnosis. [Live account evidence](archive/2026-10-07/hosted-account-roundtrip.md).

## Next session

The hosted ChatGPT/Claude update round trip is now accepted through the user test plus live database evidence. The earlier Claude reconnect/write check is complete. If the owner wants to continue the same packet, its ID is available in this task history; do not publish packet content into Git.

Prioritize a simple hosted release and extensibility. Before broader distribution, check actual app reconnection/revocation and restart/redeploy recovery, then decide the next provider and operational improvements. Keep evidence distinct from fixture coverage, and do not silently expand stored grants or read OTPs. Sending another real email requires authorization for that request.

Prioritize hosted extensibility and simple distribution. Public directory submission, additional provider compatibility, hosted import, expired-record cleanup, retention and broader abuse controls remain future work. Local packets and hosted packets are separate stores.

## Workflow and cleanup

Engine changes start in Conclave, are tested/committed there, then migrate with `node scripts/sync-converse.js --apply` and `--check`. Run Converse checks before snapshot commit. Current suites already passed; documentation-only cleanup does not warrant rerunning them.

For the source suite use four-file test concurrency. For Converse on Windows, use a workspace-local TEMP/TMP directory such as `E:\Coding\converse\.test-tmp`; default sandbox temp paths caused rename failures. Git network commands require the host permission path. Neon connector authentication repeatedly requested retry; the configured local PG connection worked for sanitized read-only grant metadata.

The temporary consent-browser fixture has no running process and its scratch launcher was removed. Ignored logs/screenshots remain as evidence. Local databases, packet histories, private configuration and the user's local tunnel are retained. Do not delete `.conclave` wholesale: it contains active SQLite state.

Detailed reports: [independent deployment](archive/2026-10-07/hosted-independent-pilot.md), [email form correction](archive/2026-10-07/hosted-signin-origin-fix.md), [consent callback correction](archive/2026-10-07/hosted-consent-callback-fix.md), [Claude write-scope correction](archive/2026-10-07/hosted-claude-write-scope.md).
