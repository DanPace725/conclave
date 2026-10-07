# Your Conclave handoff setup checklist

Updated October 7, 2026. I will keep this document current as the setup progresses.

The goal is simple: ask an app to save a handoff in Conclave, then ask another app to retrieve that handoff and continue the work.

## What is ready

- [x] A separate development branch: `codex/conclave-handoffs`.
- [x] Tools to save, find, and retrieve named handoff packets.
- [x] Saved packets stay available after the server restarts.
- [x] Updates keep the earlier versions and prevent accidental overwrites.
- [x] A local server and the required software installed in this checkout.
- [x] A password-protected local HTTP connection for development.
- [x] Example connection files for this computer, generated inside `.conclave/mcp-config/`.
- [ ] A live test inside your actual ChatGPT or Claude account.
- [x] Online storage code that keeps each account's handoffs separate.
- [x] Sign-in consent, renewable app connections, and a page to revoke access.
- [x] Local tests of the full online authorization and handoff flow.
- [ ] Put this build online and check its public address.
- [ ] Apply the new database migration to the hosted database.
- [ ] Installable public plugins and directory listings.

The online implementation is prepared and tested locally, but **it is not deployed**. The live ChatGPT/Claude steps below are ready to follow once the server is online. The existing local connection stores packets on this computer; those packets are separate from the online account's packets.

**Online server address: not issued or verified yet.** Below, `YOUR-CONVERSE-ADDRESS` means the final HTTPS address of the Converse deployment. The connector URL will be `https://YOUR-CONVERSE-ADDRESS/mcp`. Do not paste this placeholder into an app.

The browser session is confirmed signed in to `danpace725s-projects` and can open the Converse project. Its current production domain is `converse-cyan.vercel.app`, with production marked Ready. This is the existing app; the handoff build has not been deployed there.

## What you can do now

You do not need to buy anything, create a database, or provide model API keys for the current local work. The model in your chat writes the packet; Conclave saves and retrieves it without making an extra model call.

If you want to try a local app now:

1. Pick a local app that supports MCP, such as Claude Desktop, Gemini CLI, Cursor, or VS Code.
2. Use the matching example file from `.conclave/mcp-config/` in this Conclave checkout. These files contain the correct paths for this computer and no passwords.
3. Add the `conclave` entry to that app's MCP configuration. Keep any other entries already in your settings. I have not changed your app settings.
4. Restart or reconnect the app. Check that `save_handoff`, `find_handoffs`, and `get_handoff` appear.
5. Ask: **“Use Conclave to save a handoff called ‘My first handoff’. Include our objective, decisions, constraints, open questions, and next steps.”**
6. Keep the ID the app returns. In another connected local app or a fresh conversation, ask: **“Use Conclave to retrieve handoff [paste ID] and continue from it.”**

For a more specific retrieval, ask: **“Retrieve that handoff, focusing on the login work.”** The tool keeps all decisions, constraints, and open questions, while selecting matching context paragraphs. The complete saved packet stays available.

To update a packet, ask: **“Read the current handoff and save an updated version with what we decided today.”** The tool requires the current version before updating. Saving a second packet with the same title creates a separate handoff; use the ID when there could be confusion.

If you use Gemini CLI, there is also a generated local extension folder at `.conclave/mcp-config/gemini-extension/`. It points to this checkout. It is a development extension for this computer, not a published portable package. The technical guide has its install command.

## Things you need to do before the online test

- [x] **Confirm browser hosting access.** The signed-in Chrome session can open `converse` in `danpace725s-projects`. We can use this browser for the hosting dashboard steps. The connector and CLI use separate credentials and still lack this team's access; reconnect those only if we need that route.
- [ ] **Check the hosting usage warning.** The team dashboard shows “Exceeded free resources” and Fluid Active CPU of 5h 46m against a 4h free allowance. We still need to establish how this affects the pilot. No plan change or purchase has been made.
- [ ] **Rotate two credentials before deploying.** My earlier configuration check accidentally included the database password and `SESSION_SECRET` in tool output. In Neon, reset the database role's password and replace the corresponding `DATABASE_URL` and `DATABASE_URL_UNPOOLED` values in Vercel and your local `.env`. In Vercel, replace `SESSION_SECRET` with a newly generated random secret of at least 32 characters. Keep `KEY_ENCRYPTION_SECRET` unchanged so existing saved model keys remain readable. Changing the session secret signs browsers out and invalidates this implementation's app grants. Do not send the replacement secrets in chat.
- [ ] **Confirm the pilot account.** Use the same Converse sign-in account from both apps. Your allowed email list controls who can connect. The ChatGPT and Claude accounts themselves can have different email addresses; the Converse account you choose during each permission flow must match.
- [ ] **Enable custom apps if your workspace requires it.** A workspace administrator may need to enable developer mode or custom connectors.

