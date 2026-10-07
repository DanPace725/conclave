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

## Follow-up: browser form entry and approved existing key

The user approved reusing the existing environment `OPENAI_API_KEY`. A read-only `/v1/models` authentication check returned HTTP 200; no model call, response content or secret output. The fixture profile's actual vendor doctor subsequently passed with the key mapped only in the child-process environment. This proves local configuration validation, not tunnel-scoped authorization or a live connection.

Windows-based form entry again reported an extension UI and native Computer Use stopped because it could not verify the current URL. The user identified NordPass and asked to leave it alone. In a later turn, documented browser page controls successfully opened/filled the tunnel form without operating NordPass. The prepared draft selects Pace Consulting Services and the one ChatGPT workspace offered by the Platform page (`dd9cffeb-4866-4e65-8800-a7018c53912c`). A screenshot is retained in ignored `.conclave/tunnel-review.png`; no creation button submitted. Access approval for the private tunnel and ChatGPT connector is pending under the Computer Use confirmation rules. No live tunnel, key file or registered app has been created.

## Follow-up: approved private connection and real ChatGPT round trip

The user answered **Yes, connect Conclave** to the concrete private tunnel/ChatGPT read-save access confirmation. Created **Conclave local handoffs** under Pace Consulting Services (`org-OcaOjCyJT5NuEFGuKK5mhA14`), associated with the offered ChatGPT workspace. Tunnel ID: `tunnel_6ac6b5172dd081918c3e28eb0e48c6ea`. Existing key passed actual tunnel metadata authentication, kept only in process environment.

The client started inside the agent sandbox and authenticated, but loopback health requests from both the host and Chrome timed out. Read-only host diagnostics verified the exact client path, start time and listener. Stopped only that owned process and restarted the same official executable/profile as a hidden host process. Health then returned HTTP 200 with `live:true`, `ready:true`, lifecycle `running`. No firewall, browser extension or account security changes. Runtime identity is recorded in ignored `.conclave/chatgpt-tunnel/runtime.json`; no startup-at-login task or credential file was created.

ChatGPT Plugins → Add custom MCP server → Tunnel accepted the complete tunnel ID with upstream **No authentication**. The authorized workspace/tunnel controls access to the local stdio server. Created and connected the private plugin `plugin_asdk_app_6ac6b6e4647081919e4c151e3dbde41c`, then used **Try in chat** to create a new regular ChatGPT conversation. [Connected plugin](https://chatgpt.com/plugins/plugin_asdk_app_6ac6b6e4647081919e4c151e3dbde41c).

- The real chat reported `get_handoff`, ID `conv_3236a4e1-42e7-46d6-bdc8-98a5074c620c`, revision **2**, title **Coding Pilot**. The request did not supply the title. Tunnel logs show forwarded commands during registration and chat invocation. Existing packet revision remains 2.
- Asked the chat to save a new synthetic test packet, without updating Coding Pilot. It returned `conv_fd5705a5-30fb-4d8f-be61-0b21c7f777c0`, revision **1**.
- An independent real SDK stdio client retrieved that exact ID from canonical `.conclave/handoffs` and asserted revision 1, title **ChatGPT local tunnel verification**, and preserved test-data constraint. This independently demonstrates the ChatGPT save reached the same local database.
- [Actual regular chat](https://chatgpt.com/c/6ac6b707-ecf8-83e8-866d-5985f3b1e7d6). Screenshots in ignored `.conclave/chatgpt-connected.png` and `.conclave/chatgpt-retrieved.png` preserve account-side evidence; `.conclave/chatgpt-tunnel/verify-save.mjs` preserves the local read-only assertion.
- Generated the optional registered-app workflow package with the real technical ID. It has no duplicate stdio entry and was not installed. `npm run ... -- link --app-id` on this PowerShell/npm installation dropped the flag; direct Node invocation succeeded. Corrected operational instructions to direct Node for flag-bearing setup commands.

This resolves the observed regular ChatGPT tool-discovery failure. Native ChatGPT desktop, actual Claude Desktop/Code, local Codex attachment, interactive MCP Apps rendering and hosted OAuth deployment remain separate checks. Browser registration alone would not have been sufficient; real read/save and independent retrieval now passed. No Vercel resource, public listing, database migration, push or deployment. Conclave performs no inference calls; the actual ChatGPT test used ChatGPT's conversational model.
