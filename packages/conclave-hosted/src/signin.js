import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import { hostedPage } from './public-pages.js';
import { hostedBrand } from '../../../src/handoff-branding.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const digest = value => createHash('sha256').update(value).digest('hex');
const revokedKey = email => 'browser-reset:' + digest(email);

export function signinPage(account, req, res, { mode = 'password', email = '', code = false, message = '' } = {}) {
  const invited = account.publicSignup ? '' : 'invited ';
  const csrf = `<input type="hidden" name="csrf" value="${escape(account.form(req, res))}">`;
  const emailField = `<label>Email<input name="email" type="email" autocomplete="${mode === 'password' ? 'username' : 'email'}" maxlength="254" value="${escape(email)}" required></label>`;
  const passwordField = `<label>${mode === 'reset' ? 'New password' : 'Password'}<input name="password" type="password" autocomplete="${mode === 'reset' ? 'new-password' : 'current-password'}" ${mode === 'reset' ? 'minlength="12"' : ''} maxlength="128" required></label>`;
  const codeField = '<label>Email code<input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>';
  let content;
  if (mode === 'password') content = `<form action="/signin/google" method="post">${csrf}<button class="social">Continue with Google</button></form><p class="divider">or sign in with your email</p><form action="/signin/password" method="post">${csrf}${emailField}${passwordField}<button>Sign in</button></form><p><a href="/signin/reset">Set or reset your password</a> · <a href="/signin/code">Use an email code instead</a></p><p class="note">New here? Continue with Google or use an email code once to create your ${invited}account. You can then set a password.</p>`;
  else if (mode === 'reset') content = `<p>Use a recovery code to set a password for your existing Conclave account. Your email is your username.</p><form action="/signin/reset" method="post">${csrf}${emailField}${code ? codeField + passwordField + '<label>Confirm new password<input name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><p class="note">Use 12–128 characters. Passwords are managed by Neon Auth.</p>' : ''}<button>${code ? 'Save password' : 'Send recovery code'}</button></form><p><a href="/">Back to sign in</a> · <a href="/signin/code">Use an email code instead</a></p>`;
  else content = `<p>Get a six-digit code at your ${invited}email address. This also works if you have not set a password.</p><form action="/signin" method="post">${csrf}${emailField}${code ? codeField : ''}<button>${code ? 'Sign in with code' : 'Send email code'}</button></form><p><a href="/">Back to password or Google sign-in</a>${code ? ' · <a href="/signin/code">Request a new code</a>' : ''}</p>`;
  return hostedPage(res, mode === 'reset' ? 'Set or reset your password' : 'Sign in to Conclave',
    `${message ? `<p class="note" role="status">${escape(message)}</p>` : ''}${content}<p class="note">Use the same Conclave email in ChatGPT and Claude.</p>`,
    { intro: mode === 'reset' ? '' : hostedBrand.tagline, signedIn: false });
}