## Putting the server online

This is the prepared developer sequence. Browser hosting access is verified; the credential rotation and usage check above remain before the live pilot. You do not need to create a second hosting project or a second database for the implementation.

1. Choose a stable HTTPS address on the existing Converse project for the pilot. A preview needs a stable alias and a working Converse sign-in callback. Keep the server address fixed during a connection.
2. In Vercel's environment settings for that deployment, set **`CONCLAVE_MCP_ORIGIN`** to its origin, such as `https://your-real-address.example`, with no trailing slash or path. Keep the existing database and sign-in settings. Leave this variable absent in deployments where handoffs should stay disabled.
3. Apply migration `0005_handoff_mcp` using `npm run db:migrate` from `E:\Coding\converse\converse`, with the intended database's direct connection configured. This creates handoff and authorization tables; it does not copy existing chats into them. Test an isolated database first.
4. Deploy the prepared `codex/conclave-handoffs` build to that address. This build includes the `/mcp`, authorization, metadata, and `/connect` routes. The implementation uses the existing hosting and database; actual plan limits and any extra hosting/storage cost still need checking in your account.
5. Check `https://YOUR-CONVERSE-ADDRESS/.well-known/oauth-protected-resource/mcp`: it should return JSON describing the same `/mcp` address. An unauthenticated request to `/mcp` should request sign-in, not show a Vercel login wall or expose packets. Deployment protection must allow the cloud clients to reach these routes; keep Conclave's own authorization required.
6. Open `https://YOUR-CONVERSE-ADDRESS/connect`. Confirm Converse sign-in works and that the connection-management page opens. Then enter the verified `/mcp` URL in each app below.

The first cloud pilot has a deliberate storage limit: 2,000 stored handoff events per account, including earlier versions and creation records. If reached, saving stops with an explicit error; older packets are not silently dropped. Public distribution and larger-scale storage remain later work.

## Set up the private plugin in ChatGPT

Do this after the online address is verified. OpenAI's interface may call the connection an app, connector, or plugin; this pilot connects directly to our MCP server.

