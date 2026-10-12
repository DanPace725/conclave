import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { chromium } from '@playwright/test';
import { createStandaloneApp } from '../src/app.js';
import { migrateHosted } from '../src/migrate.js';

// Real browser/forms/cookies with synthetic Neon responses. No .env, external
// auth requests, user credentials or live data are used.
test('hosted password, email backup, recovery and Google navigation work on desktop and mobile', async t => {
  const db = new PGlite(); t.after(() => db.close()); let tail = Promise.resolve();
  const pool = { query: (sql, values) => sql.includes('CREATE TRIGGER') ? db.exec(sql) : db.query(sql, values), async connect() {
    let unlock; const ready = new Promise(done => { unlock = done; }); const before = tail; tail = ready; await before;
    return { query: pool.query, release: unlock };
  } };
  await migrateHosted(pool);
  let app, callback;
  const server = createServer((req, res) => app(req, res));
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => { server.closeAllConnections(); server.close(done); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const user = { id: 'synthetic-owner', email: 'pilot@example.test', emailVerified: true };
  const options = { pool, origin, secret: 'synthetic-browser-secret-'.repeat(3), allowedEmails: user.email,
    authBaseUrl: 'https://synthetic-auth.example.test/auth', fetcher: async (url, init) => {
      const data = init.body && JSON.parse(init.body);
      if (url.endsWith('/sign-in/social')) {
        callback = data.callbackURL;
        return Response.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?synthetic=1' },
          { headers: { 'set-cookie': '__Secure-neon-auth.session_challenge=synthetic-challenge; Secure' } });
      }
      if (url.includes('/get-session?')) return Response.json({ user, session: { id: 'synthetic-session' } });
      if (url.includes('/email-otp/')) return Response.json({ success: true });
      return Response.json({ user, token: 'synthetic-token-never-in-browser' });
    } };
  const browser = await chromium.launch({ channel: 'msedge' }); t.after(() => browser.close());
  await mkdir('.conclave/hosted-login-previews', { recursive: true });
  for (const name of ['desktop', 'mobile', 'scriptless']) await t.test(name, async () => {
    app = createStandaloneApp({ ...options, allowedEmails: name === 'desktop' ? user.email : '*' });
    const context = await browser.newContext({ javaScriptEnabled: name !== 'scriptless',
      viewport: name === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 1000 },
      ...(name === 'mobile' ? { isMobile: true, hasTouch: true } : {}) });
    try {
      const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('https://accounts.google.com/**', route => {
        const target = new URL(callback); target.searchParams.set('neon_auth_session_verifier', 'synthetic-verifier');
        return route.fulfill({ status: 302, headers: { location: target.href }, body: '' });
      });
      await page.goto(origin);
      await page.getByLabel('Email', { exact: true }).fill(user.email);
      await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
      await page.screenshot({ path: `.conclave/hosted-login-previews/signin-${name}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('link', { name: 'Use an email code instead', exact: true }).click();
      await page.getByLabel('Email', { exact: true }).fill(user.email);
      await page.getByRole('button', { name: 'Send email code', exact: true }).click();
      await page.getByLabel('Email code', { exact: true }).fill('123456');
      await page.getByRole('button', { name: 'Sign in with code', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await page.getByRole('link', { name: 'Set or reset your password', exact: true }).click();
      await page.getByLabel('Email', { exact: true }).fill(user.email);
      await page.getByRole('button', { name: 'Send recovery code', exact: true }).click();
      await page.getByLabel('Email code', { exact: true }).fill('123456');
      await page.getByLabel('New password', { exact: true }).fill('synthetic-new-password');
      await page.getByLabel('Confirm new password', { exact: true }).fill('synthetic-new-password');
      await page.screenshot({ path: `.conclave/hosted-login-previews/recovery-${name}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Save password', exact: true }).click();
      assert.match(await page.textContent('main'), /Password saved/);
      await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
      if (name === 'scriptless') await page.getByRole('link', { name: 'Continue with Google', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
      assert.match(await page.textContent('main'), /pilot@example.test/);
      assert.ok(!(await page.content()).includes('synthetic-token-never-in-browser'));
      if (name !== 'scriptless') assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
