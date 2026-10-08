# Native OAuth consent callback correction

2026-10-07. The user reported "Sign in and submit from this page" at `/connect` while adding Conclave to ChatGPT. The deployed login/consent origin policy was already `same-origin`, so this was a second browser-flow issue.

Railway HTTP logs showed a successful consent POST (303) at 00:04:54 UTC followed by a rejected POST (403) at 00:04:56 UTC on October 8 (October 7 locally). The source's consent page restricted `form-action` to `self`; Chromium also applies that restriction to the cross-origin redirect after a native form submission. See [MDN's form-action documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action).

## Reproduction and correction

An isolated localhost fixture used synthetic identity, empty in-memory PGlite storage, the actual hosted adapter and an OAuth callback on a different localhost port. Clicking Cancel produced no browser navigation despite the server redirect; clicking it again reproduced the exact plain-text rejection. No real account or app permission was used. The browser could reach the fixture only when launched outside Windows sandbox networking.

The consent document now allows `self` and only the pending client's validated callback origin in `form-action`. The consent redirect response uses the same policy. Login, connection management and other routes retain `form-action self`. Policy construction rejects directive/source delimiter characters in callback origins. Redirect registration, pending nonce, canonical origin, signed CSRF, owner isolation and approval checks remain in force. Failed submissions now provide a styled explanation and instructions to start Connect again, rather than a dead-end text response.

With the correction, the same native Cancel button navigated to the separate callback origin and rendered "OAuth callback reached" with `access_denied`. It created no grant. The ignored private screenshot is `.conclave/consent-callback-browser.png`. Allow-path code/token/MCP behavior and consent/redirect policy equality were covered by the HTTP fixtures; actual ChatGPT completion is a separate acceptance check.

The focused ten hosted tests passed; the complete source suite passed 360 checks / one optional skip. Syntax/resource checks passed. Rollout and downstream validation are recorded after completion. The actual in-flight request was already consumed by its first successful POST, so the user must restart Connect from ChatGPT rather than resubmit the old page.
