# Use local Conclave from a regular ChatGPT chat

Checked October 7, 2026. [Main setup checklist](HANDOFF_SETUP.md).

The installed `conclave-handoffs@conclave-local` package supplies local workflows and a local MCP command. Seeing its name in ChatGPT does not mean a regular ChatGPT chat can run that command. Regular Chat needs a registered MCP connection. OpenAI's **Secure MCP Tunnel** provides that connection while keeping the server and packet database on your PC.

This route needs no Vercel deployment, public server, inbound firewall opening or database migration. Conclave still makes no model calls. The tunnel requires an OpenAI Platform runtime API key for its connection, separate from the model answering your chat. Account eligibility, permissions and any tunnel usage charges should be checked in your account; we have not verified pricing.

## What has been checked

- The local server exposes all six Conclave tools through a real MCP connection.
- Your requested `conv_3236a4e1-42e7-46d6-bdc8-98a5074c620c` exists in this checkout's handoff database at revision **2**. Only its presence/revision were inspected here.
- The signed-in browser can open OpenAI tunnel settings under **Pace Consulting Services** and ChatGPT's custom MCP setup.
- The official Windows `tunnel-client` release **v0.0.16** is downloaded in `.conclave/tunnel-client/`; its archive SHA-256 matches GitHub's release digest. This is a local installation, not a connected tunnel.
- Setup commands and registered-app packaging are implemented and tested. A real ChatGPT tool call, tunnel authorization and UI rendering remain unverified.
- Browser setup stopped because another Chrome extension UI is open. Dismiss that UI before asking me to continue the account setup; no tunnel, runtime key or ChatGPT connection has been created.

## 1. Create the private tunnel

