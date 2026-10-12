# Hosted plugin polish — October 12, 2026

## Scope and behavior

Publisher: Didactech Industries. Public support/privacy contact: contact@didactechindustries.com. User authorized preparing hosted presentation, rather than modifying local plugin installations. No remote publication, deployment or directory submission was performed.

Added a square PNG icon, shared hosted identity, public getting-started/support/privacy/pilot-terms pages, branded sign-in/account/consent pages, dashboard help and empty-library guidance, and self-contained embedded library help. Existing default presentation remains available to Converse/local adapters. MCP icons are advertised only by the standalone hosted service; hosts decide whether to display them. Icon metadata does not establish a directory listing or private Claude connector logo.

The hosted package builder writes portable root manifests, OpenAI listing/onboarding metadata, OAuth DCR with default read/write scopes, PNG assets, hosted skills, and Codex/Claude Code compatibility overlays. It reads no environment files or account data and includes no local launchers. Claude web directory submission is a separate form. The generated ZIP has root manifests and ten reviewed entries; there are no credentials or stored handoffs.

Public documentation describes explicit saves, same-account access, read-only browsing, immutable history, reported source labels, revocation versus deletion, invitation-only access and actual retention limits. It does not promise a deletion feature or legal review. Extracting the original inline hosted CSS allows all account/public pages to reuse the existing visual design.

## Validation

- Source syntax/resource checks passed.
- Complete engine run: 375 passed, one optional skip, zero failures.
- Transport and consent checks: eight passed.
- Embedded UI browser suite: 14 desktop/mobile cases passed.
- Dashboard browser suite: 14 desktop/mobile cases passed after updating a pre-existing assertion that counted the new intentional logo as an injected image. Packet-content image checks remain enforced.
- Final changed package/auth fixture: seven passed. Earlier focused hosted/dashboard/consent run: 16 passed. Hosted UI resource checks: three passed, including distinct content-addressed hosted/default resource identities, no baked-in packet data and unchanged restrictive CSP.
- Presentation preview: actual standalone root/help/guide and synthetic dashboard tested at 1280px desktop, 390px mobile, and desktop dark mode; no horizontal overflow or page JavaScript errors, logo loads. Three app-response-only synthetic MCP App PNGs were captured at 1248px wide for library, packet and comparison review. They are not real-client evidence or a reviewer demo.
- Local source verification receipts: `.conclave/hosted-polish-verify.log`, `.conclave/hosted-dashboard-verify.log`, `.conclave/hosted-package-final.log`, `.conclave/hosted-preview.log`. First complete run reached two obsolete dashboard image assertions; the final dashboard rerun passes all 14. Other suites had passed before that correction.
- Converse snapshot verification is recorded separately in its archive after canonical source commit and migration.

## Assets and image-generation receipt

Mode: built-in image generation, one new image, opaque background, no references. Output copied to `src/resources/branding/conclave-icon.png`; actual PNG 1254 × 1254, 1,380,654 bytes. The same source is copied into review-package assets. There is no claimed SVG master or fabricated dark variant.

Exact generation prompt:

> Use case: logo-brand. Asset type: final app-directory icon for Conclave, a service for carrying explicitly saved project handoffs between AI conversations. Create ONE polished square icon, 1024x1024 composition, not a contact sheet. Subject: three simple overlapping rounded document cards arranged in a subtle clockwise open-circle/C formation, conveying continuity and collected context. Precisely three cards, clean spacious geometric silhouette, no tiny details, no text, no lettering, no arrows, no third-party marks. White and very pale ice-blue card faces with restrained blue edge/shadow separation, on a rich cobalt-blue (#2357C6) square background with a subtle blue-to-cyan gradient. All meaningful shapes contained in central 70% with generous safe margins so it reads at 24/48px and circular crops. Straight-on flat vector-like graphic, strong recognizable silhouette, extremely minimal, professional and calm. No glossy 3D, no mockup, no border around the icon, no watermark. Background fills the entire square, no transparent outer corners.

Review outputs are ignored artifacts under `.conclave/hosted-listing/`; the install/review ZIP is `.conclave/conclave-hosted.zip`. App screenshots use synthetic preview packets, including the literal-text safety fixture. Do not pass these off as real account tests. Screenshot prompts and limitations accompany the images.

## Release boundaries

No database migration, new authentication flow or permission change is needed. Public pages are mounted behind the same host/security middleware, require no account cookie or database reads, and use self-hosted assets. The private-pilot access policy remains in place.

Publication/deployment requires final approval. Live SHA/health/headers/pages/assets/OAuth metadata, actual ChatGPT/Claude setup/onboarding, same-account continuation, revocation/reconnection and recovery must be checked after deployment. Public listing review also needs approved reviewer access, an actual-client demo/test evidence, operational retention/removal readiness and the required MCP App origin configuration. See the active [hosted distribution guide](../../HOSTED_PLUGIN.md).
