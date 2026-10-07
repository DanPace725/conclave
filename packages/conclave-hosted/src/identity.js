import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const normalize = value => String(value || '').trim().toLowerCase();
export function createIdentity({ origin, secret, allowedEmails, authBaseUrl, fetcher = fetch }) {
  if (typeof secret !== 'string' || secret.length < 32) throw Error('Set a strong CONCLAVE_SESSION_SECRET');
  const secure = new URL(origin).protocol === 'https:';
  const cookieName = secure ? '__Host-conclave_session' : 'conclave_session';
  const allowed = new Set(allowedEmails.split(',').map(normalize).filter(Boolean));
  if (!allowed.size || allowed.has('*')) throw Error('Set CONCLAVE_ALLOWED_EMAILS to explicit pilot account emails');
  const base = new URL(authBaseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash)
    throw Error('Set NEON_AUTH_BASE_URL to a trusted HTTPS Auth endpoint');
  const sign = value => createHmac('sha256', secret).update(value).digest('base64url');
  const equal = (a, b) => {
    const x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
  };
  const readCookie = (req, name) => (req.headers.cookie || '').split(';').map(s => s.trim())
    .find(s => s.startsWith(name + '='))?.slice(name.length + 1);
  const pack = data => {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    return payload + '.' + sign(payload);
  };
  const unpack = value => {
    try {
      const [payload, signature, extra] = (value || '').split('.');
      if (extra || !payload || !signature || !equal(signature, sign(payload))) return null;
      const data = JSON.parse(Buffer.from(payload, 'base64url'));
      return Number.isSafeInteger(data.expires) && data.expires > Date.now() ? data : null;
    } catch { return null; }
  };
  const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const csrfName = secure ? '__Host-conclave_csrf' : 'conclave_csrf';
  return {
    emailAllowed: email => allowed.has(normalize(email)),
    identity(req) {
      const data = unpack(readCookie(req, cookieName));
      return data && typeof data.id === 'string' && data.id && allowed.has(normalize(data.email))
        ? { id: data.id, email: normalize(data.email) } : null;
    },
    sessionCookie(user) {
      return cookie(cookieName, pack({ id: user.id, email: normalize(user.email), expires: Date.now() + 7 * 86400000 }), 604800);
    },
    clearCookie: () => cookie(cookieName, '', 0),
    form(req, res) {
      let token = readCookie(req, csrfName);
      if (!unpack(token)?.nonce) {
        token = pack({ nonce: randomBytes(24).toString('base64url'), expires: Date.now() + 3600000 });
        res.append('Set-Cookie', cookie(csrfName, token, 3600));
      }
      return token;
    },
    checkForm: req => req.headers.origin === origin && !!unpack(req.body?.csrf)?.nonce
      && equal(req.body.csrf, readCookie(req, csrfName)),
    async emailCode(email, otp) {
      email = normalize(email);
      if (!allowed.has(email) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return { status: 403, error: 'This account is not enabled for the private pilot.' };
      if (otp !== undefined && !/^\d{6}$/.test(otp)) return { status: 400, error: 'Enter the six-digit email code.' };
      let response;
      try {
        response = await fetcher(base.href.replace(/\/$/, '') + (otp === undefined ? '/email-otp/send-verification-otp' : '/sign-in/email-otp'), {
          method: 'POST', signal: AbortSignal.timeout(10000),
          headers: { 'Content-Type': 'application/json', origin, 'x-neon-auth-middleware': 'true' },
          body: JSON.stringify(otp === undefined ? { email, type: 'sign-in' } : { email, otp }),
        });
      } catch { return { status: 502, error: 'Sign-in is unavailable. Try again shortly.' }; }
      const data = await response.json().catch(() => null);
      if (response.status === 429) return { status: 429, error: 'Too many attempts. Wait before trying again.' };
      if (!response.ok) return { status: response.status >= 500 ? 502 : 400, error: 'Sign-in could not be completed. Try a new code.' };
      if (otp === undefined) return data?.success === true ? { status: 200 } : { status: 502, error: 'Could not send a code.' };
      const user = data?.user;
      if (!data?.token || typeof user?.id !== 'string' || !user.id || user.emailVerified !== true || normalize(user.email) !== email)
        return { status: 401, error: 'The code could not be verified. Request a new code.' };
      // The upstream token stays server-side; only a signed Conclave identity is returned.
      return { status: 200, user: { id: user.id, email } };
    },
  };
}
