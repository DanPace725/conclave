import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';
import { startServer } from '../src/server.js';
import { session } from '../src/access.js';

test('signed-in users reach only the hosted conversations they created', async () => {
  const names = ['APP_PASSWORD', 'SESSION_SECRET', 'ALLOWED_EMAILS'];
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  const client = new PGlite({ extensions: { vector } });
  const migrations = new URL('../drizzle/', import.meta.url);
  let server;
  try {
    for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort())
      for (const statement of readFileSync(new URL(file, migrations), 'utf8').split('--> statement-breakpoint'))
        if (statement.trim()) await client.exec(statement);
    server = await startServer({ port: 0, database: () => drizzle(client, { schema }), serviceOptions: {
      availability: () => ({ openai: true, jev: false }),
      providerFactory: () => ({ name: 'openai', respond: async () => assert.fail('no model call expected') }),
    } });
    const url = `http://127.0.0.1:${server.address().port}/api/conclave`;
    const as = cookie => {
      const headers = cookie ? { cookie: 'converse_session=' + cookie } : {};
      const read = async query => { const response = await fetch(`${url}?${query}`, { headers }); return { status: response.status, body: await response.json() }; };
      const post = async body => {
        const response = await fetch(url, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
      };
      return { read, post, list: async () => (await read('action=list')).body.conversations.map(row => row.title).sort(),
        create: async title => (await post({ action: 'create', title })).body.conversation_id };
    };

    // Open local access and password sessions carry no user: rows stay unowned.
    const open = as();
    const legacy = await open.create('Before sign-in');
    assert.deepEqual(await open.list(), ['Before sign-in']);

    process.env.SESSION_SECRET = 'fixture-session-secret';
    process.env.ALLOWED_EMAILS = 'ada@example.com,grace@example.com';
    const ada = as(session({ id: 'user-ada', email: 'ada@example.com' }));
    const grace = as(session({ id: 'user-grace', email: 'grace@example.com' }));
    assert.equal((await as().read('action=list')).status, 401);
    const adas = await ada.create("Ada's notes"), graces = await grace.create("Grace's notes");
    assert.deepEqual(await ada.list(), ["Ada's notes"]);
    assert.deepEqual(await grace.list(), ["Grace's notes"]);
    assert.deepEqual((await client.query('SELECT id, owner_id FROM app.conversations ORDER BY created_at, id')).rows.map(row => row.owner_id).sort(),
      [null, 'user-ada', 'user-grace'].sort());

    // Another user's conversation, and an unowned one, read as missing on every path.
    for (const target of [adas, legacy]) {
      for (const query of ['view', 'transcript', 'download', 'export', 'activity', 'audit'].map(action => `action=${action}&conversation=${target}`)
        .concat(`action=image&conversation=${target}&event=evt_missing`, `action=workspace_file&conversation=${target}&path=notes.md`)) {
        const refused = await grace.read(query);
        assert.equal(refused.status, 404, query);
        assert.match(refused.body.error, /not found|unavailable/, query);
      }
      for (const input of [{ action: 'document_upload', name: 'notes.md', content: 'Injected.' }, { action: 'conversation_name', title: 'Renamed' },
        { action: 'ask', message_id: 'msg_1', content: 'Hello', settings: { model: 'fixture', jev: false } }, { action: 'agent_stop' }]) {
        const refused = await grace.post({ ...input, conversation_id: target });
        assert.deepEqual([refused.status, refused.body.error], [404, 'Conversation not found'], input.action);
      }
    }
    // The refused writes took no lease and changed nothing.
    assert.equal((await ada.post({ action: 'document_upload', conversation_id: adas, name: 'notes.md', content: "Ada's own file." })).status, 200);
    assert.equal((await ada.read(`action=transcript&conversation=${adas}`)).body.title, "Ada's notes");
    const file = await fetch(`${url}?action=workspace_file&conversation=${adas}&path=notes.md`, { headers: { cookie: 'converse_session=' + session({ id: 'user-ada', email: 'ada@example.com' }) } });
    assert.equal(await file.text(), "Ada's own file.");
    assert.equal((await grace.read(`action=transcript&conversation=${graces}`)).status, 200);

    // Without sign-in the repository is unscoped, as before.
    delete process.env.SESSION_SECRET;
    assert.deepEqual(await open.list(), ["Ada's notes", 'Before sign-in', "Grace's notes"]);
    assert.equal((await open.read(`action=transcript&conversation=${adas}`)).status, 200);
  } finally {
    server?.close();
    await client.close();
    for (const name of names) if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name];
  }
});
