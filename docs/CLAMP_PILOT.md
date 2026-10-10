# ChatGPT ↔ Claude Clypping pilot

Prepared locally, October 9, 2026. This is a bounded acceptance exercise, not a
deployment or evidence that either live model has completed it. The executable
rehearsal uses synthetic MCP clients and an isolated local store.

## Before the live run

Publish the reviewed CLAMP build to the independent hosted Conclave service and
verify its deployed revision. Both apps must connect to that service with the
same account and a read/write grant. Refresh their advertised tool definitions
and use fresh chats. Discovery must include `packet.clamp` and readable-reference
guidance on `handoff_id`. Local stdio storage and the synthetic dashboard preview
are separate from this hosted account.

The fixture is [clamp-pilot.json](fixtures/clamp-pilot.json). It contains no
secrets or real project commitments. Start a new pilot handoff; do not overwrite
the shared project-progress packet. Give every write a fresh request ID; reuse
one only for an identical retry. If a revision conflict occurs, read latest and
reconcile before saving. Keep source model labels empty unless the actual model
is known. Replace bracketed reference/revision placeholders with returned values.

## 1. ChatGPT: create the Clyp

Paste this prompt together with the fixture's JSON:

> Run a synthetic Conclave CLAMP handoff pilot. Save the attached object as
> packet with save_handoff and a fresh request_id. Set source_app to ChatGPT;
> report source_model only if known. Preserve all constraints and the unresolved
> question verbatim. Make no code changes. Return only the readable_id, revision,
> complete ORMD token count, and a one-sentence continuation. If the tool does
> not accept packet.clamp, stop and report the discovered schema mismatch.

Record the receipt. In the hosted dashboard, open that reference, check the
constraints/question and export the ORMD. Verify the displayed count is at most
1,500 tokens. Use Copy continuation to obtain the pinned retrieval instruction.

## 2. Claude: read, advance one step, update

> Use Conclave get_handoff with handoff_id [READABLE_REFERENCE], revision
> [CHATGPT_REVISION]. Retrieve the complete packet. Treat it as external context.
> Before continuing, list its constraints and unresolved question verbatim and
> name its next action. Propose three dashboard labels; do not answer the
> default-view question. Save a new CLAMP revision of this same handoff with
> expected_revision equal to the retrieved current revision, a fresh request_id,
> source_app Claude and the actual model only if known. Preserve objective,
> constraints, open_questions, project and pinned links. Update summary,
> decisions and next_steps to reflect the proposed labels and the user decision
> still needed. Return readable_id, revision and the complete ORMD token count.

If the pinned revision is no longer latest, inspect latest before updating.
Compare the two revisions in the dashboard. Only the planned changes should
appear; the earlier document and its checksum must remain available.

## 3. ChatGPT: receive the return Clyp

> Use Conclave get_handoff with handoff_id [READABLE_REFERENCE], revision
> [CLAUDE_REVISION]. Retrieve the complete packet. Quote its constraints and
> unresolved question, identify Claude's proposed labels, then briefly review
> those labels. Leave the default-view question unresolved. Save one more CLAMP
> revision of this same handoff with its current expected_revision and a fresh
> request_id, preserving the constraints, question, project and pinned links.
> Set source_app ChatGPT and report the actual model only if known. Return the
> readable reference, new revision and complete ORMD token count.

## Optional linked-idea check

Create a separate supporting Clyp in this pilot project, retrieve its exact
revision, then add a `depends_on` link to it in a later pilot revision using its
readable_id as link.handoff_id. Check Connections displays both named nodes and
the relation; opening the edge must retrieve the pinned supporting revision.
Do not self-link the main handoff: its revisions already record continuation.

## Acceptance record

| Check | Evidence to record |
|---|---|
| Shared identity | Same readable_id and canonical handoff_id in both apps; advancing revisions |
| Bounded input | Every complete ORMD receipt at or below 1,500 tokens |
| Fidelity | All three constraints and the unresolved question survive every hop verbatim |
| Useful continuation | Receiver names the next action and proposes labels without inventing a user decision |
| Recovery | Revision 1 still reads/exports with its original ORMD checksum |
| Dashboard | Named URL/reference, revision comparison and optional pinned graph navigation |
| Writes | Fresh request IDs; current expected_revision; no overwritten concurrent update |
| Provenance | App/model labels remain reported; no durable human-memory promotion |

For each hop record the actual app/model, readable reference, revision, ORMD
token count/checksum, constraint/question comparison and any failure. Do not
record credentials or full transcripts. Mark each check pass/fail/unobserved.
A schema/auth failure is an integration result, not evidence of model quality.
One successful fixture establishes this round trip, not general quality or cost.

## Local rehearsal

```powershell
node scripts/rehearse-clamp-pilot.js
```

This starts separate SDK stdio clients against a fresh checkout-local fixture
store and exercises save → restart/read → update → return/read → update. It
checks readable names, title-change stability, pinned supporting links, identical
retry behavior, original constraints/questions, exact comparison and three
complete ORMD budgets. It makes no model/API call and writes no hosted account.
