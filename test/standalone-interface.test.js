import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { ConclaveService } from '../src/service.js';
import { serviceCommand } from '../src/service-cli.js';
import { startServer } from '../src/server.js';

const provider = { name: 'openai', respond: async () => ({ status: 'completed', model: 'fixture',
  usage: { input_tokens: 20, output_tokens: 5 }, output: [{ type: 'message',
    content: [{ type: 'output_text', text: 'Task complete.' }] }] }) };

test('standalone service CLI checkpoints an agent, resumes from a fresh store, and exposes saved files', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'conclave-cli-'));
  let store = new Store(folder);
  try {
    const options = { providerFactory: () => provider, availability: () => ({ openai: true }) };
    let service = new ConclaveService(store, options);
    const id = service.create('Standalone run').conversation_id;
    await service.uploadDocument(id, { name: 'notes.md', content: 'Source text to preserve.' });
    const command = args => serviceCommand([...args, '--conversation', id], { service, write: () => {} });
    const started = await command(['agent-start', 'Inspect notes and finish.', '--no-jev']);
    assert.equal(started.agent.status, 'running');
    store.close(); store = new Store(folder); service = new ConclaveService(store, options);
    const finished = await command(['agent-step']);
    assert.equal(finished.agent.status, 'completed');
    assert.equal(finished.agent.steps, 1);
    assert.equal((await command(['workspace-read', 'notes.md'])).content, 'Source text to preserve.');
    assert.equal((await command(['workspace-list'])).length, 1);
    assert.ok((await command(['audit'])).records.length);
  } finally { store.close(); rmSync(folder, { recursive: true }); }
});

test('standalone HTTP server runs the shared authenticated API with a supplied service', async () => {
  const store = new Store(undefined, { memory: true });
  const previous = process.env.APP_PASSWORD;
  process.env.APP_PASSWORD = 'standalone-fixture';
  let server;
  try {
    const service = new ConclaveService(store, { providerFactory: () => provider });
    server = await startServer({ port: 0, service });
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(url + '/api/conclave?action=status')).status, 401);
    const unlocked = await fetch(url + '/api/session', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'standalone-fixture' }) });
    assert.equal(unlocked.status, 200);
    const cookie = unlocked.headers.get('set-cookie').split(';')[0];
    const headers = { 'content-type': 'application/json', cookie };
    const created = await (await fetch(url + '/api/conclave', { method: 'POST', headers,
      body: JSON.stringify({ action: 'create', title: 'Standalone HTTP' }) })).json();
    const uploaded = await fetch(url + '/api/conclave', { method: 'POST', headers, body: JSON.stringify({
      action: 'document_upload', conversation_id: created.conversation_id, name: 'source.txt', content: 'Exact source',
    }) });
    assert.equal(uploaded.status, 200);
    const viewed = await (await fetch(url + `/api/conclave?conversation=${created.conversation_id}`, { headers })).json();
    assert.equal(viewed.workspace[0].content, 'Exact source');
    const clp = async (action, input) => {
      const response = await fetch(url + '/api/conclave', { method: 'POST', headers, body: JSON.stringify({
        action, conversation_id: created.conversation_id, ...input,
      }) });
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      return result;
    };
    await clp('clp_frame_register', { name: 'claim', version: '1.0', required_fields: ['text'] });
    await clp('clp_attest', { source_event_id: viewed.workspace[0].source_event_id, origin_uri: 'https://local.example/report' });
    const bundle = await clp('clp_record', { frame: 'claim', frame_version: '1.0', content: { text: 'Exact source claim' }, source_event_ids: [viewed.workspace[0].source_event_id] });
    assert.equal((await clp('clp_query', { frame: ['claim'] })).rows[0].id, bundle.id);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    store.close();
    if (previous === undefined) delete process.env.APP_PASSWORD; else process.env.APP_PASSWORD = previous;
  }
});
