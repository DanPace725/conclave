# Conclave

**Pick up your work in another AI app.**

Conclave saves the important parts of a conversation—your goal, decisions, constraints, open questions, and next steps—so you can continue elsewhere without explaining everything again.

For example, plan a project in ChatGPT, ask it to save a handoff, then retrieve that handoff in Claude or Gemini. Use the same Conclave account in each connected app to find the same saved work.

[Open Conclave](https://conclave-mcp-production.up.railway.app) · [Getting started](https://conclave-mcp-production.up.railway.app/get-started) · [Help](https://conclave-mcp-production.up.railway.app/support)

## Get started

1. **Sign in to Conclave.** New accounts can use Google or an email sign-in code. Existing accounts can also sign in with a password.
2. **Connect your AI apps.** Add the address below as a custom connection, choose OAuth and automatic registration when asked, and approve read and save access. Use the same Conclave account in each app. Custom-connection availability depends on the app and your account.
3. **Save, then resume.** Ask one connected app to save a handoff. Keep the reference it returns and use it in another connected app.

Connection address:

```text
https://conclave-mcp-production.up.railway.app/mcp
```

To save:

> Use Conclave to save a handoff for this project. Include our goal, decisions, constraints, open questions, and next steps. Return its reference.

To resume:

> Use Conclave to retrieve [handoff reference] and continue from it.

To keep the same work up to date:

> Read the current Conclave handoff [reference], then update it with today's decisions and next steps. Keep unresolved questions.

Replace the bracketed reference with the one from your save. A successful save returns a reference and version; a draft in chat alone has not been saved. The hosted handoff service needs no model API key.

## Use the web app

The dashboard lets you find saved handoffs, read earlier versions, compare changes, copy a reference, and export saved work. Its graph shows links explicitly saved between handoffs. Ask your connected AI app to save updates; browsing the dashboard does not change a handoff.

The navigation update in this branch organizes the website into:

- **Dashboard:** browse your saved work.
- **Getting Started:** three short steps to connect, save, and resume.
- **Docs:** connection settings, permissions, and technical details.
- **Account:** the round profile button at the top right, with Connections, password, and sign-out controls.

This navigation update is awaiting deployment. The live website may still show the previous labels.

You can also install the dashboard from a supported browser to open it from your home screen or desktop. An internet connection is needed to load handoffs.

## Your saved work

Only what you explicitly ask an app to save carries over. Conclave does not automatically copy your entire chat or see another app's current memory. Review important details before continuing.

Updating a handoff keeps its earlier versions. Reuse its reference to continue the same work; creating another handoff with the same title creates a separate item.

Connections control which apps can read or save your handoffs. Revoking a connection stops its future access but keeps your saved work. Signing out of the website leaves connected apps authorized. See [Privacy](https://conclave-mcp-production.up.railway.app/privacy) for data handling and removal requests.

Hosted handoffs and handoffs saved by a local Conclave installation use separate stores. They do not synchronize automatically.

## Run locally or build with Conclave

This repository also contains the Conclave engine used by Converse. It supports saved conversation history, context and memory management, agents, and workspace files. The hosted handoff website has its own account and storage; you do not need Converse to use it.

- [Local engine and command-line guide](docs/CLI_GUIDE.md)
- [Local and coding-app connections](docs/HANDOFF_SETUP.md)
- [Handoff format and linked handoffs](docs/CLAMP.md)
- [Hosted service setup](docs/HOSTED_HANDOFFS.md)
- [Development and Converse integration](docs/CONVERSE_INTEGRATION.md) · [Testing](TESTING_GUIDE.md)

## Help and licence

Conclave is published by **Didactech Industries**. For setup help, account questions, or data requests, contact [contact@didactechindustries.com](mailto:contact@didactechindustries.com).

Released under the [MIT licence](LICENSE).
