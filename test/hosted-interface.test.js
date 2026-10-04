import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';
import { startServer } from '../src/server.js';

test('standalone hosted API persists streamed replies and workspace sources across repository instances', async () => {
  const client = new PGlite({ extensions: { vector } });
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
    // Each HTTP operation creates a fresh PostgreSQL repository/service. CLP
    // registries and provenance must hydrate from the same append-only events.
    const clp = async (action, input = {}) => {
      const response = await post({ action, conversation_id: id, ...input });
      const value = await response.json();
      assert.equal(response.status, 200, JSON.stringify(value));
      return value;
    };
    await clp('clp_frame_register', { name: 'claim', version: '1.0', required_fields: ['text'] });
    const sourceId = record.context_layer.events.find(event => event.kind === 'document').id;
    await clp('clp_attest', { source_event_id: sourceId, origin_uri: 'https://source.example/report' });
    const evidence = await clp('clp_record', { frame: 'claim', frame_version: '1.0', content: { text: 'Observed report' }, source_event_ids: [sourceId] });
    const claim = await clp('clp_record', { frame: 'claim', frame_version: '1.0', content: { text: 'Derived claim' }, source_event_ids: [] });
    await clp('clp_link', { from: evidence.id, to: claim.id, relation: 'supports' });
    const result = await clp('clp_query', { frame: ['claim'], filters: { keyword: 'Derived' } });
    assert.equal(result.rows[0].id, claim.id);
    assert.equal(result.explain[0].evidence.support_count, 1);
    const frames = await (await fetch(`${url}?action=clp_frames&conversation=${id}`)).json();
    assert.equal(frames[0].version, '1.0');
    assert.equal((await (await fetch(`${url}?action=clp_bundle&conversation=${id}&bundle=${claim.id}`)).json()).id, claim.id);
    await clp('clp_link', { from: evidence.id, to: claim.id, relation: 'refutes' });
    const refuted = await clp('clp_query', { frame: ['claim'], filters: { keyword: 'Derived' } });
    assert.equal(refuted.rows.length, 0);
    assert.match(refuted.telemetry.unresolved_clusters[0].reason, /refuted/);
    const bad = await post({ action: 'clp_query', conversation_id: id, frame: ['claim'], policy_view: 'effective' });
    assert.equal(bad.status, 400);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await client.close();
    if (previous === undefined) delete process.env.APP_PASSWORD; else process.env.APP_PASSWORD = previous;
  }
});
