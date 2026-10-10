# First Conclave dashboard increment

Date: October 7, 2026. Branch: `codex/conclave-dashboard`.

Requested input: hosted Conclave packet `conv_4ad6c3c2-dca1-4443-8361-4a217a6b80a6`, revision 1, “Conclave dashboard work brief,” labeled ChatGPT / GPT-5.6 Sol. Retrieved completely through the Conclave plugin. Packet labels and claims are external context. The user then authorized starting the work; no production merge or deployment was authorized.

## Result and design choices

Implemented a standalone `/dashboard` in the independent hosted service. Recent handoffs is the default; complete detail stays adjacent to discovery on desktop. The dashboard shows source claims, immutable revisions and their exact comparisons, emphasizes removed constraints/questions, retains older revision links, and offers explicit continuation copying and revision JSON downloads. History and lineage inspection are expandable so the initial packet view remains compact. Narrow layouts scroll to the chosen detail.

Existing owner-bound find/get/history/compare operations supply all content. The only backend addition is a read-only browser-session HTTP adapter. No schema, data migration, model spend, new dependency, editing, task dispatch or app-message sending was introduced. Root sign-in/connection instructions retain their existing behavior with a dashboard link added for signed-in users. Shared source/assets belong to Conclave and are migrated into Converse; Converse does not mount the standalone dashboard in its chat UI.

Latest saved revision is deliberately distinguished from agreed project state. Saved handoffs cannot prove app recall, related titles cannot establish project membership, and the current linear optimistic concurrency cannot establish a branch conflict. The [active design guide](../../DASHBOARD.md) records project grouping, canonical state, reviewable merges, graphs/timelines, action routing and operational follow-ups.

## Validation

- Full Conclave suite: 362 passes, one optional skip, zero failures (363 tests). The two new HTTP cases exercise the actual standalone app and signed owner cookies against PGlite-backed repositories: anonymous/tampered sessions, account isolation, host/origin restrictions, extra parameters/owner override rejection, write refusal, no packet changes, complete original retrieval, paging, immutable history, hashes and removed fields.
- Six Edge browser cases pass: desktop 1440 × 1000 and narrow 390 × 844. They cover recent search/paging, exact constraint/question removals, history paging, earlier revision bookmark/reload, latest checks, complete revision JSON export, HTML text inertness, empty results, clipboard fallback, no local storage, expired access, recoverable read failure, a deliberately late response after switching packets and a queued history expansion after immediately closing its packet. Detached history views cannot initiate a read; the navigation case also asserts no page JavaScript errors. Screenshots at `.conclave/dashboard-desktop.png` and `.conclave/dashboard-mobile.png` were visually inspected.
- Source syntax/static UI consistency checks pass. Final small changes are rechecked with the focused HTTP tests and syntax check before source commit.
- The first preview port (`3215`) returned EADDRINUSE without an enumerable listener. The isolated demo was moved to `3226`. Sandboxed Edge launch then exited before tests; the same synthetic cases passed outside the sandbox. No browser configuration or live account setting was changed.

Local fixtures are not production account evidence. Deployment, real dashboard sign-in, native mobile/Safari and broad read scalability remain unverified. The existing repository reads a bounded account event history; no database performance improvement is claimed. Production has not been merged or deployed.

The source-to-Converse parity check and app tests are recorded in the downstream migration report after synchronization. All work in this increment remains on local development branches.
