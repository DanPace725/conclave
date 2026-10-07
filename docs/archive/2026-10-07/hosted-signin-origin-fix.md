# Hosted native form sign-in correction

2026-10-07. The user reported that submitting their email at the public Conclave origin produced "Reload the sign-in page and submit from this site" and sent no email.

Reproduced in a real browser with a disallowed synthetic address, without contacting Neon Auth. The response was the same rejection before the email allowlist or upstream service. `Referrer-Policy: no-referrer` makes native form POSTs use a null Origin; our CSRF guard correctly required the canonical origin. The original HTTP fixture supplied Origin manually and missed browser behavior. See [MDN's Origin documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin) and [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).

Changed the standalone login and shared OAuth consent pages to `Referrer-Policy: same-origin`. Native same-origin form POSTs retain Origin; external navigations including OAuth callbacks still receive no referrer. Signed CSRF cookie/token checks, exact canonical origin and allowlist remain mandatory. Null, missing and foreign origins remain rejected; the fix does not accept null Origin.

Expanded the standalone HTTP regression to assert the native-form policy on login and consent and reject null/missing/foreign origins or missing CSRF cookies before upstream calls. The full source suite passed 360 checks / one optional skip, and syntax/resource checks passed. Converse parity matched 102 files; its suite passed 203 checks / one optional skip and syntax checks passed. Its snapshot is committed locally; its production deployment remains unchanged.

## Live rollout

Implementation `948598efa1b12d8cfa2ac076ea0634b5795d9d2d` was pushed and the remote SHA verified. Railway deployment `0ef00c95-c84d-4218-9ed7-4fef009af191` reported SUCCESS for that commit. Public login returned 200 with `Referrer-Policy: same-origin`. A browser's native POST with the same disallowed synthetic address now reached the account allowlist instead of failing the origin check.

After explicit user approval, one email-code request for the user's account was submitted through the real browser form. Neon Auth returned success and the browser advanced to the six-digit code entry screen. The user confirmed that the code arrived in their inbox. Before approval, automatic review rejected that test request; it was not sent until the user authorized it. The acceptance screenshot is stored privately in ignored `.conclave/signin-fix-browser.png`. No OTP was read or submitted; completed login remains a separate check. Follow-up [PR #9](https://github.com/DanPace725/conclave/pull/9) contains this correction after the hosted foundation was merged.