1. Open [OpenAI tunnel settings](https://platform.openai.com/settings/organization/tunnels).
2. Check the selected Platform organization. The currently signed-in browser selected **Pace Consulting Services**. Choose the organization you intend to use.
3. Click **Create tunnel**. Name it **Conclave local handoffs** and describe it as **Private connection to Conclave handoff packets stored on this PC.**
4. Associate the tunnel with the Platform organization and the **ChatGPT workspace where you will use it**. These are separate selections. Selecting only the Platform organization can leave the tunnel missing in ChatGPT. If a workspace is shown only as an ID, verify which account/workspace it identifies before selecting it.
5. Create the tunnel and copy its complete **tunnel ID**. Do not shorten it. It identifies the connection and is not your handoff ID.

The tunnel makes this local handoff store available through OpenAI to the authorized workspace/plugin. This local stdio server has no additional Conclave sign-in or per-account separation. For a private pilot, choose your own ChatGPT workspace and keep the plugin private. Multi-user account separation uses the separately prepared hosted OAuth server.

## 2. Prepare the local connection

Open PowerShell in `E:\Coding\converse\CLA\conclave`. Run:

```powershell
npm run mcp:chatgpt -- check
npm run mcp:chatgpt -- prepare --tunnel-id YOUR_COMPLETE_TUNNEL_ID
```

Replace `YOUR_COMPLETE_TUNNEL_ID` first. The second command uses OpenAI's client to create `.conclave/chatgpt-tunnel/conclave.yaml`. It references the existing Node launcher and keeps the health page on your computer at `http://127.0.0.1:3215/ui`. It refuses to overwrite an existing profile.

If the client executable is elsewhere, set `CONCLAVE_TUNNEL_CLIENT` to its full path before running the command. For another computer, download its matching archive from the [official latest release](https://github.com/openai/tunnel-client/releases/latest); paths and the existing download here are for this Windows PC.

## 3. Supply the tunnel key privately and start it

Use a Platform runtime API key with **Tunnels Read + Use** for the tunnel's organization. Creating/managing tunnels requires **Tunnels Read + Manage**. An organization owner or administrator controls these permissions. A ChatGPT subscription login by itself does not supply this runtime key.

Enter the key in your own terminal, not in chat. This PowerShell example prompts without displaying it and keeps it only in the terminal's environment:

```powershell
$conclaveTunnelKey = Read-Host 'OpenAI tunnel runtime key' -AsSecureString
$env:CONTROL_PLANE_API_KEY = [System.Net.NetworkCredential]::new('', $conclaveTunnelKey).Password
Remove-Variable conclaveTunnelKey
npm run mcp:chatgpt -- doctor
npm run mcp:chatgpt -- run
```

Leave the terminal running while ChatGPT uses Conclave. Check the local health page for readiness. The client opens an outbound connection to OpenAI and launches Conclave over stdio. Our helper does not start the local HTTP server or remove its password protection. It saves no API key in the profile, plugin package or Git.

Stop with **Ctrl+C** when finished, then run `Remove-Item Env:CONTROL_PLANE_API_KEY` in that terminal. Closing the terminal also discards its environment. The tunnel will be unavailable when this PC is asleep or the client is stopped.

## 4. Register Conclave in ChatGPT

1. While the tunnel is running, open [ChatGPT Plugins](https://chatgpt.com/plugins).
2. Choose **Add → Add custom MCP server**.
3. Name it **Conclave local handoffs**. Under **Connection**, choose **Tunnel**, then choose the tunnel you created. Do not paste a `conv_...` ID or `http://localhost:3213/mcp` into a server URL field.
4. For this stdio tunnel, choose **No authentication** for upstream MCP authentication. Access comes from the authorized tunnel/workspace and private plugin; this choice does not create a public listener. The hosted Conclave connector instead requires OAuth.
5. Review the displayed access warning and create/install the private plugin. Confirm it discovers `save_handoff`, `find_handoffs`, `get_handoff`, `list_handoff_versions`, `compare_handoff_versions` and `open_handoff_library`.
6. Start a **new regular ChatGPT chat** and select the newly registered **Conclave local handoffs** connection with `@`. Ask: **Use Conclave to retrieve handoff conv_3236a4e1-42e7-46d6-bdc8-98a5074c620c at revision 2.**

Success means the model actually calls `get_handoff` and receives revision 2. Displaying the plugin name, installing a package or stating it can retrieve the packet is not sufficient. Then save a small new packet in ChatGPT and retrieve its returned ID from Claude Desktop to verify the shared local database.

## Optional: add our save/resume skills to the registered connection

The registered custom MCP plugin already provides the tools. If you also want our packaged workflows, copy its technical app ID from the ChatGPT plugin page URL. It starts with `plugin_asdk_app...`; preserve the exact ID issued by ChatGPT.

```powershell
npm run mcp:chatgpt -- link --app-id YOUR_REGISTERED_APP_ID
codex plugin marketplace add E:\Coding\converse\CLA\conclave\.conclave\mcp-config\chatgpt\plugin-marketplace
codex plugin add conclave-handoffs@conclave-chatgpt
```

This generates a separate plugin whose `.app.json` points to the registered connection. It does not include the local stdio command, create an account connection or reuse a fabricated ID. Refresh the desktop plugin directory and test in a fresh chat. Select the registered connection rather than the earlier `@Conclave handoffs` local-only package. Keep local Codex/Claude configurations for direct local sessions.

## If ChatGPT still cannot find the tools

- **Tunnel absent from the list:** check the ChatGPT workspace association and Tunnels Read + Use permissions.
- **Connection exists but discovery fails:** keep the client running; check `doctor` and its local health page. Refresh the ChatGPT connection and start a new chat.
- **Only local skills/name appear:** select the registered custom MCP plugin. For a bundled plugin, inspect its `.app.json` mapping. The public plugin resolver does not register private local packages for you.
- **Packet not found after tools work:** confirm the same local data directory. Online OAuth packets and ordinary Converse conversations are separate. `CONCLAVE_HANDOFF_DATA` can explicitly select another local handoff store.
- **Local Codex has no Conclave server:** `/mcp` in a local Codex conversation checks its connections. The local plugin's runtime attachment remains a separate test; a regular ChatGPT connection does not prove it.

Sources: [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels), [custom MCP connections](https://developers.openai.com/api/docs/guides/custom-mcp-server), [registered app mappings](https://developers.openai.com/plugins/build/plugins), [local versus hosted MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [official tunnel client onboarding](https://github.com/openai/tunnel-client/blob/master/docs/onboarding.md).
