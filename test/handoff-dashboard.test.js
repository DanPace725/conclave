import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { createStandaloneApp } from '../packages/conclave-hosted/src/app.js';
import { createIdentity } from '../packages/conclave-hosted/src/identity.js';
import { migrateHosted } from '../packages/conclave-hosted/src/migrate.js';
import { HandoffRepository } from '../src/handoff-repository.js';

async function fixture(t) {
  const db = new PGlite(); let tail = Promise.resolve();
  const pool = { query: (sql, values) => sql.includes('CREATE TRIGGER') ? db.exec(sql) : db.query(sql, values), async connect() {
    let unlock; const next = new Promise(done => { unlock = done; }); const previous = tail; tail = next; await previous;
    return { query: pool.query, release: unlock };
  } };
  await migrateHosted(pool);
  let app; const server = createServer((req, res) => app(req, res));
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); await db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const options = { pool, origin, secret: 'dashboard-test-secret-'.repeat(3), allowedEmails: 'alice@example.com,bob@example.com', authBaseUrl: 'https://auth.example/auth' };
  const identity = createIdentity(options);
  const cookies = Object.fromEntries(['alice', 'bob'].map(id => [id, identity.sessionCookie({ id, email: `${id}@example.com` }).split(';')[0]]));
  app = createStandaloneApp(options);
  const request = (path, owner = 'alice', init = {}) => fetch(origin + path, { redirect: 'manual', ...init, headers: { ...(owner ? { Cookie: cookies[owner] } : {}), ...init.headers } });
  return { db, pool, origin, cookies, request };
}
const packet = { title: 'Dashboard work', summary: 'A shared dashboard', source_app: 'ChatGPT', source_model: 'Sol',
  context: 'Complete context.\n\nKeep this qualification.', constraints: ['Keep provenance.', 'Ask before publishing.'], open_questions: ['Which default view?'] };

test('dashboard serves an inert authenticated shell and enforces account, host, origin and read-only access', async t => {
  const { request, origin, pool } = await fixture(t);
  const a = new HandoffRepository(pool, 'alice'), saved = await a.save({ packet, request_id: 'first' });
  assert.equal((await request('/dashboard', null)).status, 303);
  assert.equal((await request('/dashboard/api/find', null)).status, 401);
  const page = await request('/dashboard');
  assert.equal(page.status, 200); assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await page.text();
  assert.ok(!html.includes(saved.handoff_id)); assert.ok(!html.includes('alice@example.com')); assert.ok(!html.includes(packet.context));
  for (const resource of ['app.js', 'app.css']) assert.equal((await request('/dashboard/' + resource)).status, 200);
  assert.match(await (await request('/')).text(), /href="\/dashboard"/);
  assert.equal((await request('/dashboard/api/find', 'alice', { method: 'POST' })).status, 405);
  assert.equal((await request('/dashboard/api/find', 'alice', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/dashboard/api/find', 'alice', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  const hostStatus = await new Promise((done, reject) => {
    const req = httpRequest(origin + '/dashboard', { headers: { Host: 'evil.example' } }, res => { res.resume(); done(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(hostStatus, 403);
  assert.equal((await request('/dashboard/api/find', 'alice', { headers: { Cookie: 'conclave_session=tampered' } })).status, 401);
  const data = await (await request('/dashboard/api/find', 'bob')).json(); assert.equal(data.total, 0);
  for (const path of [`get?handoff_id=${saved.handoff_id}`, `history?handoff_id=${saved.handoff_id}`, `compare?handoff_id=${saved.handoff_id}&from_revision=1`])
    assert.equal((await request('/dashboard/api/' + path, 'bob')).status, 404);
  assert.equal((await a.history({ handoff_id: saved.handoff_id })).total, 1);
});

test('dashboard reads complete immutable versions, exact removals and paginated metadata without accepting owner overrides', async t => {
  const { pool, db, request } = await fixture(t), a = new HandoffRepository(pool, 'alice');
  const saved = await a.save({ packet, request_id: 'first' });
  await a.save({ packet: { ...packet, constraints: ['Ask before publishing.'], open_questions: [], source_app: 'Claude' },
    handoff_id: saved.handoff_id, expected_revision: 1, request_id: 'second' });
  for (let i = 0; i < 11; i++) await a.save({ packet: { title: `Extra ${i}`, summary: 'Paging' }, request_id: `extra-${i}` });
  const originalCount = (await db.query('SELECT count(*) AS count FROM app.handoff_events')).rows[0].count;
  const api = '/dashboard/api/', id = saved.handoff_id;
  const first = await (await request(api + 'find')).json();
  assert.equal(first.total, 12); assert.equal(first.handoffs.length, 10); assert.equal(first.next_offset, 10);
  assert.equal((await (await request(api + 'find?offset=10')).json()).handoffs.length, 2);
  assert.equal((await (await request(api + 'find?query=dashboard')).json()).handoffs[0].handoff_id, id);
  const older = await (await request(api + `get?handoff_id=${id}&revision=1`)).json();
  assert.deepEqual(older.packet, (await a.get({ handoff_id: id, revision: 1 })).packet);
  assert.equal(older.selection.complete, true); assert.equal(older.latest_revision, 2);
  const revisions = await (await request(api + `history?handoff_id=${id}`)).json();
  assert.deepEqual(revisions.revisions.map(r => r.source_app), ['Claude', 'ChatGPT']);
  const changes = await (await request(api + `compare?handoff_id=${id}&from_revision=1&to_revision=2`)).json();
  assert.deepEqual(changes.changes.find(c => c.field === 'constraints').before, packet.constraints);
  assert.deepEqual(changes.changes.find(c => c.field === 'open_questions').after, []);
  for (const path of ['find?owner=bob', 'find?offset=-1', 'find?offset=1.5', 'find?offset=9007199254740992', 'find?query=a&query=b',
    `get?handoff_id=${id}&focus=qualifications`, `get?handoff_id=${id}&revision=0`, `compare?handoff_id=${id}&from_revision=0`])
    assert.equal((await request(api + path)).status, 400, path);
  assert.equal((await request(api + 'save')).status, 404);
  assert.equal((await request(api + 'toString')).status, 404);
  assert.equal((await db.query('SELECT count(*) AS count FROM app.handoff_events')).rows[0].count, originalCount);
  const latest = await (await request(api + `get?handoff_id=${id}`)).json();
  assert.equal(latest.sha256, (await a.get({ handoff_id: id })).sha256);
});
