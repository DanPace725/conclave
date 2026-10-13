import express from 'express';
import { readFileSync } from 'node:fs';
import { hostedPage, mountPublicPages } from './public-pages.js';
import { hostedServerInfo } from '../../../src/handoff-branding.js';
import { createHostedHandoffApp } from '../../../src/handoff-hosted.js';
import { createHandoffDashboard } from '../../../src/handoff-dashboard.js';
import { McpRecordStore } from '../../../src/handoff-repository.js';
import { createIdentity } from './identity.js';
import { verifyDatabase } from './database.js';
import { mountSignin, signinPage } from './signin.js';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function createStandaloneApp({ pool, origin, secret, allowedEmails, authBaseUrl, fetcher, trustProxy = false }) {
  const account = createIdentity({ origin, secret, allowedEmails, authBaseUrl, fetcher });
  const mcp = createHostedHandoffApp({ pool, origin, secret, ...account, accountName: 'Conclave', trustProxy,
    presentation: { page: hostedPage, serverInfo: hostedServerInfo(origin) } });
  const records = new McpRecordStore(pool), host = new URL(origin).host;
  const app = express();
  app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');
  // Evaluated when a page renders, after password recovery may have revoked this session.
  app.use((req, res, next) => { res.locals.pagePath = req.path; res.locals.publicSignup = account.publicSignup; res.locals.signedIn = () => !!account.identity(req); next(); });
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
  app.get('/styles.css', (_req, res) => res.type('css').send(styles));
  mountPublicPages(app, origin);
  mountSignin(app, { account, records, origin });
  app.get(['/', '/account'], (req, res) => {
    const user = account.identity(req);
    if (!user) return signinPage(account, req, res, { message: req.query.signin === 'failed' ? 'Google sign-in could not be completed. Try again or use an email code.' : '' });
    const csrf = account.form(req, res);
    hostedPage(res, 'Your account', `<p>Signed in as ${escape(user.email)}.</p><p><a class="button" href="/dashboard">Open your dashboard</a></p><h2>Connections</h2><p>Review the AI apps connected to your Conclave account and remove access when you need to.</p><p><a class="button" href="/connect">Manage connections</a></p><p>To connect another app, follow <a href="/get-started">Getting Started</a> or see the <a href="/docs#connect">connection settings in Docs</a>.</p><h2>Password and sign-out</h2><p><a href="/signin/reset">Set or reset your password</a></p><p class="note">Signing out here keeps app connections active; revoke them on <a href="/connect">Connections</a>.</p><form method="post" action="/signout"><input type="hidden" name="csrf" value="${escape(csrf)}"><button>Sign out</button></form>`);
  });
  app.post('/signout', (req, res) => {
    if (!account.checkForm(req)) return res.sendStatus(403);
    res.append('Set-Cookie', account.clearCookie()); res.redirect(303, '/');
  });
  app.use('/dashboard', createHandoffDashboard({ pool, origin, identity: account.identity, hostedPresentation: true }));
  app.use(mcp);
  app.use((error, _req, res, _next) => {
    if (!res.headersSent) res.status(error.type === 'entity.too.large' ? 413 : 503).send('Conclave could not complete this request. Try again shortly.');
  });
  return app;
}
