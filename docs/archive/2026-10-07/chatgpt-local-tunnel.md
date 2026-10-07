# Regular ChatGPT local connector gap and tunnel preparation

The user tested `conclave-handoffs@conclave-local` in a regular ChatGPT chat. The UI supplied its mention but the model reported no Conclave tools and did not retrieve the packet. The installed package supplies stdio and skills, with no registered `.app.json` mapping. Official OpenAI documentation describes separate custom MCP registration for Chat and an outbound Secure MCP Tunnel for a private local server.

## Implemented

- `mcp:chatgpt check` uses real SDK stdio discovery with disposable storage. Optional handoff ID inspection uses read-only SQLite and prints only presence/revision.
- `prepare --tunnel-id` invokes official `tunnel-client init` with a named workspace profile, complete tunnel ID, absolute quoted forward-slash Windows paths and loopback health port 3215. No forced replacement.
- `doctor`/`run` require an environment-held runtime key; no key is written to generated files. The client connects over stdio to the same existing local store. Existing HTTP authentication is unchanged.
- `link --app-id` creates a separate private `conclave-chatgpt` marketplace with skills and registered `.app.json` mapping in portable and compatibility manifests; no duplicate stdio configuration or fabricated ID.
- Save/resume skills explicitly report unavailable tools without claiming a packet was saved/read.
- Plain-language setup is in `docs/CHATGPT_LOCAL.md` and linked from the ongoing checklist.

## Verified

- Six tool names discovered over real stdio. The requested `conv_3236a4e1-42e7-46d6-bdc8-98a5074c620c` exists in the canonical local handoff database, latest revision 2. No packet contents printed or sent to a remote service.
- Five focused integration tests pass: independent/cache-copied local connections and restart retrieval, registered-app bindings without duplicate stdio, invalid app/hosted IDs before writes, complete tunnel IDs and loopback settings, credential-free host templates.
- Full source suite: **355 passed, one optional saved-export replay skipped**. Syntax/UI bundle/credential artifact checks and `git diff --check` passed.
- Official GitHub latest Windows amd64 archive v0.0.16 downloaded under ignored `.conclave/tunnel-client/`; SHA-256 `edef7241b0c647fcb30f1a80ff376b6b25c51927960f257a3f01e21b17c2aba6` equals the release asset digest. No Cloudflared/public tunnel was launched.
- Actual vendor CLI created/loaded an isolated fixture profile using the generated quoted Node path. `doctor` stopped with the expected **CONTROL_PLANE_API_KEY not set** failure. This is profile loading evidence, not an authenticated tunnel or server invocation through that client.
- Signed-in Chrome opened Platform tunnel settings in Pace Consulting Services (no tunnels) and ChatGPT Plugins → Add custom MCP server. A tunnel draft name/description was entered; its workspace selector displayed an opaque workspace ID that has not been verified. No tunnel, key, app grant or custom connection created.

## Outstanding

Chrome then blocked automation because another extension UI was open. Stop browser actions until it is dismissed. After confirming the intended organization/workspace, create/authorize the private tunnel, provide its runtime key privately, run doctor/client, register/install the ChatGPT custom connection and perform a real revision-2 tool call. These remain account steps, subject to the applicable UI access confirmation rules.

Local Codex plugin installation is still not a model invocation check. The separate local CLI MCP inventory did not list Conclave; do not infer local runtime attachment from skills appearing. This regular Chat tunnel work does not establish that local Codex connection.

No inference API calls, Vercel resource creation, migration, push, deployment, public listing or existing packet mutations.

Sources: [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels), [custom MCP registration](https://developers.openai.com/api/docs/guides/custom-mcp-server), [plugin app mappings](https://developers.openai.com/plugins/build/plugins), [host MCP versus hosted Chat](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [official client](https://github.com/openai/tunnel-client).
