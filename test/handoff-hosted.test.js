import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHostedHandoffApp } from '../src/handoff-hosted.js';
import { HandoffRepository, McpRecordStore } from '../src/handoff-repository.js';
import { HandoffOAuthProvider } from '../src/handoff-oauth.js';

async function fixture(t) {
  const db = new PGlite();
  await db.exec('CREATE SCHEMA app');
  await db.exec(await readFile(new URL('../drizzle/0005_handoff_mcp.sql', import.meta.url), 'utf8'));
  // PGlite has one connection. Serialize transaction clients as a real pool
  // would serialize writes through the SQL row lock.
  let tail = Promise.resolve();
  const pool = { query: (sql, values) => db.query(sql, values), connect: async () => {
    let unlock; const ready = new Promise(resolve => { unlock = resolve; });
    const previous = tail; tail = ready; await previous;
    return { query: pool.query, release: unlock };
  } };
  t.after(() => db.close());
  return { db, pool };
}
const packet = { title: 'Pilot project', summary: 'Continue the login work', constraints: ['Keep email sign-in'], open_questions: ['Which callback?'] };

test('hosted packets survive repository restart, owner isolation and concurrent retries', async t => {
  const { pool } = await fixture(t), a = new HandoffRepository(pool, 'alice');
  assert.throws(() => new HandoffRepository(pool, null), /owner/);
  const input = { packet, request_id: 'create-1' };
  const receipts = await Promise.all([a.save(input), new HandoffRepository(pool, 'alice').save(input)]);
  assert.equal(receipts[0].handoff_id, receipts[1].handoff_id);
  assert.equal(receipts.filter(x => x.replayed).length, 1);
  const id = receipts[0].handoff_id, b = new HandoffRepository(pool, 'bob');
  assert.equal((await new HandoffRepository(pool, 'alice').get({ handoff_id: id })).sha256, receipts[0].sha256);
  assert.equal((await b.find()).total, 0);
  await assert.rejects(b.get({ handoff_id: id }), { code: 'not_found' });
  await assert.rejects(b.history({ handoff_id: id }), { code: 'not_found' });
  await assert.rejects(b.compare({ handoff_id: id, from_revision: 1 }), { code: 'not_found' });
  await assert.rejects(b.save({ ...input, handoff_id: id, expected_revision: 1 }), { code: 'not_found' });
  const updated = await a.save({ packet: { ...packet, summary: 'New decision' }, request_id: 'update-1', handoff_id: id, expected_revision: 1 });
  assert.equal(updated.revision, 2);
  assert.equal((await a.history({ handoff_id: id })).revisions[0].revision, 2);
  assert.deepEqual((await a.compare({ handoff_id: id, from_revision: 1 })).changes, [{ field: 'summary', before: packet.summary, after: 'New decision' }]);
  assert.equal((await new HandoffRepository(pool, 'alice').get({ handoff_id: id, revision: 1 })).packet.summary, packet.summary);
  await assert.rejects(a.save({ packet, request_id: 'stale', handoff_id: id, expected_revision: 1 }), { code: 'conflict' });
  await assert.rejects(pool.query('UPDATE app.handoff_events SET data=data WHERE owner_id=$1', ['alice']), /append-only/);
});

