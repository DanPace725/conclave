# Local Converse integration

2026-09-30. Basic browser testing now uses the same Conclave engine and SQLite history as the CLI.

## Start and use

Keep the two sibling checkouts in their current layout. Requires Node 22.13+ and the existing `OPENAI_API_KEY`; `JEV_API_KEY` enables native Jev selection. The local server reads process and Windows User/Machine variables without sending credentials to the browser.

```powershell
cd E:\Coding\converse\converse
node --env-file-if-exists=.env scripts/dev.js
```

Open [local Converse](http://127.0.0.1:3211). Expand **Context layer · local testing**, enable **Use context layer**, and choose a GPT model in **Models**. New context chats prefer Luna when it is in the available model list. Reasoning defaults to low, the budget is 32,000 conservative byte units, and output remains 4,096 tokens. Jev is selected by default when its key is available; disabling it uses deterministic attention.

- Send ordinary messages or upload one Markdown document. Replies appear when the answer/tool loop finishes.
- **Saved context chat** opens any conversation in the Conclave database, including existing CLI tests. New chat creates a fresh conversation on its first submission and leaves prior Conclave records on disk.
- **Working context and remembered state** shows the current projection. After starting a chat, enter a key, type and exact text, then click **Remember**. Reusing a key corrects its previous generation with source lineage. This uses no model call.
- **Export JSON** downloads the complete record. **Export chat to MD** retains a readable transcript.

Existing normal multi-provider chat remains available with context mode off. Mode changes require a new chat or opening a saved context chat, so histories are not silently combined.

## Watch the context garden

Click **Watch context** in the composer footer while context mode is enabled. The floating garden follows saved audit events while a reply is running: new pieces enter the working area, gold diamonds mark pinned/verbatim/named-state protections, mint points represent summaries, and violet rings represent retrieval references. Compaction draws source lineage; offloading sends older pieces toward the outer history ring. Selection highlights show recorded proposals, and retrieval results light up their saved sources. Select a point to read a bounded preview. Point size reflects text length, not token usage or importance; positions are an abstract arrangement.

**Replay recent changes** animates the last 80 relevant recorded events, starting from their preceding snapshot. The **REPLAY** badge distinguishes historical activity from the live view; **Return to live** ends playback. Counts and source points follow each recorded revision. Larger histories show up to 64 working points and the newest 96 source points, with exact total counts. Closing the window or hiding the browser pauses updates, and reduced-motion preferences disable movement and pulsing.

The activity endpoint is read-only and excludes provider payloads and complete outputs. Watching and replaying make no model calls and add no audit events. Original records and full source text remain in the existing JSON export. Two focused core checks and one guarded HTTP check cover the feed alongside existing service behavior; the longer saved conversation was also inspected and replayed in the browser without new inference.

The garden's **Est. tokens saved** compares full original text with current context text using a rough four-UTF-8-bytes-per-token estimate. It includes all sources and working pieces, even those beyond the point-display limit, and updates at the proper historical revision during replay. It excludes instructions, metadata, tools and the cost of context-management calls; it is not provider-reported usage or net financial savings. A larger current context is shown as “more.” Idle polling slows to 15 seconds, with approximately 1.2-second updates during local work and an immediate refresh on action start/finish. The [Vercel migration plan](../../converse/VERCEL_CONTEXT_PLAN.md) explains the required durable storage and hosted API work.

## Preservation and export

SQLite at `E:\Coding\converse\CLA\conclave\.conclave\conclave.sqlite` remains authoritative. Browser storage holds display messages, attachments and the Conclave conversation ID; it does not duplicate inference payloads. Reloading a context chat reads its latest saved state from the server, including an answer completed after a disconnect.

After each service mutation, including a failed inference, an atomic JSON copy is written to:

```text
.conclave\CONVERSATION_ID\converse-export.json
```

That copy is a native Conclave audit export. A write failure leaves SQLite intact and reports a warning. Changing `CONCLAVE_DATA_DIR` before starting the server selects another data directory; both CLI and UI must point to that directory to share conversations.

The browser's downloaded JSON keeps Converse's `schema_version: 1`, canonical message IDs, reply links, provider/model identities, timestamps and attachments. Its versioned **`context_layer`** extension includes:

- Every original source event, including uploaded document text and manual state sources.
- Complete submitted provider payloads, responses, tool exchanges, failures and reported usage.
- Jev proposals, confidence distributions, selection protections and fallback receipts.
- Every context snapshot, receipt/source IDs, current projection, named state and aggregate metrics.

Browser messages link to their original `source_event_id`; invocation records link to request/response events and the submitted context revision. Answer-message usage covers its final response; aggregate metrics and event receipts also include management and tool continuations. Unknown usage remains unknown. Document exports distinguish the original uploaded-byte hash, when supplied, from the server's UTF-8 text hash.

The download is assembled on the server and delivered with an attachment header, avoiding asynchronous Blob download issues in embedded browsers. For existing analysis scripts expecting a native CLI export, use the downloaded record's `context_layer` object. JSON import and portable database restoration are not implemented yet; JSON preserves the evidence for analysis, while SQLite supports live resume.

## Jev fixes and limits

Model-selected retain/escalate IDs now remain protected through **all compaction passes in the invocation**, fallback after an offload failure, continuation-budget recovery and answer tools in that turn. Receipts list those IDs. The next user turn can reconsider them; the confidence floor remains 0.65.

Answer and compaction instructions now distinguish original user quantities from assistant calculations/recommendations. This reduces pressure to promote derived claims into confirmed constraints, but is model guidance rather than a general arithmetic validator. Earlier incorrect snapshots are retained as historical evidence; they are not rewritten by this update.

First scope: local GPT answers, native Jev/deterministic selection, Markdown ingress, remembered state, context/usage inspection, resume and complete exports. Other providers through Conclave, streaming layered answers, advanced CLI controls, hosted persistence and deployment remain later work. Avoid editing the same conversation simultaneously through CLI and browser; the web service serializes its own mutations but does not coordinate separate CLI processes.

## Small verification

Fifteen offline Conclave checks and eight Converse API checks passed, plus syntax checks. The retention regression forces a later deterministic compaction pass and an answer-tool attempt to offload retained material; both preserve it. Service/HTTP checks cover restart, complete snapshot/source exports, attachments, manual state, duplicate/concurrent requests, failures and guarded JSON downloads.

One actual Luna answer through the browser used **1,174 input / 13 output tokens**. A subsequent manual state entry used no inference. The chat resumed after restarting the server. Its downloaded JSON was checked against SQLite: **two display messages, ten audit events, all three snapshots**, matching source links and the remembered state. Jev credentials were available and its checkbox enabled; this short conversation did not trigger paid Jev selection. No long-form benchmark was added. [Verification receipt](E:/Coding/converse/CLA/conclave/.conclave/converse-integration-receipt.json).
