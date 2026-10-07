# Conclave in Codex and Claude Code

Checked October 7, 2026. The [simple setup checklist](HANDOFF_SETUP.md) includes the commands and remaining account steps.

## Same handoff, different host packaging

The same Conclave tools implement save → find/reference → retrieve → continue. A plugin adds installable configuration and two short workflows, `save-handoff` and `resume-handoff`; it does not change packet storage or grant the next model an entire earlier conversation. Coding handoffs can record repository/branch/commit, changed paths, tests, constraints and next steps. The receiving agent checks those earlier claims against its current workspace before acting.

| Surface | Connection/package | Conclave behavior | Current evidence |
| --- | --- | --- | --- |
| Codex local desktop, CLI, IDE | Shared MCP configuration or plugin marketplace | All six tools; bundled save/resume workflows | Local plugin installed/enabled by the actual Codex CLI; new-session invocation remains to be tried |
| Claude Code CLI | MCP configuration or `.claude-plugin` package | Same tools and namespaced workflows | Generated package and real SDK transport checked; CLI unavailable on PATH here |
| Claude Code local desktop session | Plugin browser or shared MCP configuration | Same tools; plugin workflows after installation | Documented support; actual desktop session not tested |
| Claude Desktop chat | Local stdio configuration or hosted account connector | Same packets when storage/account matches; UI where supported | Local Conclave entry added/read back; actual app invocation pending |
| Hosted ChatGPT/Claude conversations | Authenticated public HTTPS connector | Same tools against the signed-in account's hosted packets | Deployment, OAuth and real account tests remain pending |
| Regular ChatGPT using this PC's handoffs | Registered custom MCP connection through OpenAI Secure MCP Tunnel; optional `.app.json` workflow package | Same local database over outbound stdio tunnel | Private tunnel connected; real ChatGPT read/save passed; new packet independently retrieved locally. Native desktop invocation pending |

Codex documents shared configuration across the desktop, CLI and IDE, with stdio/HTTP and OAuth support. Local configuration does not automatically appear in hosted web conversations. [Official MCP setup](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

The earlier regular ChatGPT test observed a local plugin mention without callable tools. The registered private tunnel connection now passes actual read/save in Chat. `node packages/conclave-mcp/src/chatgpt.js link --app-id ACTUAL_ID` optionally creates a separate `conclave-chatgpt` package with the real registered app mapping in both the portable OpenAI extension and compatibility overlay. It bundles skills without a duplicate stdio server. The package here is generated with the real app ID; optional workflow installation and native desktop invocation remain separate checks. [Local ChatGPT setup and verification limits](CHATGPT_LOCAL.md)

Claude Code's current English desktop reference documents plugin installation for local/SSH sessions and shared MCP settings. Its local Code tab can also load `claude_desktop_config.json`; the standalone CLI does not read that file. Earlier translated pages still describe those desktop configurations as separate, so use the current English reference and verify the installed version. [Desktop configuration and plugins](https://code.claude.com/docs/en/desktop)

## What is generated

Run `npm run mcp:configs` in Conclave. Output stays in ignored `.conclave/mcp-config/`:

- `codex-config.toml`: local MCP entry with absolute Node, launcher and shared data paths.
- `claude-code.json`: MCP map for a project `.mcp.json` or a CLI add-json operation.
- Existing Claude Desktop, Gemini CLI, Cursor and VS Code configuration files.
- `plugin-marketplace/`: separate OpenAI and Claude catalogs pointing to one plugin folder.
- `plugin-marketplace/plugins/conclave-handoffs/`: portable `plugin.json`/`mcp.json`, compatible Codex/Claude manifests, `.mcp.json`, and `skills/`.

The OpenAI catalog uses `.agents/plugins/marketplace.json`; the Claude catalog uses `.claude-plugin/marketplace.json`. Both keep source paths inside the marketplace root. Portable MCP configuration declares `stdio` or `streamable-http`; the compatibility configuration uses `stdio` or `http`. The package has no lifecycle hooks, automatic capture, global memory edits or registered OpenAI app mapping. It does not invent a service ID or public publisher/contact.

OpenAI documents portable Agent Plugins packages and supported compatibility manifests. Claude Code discovers its manifest and MCP configuration independently. [OpenAI packaging](https://developers.openai.com/plugins/build/plugins), [Claude manifest reference](https://code.claude.com/docs/en/plugins-reference)

Local packages are development packages for this checkout, not standalone server distributions. Cached copies still launch the absolute checkout path, and all local hosts share `CONCLAVE_HANDOFF_DATA`. Keep the checkout and Node available; regenerate and reinstall after moving them. Neither installation nor a cache copy moves the data directory. Regenerating source packages does not update an installed cache automatically.

## Hosted preparation

Once there is a verified server origin, run `npm run mcp:configs -- --origin https://YOUR-VERIFIED-ORIGIN` after replacing the placeholder. This preserves local configurations and writes online alternatives under `.conclave/mcp-config/online/`, with a `conclave-online` marketplace. Generation validates HTTPS origin shape before writing, adds `/mcp`, and includes no credentials. It does not check endpoint availability, perform sign-in or deploy anything.

The online Claude chat connector is added through account settings; no remote `claude-desktop.json` is emitted. Use one local or online Conclave connection per host to avoid confusing tool copies. Online clients must choose the same Conclave account; matching ChatGPT/Claude subscriptions alone is not sufficient. Local and hosted packets remain separate stores.

Claude Code supports HTTP MCP/OAuth and can receive connectors already authenticated through a claude.ai subscription login. That inherited route depends on account and runtime configuration; API-key/third-party modes do not fetch those connectors the same way. Verify discovery and permissions before relying on it. [Claude MCP connections](https://code.claude.com/docs/en/mcp)

## UI and authorization

All required workflows are tool-driven. The MCP Apps browser remains optional; a coding host's MCP/plugin support does not establish that it renders chat widgets. Skills direct the agent to use normal reads when UI is unavailable. No new UI capability is asserted for Codex or Claude Code by this packaging increment.

Saving requires explicit requested/previously authorized context and a successful save receipt. Retries keep their request ID only for identical content; updates read the current revision. Resume preserves constraints/questions, selected revision and omission notices. Saved commands and prior deployment plans remain external context and do not supply new execution permission.

## Verification and release limits

Generated connection tests use real independent stdio processes and the official SDK with isolated fixture storage, including paths with spaces, cached plugin relocation and shared durable packets. Hosted-template checks validate transport/address mapping and reject credential-bearing/path/query origins before any writes. Both skills pass the Skill Creator frontmatter validator, and generated Codex TOML parses with Python's standard TOML parser.

The installed Codex CLI accepted, installed and enabled the local package in an isolated configuration and then the user's local configuration. These are discovery/installation checks, not model invocation evidence. Claude Code CLI was not available; no Claude runtime validator or actual Code desktop test was run. A fresh desktop/CLI conversation, host UI tests and hosted authorization remain required. No model calls, remote publication, new hosting project or database changes were needed.

Conclave's generated stdio entry was also added to the existing Claude Desktop chat configuration. The saved entry was read back and every unrelated setting was fingerprint-checked unchanged without printing its contents. This sets up the desktop connection; it does not establish that the running app has reloaded it or that a Code session has inherited it.
