# Handoff history and portability

October 7, 2026. Work continued while the user considers a separate Conclave deployment and is away from their PC. This increment requires no hosting decision, new account, credential change, model spending or cloud resource.

## Implemented

- `HandoffService.history` and `list_handoff_versions`: newest-first, bounded metadata pages containing immutable revision/event/hash lineage. Hosted methods hydrate only the verified owner's events.
- `HandoffService.compare` and `compare_handoff_versions`: exact changed field values with original packet hashes, explicit removed constraints/questions, immutable source revisions, and a capacity error instead of clipping. New tools need only `handoffs:read` and remain callable in read-only OAuth sessions; saving remains unavailable there.
- `src/handoff-portability.js` and `npm run mcp:backup`: consistent full-history local export, exclusive file creation, inspect/dry-run without destination creation, strict format/timestamp/schema/checksum/contiguous-revision validation, and atomic import of all revisions. Fresh IDs and event times distinguish copies from originals; source IDs/timestamps remain unverified claims. Identical import retries return the original import receipt even after later local edits. Export time is excluded from the import digest.
- Backups have a 1,000-revision / 8 MiB limit and contain plaintext packet histories. They exclude ordinary chats, ownership, tokens, app permissions and authority claims. Hashes are integrity checks, not authentication. No permanent deletion or automatic local-to-hosted synchronization was added.
- The user checklist explains the new tools, exact backup commands, remaining PC setup, and the two hosting options. The standalone option remains a recommendation under discussion, with no project created.

## Evidence

- Focused service, hosted/PGlite, portability/real CLI process, and SDK transport run: 22 passes, no failures.
- Full source suite after the additional read-only HTTP assertions: 347 passes, one optional skip, no failures.
- Syntax and existing evaluation credential checks passed; diff whitespace check passed.
- Coverage includes original/replacement binding text, pagination, identical comparison, capacity failure without truncation, other-owner rejection, actual read-only HTTP tool calls/scopes, strict rejection before mutation, JSON key-order normalization, mid-import storage rollback, restart/retry after edits, no-overwrite output, and dry-run with no destination directory.
- SDK transport cases use independent stdio processes plus loopback HTTP. They are not actual ChatGPT/Claude/Gemini account tests. PGlite uses one serialized fixture connection; real Neon concurrency remains unverified.

## Next operational work

Hosting decision and sign-in adapter if standalone; credential rotation; Vercel usage check; isolated/live migration and deployment; actual app installation and cross-app save/retrieve/update/revoke checks. Public distribution still requires abuse/retention/erasure/expired OAuth-state maintenance, publisher/privacy/support information and platform review. These remain explicitly pending.
