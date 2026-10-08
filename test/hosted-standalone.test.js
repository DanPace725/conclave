import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createStandaloneApp } from '../packages/conclave-hosted/src/app.js';
import { createIdentity } from '../packages/conclave-hosted/src/identity.js';
import { migrateHosted } from '../packages/conclave-hosted/src/migrate.js';
import { verifyDatabase } from '../packages/conclave-hosted/src/database.js';
import { startHostedServer } from '../packages/conclave-hosted/src/server.js';

const secret = 'standalone-test-secret-'.repeat(3);
const defaults = { origin: 'https://conclave.example', secret, allowedEmails: 'alice@example.com', authBaseUrl: 'https://auth.example/auth' };
async function fixture(t) {
  const db = new PGlite(); let tail = Promise.resolve();
  const pool = { query: (sql, values) => sql.includes('CREATE TRIGGER') ? db.exec(sql) : db.query(sql, values),
    async connect() {
      let unlock; const ready = new Promise(done => { unlock = done; });
      const previous = tail; tail = ready; await previous;
      return { query: pool.query, release: unlock };
    }, end: async () => {} };
  t.after(() => db.close()); return { db, pool };
}
test('standalone schema migrates atomically and idempotently without chat, keys or embeddings', async t => {
  const { db, pool } = await fixture(t);
  await migrateHosted(pool); await migrateHosted(pool); await verifyDatabase(pool);
  const names = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='app' ORDER BY tablename")).rows.map(r => r.tablename);
  assert.deepEqual(names, ['handoff_events', 'mcp_locks', 'mcp_records']);
  await db.exec("UPDATE conclave_hosted.migrations SET checksum='changed'");
  await assert.rejects(migrateHosted(pool), /checksum/);
  assert.equal((await db.query('SELECT count(*) FROM conclave_hosted.migrations')).rows[0].count, 1);
});
test('standalone migration and readiness refuse a Converse database before modifying it', async t => {
  const { db, pool } = await fixture(t);
  await db.exec('CREATE SCHEMA app; CREATE TABLE app.conversations(id text)');
  await assert.rejects(migrateHosted(pool), /Refusing to migrate Converse/);
  assert.equal((await db.query("SELECT to_regclass('conclave_hosted.migrations') AS migration")).rows[0].migration, null);
  await assert.rejects(verifyDatabase(pool), /separate Conclave/);
});
test('standalone identity uses independent secure cookies, verified accounts and no wildcard key dependency', async () => {
  const account = createIdentity(defaults), user = { id: 'alice-id', email: 'alice@example.com' };
  const header = account.sessionCookie(user);
  assert.match(header, /^__Host-conclave_session=/); assert.match(header, /; Secure/);
  assert.deepEqual(account.identity({ headers: { cookie: header.split(';')[0] } }), user);
  assert.equal(account.identity({ headers: { cookie: 'converse_session=' + header.split('=')[1] } }), null);
  assert.equal(account.identity({ headers: { cookie: header.split(';')[0] + 'bad' } }), null);
  assert.equal(createIdentity({ ...defaults, secret: 'rotated-secret-'.repeat(3) }).identity({ headers: { cookie: header.split(';')[0] } }), null);
  assert.throws(() => createIdentity({ ...defaults, allowedEmails: '*' }), /explicit/);
  assert.throws(() => createIdentity({ ...defaults, secret: 'weak' }), /strong/);
  let calls = 0;
  const unverified = createIdentity({ ...defaults, fetcher: async () => { calls++; return Response.json({ token: 'upstream-only', user: { ...user, emailVerified: false } }); } });
  assert.equal((await unverified.emailCode('bob@example.com', '123456')).status, 403);
  assert.equal(calls, 0);
  assert.equal((await unverified.emailCode(user.email, '123456')).status, 401);
  const wrongEmail = createIdentity({ ...defaults, fetcher: async () => Response.json({ token: 'upstream-only', user: { id: 'bob', email: 'bob@example.com', emailVerified: true } }) });
  assert.equal((await wrongEmail.emailCode(user.email, '123456')).status, 401);
});
test('standalone HTTP sign-in and two OAuth clients share durable packets and independently revoke', async t => {
  const { db, pool } = await fixture(t); await migrateHosted(pool);
  let app, upstreamCalls = 0;
  const server = createServer((req, res) => app(req, res));
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => { server.closeAllConnections(); server.close(done); }));
  const origin = `http://127.0.0.1:${server.address().port}`, resource = origin + '/mcp';
  const options = { ...defaults, origin, pool, fetcher: async (_url, init) => {
    upstreamCalls++; assert.equal(init.headers.origin, origin);
    const body = JSON.parse(init.body);
    if (!body.otp) return Response.json({ success: true });
    return Response.json({ token: 'never-return-this-token', user: { id: 'alice-id', email: body.email, emailVerified: true } });
  } };
  app = createStandaloneApp(options);
  const request = (path, init = {}) => fetch(origin + path, { redirect: 'manual', ...init });
  const hostStatus = (path, host) => new Promise((done, reject) => {
    const req = httpRequest(origin + path, { headers: { Host: host } }, res => { res.resume(); done(res.statusCode); });
    req.on('error', reject); req.end();
  });
  const form = (body, cookie) => ({ method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  assert.equal(await hostStatus('/healthz', 'healthcheck.railway.app'), 200);
  assert.equal(await hostStatus('/mcp', 'healthcheck.railway.app'), 403);
  assert.equal(await hostStatus('/', 'evil.example'), 403);
  const landing = await request('/'), html = await landing.text();
  assert.equal(landing.headers.get('referrer-policy'), 'same-origin', 'native forms must preserve Origin');
  assert.match(landing.headers.get('content-security-policy'), /form-action 'self'$/, 'login must not permit external callbacks');
  const csrf = html.match(/name="csrf" value="([^"]+)"/)[1], browser = landing.headers.get('set-cookie').split(';')[0];
  assert.ok(!html.includes('Sign in to Converse'));
  assert.equal((await request('/signin', form({ email: 'alice@example.com' }, browser))).status, 403);
  for (const requestOrigin of ['null', 'https://evil.example', '']) {
    const rejected = form({ email: 'alice@example.com', csrf }, browser);
    if (requestOrigin) rejected.headers.Origin = requestOrigin; else delete rejected.headers.Origin;
    assert.equal((await request('/signin', rejected)).status, 403);
  }
  assert.equal((await request('/signin', form({ email: 'alice@example.com', csrf }, ''))).status, 403);
  assert.equal(upstreamCalls, 0);
  const sent = await request('/signin', form({ email: 'alice@example.com', csrf }, browser));
  assert.match(await sent.text(), /six-digit/);
  const signed = await request('/signin', form({ email: 'alice@example.com', otp: '123456', csrf }, browser));
  assert.equal(signed.status, 303);
  const session = signed.headers.get('set-cookie').split(';')[0], cookies = browser + '; ' + session;
  assert.ok(!(await signed.text()).includes('never-return-this-token'));
  const dashboard = await (await request('/', { headers: { Cookie: cookies } })).text();
  assert.match(dashboard, /ChatGPT or Claude/); assert.ok(!dashboard.includes('never-return-this-token'));
  const metadata = await (await request('/.well-known/oauth-authorization-server')).json();
  assert.deepEqual(metadata.code_challenge_methods_supported, ['S256']);
  assert.equal(metadata.registration_endpoint, origin + '/register');
  async function connect(name) {
    const client = await (await request('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: name, redirect_uris: ['https://client.example/callback'], token_endpoint_auth_method: 'none' }) })).json();
    const verifier = randomBytes(32).toString('base64url'), challenge = createHash('sha256').update(verifier).digest('base64url');
    const auth = await request('/authorize?' + new URLSearchParams({ client_id: client.client_id, response_type: 'code', redirect_uri: client.redirect_uris[0], resource, code_challenge: challenge, code_challenge_method: 'S256', scope: 'handoffs:read handoffs:write' }));
    const consentPath = auth.headers.get('location'), browserCookies = cookies + '; ' + auth.headers.get('set-cookie').split(';')[0];
    // Browser and OAuth state survive a fresh deployment instance.
    app = createStandaloneApp(options);
    const consentResponse = await request(consentPath, { headers: { Cookie: browserCookies } });
    assert.equal(consentResponse.headers.get('referrer-policy'), 'same-origin', 'consent forms must preserve Origin too');
    assert.match(consentResponse.headers.get('content-security-policy'), /form-action 'self'$/);
    const consentPage = await consentResponse.text();
    const consentCsrf = consentPage.match(/name="csrf" value="([^"]+)"/)[1];
    const allowed = await request('/connect', form({ request: new URL(consentPath, origin).searchParams.get('request'), csrf: consentCsrf, decision: 'allow' }, browserCookies));
    assert.equal(allowed.headers.get('content-security-policy'), consentResponse.headers.get('content-security-policy'));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('location'), null);
    const completed = await allowed.text();
    const code = new URL(completed.match(/id="oauth-return" href="([^"]+)"/)[1].replaceAll('&amp;', '&')).searchParams.get('code');
    const tokens = await (await request('/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: client.client_id, grant_type: 'authorization_code', code, code_verifier: verifier, resource, redirect_uri: client.redirect_uris[0] }) })).json();
    assert.ok(tokens.access_token);
    const sdk = new Client({ name, version: 'test' }); t.after(() => sdk.close());
    await sdk.connect(new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } }));
    return { sdk, tokens, client };
  }
  const a = await connect('ChatGPT'), b = await connect('Claude');
  const saved = (await a.sdk.callTool({ name: 'save_handoff', arguments: { request_id: 'standalone-1', packet: { title: 'Hosted pilot', summary: 'Keep this project moving', constraints: ['Ask before publishing'] } } })).structuredContent;
  const received = (await b.sdk.callTool({ name: 'get_handoff', arguments: { handoff_id: saved.handoff_id } })).structuredContent;
  assert.equal(received.handoff_id, saved.handoff_id); assert.deepEqual(received.packet.constraints, ['Ask before publishing']);
  const grants = await db.query("SELECT key FROM app.mcp_records WHERE key LIKE 'grant:%' AND data->>'clientId'=$1", [b.client.client_id]);
  const connections = await (await request('/connect', { headers: { Cookie: cookies } })).text();
  const revokeCsrf = connections.match(/name="csrf" value="([^"]+)"/)[1];
  assert.equal((await request('/connect', form({ grant: grants.rows[0].key.slice(6), csrf: revokeCsrf }, cookies))).status, 303);
  assert.equal((await request('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${b.tokens.access_token}` } })).status, 401);
  assert.equal((await request('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${a.tokens.access_token}` } })).status, 400);
  assert.equal((await request('/signout', form({ csrf }, cookies))).status, 303);
  assert.equal((await request('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${a.tokens.access_token}` } })).status, 400);
  for (let i = 0; i < 4; i++) await request('/signin', form({ email: 'alice@example.com', csrf }, browser));
  assert.equal((await request('/signin', form({ email: 'alice@example.com', csrf }, browser))).status, 429);
});
test('standalone startup fails closed and releases its pool for missing configuration', async () => {
  let ended = false;
  await assert.rejects(startHostedServer({ env: {}, pool: { end: async () => { ended = true; } } }), /Configure/);
  assert.equal(ended, true);
});