export function mountSignin(app, { account, records, origin }) {
  const page = (req, res, options) => signinPage(account, req, res, options);
  const budget = async (key, limit) => records.atomic(key, async tx => {
    const now = Date.now(), old = await records.get(key, tx) || { count: 0, until: now + 3600000 };
    if (old.count >= limit) return false;
    await records.put(key, { ...old, count: old.count + 1 }, old.until, null, tx); return true;
  });
  // Password recovery invalidates existing website sessions, including cookies
  // issued by an older release. It does not silently revoke connected-app grants.
  app.use(async (req, res, next) => {
    try {
      const user = account.identity(req);
      if (user) {
        const reset = await records.get(revokedKey(user.email));
        if (reset && account.issuedAt(req) <= reset.at) {
          req.conclaveSessionRevoked = true; res.append('Set-Cookie', account.clearCookie());
        }
      }
      next();
    } catch (error) { next(error); }
  });
  app.get('/signin/code', (req, res) => page(req, res, { mode: 'code' }));
  app.get('/signin/reset', (req, res) => page(req, res, { mode: 'reset' }));
  app.get('/signin/google/continue.js', (_req, res) => res.type('js').send("const link=document.getElementById('google-continue'); if(link && new URL(link.href).protocol==='https:') window.location.assign(link.href);"));
  app.use(['/signin', '/signout'], express.urlencoded({ extended: false, limit: '8kb' }));
  app.post(['/signin', '/signin/password', '/signin/reset'], async (req, res) => {
    if (!account.checkForm(req)) return res.status(403).send('Reload the sign-in page and submit from this site.');
    const mode = req.path.endsWith('/password') ? 'password' : req.path.endsWith('/reset') ? 'reset' : 'code';
    const email = String(req.body.email || '').trim().toLowerCase(), otp = req.body.otp;
    const code = otp !== undefined;
    const fail = (status, message) => { res.status(status); return page(req, res, { mode, email, code, message }); };
    if (!account.emailAllowed(email)) return fail(403, 'Sign-in is unavailable for these details. Check your email or contact support.');
    const verifying = code || mode === 'password';
    if (!await budget('signin-ip:' + digest(req.ip + ':' + (verifying ? 'verify' : 'send')), verifying ? 60 : 10))
      return fail(429, 'Too many attempts. Wait before trying again.');
    const key = 'signin:' + digest(email + ':' + mode + ':' + (code || mode === 'password' ? 'verify' : 'send'));
    if (!await budget(key, code || mode === 'password' ? 15 : 5)) return fail(429, 'Too many attempts. Wait before trying again.');
    if (mode === 'reset' && code && req.body.password !== req.body.confirm) return fail(400, 'The passwords must match. Enter them again.');
    const result = mode === 'password' ? await account.password(email, req.body.password)
      : mode === 'reset' ? await account.resetPassword(email, otp, req.body.password) : await account.emailCode(email, otp);
    if (result.status !== 200) return fail(result.status, result.error);
    if (mode === 'reset') {
      if (!code) return page(req, res, { mode, email, code: true, message: 'If this Conclave account exists, a recovery code is on its way. New here? Create your account using Google or an email sign-in code first.' });
      // Keep this marker longer than the maximum seven-day browser cookie.
      await records.atomic(revokedKey(email), tx => records.put(revokedKey(email), { at: Date.now() }, Date.now() + 8 * 86400000, null, tx));
      res.append('Set-Cookie', account.clearCookie());
      return page(req, res, { email, message: 'Password saved. Sign in with your email and new password. Existing website sessions have been signed out; app connections remain active.' });
    }
    if (!result.user) return page(req, res, { mode, email, code: true, message: 'Check your email for a six-digit sign-in code.' });
    res.append('Set-Cookie', account.sessionCookie(result.user)); res.redirect(303, '/');
  });
  app.post('/signin/google', async (req, res) => {
    if (!account.checkForm(req)) return res.sendStatus(403);
    if (!await budget('google-start:' + digest(req.ip), 20)) {
      res.status(429); return page(req, res, { message: 'Too many attempts. Wait before trying again.' });
    }
    const state = randomBytes(32).toString('base64url'), result = await account.startGoogle(state);
    if (result.status !== 200) { res.status(result.status); return page(req, res, { message: 'Google sign-in is unavailable. Try password or an email code.' }); }
    await records.put('google:' + digest(state), { challenge: result.challenge }, Date.now() + 600000);
    res.append('Set-Cookie', account.googleCookie(state));
    // Cross-site redirects following a form POST can be blocked by form-action
    // on mobile. Navigate from a same-origin completion document instead.
    res.set('Content-Security-Policy', res.get('Content-Security-Policy').replace("script-src 'none'", "script-src 'self'"));
    res.set('Referrer-Policy', 'no-referrer');
    return hostedPage(res, 'Continue with Google', `<p>Continue to Google to sign in, then return to Conclave.</p><p><a id="google-continue" href="${escape(result.url)}" rel="noreferrer">Continue with Google</a></p><script src="/signin/google/continue.js" defer></script>`);
  });
  app.get('/signin/google/return', async (req, res) => {
    const state = req.query.state, verifier = req.query.neon_auth_session_verifier;
    const fail = () => { res.append('Set-Cookie', account.clearGoogleCookie()); res.status(400); return page(req, res, { message: 'Google sign-in could not be completed. Start a fresh attempt or use an email code.' }); };
    if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state)
      || typeof verifier !== 'string' || !verifier.length || verifier.length > 2048) return fail();
    // Repeat as a same-origin navigation before reading/setting cookies. This
    // follows the tested Converse return pattern without sharing its identity.
    if (req.query.resume !== '1') {
      const next = '/signin/google/return?' + new URLSearchParams({ state, neon_auth_session_verifier: verifier, resume: '1' });
      res.set('Referrer-Policy', 'no-referrer');
      return res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${escape(next)}"><title>Returning to Conclave</title><p><a href="${escape(next)}">Continue to Conclave</a></p></html>`);
    }
    if (account.googleState(req) !== state) return fail();
    const key = 'google:' + digest(state);
    const pending = await records.atomic(key, async tx => { const value = await records.get(key, tx); await records.remove(key, tx); return value; });
    if (!pending) return fail();
    const result = await account.finishGoogle(verifier, pending.challenge);
    if (result.status !== 200) return fail();
    res.append('Set-Cookie', account.clearGoogleCookie()); res.append('Set-Cookie', account.sessionCookie(result.user)); res.redirect(303, '/');
  });
}
