# Your Conclave handoff setup checklist

Updated October 7, 2026. I will keep this document current as the setup progresses.

The goal is simple: ask an app to save a handoff in Conclave, then ask another app to retrieve that handoff and continue the work.

## What is ready

- [x] A separate development branch: `codex/conclave-handoffs`.
- [x] Tools to save, find, and retrieve named handoff packets.
- [x] Saved packets stay available after the server restarts.
- [x] Updates keep the earlier versions and prevent accidental overwrites.
- [x] Tools to browse earlier versions and show exactly what changed.
- [x] A compact chat card and an expanded, read-only handoff browser for compatible apps.
- [x] A local UI preview with example data, plus desktop and narrow-screen browser tests.
- [x] Local backup, inspection, and restore commands, including a check before saving.
- [x] A local server and the required software installed in this checkout.
- [x] A password-protected local HTTP connection for development.
- [x] Example connection files for this computer, generated inside `.conclave/mcp-config/`.
- [x] Codex and Claude Code configuration files, plus local plugin packages with save/resume workflows.
- [x] Conclave plugin installed and enabled in this computer's Codex setup.
- [x] Conclave's local MCP connection added to the existing Claude Desktop configuration.
- [ ] First Conclave tool call in a fresh Codex desktop/CLI conversation.
- [ ] Install and try the Claude Code plugin in your desktop app or CLI.
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
4. Restart or reconnect the app. Check that `save_handoff`, `find_handoffs`, `get_handoff`, `list_handoff_versions`, `compare_handoff_versions`, and `open_handoff_library` appear. A read-only connection omits `save_handoff`.
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

## When you are back at your PC

You can leave the hosting decision open while trying the local connection. The order for the online setup is:

1. Choose whether Conclave gets its own Vercel project or starts inside Converse. The options below explain the remaining work for each.
2. Reset the exposed database password and session secret using the steps above, and check the Vercel usage warning.
3. Pick the account you will use to sign in to Conclave from every app.
4. Once the chosen server is deployed and checked, follow the ChatGPT and Claude installation steps below and test one handoff between them.

Your remaining hosting decision and account setup do not stop the local engine work. The new history tools and backup commands have been tested locally. A separate Conclave sign-in page, live deployment, database migration, and real account tests remain unfinished.

## See earlier versions and what changed

After updating the local server, reconnect it in your app. For an online connection that already exists, refresh its tools after deploying an update. Conclave now offers six tools: save, find, retrieve, list versions, compare versions, and open the handoff browser.

- Ask: **“Use Conclave to list the earlier versions of handoff [ID].”** The list shows the newest versions first; the model can request another page.
- Ask: **“Use Conclave to compare version 1 of handoff [ID] with its latest version. Show changed constraints and questions.”** The result includes the exact earlier and later text, including removed items.
- Ask: **“Retrieve version 1 of that handoff.”** Reading an older version leaves the current version untouched. To reuse earlier content, read the current version and explicitly save a new update.

Comparisons do not make an extra model call inside Conclave. They show stored text changes and do not decide which version is factually correct.

## Try the chat UI

To see the new interface before choosing hosting:

1. Open a terminal in `E:\Coding\converse\CLA\conclave`.
2. Run **`npm run mcp:ui:preview`**.
3. Open **`http://127.0.0.1:3214`** in your browser. This shows example packets only; it does not open your real handoffs or accounts.
4. To try the compact chat card, open **`http://127.0.0.1:3214/?inline=1`**, then click **Open handoff browser**.
5. Try searching, reading a packet, opening its version history and comparing versions. Stop the preview with Ctrl+C in the terminal.

In an app connected to the updated server, ask: **“Open my Conclave handoff library.”** ChatGPT and Claude document interactive MCP interfaces, but we still need to test this custom interface in your actual accounts. A terminal client such as Gemini CLI receives ordinary tool results.

The browser lets you inspect saved context and copy its ID. **Continue in chat** asks the current model to retrieve the selected version; it appears only when the app supports that action. You can also expand **Continuation text for another app** and copy that request. Browsing does not save an update; ask the chat to save one explicitly.

For a public ChatGPT release, we will also need a dedicated UI origin, privacy/support details and platform review. The supported UI conventions and the next feature list are in [the plugin development guide](PLUGIN_UI.md).

