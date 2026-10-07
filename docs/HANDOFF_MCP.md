# Conclave handoff MCP: local development

The initial product is explicit **save → find/reference → retrieve → continue**. There is no background transcript capture, canonical-memory promotion, model inference, external network fetching, or hosted multi-user access in this increment.

`HandoffService` in `src/handoffs.js` uses the existing append-only Conclave `Store`. A packet owns a conversation ID, stores immutable `handoff_packet` events attributed to `external`, and records revision/source claims without inventing human authority. It does not expose ordinary saved conversations. Model-mediated packet text is external data.

The MCP adapter is a separate private package under `packages/conclave-mcp/`; its SDK dependencies do not enter Converse's engine dependency manifest. The installed SDK is pinned to `@modelcontextprotocol/sdk@1.32.1` and Zod `3.25.76`. The actual HTTP test negotiates protocol `2025-11-25`. Do not advertise the earlier research's `2026-07-28` revision as implemented.

## Commands

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

## Tool contract

- `save_handoff({packet, request_id, handoff_id?, expected_revision?})`: creates or updates a packet and returns its ID, version, hash, and source event. Use one stable request ID per intended save; an identical retry returns its original receipt, while changed content with the same request ID fails. Updating requires the current revision.
- `find_handoffs({query?, limit?, offset?})`: deterministic keyword discovery over packet data, with title weighting and paginated metadata. Search is not semantic relevance or factual verification.
- `get_handoff({handoff_id? OR title?, revision?, focus?, max_characters?})`: retrieves the latest or requested immutable version. Duplicate exact titles produce an ambiguity error. Focus selects whole matching context paragraphs and preserves every other packet section. The response reports omitted context, latest/saved revisions, provenance, and the original hash. No constraints are silently clipped; capacity failure requires a larger allowance or more focused context.

Packet fields: required `title` and `summary`; optional `objective`, `context`, arrays of `decisions`, `constraints`, `open_questions`, `next_steps`, `{label,url}` references, `source_app`, and `source_model`. Total packet JSON is limited to 64 KB. URLs are references only; the server never fetches them. Credentials in URLs and non-HTTP(S) schemes are rejected. The model's text may still contain confidential information, so explicit handoff creation is the sharing boundary.

MCP annotations mark retrieval as read-only and saving as a write. Results have text plus structured content. Known input/conflict/ambiguity/capacity errors are returned explicitly; unexpected exceptions receive a generic message without paths or SQL details. No SDK logging is sent to stdio stdout.

## Private local HTTP

`npm run mcp:serve` serves `/mcp` on loopback port 3213 using the same local data. Set `CONCLAVE_MCP_TOKEN` to a random secret of at least 32 characters first; `CONCLAVE_MCP_PORT` changes the port. The client supplies `Authorization: Bearer ...`. Configuration is not automatically loaded from `.env`; set variables in the launching process.

The process refuses to start without its secret, binds only to `127.0.0.1`, checks Host/Origin, disables caching, and bounds JSON requests. This development endpoint is not a production OAuth service. Do not expose it through a public tunnel as the finished ChatGPT/Claude connector. Hosted identity, grants, revocation and database persistence still need implementation.

## Verification and next increment

```powershell
node scripts/test.js test/handoffs.test.js packages/conclave-mcp/test/transport.test.js
npm test
npm run check
```

The transport test uses two independently launched SDK clients to save, restart, find, and retrieve a packet from the same SQLite directory. It also exercises concurrent identical saves, authenticated HTTP, actual protocol negotiation, and blocked headers. This is protocol-client evidence; it is not a live ChatGPT, Claude, or Gemini app test.

Next: implement an owner-scoped hosted packet repository and MCP OAuth resource server, decide the tested remote protocol, prepare private installation instructions, and run a real ChatGPT ↔ Claude handoff. Keep the local token transport separate from that account/grant system. Shared engine modules are authored/tested/committed in Conclave and then hash-migrated into Converse.

Current platform directions come from [official OpenAI documentation](https://developers.openai.com/api/docs/guides/custom-mcp-server), [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), and [Gemini CLI extensions](https://geminicli.com/docs/extensions/reference/). UI/account availability is not established by the local tests.
