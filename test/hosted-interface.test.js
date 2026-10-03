import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';
import { startServer } from '../src/server.js';

test('standalone hosted API persists streamed replies and workspace sources across repository instances', async () => {
  const client = new PGlite();
  const migrations = new URL('../drizzle/', import.meta.url);
  let server;
  const previous = process.env.APP_PASSWORD;
  delete process.env.APP_PASSWORD;
  try {
    for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort())
      for (const statement of readFileSync(new URL(file, migrations), 'utf8').split('--> statement-breakpoint'))
        if (statement.trim()) await client.exec(statement);
    const db = drizzle(client, { schema });
    server = await startServer({ port: 0, database: () => db, serviceOptions: {
      availability: () => ({ openai: true, jev: false }),
      providerFactory: () => ({ name: 'openai', respond: async (_payload, options) => {
        options?.onDelta?.('Saved from standalone.');
        return { status: 'completed', model: 'fixture', usage: { input_tokens: 10, output_tokens: 5 },
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'Saved from standalone.' }] }] };
      } }),
    } });
    const url = `http://127.0.0.1:${server.address().port}/api/conclave`;
    const post = body => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const created = await (await post({ action: 'create', title: 'Hosted standalone' })).json();
    const id = created.conversation_id;
    assert.ok(id);
    assert.equal((await post({ action: 'document_upload', conversation_id: id, name: 'notes.md', content: 'Canonical workspace source.' })).status, 200);
    const answered = await post({ action: 'ask', conversation_id: id, message_id: 'msg_hosted', content: 'Read notes.', stream: true,
      settings: { model: 'fixture', jev: false } });
    const events = (await answered.text()).trim().split('\n').map(line => JSON.parse(line));
    assert.ok(events.some(event => event.delta === 'Saved from standalone.'));
    assert.equal(events.at(-1).view.messages.at(-1).content, 'Saved from standalone.');
    const record = await (await fetch(`${url}?action=download&conversation=${id}`)).json();
    assert.equal(record.messages.at(-1).content, 'Saved from standalone.');
    assert.ok(record.context_layer.events.some(event => event.kind === 'document' && event.content === 'Canonical workspace source.'));
    assert.ok(record.context_layer.snapshots.length);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await client.close();
    if (previous === undefined) delete process.env.APP_PASSWORD; else process.env.APP_PASSWORD = previous;
  }
});
