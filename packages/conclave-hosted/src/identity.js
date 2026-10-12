import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const normalize = value => String(value || '').trim().toLowerCase();
export function createIdentity({ origin, secret, allowedEmails, authBaseUrl, fetcher = fetch }) {
  if (typeof secret !== 'string' || secret.length < 32) throw Error('Set a strong CONCLAVE_SESSION_SECRET');
  const secure = new URL(origin).protocol === 'https:';
  const cookieName = secure ? '__Host-conclave_session' : 'conclave_session';
  const allowed = new Set(String(allowedEmails || '').split(',').map(normalize).filter(Boolean));
  const publicSignup = allowed.size === 1 && allowed.has('*');
  if (!allowed.size || (allowed.has('*') && !publicSignup))
    throw Error('Set CONCLAVE_ALLOWED_EMAILS to explicit account emails or * alone for public signup');
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
  const googleName = secure ? '__Host-conclave_google' : 'conclave_google';
  const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && (publicSignup || allowed.has(email));
  const unavailable = { status: 502, error: 'Sign-in is unavailable. Try again shortly.' };
  const invalid = { status: 401, error: 'Sign-in could not be verified. Check your details or use an email code.' };
  const passwordValid = password => typeof password === 'string' && password.length >= 12 && password.length <= 128;
  const upstream = async (path, body, headers = {}) => {
    try {
      const response = await fetcher(base.href.replace(/\/$/, '') + path, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', origin, 'x-neon-auth-middleware': 'true', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 429) return { status: 429, error: 'Too many attempts. Wait before trying again.' };
      if (!response.ok) return response.status >= 500 ? unavailable : invalid;
      return { status: 200, data, response };
    } catch { return unavailable; }
  };
  const verified = (result, email, token = true) => {
    if (result.status !== 200) return result;
    const user = result.data?.user;
    if ((token && !result.data?.token) || typeof user?.id !== 'string' || !user.id || user.emailVerified !== true
      || !validEmail(normalize(user.email)) || (email && normalize(user.email) !== email)) return invalid;
    return { status: 200, user: { id: user.id, email: normalize(user.email) } };
  };
  return {
    publicSignup,
    emailAllowed: email => validEmail(normalize(email)),
    identity(req) {
      const data = unpack(readCookie(req, cookieName));
      return !req.conclaveSessionRevoked && data && typeof data.id === 'string' && data.id && validEmail(normalize(data.email))
        ? { id: data.id, email: normalize(data.email) } : null;
    },
    sessionCookie(user) {
      return cookie(cookieName, pack({ id: user.id, email: normalize(user.email), issued: Date.now(), expires: Date.now() + 7 * 86400000 }), 604800);
    },
    clearCookie: () => cookie(cookieName, '', 0),
    issuedAt: req => unpack(readCookie(req, cookieName))?.issued || 0,
    googleCookie: state => cookie(googleName, pack({ state, expires: Date.now() + 600000 }), 600),
    googleState: req => unpack(readCookie(req, googleName))?.state,
    clearGoogleCookie: () => cookie(googleName, '', 0),
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
    async password(email, password) {
      email = normalize(email);
      if (!validEmail(email)) return invalid;
      // Older accounts may have shorter passwords; enforce length policy only on setup/reset.
      if (typeof password !== 'string' || !password.length || password.length > 128) return invalid;
      return verified(await upstream('/sign-in/email', { email, password }), email);
    },
    async resetPassword(email, otp, password) {
      email = normalize(email);
      if (!validEmail(email)) return invalid;
      if (otp !== undefined && (!/^\d{6}$/.test(otp) || !passwordValid(password)))
        return { status: 400, error: 'Enter the six-digit recovery code and a password of 12–128 characters.' };
      const result = await upstream(otp === undefined ? '/email-otp/request-password-reset' : '/email-otp/reset-password',
        otp === undefined ? { email } : { email, otp, password });
      return result.status === 200 ? (result.data?.success === true ? { status: 200 } : unavailable) : result;
    },
    async startGoogle(state) {
      const result = await upstream('/sign-in/social', { provider: 'google', callbackURL: `${origin}/signin/google/return?state=${state}`,
        errorCallbackURL: `${origin}/?signin=failed` });
      if (result.status !== 200) return result;
      const names = ['__Secure-neon-auth.session_challenge', '__Secure-neon-auth.session_challange'];
      const challenge = result.response.headers.getSetCookie().find(value => names.some(name => value.startsWith(name + '=')))
        ?.split(';')[0].split('=').slice(1).join('=');
      try {
        const target = new URL(result.data?.url);
        if (target.protocol !== 'https:' || target.username || target.password
          || !['https://accounts.google.com', base.origin].includes(target.origin)
          || !challenge || challenge.length > 4096 || /[\s;,]/.test(challenge)) return unavailable;
        return { status: 200, url: target.href, challenge };
      } catch { return unavailable; }
    },
    async finishGoogle(verifier, challenge) {
      if (typeof verifier !== 'string' || !verifier.length || verifier.length > 2048 || typeof challenge !== 'string') return invalid;
      const result = await upstream('/get-session?' + new URLSearchParams({ neon_auth_session_verifier: verifier }), undefined,
        { cookie: `__Secure-neon-auth.session_challenge=${challenge}; __Secure-neon-auth.session_challange=${challenge}` });
      return verified(result, undefined, false);
    },
    async emailCode(email, otp) {
      email = normalize(email);
      if (!validEmail(email)) return { status: 403, error: 'Sign-in is unavailable for these details.' };
      if (otp !== undefined && !/^\d{6}$/.test(otp)) return { status: 400, error: 'Enter the six-digit email code.' };
      const result = await upstream(otp === undefined ? '/email-otp/send-verification-otp' : '/sign-in/email-otp',
        otp === undefined ? { email, type: 'sign-in' } : { email, otp });
      if (result.status !== 200) return result;
      return otp === undefined ? (result.data?.success === true ? { status: 200 } : unavailable) : verified(result, email);
    },
  };
}
