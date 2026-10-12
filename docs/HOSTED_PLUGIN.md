# Hosted plugin presentation and distribution

Conclave is published by **Didactech Industries**, with support at **contact@didactechindustries.com**. This package targets the independent hosted service. Local plugins retain their identity, launchers and storage.

## Public pages and identity

The hosted server provides `/get-started`, `/support`, `/privacy`, `/terms` and `/assets/conclave-icon.png` without signing in. The sign-in, account and consent pages link to this information; the dashboard adds the icon, help links and a first-save guide for an empty library. The embedded hosted library includes concise help. The service still requires an invited account and OAuth permission to access handoffs.

The prepared account login uses email/password or Google with email codes as a backup. Password setup/recovery and Google's production client requirements are in the [hosted authentication guide](HOSTED_AUTH.md). These are local changes until approved deployment.

The icon is a square 1254 × 1254 PNG under 5 MiB, suitable for light/dark surfaces and circular crops. The hosted MCP initialization advertises it as a server icon. A client decides whether to display that hint; it does not update a directory listing by itself.

## Build a review package

```powershell
npm run hosted:package
# Optional: a different fixed HTTPS origin, without a trailing slash or path
npm run hosted:package -- --origin https://your-conclave.example
Compress-Archive -LiteralPath (Get-ChildItem -Force .conclave/hosted-plugin).FullName -DestinationPath .conclave/conclave-hosted.zip -Force
```

The ignored `.conclave/hosted-plugin` folder contains a portable root `plugin.json` and `mcp.json`, the PNG, hosted onboarding/save/resume skills, and Codex/Claude Code overlays. The ZIP must place `plugin.json` at its root. The builder loads no environment files, credentials, local handoffs or launcher configuration. Inspect ZIP entries before sharing, especially if the output directory was manually modified.

ChatGPT uses `extensions.com.openai.interface` for display metadata and `onboardingSkill` for first-run guidance. The remote server URL is fixed in the package, with OAuth dynamic client registration and default read/write scopes declared in `mcp.json`. Claude's web connector directory uses its own submission form; the Claude Code overlay is not a Claude web directory submission. Upload the PNG and provide the public documentation URLs separately in that form.

## Listing copy

| Field | Value |
|---|---|
| Name | Conclave |
| Short description | Continue across AI apps |
| Publisher | Didactech Industries |
| Support | contact@didactechindustries.com |
| Website | https://conclave-mcp-production.up.railway.app/get-started |
| Support URL | https://conclave-mcp-production.up.railway.app/support |
| Privacy | https://conclave-mcp-production.up.railway.app/privacy |
| Terms | https://conclave-mcp-production.up.railway.app/terms |

Long description: Save your goal, decisions, constraints, and next steps from one AI conversation, then resume the work in another. Browse saved handoffs, inspect earlier versions, and see what changed.

Suggested prompts:

- Save a handoff so I can continue this work in another AI app.
- Find my handoffs for this project and help me resume.
- Show what changed since the previous handoff.

These describe implemented capabilities, not automatic transcript capture or guaranteed recall. Keep the invitation-only pilot disclosure wherever distribution is offered.

## Release and directory review

1. Review the actual publisher/contact details, generated assets, public copy, privacy notice and pilot terms. These documents describe current implementation; they are not a legal review or confirmation that support email delivery works.
2. After explicit publication/deployment approval, publish the verified source and deploy. Read back the live SHA, health, public pages, icon MIME/size, OAuth metadata and security headers. Publishing a ZIP alone does not deploy the pages it references.
3. Reconnect/refresh tools in ChatGPT and Claude and exercise a real same-account save/resume/update/compare flow. Verify read-only access, revocation/reconnection and restart/redeploy recovery separately. Local fixtures do not establish real-client acceptance.
4. Arrange reviewer access without putting account credentials in the package. Public distribution remains pending until the access policy, retention/cleanup and removal handling are ready for the intended audience. Assess the dedicated MCP App UI-origin requirement against the hosting configuration before submitting.
5. Record a real-app demo and platform test evidence. For ChatGPT prepare at least five positive and three negative cases. Claude MCP App submissions need 3–5 PNG screenshots at least 1000 px wide, showing the app response only, with prompts supplied separately. Prepared screenshots from synthetic fixtures are design previews, not executed reviewer tests.
6. Submit through each platform's developer portal with its required review information. Confirm directory acceptance and visible icons independently; no private custom-connector logo behavior is promised.

Suggested positive cases: save a constrained plan and retain its reference; resume it in another app; find it by project; update the same reference and inspect immutable history; compare revisions and open the library. Suggested negative cases: request another account's handoff; try saving with read-only access; provide an obsolete expected revision. Keep reviewer fixtures separate from real user data and record the actual result for each.

Requirements checked October 12, 2026 against [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [OpenAI submission](https://developers.openai.com/plugins/deploy/submission), [OpenAI submission errors](https://developers.openai.com/plugins/deploy/submission-errors), and [Claude connector submission](https://claude.com/docs/connectors/building/submission). Recheck platform requirements before publishing.
