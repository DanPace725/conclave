# Conclave handoff MCP: local and hosted setup

**Current priority:** the [independent hosted service](HOSTED_HANDOFFS.md) owns its Railway endpoint, Neon database and Conclave sign-in. The earlier Converse-hosted adapter below remains compatible; it is no longer the preferred deployment path. Local launchers remain development options and do not synchronize with the hosted account.

The product is explicit **save → find/reference → retrieve → continue**. It has local storage and a prepared owner-scoped hosted implementation. There is no background transcript capture, canonical-memory promotion, model inference, or external network fetching.

`HandoffService` in `src/handoffs.js` uses the existing append-only Conclave `Store`. A packet owns a conversation ID, stores immutable `handoff_packet` events attributed to `external`, and records revision/source claims without inventing human authority. It does not expose ordinary saved conversations. Model-mediated packet text is external data.

Local launchers live in the private package `packages/conclave-mcp/`; shared tool/auth/server adapters now live in `src/` and their dependencies migrate into Converse's manifest. The SDK is pinned to `@modelcontextprotocol/sdk@1.32.1`, Express `5.2.1`, and Zod `3.25.76`. The actual HTTP test negotiates protocol `2025-11-25`. Do not advertise the earlier research's `2026-07-28` revision as implemented.

## Commands