test('real HTTP OAuth discovery, consent, PKCE, MCP handoff and revocation', async t => {
  const { pool, db } = await fixture(t);
  let app;
  const http = createServer((req, res) => app(req, res));
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { http.closeAllConnections(); http.close(resolve); }));
  const origin = `http://127.0.0.1:${http.address().port}`, resource = `${origin}/mcp`;
  const options = { pool, origin, secret: 'test-secret-'.repeat(4),
    identity: req => req.headers.cookie?.includes('test_owner=alice') ? { id: 'alice', email: 'alice@example.com' } : null,
    emailAllowed: email => email === 'alice@example.com' };
  app = createHostedHandoffApp(options);
  const request = (path, opts = {}) => fetch(origin + path, { redirect: 'manual', ...opts });
  const form = (data, headers = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(data) });
  const noToken = await request('/mcp', { method: 'POST' });
  assert.equal(noToken.status, 401);
  assert.match(noToken.headers.get('www-authenticate'), /oauth-protected-resource\/mcp/);
  const metadata = await (await request('/.well-known/oauth-protected-resource/mcp')).json();
  assert.equal(metadata.resource, resource);
  const oauth = await (await request('/.well-known/oauth-authorization-server')).json();
  assert.equal(oauth.registration_endpoint, origin + '/register');
  const registration = await request('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: '<script>untrusted</script>', redirect_uris: ['https://client.example/callback'], token_endpoint_auth_method: 'none' }) });
  assert.equal(registration.status, 201);
  const client = await registration.json();
  const verifier = randomBytes(32).toString('base64url'), challenge = createHash('sha256').update(verifier).digest('base64url');
  const parameters = { client_id: client.client_id, response_type: 'code', redirect_uri: client.redirect_uris[0], state: 'state-one', code_challenge: challenge, code_challenge_method: 'S256', resource };
  const auth = await request('/authorize?' + new URLSearchParams(parameters));
  assert.equal(auth.status, 302);
  const cookie = auth.headers.get('set-cookie').split(';')[0] + '; test_owner=alice';
  const consentPath = auth.headers.get('location');
  // A new server instance can continue the durable authorization request.
  app = createHostedHandoffApp(options);
  const consentPage = await request(consentPath, { headers: { Cookie: cookie } });
  assert.match(consentPage.headers.get('content-security-policy'), /form-action 'self' https:\/\/client\.example$/);
  const html = await consentPage.text();
  assert.ok(html.includes('&lt;script&gt;untrusted&lt;/script&gt;'));
  assert.ok(!html.includes('<script>untrusted'));
  const csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
  const pending = new URL(consentPath, origin).searchParams.get('request');
  const foreignConsent = await request('/connect', form({ request: pending, csrf, decision: 'allow' }, { Cookie: cookie, Origin: 'https://evil.example' }));
  assert.equal(foreignConsent.status, 403);
  assert.match(await foreignConsent.text(), /start Connect again/);
  assert.match(foreignConsent.headers.get('content-security-policy'), /form-action 'self'$/);
  const consent = await request('/connect', form({ request: pending, csrf, decision: 'allow' }, { Cookie: cookie, Origin: origin }));
  assert.equal(consent.status, 303);
  assert.equal(consent.headers.get('content-security-policy'), consentPage.headers.get('content-security-policy'));
  const redirect = new URL(consent.headers.get('location'));
  assert.equal(redirect.searchParams.get('state'), 'state-one');
  const code = redirect.searchParams.get('code');
  const exchange = { client_id: client.client_id, grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: client.redirect_uris[0], resource };
  assert.equal((await request('/token', form({ ...exchange, code_verifier: randomBytes(32).toString('base64url') }))).status, 400);
  assert.equal((await request('/token', form({ ...exchange, resource: 'https://other.example/mcp' }))).status, 400);
  const tokens = await (await request('/token', form(exchange))).json();
  assert.ok(tokens.access_token);
  assert.equal((await request('/token', form(exchange))).status, 400);
  // No raw codes or bearer/refresh tokens appear in persistent state.
  const state = JSON.stringify((await db.query('SELECT data FROM app.mcp_records')).rows);
  for (const value of [code, tokens.access_token, tokens.refresh_token]) assert.ok(!state.includes(value));
  const mcp = new Client({ name: 'handoff-pilot-a', version: '1' });
  t.after(() => mcp.close());
  await mcp.connect(new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } }));
  assert.deepEqual((await mcp.listTools()).tools.map(x => x.name), ['save_handoff', 'find_handoffs', 'get_handoff', 'list_handoff_versions', 'compare_handoff_versions', 'open_handoff_library']);
  const saved = (await mcp.callTool({ name: 'save_handoff', arguments: { packet, request_id: 'http-save' } })).structuredContent;
  assert.ok(saved.handoff_id);
  app = createHostedHandoffApp(options);
  const second = new Client({ name: 'handoff-pilot-b', version: '1' });
  t.after(() => second.close());
  await second.connect(new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } }));
  const retrieved = (await second.callTool({ name: 'get_handoff', arguments: { handoff_id: saved.handoff_id } })).structuredContent;
  assert.deepEqual(retrieved.packet.constraints, packet.constraints);
  const refreshArgs = { client_id: client.client_id, grant_type: 'refresh_token', refresh_token: tokens.refresh_token, resource };
  const refreshed = await (await request('/token', form(refreshArgs))).json();
  assert.ok(refreshed.access_token);
  assert.notEqual(refreshed.refresh_token, tokens.refresh_token);
  assert.equal((await request('/token', form(refreshArgs))).status, 400);
  const managePage = await request('/connect', { headers: { Cookie: 'test_owner=alice' } });
  assert.match(managePage.headers.get('content-security-policy'), /form-action 'self'$/);
  const manage = await managePage.text();
  const grant = manage.match(/name="grant" value="([^"]+)"/)[1], manageCsrf = manage.match(/name="csrf" value="([^"]+)"/)[1];
  assert.equal((await request('/connect', form({ grant, csrf: manageCsrf }, { Cookie: 'test_owner=alice', Origin: origin }))).status, 303);
  for (const token of [tokens.access_token, refreshed.access_token]) assert.equal((await request('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await request('/token', form({ ...refreshArgs, refresh_token: refreshed.refresh_token }))).status, 400);
});

test('OAuth rejects other owners, changed resources, expired grants and unsafe redirects', async t => {
  const { pool } = await fixture(t), records = new McpRecordStore(pool);
  let allowed = true;
  const provider = new HandoffOAuthProvider(records, { origin: 'https://conclave.example', secret: 'test-secret-'.repeat(4), emailAllowed: () => allowed });
  await assert.rejects(provider.clientsStore.registerClient({ client_id: 'x', redirect_uris: ['https://user:password@client.example/callback'] }), /callback/);
  await assert.rejects(provider.clientsStore.registerClient({ client_id: 'x', redirect_uris: ['javascript:alert(1)'] }), /callback/);
  const client = { client_id: 'x', redirect_uris: ['https://client.example/callback'], token_endpoint_auth_method: 'none' };
  await provider.clientsStore.registerClient(client);
  const recovered = await new HandoffOAuthProvider(records, { origin: 'https://conclave.example', secret: provider.secret, emailAllowed: () => true }).clientsStore.getClient('x');
  assert.equal(recovered.client_id, 'x');
  let redirect, nonce;
  await provider.authorize(client, { resource: new URL(provider.resource), codeChallenge: 'a'.repeat(43), redirectUri: client.redirect_uris[0], scopes: ['handoffs:read'] }, { cookie(_key, value) { nonce = value; }, redirect(_status, value) { redirect = value; } });
  const pending = new URL(redirect, provider.origin).searchParams.get('request');
  await assert.rejects(provider.approve(pending, 'wrong', { id: 'alice', email: 'alice@example.com' }, true), /expired/);
  const callback = await provider.approve(pending, nonce, { id: 'alice', email: 'alice@example.com' }, true);
  const code = new URL(callback).searchParams.get('code');
  const tokens = await provider.exchangeAuthorizationCode(client, code, undefined, client.redirect_uris[0], new URL(provider.resource));
  const auth = await provider.verifyAccessToken(tokens.access_token);
  await assert.rejects(provider.revokeGrant(auth.extra.grant, 'bob'), /not found/);
  const rotated = new HandoffOAuthProvider(records, { origin: provider.origin, secret: 'rotated-secret-'.repeat(4), emailAllowed: () => true });
  await assert.rejects(rotated.verifyAccessToken(tokens.access_token), /revoked/);
  const otherOrigin = new HandoffOAuthProvider(records, { origin: 'https://other.example', secret: provider.secret, emailAllowed: () => true });
  await assert.rejects(otherOrigin.exchangeRefreshToken(client, tokens.refresh_token), /revoked/);
  await records.put('expired:test', { test: true }, Date.now() - 1000);
  assert.equal(await records.get('expired:test'), undefined);
  allowed = false;
  await assert.rejects(provider.verifyAccessToken(tokens.access_token), /revoked/);
  await assert.rejects(provider.exchangeRefreshToken(client, tokens.refresh_token), /revoked/);
});

test('read-only MCP connection cannot discover or invoke a save tool', async t => {
  const { pool } = await fixture(t);
  let app;
  const http = createServer((req, res) => app(req, res));
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { http.closeAllConnections(); http.close(resolve); }));
  const origin = `http://127.0.0.1:${http.address().port}`, secret = 'readonly-secret-'.repeat(3);
  const records = new McpRecordStore(pool), provider = new HandoffOAuthProvider(records, { origin, secret, emailAllowed: () => true });
  const client = { client_id: 'readonly', client_name: 'Read only', redirect_uris: ['https://client.example/callback'], token_endpoint_auth_method: 'none' };
  await provider.clientsStore.registerClient(client);
  let pending, nonce;
  await provider.authorize(client, { resource: new URL(provider.resource), codeChallenge: 'a'.repeat(43), redirectUri: client.redirect_uris[0], scopes: ['handoffs:read'] }, { cookie(_key, value) { nonce = value; }, redirect(_status, value) { pending = new URL(value, origin).searchParams.get('request'); } });
  const callback = await provider.approve(pending, nonce, { id: 'bob', email: 'bob@example.com' }, true);
  const tokens = await provider.exchangeAuthorizationCode(client, new URL(callback).searchParams.get('code'), undefined, client.redirect_uris[0], new URL(provider.resource));
  app = createHostedHandoffApp({ pool, origin, secret, identity: () => null, emailAllowed: () => true });
  const mcp = new Client({ name: 'readonly', version: '1' });
  t.after(() => mcp.close());
  await mcp.connect(new StreamableHTTPClientTransport(new URL(provider.resource), { requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } } }));
  const tools = (await mcp.listTools()).tools;
  assert.deepEqual(tools.map(x => x.name), ['find_handoffs', 'get_handoff', 'list_handoff_versions', 'compare_handoff_versions', 'open_handoff_library']);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.deepEqual(tool._meta.securitySchemes, [{ type: 'oauth2', scopes: ['handoffs:read'] }]);
  }
  const existing = await new HandoffRepository(pool, 'bob').save({ packet, request_id: 'readonly-existing' });
  const browser = await mcp.callTool({ name: 'open_handoff_library', arguments: { handoff_id: existing.handoff_id } });
  assert.equal(browser.isError, undefined);
  assert.equal(browser.structuredContent.data.handoff_id, existing.handoff_id);
  const history = await mcp.callTool({ name: 'list_handoff_versions', arguments: { handoff_id: existing.handoff_id } });
  assert.equal(history.structuredContent.revisions[0].sha256, existing.sha256);
  const compared = await mcp.callTool({ name: 'compare_handoff_versions', arguments: { handoff_id: existing.handoff_id, from_revision: 1 } });
  assert.equal(compared.structuredContent.identical, true);
  const blocked = await mcp.callTool({ name: 'save_handoff', arguments: { packet, request_id: 'blocked' } });
  assert.equal(blocked.isError, true);
  assert.match(blocked.content[0].text, /not found/);
  assert.equal((await new HandoffRepository(pool, 'bob').find()).total, 1);
});

