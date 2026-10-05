# Canonical export performance

October 5, 2026. A supplied 1,283-event/38-snapshot Converse export reproduced a 28.4-second local download build. `downloadRecord` constructed `service.view()` twice and its nested context/memory/protection helpers repeatedly decoded the same large audit history.

Use an existing synchronous `Store.withReadCache()` scope around download/export, and reuse the inspection view in `service.export()`. Download JSON is compact. No canonical events, payloads or snapshots are removed. The scope releases its cache on failure, and subsequent exports read later writes.

`node scripts/profile-export.js <export-path> [<export-path> ...] --output=<json-path>` hydrates supplied exports offline and checks exact event/snapshot fidelity. It never calls providers or a hosted database.

Observed local Windows results:

| Export | History decodes before / after | Total replay before / after | Build before / after |
|---|---:|---:|---:|
| Pain, 66.99 MB supplied JSON | 85 / 1 | 28.424 / 1.468 s | 27.282 / 0.337 s |
| Brain, 12.07 MB supplied JSON | 77 / 1 | 3.680 / 0.315 s | 3.450 / 0.124 s |

Totals include local hydration and compact serialization on both arms. Compact downloads are approximately 60.50 MB and 10.46 MB respectively. Network transfer, cold Neon access, concurrent function memory pressure and production button-to-file latency were not measured. The route still assembles the record/string before transferring chunks.

Source validation: 229 tests passed, one optional replay skipped; syntax and diff checks passed. Added regression verifies one history decode, one inspection, exact canonical history, retained model-input metadata, cache release and subsequent-write visibility. Hosted interface download coverage also passed.

Detailed conversation weaknesses and measured before/after artifacts are in Converse `docs/archive/2026-10-05/conversation-audit/`. Context-selection and memory policy were not changed.
