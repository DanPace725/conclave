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
- [ ] A private online server that ChatGPT and Claude can both reach.
- [ ] Sign-in and account permissions for that online server.
- [ ] Installable public plugins and directory listings.

The current build stores packets on this computer. It does not yet make them available to ChatGPT or Claude's cloud connections. The local HTTP connection is for testing; its password is not a replacement for the online sign-in setup.

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

## Things you will need to do later

These tasks are waiting for the online server and sign-in to be ready. You do not need to do them yet.

- [ ] **Choose the first accounts to test.** The starting pair is ChatGPT and Claude. Use the accounts where you want to continue the same work.
- [ ] **Approve where Conclave runs online.** I will first prepare a concrete hosting option, its address, and any cost information. Existing Converse hosting may be usable; this has not been verified for the handoff service.
- [ ] **Sign in to Conclave from each app.** This gives each app permission to access your saved handoffs. You should not paste your model API keys into a handoff or plugin configuration.
- [ ] **Add the private Conclave connection in ChatGPT.** I will provide the exact server address and steps after the online connection is ready. Account or workspace rules may limit custom connections.
- [ ] **Add the private Conclave connector in Claude.** Use the same Conclave account so both apps see your handoffs.
- [ ] **Run one real handoff test.** Save in one app, retrieve in the other, and confirm that the important constraints and next steps survived.
- [ ] **Review publication details if we distribute it.** You may need to supply a publisher name, support contact, and privacy information, and submit the plugin using your developer account.

Gemini CLI and Gemini API integrations are planned. A general custom-connector route in the consumer Gemini chat app has not been established. I will not mark that app ready unless we verify it.

## What to remember

- Only material sent through the save tool goes into the handoff. The plugin does not silently copy your entire conversation.
- Share only what you want the receiving app to see. A handoff can contain private project details.
- Source app/model labels describe what the saving app reports. Conclave does not pretend it independently verified them.
- Saving a packet does not turn a model's summary into a verified instruction from you. It is context for the receiving conversation.
- Older versions are retained. This first build does not provide a permanent-delete button.

Implementation and test details live in [the technical setup guide](HANDOFF_MCP.md). The broader [research plan](archive/2026-10-07/mcp-connector-plan.md) is still available.