test('hosted storage cap preserves identical retry receipts and refuses new writes atomically', async t => {
  const { pool } = await fixture(t), repo = new HandoffRepository(pool, 'alice');
  const input = { packet, request_id: 'original' }, receipt = await repo.save(input);
  const { rows } = await pool.query('SELECT data FROM app.handoff_events WHERE owner_id=$1 AND seq=2', ['alice']);
  // Seed realistic immutable historical revisions to exercise the boundary.
  await pool.query(`INSERT INTO app.handoff_events(owner_id,seq,data)
    SELECT $1,n,$2::jsonb || jsonb_build_object('seq',n,'id','evt_fixture_'||n,
      'metadata',($2::jsonb->'metadata') || jsonb_build_object('revision',n-1,'request_id','fixture-'||n))
    FROM generate_series(3,2000) AS n`, ['alice', rows[0].data]);
  assert.equal((await repo.save(input)).handoff_id, receipt.handoff_id);
  await assert.rejects(repo.save({ packet, request_id: 'over-cap' }), { code: 'capacity' });
  assert.equal(Number((await pool.query('SELECT count(*) AS count FROM app.handoff_events WHERE owner_id=$1', ['alice'])).rows[0].count), 2000);
  assert.equal((await repo.get({ handoff_id: receipt.handoff_id })).revision, 1999);
});
