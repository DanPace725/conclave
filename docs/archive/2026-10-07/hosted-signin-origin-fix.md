# Hosted native form sign-in correction

2026-10-07. The user reported that submitting their email at the public Conclave origin produced "Reload the sign-in page and submit from this site" and sent no email.

Reproduced in a real browser with a disallowed synthetic address, without contacting Neon Auth. The response was the same rejection before the email allowlist or upstream service. `Referrer-Policy: no-referrer` makes native form POSTs use a null Origin; our CSRF guard correctly required the canonical origin. The original HTTP fixture supplied Origin manually and missed browser behavior. See [MDN's Origin documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin) and [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).

Changed the standalone login and shared OAuth consent pages to `Referrer-Policy: same-origin`. Native same-origin form POSTs retain Origin; external navigations including OAuth callbacks still receive no referrer. Signed CSRF cookie/token checks, exact canonical origin and allowlist remain mandatory. Null, missing and foreign origins remain rejected; the fix does not accept null Origin.

Expanded the standalone HTTP regression to assert the native-form policy on login and consent and reject null/missing/foreign origins or missing CSRF cookies before upstream calls. The full source suite passed 360 checks / one optional skip, and syntax/resource checks passed. Deployment and browser/email results will be recorded after rollout. Converse receives the shared consent correction through its normal engine snapshot; its production deployment remains unchanged.
