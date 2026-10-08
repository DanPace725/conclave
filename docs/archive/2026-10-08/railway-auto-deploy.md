# Railway automatic deployment

October 8, 2026. The user asked to enable automatic deployment after live inspection confirmed Conclave was pinned to `28cd797`.

Reviewed one staged, non-destructive field removal: `source.commitSha`. Repository `DanPace725/conclave`, branch `codex/conclave-dashboard`, production environment and all other service settings were preserved. Accepted that source change through Railway. Live source inspection confirms the branch with no commit pin and no pending changes.

Deployment `3a2c5029-1d16-4a64-97ab-45631410e4c5` reached SUCCESS at branch head `f0e5e2d9ddfcccba70b76a4fe1ecebe23b21c1aa`. Runtime logs confirm standalone migrations and server readiness. The prior healthy build is `f8051a5a-60d3-4c13-94c6-06fb7709a00f` at `28cd7973c5d2d66d0008f26b8164160afd5129a9`.

This releases previously published dashboard/account styling, one-packet event reads and optional app-reported project names/filtering. Source syntax/resource checks and 106-file snapshot parity passed before changing configuration. Prior recorded implementation evidence was 364 source tests / one optional skip, eight synthetic desktop/narrow browser cases and 203 Converse tests / one optional skip. Ten public live release checks passed after SUCCESS. Real signed-in dashboard acceptance remains deferred by the user; no login email, packet read or grant change was performed.

Verification correction: subsequent source documentation push `0621797478434728390c97d68ce7d70494fe5b20` was independently verified on GitHub but did not trigger a Railway deployment. Removing the pin alone has not established automatic deployment. The connector does not expose Railway's separate auto-deploy toggle. The live runtime remains `f0e5e2d`. Converse production and main branches remain unchanged.

Automatic approval review rejected a live repository reconnect because it could affect every environment, beyond the production-scoped operation. It also rejected browser GitHub sign-in because that authentication was not explicitly authorized. A concise approval request is pending for Railway GitHub sign-in and checking/enabling only the production service's toggle. No rejected action was bypassed. The owner can also enable the toggle directly; see [Railway's instructions](https://docs.railway.com/deployments/github-autodeploys).

For rollback, either suspend automatic deployment by pinning an accepted rollback commit or revert the offending branch change and confirm the resulting release. Redeploying an old build alone does not stop the next source push from replacing it. See [release instructions](../../DASHBOARD_RELEASE.md).