Sources: [ChatGPT UI guide](https://developers.openai.com/plugins/build/chatgpt-ui), [Claude interactive connectors](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude).

## Back up a local handoff

These commands run from `E:\Coding\converse\CLA\conclave`. They operate on this computer's local handoff storage; they do not download the online account or copy chats, app permissions, or credentials.

1. Ask your connected local app to find the handoff and give you its ID.
2. Save every version of that handoff to a new file:

   ```powershell
   npm run mcp:backup -- export conv_REPLACE_WITH_ID .\my-handoff-backup.json
   ```

3. Check the file before importing it:

   ```powershell
   npm run mcp:backup -- inspect .\my-handoff-backup.json
   npm run mcp:backup -- import .\my-handoff-backup.json --dry-run
   ```

4. To restore it into your current local storage:

   ```powershell
   npm run mcp:backup -- import .\my-handoff-backup.json
   ```

   To restore into a different local directory, set `$env:CONCLAVE_HANDOFF_DATA` to that directory before running the import. Point your local MCP clients at the same directory to use those restored packets.

Restore creates a new handoff ID and keeps all included versions. Reimporting the identical backup returns the same imported handoff without duplicating it, even if you later updated that copy. A failed restore rolls back the whole operation. The export command refuses to overwrite an existing file; use a new filename for the next backup.

**Keep backup files private.** They contain readable packet text, including older versions and removed details. Checksums detect damaged or changed data; they do not prove who wrote it. Imported source labels remain unverified. A backup is limited to 1,000 versions and 8 MiB; a larger handoff fails explicitly instead of exporting an incomplete copy. This is a handoff backup, not a complete Conclave database backup or automatic local-to-online sync.

## Putting the server online

### Recommended option: a separate Conclave project

A dedicated Conclave Vercel project would give all connected apps one stable server address and let us update Conclave independently of Converse. This is a recommendation under discussion; no separate project or deployment has been created. The existing-project instructions below describe the implementation currently prepared.

The setup work for this option is:

1. Add a standalone hosting entry point in the Conclave source repository, reusing the handoff tools, storage, and app permissions already built.
2. Give Conclave its own sign-in and return page using the existing identity provider. The current permission page relies on Converse's sign-in on the same website, so moving the server requires this adjustment.
3. Start with the existing Neon database and its account-owned handoff tables. A separate website does not require a second database; keep the same verified account identity when connecting from different apps.
4. Create a separate Vercel project, configure its database and sign-in settings, and verify a stable HTTPS address. Enter that same address ending in `/mcp` in every connector.
5. Test saving in one real app and retrieving in another before treating the deployment as ready.

A second project on the same Vercel team will not provide a fresh team usage allowance. The existing “Exceeded free resources” warning still needs checking. See [Vercel's team usage guidance](https://vercel.com/docs/pricing/manage-and-optimize-usage). Vercel supports deploying the [Express server framework](https://vercel.com/docs/frameworks/backend/express) used by the hosted implementation.

### Existing Converse project option

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
| Claude Desktop | Already configured on this computer. Fully quit and reopen Claude Desktop, then check that Conclave appears. If reinstalling later, merge `mcpServers.conclave` from `.conclave/mcp-config/claude-desktop.json` into its MCP configuration, keeping other servers. |
| Cursor | Merge `.conclave/mcp-config/cursor-mcp.json` into the project's `.cursor/mcp.json` or your global MCP settings. Reconnect Conclave in its MCP settings. |
| VS Code | Merge the `servers.conclave` entry from `.conclave/mcp-config/vscode-mcp.json` into the workspace's `.vscode/mcp.json`. Start the server through VS Code's MCP server controls. |

The files contain this computer's actual Node and checkout paths. They are development configurations, not portable public installers. Conclave was added to Claude Desktop's existing `%APPDATA%\Claude\claude_desktop_config.json`; all unrelated settings were verified unchanged. Cursor and VS Code settings have not been edited.

Sources: [Claude Desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop), [Cursor configuration](https://docs.cursor.com/context/model-context-protocol), [VS Code configuration](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

## Codex desktop, CLI, and IDE

**Already done on this computer:** the `conclave-handoffs` plugin is installed and enabled from the `conclave-local` marketplace. It uses local handoff storage in this checkout, with the same packets as the other local configurations.

1. Start a fresh Codex conversation. If the plugin does not appear, restart the desktop app.
2. Check the installed plugins for **Conclave handoffs**. Use `/mcp` to check connected servers where that menu is available.
3. Ask: **“Use Conclave to save a handoff called ‘Coding pilot’. Include our repository, branch, changed files, test results, constraints, open questions, and next steps. Return the ID.”**
4. In another connected app, ask: **“Use Conclave to retrieve handoff [ID] and continue from it. Check the current workspace against the saved branch and commit first.”**

The plugin also includes save/resume workflows. It has no automatic conversation capture. Actual model invocation in your desktop session is still a check for you to try.

If you need to reinstall this local package, run these commands from the Conclave checkout:

```powershell
npm run mcp:configs
codex plugin marketplace add E:\Coding\converse\CLA\conclave\.conclave\mcp-config\plugin-marketplace
codex plugin add conclave-handoffs@conclave-local
codex plugin list --marketplace conclave-local
```

Codex also supports a direct MCP connection using the generated `codex-config.toml`. Choose the plugin or direct connection so you do not see duplicate tools. A local connection does not automatically give a hosted web conversation access to this computer's packets.

Sources: [Codex MCP setup](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [plugin packaging and desktop marketplaces](https://developers.openai.com/plugins/build/plugins).

## Claude Code, including the desktop Code tab

The plugin package and connection file are ready. **The Claude Code CLI was not found on this computer's PATH, so I have not installed or invoked its plugin.**

If you have the `claude` command available, use:

```powershell
claude plugin validate E:\Coding\converse\CLA\conclave\.conclave\mcp-config\plugin-marketplace\plugins\conclave-handoffs
claude plugin marketplace add E:\Coding\converse\CLA\conclave\.conclave\mcp-config\plugin-marketplace
claude plugin install conclave-handoffs@conclave-local
claude plugin list
```

Then open a **local** session in the desktop app's Code tab. Use **+ → Plugins → Manage plugins** to check Conclave, or **Add plugin** to browse the configured marketplace. Start a fresh session after installation. Invoke **`/conclave-handoffs:save-handoff`** or **`/conclave-handoffs:resume-handoff`**, or ask the same plain-language save/retrieve questions used in Codex. The desktop plugin browser supports local/SSH sessions; cloud sessions need their own remote connection.

For a direct connection without installing a plugin or CLI, merge the `mcpServers.conclave` entry from **`.conclave/mcp-config/claude-code.json`** into **`.mcp.json` in the project folder you open in Code**. Keep existing entries, start a local session, and approve the project MCP server when prompted. This connects the tools; it does not install the bundled workflow skills.

The Claude Desktop MCP connection has already been added. Current English documentation says local Code sessions can load that chat configuration too. Restart Claude and check a local Code session first; this may give you the tools without another installation. It does not install the workflow skills. The standalone CLI does not read the chat file. Check your app version if behavior differs.

Sources: [Claude Code desktop](https://code.claude.com/docs/en/desktop), [local plugin installation](https://code.claude.com/docs/en/plugin-marketplaces), [MCP configuration](https://code.claude.com/docs/en/mcp).

## Prepare the coding plugins for online use later

Once the server has a verified HTTPS address, we can generate matching online plugin/configuration files with `npm run mcp:configs -- --origin https://YOUR-VERIFIED-ORIGIN`, replacing the placeholder first. They appear under `.conclave/mcp-config/online/`, separate from the local files. That does not deploy or sign you in.

Codex can authenticate an online MCP connection with **`codex mcp login conclave`** when configured directly; for a bundled plugin, use its connection's Authenticate action. Claude Code offers authentication through **`/mcp`**. Keep the same Conclave account in each app and test one saved ID between them. No model API key is needed just to store/retrieve the packet.

The [coding integration guide](CODING_INTEGRATIONS.md) explains packaging, UI limits, local/online storage and the checks already completed.

## Test the handoff between apps

- [ ] In ChatGPT, enable Conclave and ask: **“Use Conclave to save a handoff called ‘Conclave pilot’. Our goal is to test cross-app continuity. Keep the constraint ‘Ask before publishing’ and the open question ‘Which app should we test next?’ Return the saved ID.”**
- [ ] In Claude, enable Conclave and ask: **“Use Conclave to retrieve handoff [paste the ID]. Tell me its goal, constraints, and open questions, then suggest the next step.”**
- [ ] Confirm Claude actually called `get_handoff` and returned the exact constraint and question.
- [ ] Ask Claude to read the current packet and save an updated version. Retrieve the same ID in ChatGPT and confirm the revision increased.
- [ ] Visit **`https://YOUR-CONVERSE-ADDRESS/connect`**, revoke Claude's connection, and confirm Claude must reconnect before it can retrieve packets. Keep ChatGPT's grant active to check that revocation applies to the selected connection.
- [ ] Repeat with Gemini CLI once the first pair succeeds.
- [ ] Ask ChatGPT and Claude to **open the Conclave handoff library**. Check the compact card, expanded view, light/dark appearance and keyboard controls.
- [ ] Read an earlier version in the browser, click **Continue in chat**, and confirm the model retrieves that same version. If the app lacks this action, use the continuation text instead.
- [ ] Check that browsing creates no new versions and that read-only connections cannot save.
- [ ] Save in a fresh Codex conversation and retrieve the same ID in Claude Code or Claude Desktop using local storage. Check exact constraints, questions and selected revision.
- [ ] Later, repeat between online coding and chat apps using the same Conclave sign-in account. Do not mix a local ID with an online store.

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
