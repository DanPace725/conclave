---
name: save-handoff
description: Save or update a Conclave handoff when the user asks to carry the current work into another app or conversation.
---

Use the connected Conclave MCP tools to save the relevant context explicitly requested by the user. If Conclave is unavailable, report that the packet was not saved; a written draft is not a save receipt.

Preserve the objective, decisions, constraints, open questions, next steps and relevant references. Distinguish verified results from proposed work and known limitations. Include app/model labels only when known. For coding work, include relevant repository name, branch/commit, changed paths, test results and unsaved work when established; re-check recorded repository state before asserting it is current. Do not copy credentials, environment files or an entire transcript as a default.

Create a packet with `save_handoff` and a fresh request ID for this intended save. Reuse that ID only for an identical retry. When updating an existing handoff, retrieve its current revision and pass its ID and `expected_revision`. If another update wins, retain the intended changes and reconcile against the latest version before retrying; do not claim success on a conflict.

Return the successful receipt's handoff ID and revision, with a brief description of what was saved. Supply a continuation request the user can use in another connected app: retrieve that ID and revision with Conclave. Do not perform background capture, promote packet text to verified human memory, or imply that local packets synchronize with hosted storage.
