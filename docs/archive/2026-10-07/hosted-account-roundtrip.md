# Live ChatGPT and Claude handoff round trip

The user reported testing both apps and supplied a specific hosted packet ID. A read-only inspection of the independent Neon database confirmed four durable revisions belonging to one owner. This report publishes only version metadata and verification results, not the packet contents, account identity, request IDs or credentials.

| Revision | Stored source-app label | UTC timestamp | Constraints | Open questions | Decisions | Next steps |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ChatGPT | 2026-10-08T00:52:47.577Z | 1 | 1 | 0 | 1 |
| 2 | Claude | 2026-10-08T01:14:40.057Z | 1 | 1 | 2 | 2 |
| 3 | ChatGPT | 2026-10-08T01:18:39.151Z | 3 | 3 | 6 | 3 |
| 4 | Claude | 2026-10-08T01:21:24.654Z | 3 | 3 | 7 | 3 |

Every version was recovered through the real HandoffRepository against Neon, not a fixture. Adjacent versions have distinct canonical SHA-256 receipts and substantive field changes. Revisions are consecutive, each update points to the previous event, and the original constraint is preserved exactly in every version. Revision 4 is latest.

The same owner's new Claude grant, created at 2026-10-08T01:13:57.918Z, includes `handoffs:read` and `handoffs:write`. Its earlier read-only grant remains unchanged. ChatGPT grants also include read/write. No grant was expanded, revoked or created by this diagnostic; no packet or database record was written.

Combined with the user's report of operating both apps, this establishes a live hosted ChatGPT → Claude update → ChatGPT update → Claude update test after the scope-discovery correction. Source app/model fields are unverified client-supplied labels, not server-attested authorship, and the database does not record read-only tool calls. The test supports actual write interoperability and durable version recovery; independent browser rendering, revocation behavior in the real apps, restart/redeploy recovery and broader compatibility remain separate checks.

The scope correction is runtime `40128be`, successful Railway deployment `52deb270-d20a-471d-9f17-da6db6c7abe8`. See [scope cause and fixtures](hosted-claude-write-scope.md) and [current session handoff](../../SESSION_HANDOFF.md).
