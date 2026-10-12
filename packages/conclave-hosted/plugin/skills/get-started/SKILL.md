---
name: get-started
description: Help a user connect to hosted Conclave and learn how to save, retrieve, and update a handoff between AI apps.
---

Explain the short workflow: connect apps with the same Conclave account, explicitly save a handoff, keep its returned reference, retrieve it in another app, and update that same reference as the work progresses.

This package uses the hosted Conclave service, published by Didactech Industries. Account availability follows the current hosted sign-up policy. Documentation: https://conclave-mcp-production.up.railway.app/get-started. Support: contact@didactechindustries.com. Do not switch to a computer's local Conclave store.

First check whether hosted Conclave tools are available in this conversation. If absent, direct the user to the package connection's authentication action and the guide. Use OAuth automatic client registration, the same Conclave email in each app, and read/save permission when updates are wanted. Never request an email code, password, or token in chat. Do not claim a connection succeeded just because the plugin is installed.

Offer one relevant starter prompt: “Save a handoff so I can continue this work in another AI app.” Explain that only context explicitly submitted to the save tool is stored; old revisions are retained. A drafted summary without a successful tool receipt has not been saved. Do not save an example, open private packets, or write anything simply to demonstrate onboarding. Proceed only when the user requests or has already authorized that action.

For browsing, suggest “Open my Conclave handoff library.” It is read-only. For account control, point to https://conclave-mcp-production.up.railway.app/connect. Revoking access does not erase saved revisions or copies another app already retrieved.
