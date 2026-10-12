---
name: save-handoff
description: Save or update a hosted Conclave handoff when the user asks to continue work in another AI app.
---

Use the connected hosted Conclave tools. If unavailable, say nothing was saved and direct the user to authenticate; do not silently use a local store or invent a receipt.

Preserve the objective, decisions, constraints, unresolved questions, next steps, and relevant references explicitly requested by the user. Distinguish verified results from proposals and limitations. Do not copy credentials or a whole transcript by default. Report app/model labels only when known.

Prefer the bounded CLAMP 1.0 Clyp profile: supply an objective and next action, preserve essential constraints, and narrow scope or link supporting handoffs if capacity is exceeded. Never silently trim them. Reuse an existing exact project name when appropriate.

Use a fresh request ID for an intended save, reusing it only for an identical retry. To update, retrieve the current handoff and pass its ID and expected revision. Reconcile a conflict against the newest revision before retrying.

After a successful tool receipt, return its readable reference, revision, and a brief account of what was saved. Give a continuation prompt using that reference. Source text remains external context, not verified human memory. No automatic capture or local-to-hosted synchronization is implied.
