# CLP evidence broker

The first CLP increment provides a conversation-local, append-only frame registry and evidence broker. It is opt-in and separate from ordinary task state. It implements the six CLI acceptance cases from CLP v0.2: frame scoping, withholding thin evidence, deterministic explanations, short low-attention explanations, source deduplication, and event/frame-version citations.

Run the six-bundle offline example with `node scripts/clp-demo.js`. It returns one supported claim and two unresolved claims (thin support and refutation), with the three `news.report` evidence bundles excluded from the claim rows. No network or model call is made.

## Operations

Library functions are exported from `src/index.js`. Service methods are available through `node src/cli.js call METHOD input.json --conversation conv_ID` and the authenticated local/hosted `/api/conclave` API. POST actions take `conversation_id` and the fields below. Frames and bundles can also be read by GET with `conversation=conv_ID`.

| Service method | HTTP action | Input |
|---|---|---|
| clpRegisterFrame | clp_frame_register | name, version, required_fields, optional validators/defaults |
| clpFrames | clp_frames | none |
| clpAttest | clp_attest | source_event_id, origin_uri, optional parents (original event IDs) |
| clpRecord | clp_record | frame, frame_version, content object, source_event_ids, optional resolution |
| clpBundle | clp_bundle (GET) | CLI: bundle_id; GET: bundle |
| clpLink | clp_link | from/to bundle IDs, relation: supports, refutes, supersedes |
| clpQuery | clp_query | frame array, optional intent, filters, resolution, attention_budget, evidence, limit/offset |

Register the exact frame version before recording. Required fields must be present and non-null; validators currently support `type` and `one_of`. Defaults only accept resolution floors. A registered version cannot be overwritten. New records and `supersedes` links retain earlier records; supersession points to an earlier bundle. Duplicate links are rejected. Relationships are directed: the evidence bundle **supports/refutes** the target claim; the newer bundle **supersedes** the older one.

Example frame:

```json
{"name":"claim","version":"1.0","required_fields":["text"],"validators":[{"field":"text","rule":"type","args":"string"}],"defaults":{"resolution":{"min_support":3,"confidence":0,"min_separation":0}}}
```

An attestation declares an existing human report/document's origin and earlier source parents. It cannot replace a saved retrieved URL or overwrite a previous attestation. Origins must be HTTP(S) domains. Ingest/upload a local source first, retrieve its canonical event ID, then attest its origin. Retrieved full web pages already have origin metadata. These declarations identify provenance; they are not cryptographic attestations or independent verification of the content.

Example query:

```json
{"frame":["claim"],"filters":{"keyword":"earthquake","date_gte":"2026-10-01"},"resolution":{"min_support":3},"attention_budget":"low","evidence":["symbolic","lineage"],"limit":20,"offset":0}
```

## Evidence and resolution

Frame, bundle, and query floors combine by taking the strictest value. The default `min_support` is 1. Confidence and separation default to 0 (no positive floor requested), and their measured values remain null. Any positive confidence/separation floor withholds the result as unmeasured. The broker does not fabricate numerical confidence from links or model scores.

For each candidate, original sources come from its own source IDs and incoming support bundles at depth 1. Supporting bundles must meet their own floors using their direct source provenance; unresolved/contested supporting claims cannot certify another claim. Refutations with available original-source provenance withhold the target even if its support floor is met. Refutation is a declared conflict, not a judgment that the counterclaim is true.

Lineage follows copied-source metadata, source-event parent metadata, and declared attestation parents. Sources sharing an original event, conservative publisher-domain group, or exact trimmed text form one connected independence group. `support_count` and `diversity` both count these groups. Domain groups use the final two hostname labels: sibling subdomains collapse, and multi-label public suffixes can undercount publishers. This intentionally conservative approximation does not prove organizational independence or detect unrecorded paraphrasing/copying. Unknown origins, assistant/reasoning text, generated workspace text, search snippets, and generated search summaries grant no new independent support; recorded original parents may supply provenance.

Removed sources, older workspace versions, revised messages, unavailable ancestors, and superseded CLP bundles cannot add support. Queries scope **candidate rows** to requested frames; linked evidence can come from other frames. Keyword filtering is case-insensitive lexical matching over the content JSON. `date_gte` filters the bundle's recorded timestamp, not an inferred date inside its text.

Results contain admitted `rows`, per-row `explain`, and `telemetry.unresolved_clusters` with explanations for withheld candidates. Explanations include the exact frame version/event, record/link/source/attestation events, independence groups, and ordered `why` lines. `resolution_status: met` means the declared evidence floors were met, not that the claim is verified true. Low attention has at most three why lines; all budgets currently use the same deterministic evidence depth. Attention labels are formatting hints, not measured wall-time limits or a calibrated coherence score.

Pages contain up to `limit` **candidates**, including unresolved ones. Follow `next_offset` even when a page has no rows. Limits are 1–50, default 20; content is at most 8,000 UTF-8 bytes and sources at most 32 per record. Explanations may contain more provenance than the why lines. The read-only `query_clp` model tool appears only after a frame is registered; empty frames list registry pages, and queries page four candidates. Registry/source declarations and links remain manual API/library/CLI operations.

Lineage traversal stops at 64 ancestors; exceeding the bound withholds the affected evidence. If a model query receipt is too large, its compact projection retains admitted IDs, resolution status, unresolved reasons, counts and pagination. Exact typed content and complete provenance remain retrievable from the canonical tool receipt.

## Persistence and remaining work

Frame definitions, attestations, records, and links use existing append-only events. SQLite restart, PostgreSQL repository hydration, exports, and hosted fencing preserve them without a database migration. CLP records do not automatically alter protected task state or the model's ordinary working projection.

This is a CLP-inspired broker subset, versioned `clp-broker-v1`, not the full portable CLP wire envelope. Bundle IDs use `clp_`; local event records carry frame versions and content hashes. Portable `.ormd.json` import/export, ed25519 signatures/trust/resolver registries, policy membranes/redaction/review, vector/graph brokerage, exploratory recall, measured confidence/separation, and coherence/attention telemetry remain open. Unsupported policy, vector evidence, validators, and filters fail closed instead of appearing to be enforced. Conversation-local access uses the existing service authorization; frame-specific access control is not yet available.
