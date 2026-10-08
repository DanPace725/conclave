import express from 'express';
import { createHash } from 'node:crypto';
import { createHostedHandoffApp } from '../../../src/handoff-hosted.js';
import { createHandoffDashboard } from '../../../src/handoff-dashboard.js';
import { McpRecordStore } from '../../../src/handoff-repository.js';
import { createIdentity } from './identity.js';
import { verifyDatabase } from './database.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const page = (res, content) => res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conclave</title><link rel="stylesheet" href="/styles.css"><main><h1>Conclave</h1><p class="intro">Keep your project moving between AI apps.</p>${content}</main></html>`);
export function createStandaloneApp({ pool, origin, secret, allowedEmails, authBaseUrl, fetcher }) {
  const account = createIdentity({ origin, secret, allowedEmails, authBaseUrl, fetcher });
  const mcp = createHostedHandoffApp({ pool, origin, secret, ...account, accountName: 'Conclave' });
  const records = new McpRecordStore(pool), host = new URL(origin).host;
  const app = express();
  app.disable('x-powered-by');
  // Railway's deployment probe uses its own Host. Only this non-data route accepts it.
  app.get('/healthz', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (![host, 'healthcheck.railway.app'].includes(req.headers.host)) return res.sendStatus(403);
    try { await verifyDatabase(pool); res.json({ status: 'ready' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });
  app.use((req, res, next) => {
    // Native form POSTs need their same-origin Origin header for CSRF checks.
    // Still suppress referrers when leaving Conclave, including OAuth callbacks.
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    if (req.headers.host !== host) return res.sendStatus(403);
    next();
  });
  app.get('/styles.css', (_req, res) => res.type('css').send(`:root{color-scheme:light dark;font:17px/1.6 system-ui}body{margin:0;background:light-dark(#f4f6f3,#161b18);color:light-dark(#21362c,#e4ede6)}main{max-width:680px;margin:8vh auto;padding:28px}h1{font-size:42px;letter-spacing:-1px;margin:0}.intro{font-size:21px}a{color:light-dark(#176547,#8fd4b4)}label{display:block;margin:18px 0}input{display:block;box-sizing:border-box;width:100%;padding:12px;margin:6px 0;border:1px solid #718378;border-radius:6px;font:inherit}button{padding:10px 18px;border:0;border-radius:6px;background:#226f50;color:white;font:inherit;cursor:pointer}code{overflow-wrap:anywhere}.note{font-size:15px}.error{color:light-dark(#9b2727,#ffa4a4)}`));
  const form = (req, res, email = '', code = false, message = '') => {
    const csrf = account.form(req, res);
    page(res, `${message ? `<p class="${code ? 'note' : 'error'}" role="status">${escape(message)}</p>` : ''}<h2>Sign in to your handoffs</h2><form action="/signin" method="post"><input type="hidden" name="csrf" value="${escape(csrf)}"><label>Email<input name="email" type="email" autocomplete="email" maxlength="254" value="${escape(email)}" required></label>${code ? '<label>Email code<input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>' : ''}<button>${code ? 'Sign in' : 'Send email code'}</button></form><p class="note">Private pilot. Use the same Conclave account in ChatGPT and Claude.</p>${code ? '<p><a href="/">Request a new code</a></p>' : ''}`);
  };
  app.get('/', (req, res) => {
    const user = account.identity(req);
    if (!user) return form(req, res);
    const csrf = account.form(req, res);
    page(res, `<p>Signed in as ${escape(user.email)}.</p><p><a href="/dashboard">Open your handoff dashboard</a></p><h2>Connect your AI apps</h2><p>MCP server address: <code>${escape(origin)}/mcp</code></p><p>Add this address as a custom MCP connection in ChatGPT or Claude. Choose OAuth and automatic client registration, then sign in with this account and approve access.</p><p>Ask one app to save a handoff and the other to retrieve its ID. Saved versions retain decisions, constraints and open questions.</p><p><a href="/connect">Manage app connections</a></p><p class="note">Only context you explicitly save is stored. Source app and model labels are reported claims. Signing out here keeps app connections active; revoke them on the connections page.</p><form method="post" action="/signout"><input type="hidden" name="csrf" value="${escape(csrf)}"><button>Sign out</button></form>`);
  });
  app.use(['/signin', '/signout'], express.urlencoded({ extended: false, limit: '8kb' }));
  app.post('/signin', async (req, res) => {
    if (!account.checkForm(req)) return res.status(403).send('Reload the sign-in page and submit from this site.');
    const email = String(req.body.email || '').trim().toLowerCase(), otp = req.body.otp;
    if (!account.emailAllowed(email)) { res.status(403); return form(req, res, '', false, 'This account is not enabled for the private pilot.'); }
    const budget = 'signin:' + createHash('sha256').update(email + ':' + (otp === undefined ? 'send' : 'verify')).digest('hex');
    const allowed = await records.atomic(budget, async tx => {
      const now = Date.now(), old = await records.get(budget, tx) || { count: 0, until: now + 3600000 };
      if (old.count >= (otp === undefined ? 5 : 15)) return false;
      await records.put(budget, { ...old, count: old.count + 1 }, old.until, null, tx);
      return true;
    });
    if (!allowed) { res.status(429); return form(req, res, email, false, 'Too many attempts. Wait before trying again.'); }
    const result = await account.emailCode(email, otp);
    if (result.status !== 200) { res.status(result.status); return form(req, res, email, false, result.error); }
    if (!result.user) return form(req, res, email, true, 'Check your email for a six-digit sign-in code.');
    res.append('Set-Cookie', account.sessionCookie(result.user));
    res.redirect(303, '/');
  });
  app.post('/signout', (req, res) => {
    if (!account.checkForm(req)) return res.sendStatus(403);
    res.append('Set-Cookie', account.clearCookie()); res.redirect(303, '/');
  });
  app.use('/dashboard', createHandoffDashboard({ pool, origin, identity: account.identity }));
  app.use(mcp);
  app.use((error, _req, res, _next) => {
    if (!res.headersSent) res.status(error.type === 'entity.too.large' ? 413 : 503).send('Conclave could not complete this request. Try again shortly.');
  });
  return app;
}
