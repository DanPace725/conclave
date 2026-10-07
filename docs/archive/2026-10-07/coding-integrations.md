# Coding client integration and desktop plugin setup

October 7, 2026, local `codex/conclave-handoffs`. This increment packages the existing six MCP tools; it adds no new storage or hosted routes.

## Implementation

- Refactored the configuration generator into a callable `writeConfigurations` function plus CLI. Preserved local Claude Desktop stdio shape and added Codex TOML/Claude Code JSON.
- Generated a private local marketplace containing portable root `plugin.json`/`mcp.json`, Codex compatibility metadata, Claude metadata and `.mcp.json`, with separate catalogs for the two hosts.
- Added concise shared `save-handoff`/`resume-handoff` skills. Coding context can carry verified repository/branch/commit, changed paths and tests. Save receipts/revision guards and current-workspace checks remain explicit; packets do not authorize actions or become canonical human memory.
- Optional `--origin` validates a credential-free HTTPS origin before writing, preserves local examples and emits distinct online alternatives. No remote Claude chat config file is generated; that surface uses its account connector flow.
- Local generated packages retain absolute Node/checkout/data paths so cache relocation does not change storage. They depend on this development checkout and are not portable standalone server installers.

## Verification

Source full suite: **353 passed / one optional saved-export replay skipped**. Syntax, UI bundle/source parity, generated Codex TOML parsing and both Skill Creator frontmatter validators passed.

Three new regressions cover actual independent stdio process launch from generated/cache-copied entries with paths containing spaces, durable cross-client retrieval preserving exact constraints/questions/hash, hosted transport mappings and rejection of credential/path/query/fragment origins before writing. These use the SDK and isolated synthetic storage, not Codex or Claude model sessions.

Installed Codex CLI at `5ea220ae823df3d7/codex.exe` accepted the local marketplace/package in an isolated workspace configuration. Initial restricted execution failed during Windows configuration-path canonicalization; the approved elevated run succeeded with no user configuration changes. The same validated package was then installed in the user's real configuration through `codex plugin marketplace add` and `codex plugin add`. Listing only `conclave-local` confirmed `conclave-handoffs@conclave-local` installed and enabled, version `0.1.0`, with a local source and cache at `~/.codex/plugins/cache/conclave-local/conclave-handoffs/0.1.0`.

The Codex install changes the user's Conclave marketplace/plugin settings and cache. A follow-up added the generated local stdio entry to the existing Claude Desktop configuration, using an adjacent temporary file and atomic rename. Readback verified that the Conclave entry matched and the fingerprint of all unrelated settings was unchanged. No credentials or unrelated configuration contents were printed.

These setup actions do not make model calls, capture a conversation, install global workflow hooks or publish a package. Claude Desktop still needs to reload its configuration; actual Chat/Code invocation remains pending.

## Research and limits

The [active coding guide](../../CODING_INTEGRATIONS.md) cites official OpenAI/Claude packaging, MCP and desktop documentation. Current English Claude desktop documentation differs from older translated pages on whether Code reads the chat desktop configuration; the guide uses current English and retains an actual-version check.

The Claude Code CLI was not found on PATH. No Claude plugin validator, installation or actual desktop conversation was run. The generated MCP mapping and plugin manifests are prepared for those checks. New-session Codex tool invocation, visual widget rendering in coding hosts, real hosted OAuth/account discovery and cross-device interoperability remain pending. No deployment, cloud resource, database migration, public listing or push was performed.
