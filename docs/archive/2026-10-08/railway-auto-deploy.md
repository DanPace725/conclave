# Railway automatic deployment

October 8, 2026. The user asked to enable automatic deployment after live inspection confirmed Conclave was pinned to `28cd797`.

Reviewed one staged, non-destructive field removal: `source.commitSha`. Repository `DanPace725/conclave`, branch `codex/conclave-dashboard`, production environment and all other service settings were preserved. Accepted that source change through Railway. Live source inspection confirms the branch with no commit pin and no pending changes.

Deployment `3a2c5029-1d16-4a64-97ab-45631410e4c5` reached SUCCESS at branch head `f0e5e2d9ddfcccba70b76a4fe1ecebe23b21c1aa`. Runtime logs confirm standalone migrations and server readiness. The prior healthy build is `f8051a5a-60d3-4c13-94c6-06fb7709a00f` at `28cd7973c5d2d66d0008f26b8164160afd5129a9`.

This releases previously published dashboard/account styling, one-packet event reads and optional app-reported project names/filtering. Source syntax/resource checks and 106-file snapshot parity passed before changing configuration. Prior recorded implementation evidence was 364 source tests / one optional skip, eight synthetic desktop/narrow browser cases and 203 Converse tests / one optional skip. Ten public live release checks passed after SUCCESS. Real signed-in dashboard acceptance remains deferred by the user; no login email, packet read or grant change was performed.

Future pushes to `codex/conclave-dashboard` automatically deploy Conclave. A source documentation push can therefore trigger another build of the same runtime. Verify its deployment status and exact SHA separately from Git publication. Converse production and main branches remain unchanged.

For rollback, either suspend automatic deployment by pinning an accepted rollback commit or revert the offending branch change and confirm the resulting release. Redeploying an old build alone does not stop the next source push from replacing it. See [release instructions](../../DASHBOARD_RELEASE.md).
