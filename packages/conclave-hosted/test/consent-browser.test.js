import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { chromium } from '@playwright/test';
import { createHostedHandoffApp } from '../../../src/handoff-hosted.js';

// Synthetic identity and empty transient storage: never loads .env or contacts
// a real AI app, auth provider or database. Three origins model a mobile callback
// that redirects onward to another web/app entry point.
test('native consent reaches a multi-origin callback on desktop and mobile, with a scriptless fallback', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('CREATE SCHEMA app');
  await db.exec(await readFile(new URL('../../../drizzle/0005_handoff_mcp.sql', import.meta.url), 'utf8'));
  let tail = Promise.resolve();
  const pool = { query: (sql, values) => db.query(sql, values), connect: async () => {
    let unlock; const ready = new Promise(done => { unlock = done; });
    const previous = tail; tail = ready; await previous;
    return { query: pool.query, release: unlock };
  } };
  async function listen(handler) {
    const server = createServer(handler);
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    t.after(() => new Promise(done => { server.closeAllConnections(); server.close(done); }));
    return `http://127.0.0.1:${server.address().port}`;
  }
  const final = await listen((_req, res) => res.end('Callback completed'));
  let callbackUrl;
  const callback = await listen((req, res) => {
    callbackUrl = new URL(req.url, callback);
    res.writeHead(302, { Location: final + '/app' }); res.end();
  });
  let app;
  const origin = await listen((req, res) => app(req, res)), resource = origin + '/mcp';
  app = createHostedHandoffApp({ pool, origin, secret: 'synthetic-secret-'.repeat(3), accountName: 'Conclave',
    identity: req => req.headers.cookie?.includes('test_owner=alice') ? { id: 'alice', email: 'alice@example.com' } : null,
    emailAllowed: email => email === 'alice@example.com' });
  const browser = await chromium.launch({ channel: 'msedge' });
  t.after(() => browser.close());
  for (const mode of ['desktop', 'mobile', 'scriptless']) {
    await t.test(mode, async () => {
      const context = await browser.newContext({ javaScriptEnabled: mode !== 'scriptless',
        ...(mode === 'mobile' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}) });
      try {
        await context.addCookies([{ name: 'test_owner', value: 'alice', url: origin }]);
        const clientResponse = await context.request.post(origin + '/register', { data: {
          client_name: 'Synthetic app', redirect_uris: [callback + '/callback'], token_endpoint_auth_method: 'none' } });
        const client = await clientResponse.json();
        const verifier = randomBytes(32).toString('base64url'), state = 'state-' + mode;
        const page = await context.newPage(), failures = [];
        page.on('console', msg => { if (msg.type() === 'error') failures.push(msg.text()); });
        await page.goto(origin + '/authorize?' + new URLSearchParams({ client_id: client.client_id,
          response_type: 'code', redirect_uri: client.redirect_uris[0], state, resource,
          code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }));
        await page.getByRole('button', { name: mode === 'scriptless' ? 'Cancel' : 'Allow connection', exact: true }).click();
        if (mode === 'scriptless') {
          await page.getByRole('link', { name: 'Return to Synthetic app', exact: true }).click();
        }
        try { await page.waitForURL(final + '/app', { timeout: 8000 }); }
        catch { throw new Error('Callback navigation stalled: ' + failures.join('\n')); }
        assert.equal(await page.locator('body').textContent(), 'Callback completed');
        assert.equal(callbackUrl.searchParams.get('state'), state);
        if (mode === 'scriptless') {
          assert.equal(callbackUrl.searchParams.get('error'), 'access_denied');
          assert.equal(callbackUrl.searchParams.get('code'), null);
        } else {
          const token = await context.request.post(origin + '/token', { form: { client_id: client.client_id,
            grant_type: 'authorization_code', code: callbackUrl.searchParams.get('code'), code_verifier: verifier,
            redirect_uri: client.redirect_uris[0], resource } });
          assert.equal(token.status(), 200); assert.ok((await token.json()).access_token);
        }
      } finally { await context.close(); }
    });
  }
  assert.equal(Number((await db.query("SELECT count(*) FROM app.mcp_records WHERE key LIKE 'grant:%'")).rows[0].count), 2);
});