Handoff responses include `readable_id`, a stable name such as
`dashboard-planning--2`. Use it as `handoff_id` in all handoff tools and pinned
links; canonical `conv_…` IDs remain accepted. Save receipts return the readable
name as `reference`. It stays stable after a title change and is scoped to the
current account/store. See [CLAMP references](CLAMP.md#readable-references) and
the prepared [ChatGPT ↔ Claude pilot](CLAMP_PILOT.md).

Run from the Conclave checkout, with Node.js 22.13 or later:

```powershell
npm ci
npm ci --prefix packages/conclave-mcp
npm run mcp:configs
npm run mcp
```

The first two commands install dependencies; they have already been installed in this checkout. `mcp:configs` writes examples inside `.conclave/mcp-config/`, leaving app settings alone. `mcp` starts stdio and waits for an MCP client; it is not an interactive chat shell. Clients should launch `node` with the absolute `packages/conclave-mcp/src/stdio.js` path.

Defaults are independent of the client's working directory. Data lives in this checkout's `.conclave/handoffs/`; `CONCLAVE_HANDOFF_DATA` selects another absolute directory. Every local client must point to the same directory to share packets. The generated examples include that path. The local installation represents one private user's data; it has no account system. Do not configure this directory as a shared multi-user service.

The generated Gemini CLI extension can be installed locally:

```powershell
gemini extensions install .\.conclave\mcp-config\gemini-extension
```

It references this checkout with absolute paths and is not portable to another machine without regeneration. Actual installation and invocation in Gemini CLI remain to be verified.

`mcp:configs` also generates Codex TOML, Claude Code JSON and dual-host local plugin marketplaces with shared save/resume skills. Optional `--origin HTTPS_ORIGIN` preserves local files and writes separate online templates. The local Codex plugin is installed/enabled on this computer; actual fresh-session invocation and Claude Code installation remain pending. See [coding integration contracts](CODING_INTEGRATIONS.md) and [simple desktop directions](HANDOFF_SETUP.md#codex-desktop-cli-and-ide).

## Tool contract

`create_project({name, summary, request_id, objective?, context?, constraints?, decisions?, open_questions?, next_steps?, references?, source_app?, source_model?})` explicitly creates a Conclave project by saving its initial handoff, with the name as both packet title and project. Projects are exact named groups of saved handoffs; an existing name groups the new packet into that project. This does not create a native project in ChatGPT or Claude, or a separate empty project record. It uses the same owner-bound save, retry and capacity guards as `save_handoff`, and requires read/write OAuth scopes. Read-only connections expose neither write tool.

After deploying tool changes, refresh the Conclave connection in ChatGPT Plugins, confirm **Create a Conclave project** is listed and enabled, then start a new conversation. Reinstalling a connection before the tool is deployed cannot reveal it. [Official refresh steps](https://developers.openai.com/plugins/deploy/connect-chatgpt)

- `save_handoff({packet, request_id, handoff_id?, expected_revision?})`: creates or updates a packet and returns its ID, version, hash, and source event. Use one stable request ID per intended save; an identical retry returns its original receipt, while changed content with the same request ID fails. Updating requires the current revision.
- `find_handoffs({query?, project?, limit?, offset?})`: deterministic keyword discovery over packet data, with title weighting and paginated metadata. `project` limits results to packets whose latest revision reports that exact name. Every result also returns `projects`: the exact names in use with a packet count, most recently saved first (at most 100). Search is not semantic relevance or factual verification.
- `get_handoff({handoff_id? OR title?, revision?, focus?, max_characters?})`: retrieves the latest or requested immutable version. Duplicate exact titles produce an ambiguity error. Focus selects whole matching context paragraphs and preserves every other packet section. The response reports omitted context, latest/saved revisions, provenance, and the original hash. No constraints are silently clipped; capacity failure requires a larger allowance or more focused context.
- `list_handoff_versions({handoff_id, limit?, offset?})`: newest-first metadata, hashes, and previous-event links, with 1–20 items per page. The hosted adapter uses the same verified-owner boundary as packet retrieval.
- `compare_handoff_versions({handoff_id, from_revision, to_revision?, max_characters?})`: exact before/after values for every changed packet field, defaulting to latest as the target. Removed constraints/questions are explicit. Returns both original packet hashes; identical content returns an empty change list. Comparison capacity failures never clip a field. Both tools are read-only and require only `handoffs:read` in hosted connections.
- `open_handoff_library({handoff_id? OR query?, offset?})`: a separate read-only display tool. Returns `{view,query,offset,data}` containing either the latest complete packet or ten catalog entries. Compatible hosts can render the linked MCP Apps resource; headless clients still receive structured/text data. Error results use the same envelope with `view:"error"` and `{error,message}` data so SDK output validation succeeds.

Packet fields: required `title` and `summary`; optional `objective`, `context`, arrays of `decisions`, `constraints`, `open_questions`, `next_steps`, `{label,url}` references, `source_app`, `source_model`, `project`, and `clamp`. Total packet JSON is limited to 64 KB. New model handoffs should use the [CLAMP 1.0 Clyp profile](CLAMP.md): an objective and next action are required, complete ORMD is bounded to 1,500 o200k_base tokens, and explicit links pin existing account-owned handoff revisions. `get_handoff` accepts `format:"ormd"` for complete saved Clyp documents; default packet reads are compatible. Focus never shortens a Clyp. Legacy packets remain unchanged.

`project` (at most 120 characters, trimmed) is an explicit name reported by the saving app, like the source labels. Names are compared exactly, including case; similar names and matching titles are never merged. A packet without a project omits the field, so packets saved before projects existed keep their hashes. On an update, omitting `project` keeps the packet's current project and an empty string removes it; either way the change is a new immutable revision and appears in comparisons. URLs are references only; the server never fetches them. Credentials in URLs and non-HTTP(S) schemes are rejected. The model's text may still contain confidential information, so explicit handoff creation is the sharing boundary.

MCP annotations mark retrieval as read-only and saving as a write. Results have text plus structured content. Known input/conflict/ambiguity/capacity errors are returned explicitly; unexpected exceptions receive a generic message without paths or SQL details. No SDK logging is sent to stdio stdout.

## Optional MCP Apps UI

The display tool references a content-addressed `ui://` resource with MIME type `text/html;profile=mcp-app`. Data tools do not launch it. The static HTML is built with the official MCP Apps SDK, declares no external connection/resource/frame domains, and contains no account data. Owner/scope checks remain on the existing authenticated tool connection; UI metadata is not authorization. Saving is model-only for this read-only UI.

`npm run mcp:ui:build` regenerates the committed resource; `mcp:ui:check` verifies it matches source. `npm run test:mcp:ui` checks the compiled app against a synthetic SDK-backed host, and `mcp:ui:preview` runs that local demonstration on port 3214. The preview uses no real storage or credentials and must not be deployed as the connector. Factory option `ui:false` omits the resource/display tool entirely.

See [the development guide](PLUGIN_UI.md) for platform capabilities, design rules, optional extensions and remaining real-account verification, and [the user checklist](HANDOFF_SETUP.md#try-the-chat-ui) for simple preview instructions.

## Portable local handoff backups

`npm run mcp:backup -- export HANDOFF_ID FILE`, `inspect FILE`, and `import FILE [--dry-run]` operate on local `CONCLAVE_HANDOFF_DATA` or the launcher's default handoff directory. Export uses a consistent SQLite transaction, includes all immutable revisions, and refuses overwriting an existing output file. Inspection/dry-run validate without opening a destination store. Import validates all fields, contiguous revisions, timestamps, canonical normalized SHA-256 packet checksums and limits before a single atomic write transaction.

Format `conclave-handoff`, schema version 1: `{format,schema_version,exported_at,source_handoff_id,revisions:[{revision,saved_at,sha256,packet}]}`. Limits: 8 MiB and 1–1,000 complete revisions. No user-supplied owners, actors, authority metadata or OAuth records are accepted. Packet source labels remain reported claims. Checksums establish consistency, not authenticity.

Import assigns fresh conversation/event IDs and current local event timestamps, preserves packet hashes/content/version order, and records claimed source IDs/revisions/timestamps in `provenance.imported_from` with `claims_verified:false`. It never promotes external data to human memory. A canonical digest of source ID and revisions deduplicates identical imports across retries/restarts; export time is excluded. Reimport after later edits returns the original import receipt and does not overwrite those edits. Storage failure rolls back every imported event. The utility does not synchronize hosted storage, restore ordinary conversations, or erase retained data. See [plain-language commands](HANDOFF_SETUP.md#back-up-a-local-handoff).

The read tool contract follows the [implemented MCP revision's tool specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools). Client tool discovery and read-only annotations are tested through the installed SDK, not inferred from directory availability.

## Private local HTTP

`npm run mcp:serve` serves `/mcp` on loopback port 3213 using the same local data. Set `CONCLAVE_MCP_TOKEN` to a random secret of at least 32 characters first; `CONCLAVE_MCP_PORT` changes the port. The client supplies `Authorization: Bearer ...`. Configuration is not automatically loaded from `.env`; set variables in the launching process.

The process refuses to start without its secret, binds only to `127.0.0.1`, checks Host/Origin, disables caching, and bounds JSON requests. This development endpoint is not the hosted OAuth service below. Do not expose it through a public tunnel as the finished ChatGPT/Claude connector.

## Hosted account connections (prepared, not deployed)

`createHostedHandoffApp` serves stateless Streamable HTTP at `/mcp` using the pinned SDK and the same tool contract. `HandoffRepository` persists append-only events in `app.handoff_events`; every query is scoped to a required verified owner. Transaction row locks serialize retries and revision checks across server instances. PostgreSQL JSONB packet normalization preserves receipt hashes. The pilot refuses operations beyond 2,000 events per account rather than truncating the catalog.

Migration `0005_handoff_mcp` adds that table, durable OAuth records, lock rows, and an append-only trigger. It has been exercised on PGlite, not applied to the live database. The snapshot migrates the thin `api/mcp.js` wrapper into Converse; Converse owns deployment rewrites and the existing database pool/sign-in.

The official SDK auth router implements discovery, client registration, token validation/PKCE and OAuth endpoint handling. Our provider persists the authorization state and requires browser consent from `identity(req)`. Password/open local sessions cannot approve a grant. Grants are limited to the handoff resource and `handoffs:read` / `handoffs:write`; read-only grants do not register the save tool. This does not expose conversations, canonical memory, or provider credentials.

- Dynamic client registration supports public clients and `client_secret_post`; HTTPS callbacks or HTTP loopback callbacks only. The SDK matches registered callbacks before redirecting. No client identity document fetching is implemented; choose automatic registration in clients.
- Authorization requests bind the client, redirect, S256 challenge, scopes, resource and optional state. A ten-minute pending request requires its browser nonce, valid identity and same-origin CSRF-protected consent. Codes expire in five minutes and are redeemed once. Resource is required on authorization/code exchange and, when supplied on refresh, must match.
- Access tokens expire after one hour; refresh tokens rotate and cannot be reused. Grants expire after 30 days. Token/code values are stored only as digests; client metadata including any generated secret is AES-GCM encrypted with a key derived from `SESSION_SECRET`.
- `/connect` lists that owner's grants and revokes a selected connection. Each bearer request checks grant expiry, revocation, the current allowed email list, and the session-secret epoch. Secret rotation invalidates existing grants. Browser sign-out alone does not revoke them.
- Fixed `CONCLAVE_MCP_ORIGIN` is required, including exact Host checking. The route stays disabled if that setting is absent. No automatic hostname inference or anonymous fallback is allowed. OAuth discovery/token endpoints use SDK CORS; MCP requests reject foreign browser Origins. JSON/form limits and generic unexpected errors bound disclosure.
- SDK limits apply per warm instance, with a durable global cap of 100 registration requests/hour for this private pilot. This is not a general public abuse-management system. Expired OAuth records are ignored on reads; scheduled cleanup, larger storage and permanent account-data deletion remain operational work before public distribution. Lock rows are retained to preserve cross-instance serialization.

Before deployment, follow the credential rotation, hosting access, environment, migration and plugin directions in [the user checklist](HANDOFF_SETUP.md). Keep the fixed origin consistent between OAuth discovery, the MCP URL, sign-in and any preview alias. Vercel deployment protection must not interpose its own login in the protocol flow. Do not claim deployment or account interoperability until public endpoint and real-app checks pass.

## Verification and next increment

```powershell
node scripts/test.js test/handoffs.test.js test/handoff-hosted.test.js packages/conclave-mcp/test/transport.test.js
npm test
npm run check
```

The transport test uses two independently launched SDK clients to save, restart, find, and retrieve a packet from the same SQLite directory. It also exercises concurrent identical saves, authenticated HTTP, actual protocol negotiation, and blocked headers. This is protocol-client evidence; it is not a live ChatGPT, Claude, or Gemini app test.

Hosted tests use PGlite and real HTTP/SDK clients to cover persistence, owner isolation, duplicate saves, version conflicts, immutable rows, metadata discovery, escaped consent, CSRF, resource/PKCE/code replay rejection, refresh rotation, account removal, secret rotation, revocation and read-only tools. This is local integration evidence, not a real platform-account or Neon deployment test. The pinned SDK continues to negotiate protocol `2025-11-25` in the transport fixture; no MCP v2 compatibility is claimed.

Next: restore hosting access, rotate the exposed configuration credentials, migrate an isolated hosted database, deploy a fixed preview address, and run a real ChatGPT ↔ Claude handoff. Shared engine modules are authored/tested/committed in Conclave and then hash-migrated into Converse.

Current platform directions come from [official OpenAI documentation](https://developers.openai.com/api/docs/guides/custom-mcp-server), [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), and [Gemini CLI extensions](https://geminicli.com/docs/extensions/reference/). UI/account availability is not established by the local tests.
