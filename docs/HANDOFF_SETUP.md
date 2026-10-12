# Conclave handoff setup

Updated October 12, 2026. Save a handoff in one connected app, then retrieve the same ID in another app using the same Conclave account or local store. Conclave stores only material explicitly sent through the save tool.

## Hosted ChatGPT and Claude

Use the [independent hosted guide](HOSTED_HANDOFFS.md) for the Railway endpoint, Conclave email-code sign-in and account checks. Hosted Conclave has its own database and sign-in; it is separate from Converse and from this computer's local packets. The earlier proposed Converse/Vercel pilot is no longer the preferred setup.

1. Connect each app to the verified hosted `/mcp` URL using OAuth automatic registration.
2. Choose the same Conclave account in both consent flows. To save, approve read and save access; a read-only connection omits write tools.
3. Ask: **“Use Conclave to save a handoff called ‘Coding pilot’. Include our objective, decisions, constraints, open questions and next steps. Return the ID.”**
4. In the second app, ask: **“Use Conclave to retrieve [ID] and continue from it.”** Confirm the exact constraints and questions survive.
5. To update, read the current version and save against that revision using the same ID. A new packet with the same title is a separate handoff.

Refresh the connection's tools after a deployed schema change and start a fresh conversation. A local source change alone cannot update a hosted connection. Source/model labels remain unverified claims; saved model text does not become a human instruction.

The hosted [Connections page](https://conclave-mcp-production.up.railway.app/connect) revokes individual grants. Removing an app's connector or signing out of the website does not itself revoke its grant. Real-app revocation/reconnection, restart/redeploy recovery and new graph gestures require account checks; automated fixtures do not establish those results.

## Codex desktop, CLI and IDE

Run local setup commands from the Conclave checkout:

```powershell
npm run mcp:configs
```

Generated files are under `.conclave/mcp-config/`. The local package is `conclave-local@conclave-local`, displayed as **conclave_local**; hosted **Conclave** is a separate connection. Use either the local plugin or direct MCP configuration to avoid duplicate tools. A local connection shares packets only with clients using the same `CONCLAVE_HANDOFF_DATA` directory. It does not give a remote chat access to this computer.

For installation commands, generated configuration paths and Claude Code integration, use [the coding integration guide](CODING_INTEGRATIONS.md). Generated online templates require a verified HTTPS origin and a separate authentication flow; generation does not deploy or sign in. The historical private ChatGPT tunnel remains documented in [CHATGPT_LOCAL.md](CHATGPT_LOCAL.md).

## Local MCP clients

Install dependencies with `npm ci` and `npm ci --prefix packages/conclave-mcp`, then use the generated configuration for your client. The stdio launcher is `packages/conclave-mcp/src/stdio.js`; it waits for a client rather than an interactive shell. All local clients must select the same private data directory. See [technical setup](HANDOFF_MCP.md) for stdio and secret-protected loopback HTTP.

The available tools are save, create project, find, retrieve, list versions, compare versions, graph and open library. Read-only connections omit the two write tools; servers configured without UI omit open library. `get_handoff` accepts both readable references and canonical IDs, and can retrieve a specific immutable revision.

## See earlier versions and changes

- Ask: **“List earlier versions of handoff [ID].”** Pages show the newest first.
- Ask: **“Compare version 1 with the latest version, including removed constraints and questions.”** Comparisons show exact stored differences without another model call inside Conclave.
- Ask: **“Retrieve version 1 of handoff [ID].”** Reading old content leaves the latest version untouched. To reuse it, read the current revision and explicitly save an update.

## Try the chat UI

```powershell
npm run mcp:ui:preview
```

Open `http://127.0.0.1:3214`, or `http://127.0.0.1:3214/?inline=1` for the compact card. The preview contains synthetic packets and no real account data. Stop it with Ctrl+C.

In a compatible connected app, ask **“Open my Conclave handoff library.”** Browsing, reading versions and graph navigation do not save changes. **Continue in chat** appears when the host supports it; otherwise copy the continuation text. [UI controls and acceptance limits](PLUGIN_UI.md)

## Back up a local handoff

These commands operate on local handoff storage, not the hosted account, ordinary conversations or OAuth grants:

```powershell
npm run mcp:backup -- export conv_REPLACE_WITH_ID .\my-handoff-backup.json
npm run mcp:backup -- inspect .\my-handoff-backup.json
npm run mcp:backup -- import .\my-handoff-backup.json --dry-run
npm run mcp:backup -- import .\my-handoff-backup.json
```

Set `CONCLAVE_HANDOFF_DATA` to an absolute directory to choose the local store. Export refuses to overwrite an existing file. Restore creates fresh local identities and preserves packet hashes and version order. Identical imports return the original imported copy, including after later edits. Writes are atomic.

Clyp backups use schema 2 and preserve the original bounded ORMD bytes and checksum. Older schema-1 backups remain supported; their source document is reconstructed because that format did not save it. Inspection/dry-run checks packet checksums and the complete restored-document token budget before opening a destination store; it does not prove that destination storage is writable. Older software that only accepts schema 1 cannot read schema-2 Clyp exports. Legacy packet-only exports remain schema 1.

Keep backups private: they contain readable text, older versions and removed details. Checksums establish consistency, not authorship. Imported lineage/source labels remain unverified. Limits are 1,000 complete revisions and 8 MiB; exceeding them fails explicitly. [Backup contract](HANDOFF_MCP.md#portable-local-handoff-backups)

## Before broader distribution

Complete real-client and operational checks, privacy/support details, retention/cleanup and each platform's publication process. A private connection is not a public directory listing. This pilot retains older versions and provides no permanent-delete button. The [pre-review setup record](archive/2026-10-12/handoff-setup-before-review.md) preserves the superseded deployment proposals and historical checks; use the active guides for current setup.