1. Open [ChatGPT Plugins](https://chatgpt.com/plugins) on the web. Select **+ → Add custom MCP server**. Account/workspace policy controls access; an administrator may need to enable custom connections.
2. Name it **Conclave** and give it the description “Save and retrieve context handoffs between AI apps.” Under **Connection**, enter the verified `https://YOUR-CONVERSE-ADDRESS/mcp` URL.
3. Choose **OAuth** authentication. Use automatic client registration; leave client ID and client secret blank when that registration option is available. Our server supports automatic registration, rather than a published client identity document. Review the displayed risk warning and choose **I understand and want to continue**, then **Create as a plugin**. Do not choose “No authentication” or enter a model API key.
4. Review the discovered tools and install the resulting plugin. Start its sign-in flow. On the Conclave page, follow **Sign in to Converse** if needed. It opens another tab; sign in, return to the permission page, and click **Continue after signing in**.
5. Check the account email and app details on the consent page, then click **Allow connection**. This permits reading and saving handoff packets. It does not grant access to your Converse conversations or saved model keys.
6. Start a fresh chat, type **`@`**, and select **Conclave**. Ask it to list your handoffs. A successful response should use `find_handoffs`.

If your account still shows the earlier Apps interface, use **Settings → Apps → Advanced settings → Developer mode**, then **Create app**, with the same URL and OAuth choice. If creation is missing, check workspace policy/account eligibility. After tool definitions change, open the connection in Plugins and choose **Refresh**, then start a new chat.

Sources: [OpenAI connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt), [developer mode availability](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt), [OAuth setup](https://developers.openai.com/plugins/build/auth).

## Set up the private connector in Claude

1. Open Claude and go to **Customize → Connectors → + Add → Add custom connector**. For Team or Enterprise, the owner may need to add it in organization settings first.
2. Name it **Conclave**, enter the same verified `https://YOUR-CONVERSE-ADDRESS/mcp` URL, and click **Continue**.
3. Review the detected OAuth settings. Choose **Sign in now** and **Register automatically** for the OAuth client. This pilot does not implement Claude's published identity option. Leave fixed request-header credentials empty.
4. Finish adding the connector and follow its sign-in prompt. Sign in to the **same Converse account** you used from ChatGPT, return to the Conclave permission page, and allow the connection.
5. In a new conversation, enable Conclave in the connector/tools menu. Ask it to retrieve a handoff using the ID returned in ChatGPT.

Source: [Claude's custom connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## Set up Gemini CLI

Gemini CLI is the supported target for these instructions. A general custom-connector route in the consumer Gemini chat app has not been verified.

For the **online** account, merge this into `%USERPROFILE%\.gemini\settings.json`, keeping your other settings and servers:

```json
{
  "mcpServers": {
    "conclave": {
      "httpUrl": "https://YOUR-CONVERSE-ADDRESS/mcp"
    }
  }
}
```

1. Replace the placeholder with the verified server address before saving.
2. Start Gemini CLI and run **`/mcp auth conclave`** if it needs sign-in.
3. Complete Conclave's sign-in and permission page using the same Converse account as the other apps.
4. Run **`/mcp`** to check the available tools, then ask Gemini to retrieve the saved handoff by ID.

For the **local development** storage on this computer, use the generated `gemini-settings.json` instead, or run `gemini extensions link E:\Coding\converse\CLA\conclave\.conclave\mcp-config\gemini-extension`. Do not configure both the local and online servers under the same `conclave` name. The local directory and online account do not automatically synchronize.

Source: [Gemini CLI MCP and OAuth guide](https://geminicli.com/docs/tools/mcp-server/), [extension installation](https://geminicli.com/docs/extensions/reference/).

## Claude Desktop, Cursor, and VS Code on this computer

These generated configurations are for local storage and do not require online sign-in. Regenerate them with `npm run mcp:configs` from the Conclave checkout if Node or the checkout moves.

| App | What to do |
| --- | --- |
| Claude Desktop | Open its developer settings and edit the MCP configuration. Merge the `mcpServers.conclave` entry from `.conclave/mcp-config/claude-desktop.json`, keeping existing servers. Fully quit and reopen Claude Desktop. |
| Cursor | Merge `.conclave/mcp-config/cursor-mcp.json` into the project's `.cursor/mcp.json` or your global MCP settings. Reconnect Conclave in its MCP settings. |
| VS Code | Merge the `servers.conclave` entry from `.conclave/mcp-config/vscode-mcp.json` into the workspace's `.vscode/mcp.json`. Start the server through VS Code's MCP server controls. |

The files contain this computer's actual Node and checkout paths. They are development configurations, not portable public installers. I have not edited your app settings.

Sources: [Claude Desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop), [Cursor configuration](https://docs.cursor.com/context/model-context-protocol), [VS Code configuration](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

## Test the handoff between apps

- [ ] In ChatGPT, enable Conclave and ask: **“Use Conclave to save a handoff called ‘Conclave pilot’. Our goal is to test cross-app continuity. Keep the constraint ‘Ask before publishing’ and the open question ‘Which app should we test next?’ Return the saved ID.”**
- [ ] In Claude, enable Conclave and ask: **“Use Conclave to retrieve handoff [paste the ID]. Tell me its goal, constraints, and open questions, then suggest the next step.”**
- [ ] Confirm Claude actually called `get_handoff` and returned the exact constraint and question.
- [ ] Ask Claude to read the current packet and save an updated version. Retrieve the same ID in ChatGPT and confirm the revision increased.
- [ ] Visit **`https://YOUR-CONVERSE-ADDRESS/connect`**, revoke Claude's connection, and confirm Claude must reconnect before it can retrieve packets. Keep ChatGPT's grant active to check that revocation applies to the selected connection.
- [ ] Repeat with Gemini CLI once the first pair succeeds.

Do not mark these account tests complete based only on the local automated tests.

## Disconnecting and later publication

Use the online **`/connect`** page to revoke a connection immediately. Removing a connector from an app may only remove that app's settings. Signing out of Converse does not revoke app access. Connections expire after 30 days and then need new consent; access tokens renew within that period. Revoking access keeps your saved packets and older versions.

- [ ] Before public publication, supply a publisher name, support contact, and privacy information, finish operational abuse/retention work, and complete each platform's submission/review process. Private setup does not create a public directory listing.

## What to remember

- Only material sent through the save tool goes into the handoff. The plugin does not silently copy your entire conversation.
- Share only what you want the receiving app to see. A handoff can contain private project details.
- Source app/model labels describe what the saving app reports. Conclave does not pretend it independently verified them.
- Saving a packet does not turn a model's summary into a verified instruction from you. It is context for the receiving conversation.
- Older versions are retained. This pilot does not provide a permanent-delete button.

Implementation and test details live in [the technical setup guide](HANDOFF_MCP.md). The broader [research plan](archive/2026-10-07/mcp-connector-plan.md) is still available.
