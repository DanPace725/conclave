import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { ConclaveService } from '../src/service.js';
import { downloadRecord } from '../src/context-repository.js';

test('canonical downloads decode history once, reuse inspection and release their cache', () => {
  const store = new Store(undefined, { memory: true });
  try {
    const service = new ConclaveService(store, { availability: () => ({ openai: true, jev: false }),
      providerFactory: () => { throw Error('Export must not call a provider'); } });
    const id = store.create('Long audit');
    const h = service.harness(id);
    h.addMessage('user', 'Keep the full source.');
    store.append(id, 'inference_request', 'answer', { provider: 'openai', payload: { model: 'fixture', input: [{ role: 'user', content: 'café 🌱 '.repeat(10000) }] } });
    const original = store.events(id);
    let inspections = 0, decodes = 0;
    const view = service.view.bind(service), events = store.events.bind(store);
    service.view = cid => { inspections++; return view(cid); };
    store.events = cid => { if (!store.readCache?.has(cid)) decodes++; return events(cid); };
    const record = downloadRecord(service, id);
    assert.equal(inspections, 1);
    assert.equal(decodes, 1);
    assert.deepEqual(record.context_layer.events, original);
    assert.equal(record.context_layer.snapshots.length, record.context_layer.context.revision);
    assert.equal(record.context_layer.model_input.next.encoding, 'o200k_base');
    assert.equal(store.readCache, null);
    h.addMessage('user', 'A later source.');
    assert.equal(service.export(id).events.at(-2).content, 'A later source.');
    service.view = () => { throw Error('Inspection failed'); };
    assert.throws(() => downloadRecord(service, id), /Inspection failed/);
    assert.equal(store.readCache, null, 'failed export must not retain stale reads');
  } finally { store.close(); }
});

test('local chat resumes from SQLite and exports complete sources, revisions, state and provider receipts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-service-'));
  let store = new Store(directory);
  try {
    let calls = 0;
    const options = { availability: () => ({ openai: true, jev: false }), providerFactory: () => ({ name: 'openai', respond: async (payload) => {
      calls++;
      assert.equal(payload.model, 'fixture');
      assert.match(JSON.stringify(payload.input), /document detail/);
      return { status: 'completed', id: 'response-fixture', model: 'fixture-reported', usage: { input_tokens: 101, output_tokens: 12 },
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'A completed local answer.' }] }] };
    } }) };
    let service = new ConclaveService(store, options);
    const conversation = service.create('Local test').conversation_id;
    const request = { message_id: 'msg_test', content: 'Use the attached note.', settings: { model: 'fixture', reasoning: 'low', jev: false },
      attachments: [{ attachment_id: 'att_test', name: 'note.md', content: 'Original document detail with café 🌱 and ``` fences.' }] };
    const answered = await service.ask(conversation, request);
    assert.equal(answered.messages.length, 2);
    assert.equal(answered.messages[1].reply_to, 'msg_test');
    assert.equal(answered.messages[1].usage.input_tokens, 101);
    assert.equal(answered.attachments[0].content, request.attachments[0].content);
    await service.ask(conversation, request);
    assert.equal(calls, 1, 'repeated completed request must not invoke the provider');
    await assert.rejects(service.ask(conversation, { ...request, content: 'Changed message.' }), /different request/);
    await service.remember(conversation, { key: 'budget.total', type: 'constraint', content: 'User budget is $500.' });
    const exported = service.export(conversation);
    assert.equal(exported.snapshots.length, exported.context.revision);
    const sources = new Set(exported.events.map((e) => e.id));
    for (const snapshot of exported.snapshots) {
      assert.ok(sources.has(snapshot.receipt_id));
      for (const item of snapshot.segments) assert.ok(item.source_event_ids.every((id) => sources.has(id)));
    }
    assert.equal(exported.state.entries[0].state_key, 'budget.total');
    assert.equal(exported.metrics.calls, 1);
    const beforeWatch = store.events(conversation).length;
    const garden = service.activity(conversation);
    assert.equal(garden.context.revision, exported.context.revision);
    assert.equal(garden.history.count, 4);
    const textBytes = (items) => items.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8'), 0);
    assert.equal(garden.history.text_bytes, textBytes(exported.events.filter((e) => ['user','assistant','document'].includes(e.kind))));
    assert.equal(garden.context.text_bytes, textBytes(exported.context.segments));
    assert.ok(garden.history.items.every((item) => sources.has(item.id)));
    assert.ok(garden.context.segments.every((item) => !('content' in item)));
    assert.deepEqual(service.activity(conversation, { after: garden.cursor }).events, []);
    const replay = service.activity(conversation, { replay: true });
    assert.equal(replay.initial_context.revision, 0);
    assert.equal(replay.initial_history.count, 0);
    assert.equal(replay.initial_history.text_bytes, 0);
    assert.equal(replay.initial_context.text_bytes, 0);
    for (const frame of replay.events.filter((item) => item.context)) {
      assert.equal(frame.context.revision, exported.snapshots.find((s) => s.receipt_id === frame.id).revision);
      assert.ok(frame.history.items.every((item) => item.seq <= frame.seq));
      assert.equal(frame.history.text_bytes, textBytes(exported.events.filter((e) => e.seq <= frame.seq && ['user','assistant','document'].includes(e.kind))), 'replay savings must exclude future source text');
    }
    assert.equal(store.events(conversation).length, beforeWatch, 'watch and replay must not write audit events');
    assert.equal(calls, 1, 'watch and replay must not invoke the provider');
    assert.throws(() => service.activity(conversation, { after: -1 }), /Invalid activity cursor/);
    assert.equal(JSON.parse(readFileSync(join(directory, conversation, 'converse-export.json'))).context.revision, exported.context.revision);
    store.close();
    store = new Store(directory);
    service = new ConclaveService(store, options);
    assert.equal(service.view(conversation).messages[1].content, 'A completed local answer.');
    assert.deepEqual(service.export(conversation).events, exported.events);
    assert.equal(calls, 1);
    await service.ask(conversation, { ...request, message_id: 'msg_attachment_only', content: '',
      attachments: [{ attachment_id: 'att_only', name: 'only.md', content: 'Attachment-only document detail.' }] });
    assert.equal(service.export(conversation).events.find((e) => e.metadata.client_message_id === 'msg_attachment_only').content, '',
      'attachment-only messages must not invent human-authored prompt text');
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('failed and concurrent requests preserve auditable history without duplicate inference', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-service-failure-'));
  const store = new Store(directory);
  try {
    let release, started;
    const wait = new Promise((resolve) => { release = resolve; });
    const providerStarted = new Promise((resolve) => { started = resolve; });
    const service = new ConclaveService(store, { providerFactory: () => ({ name: 'openai', respond: async () => {
      started();
      await wait;
      throw Error('Fixture provider unavailable');
    } }) });
    const conversation = service.create().conversation_id;
    const request = { message_id: 'msg_failed', content: 'Retain this source.', settings: { model: 'fixture', jev: false } };
    const first = service.ask(conversation, request);
    await providerStarted;
    const pending = service.activity(conversation);
    assert.equal(pending.busy, true);
    assert.equal(pending.latest.kind, 'inference_request');
    assert.ok(!JSON.stringify(pending).includes('max_output_tokens'), 'the feed must not expose inference payloads');
    await assert.rejects(service.ask(conversation, request), (error) => error.status === 409);
    release();
    await assert.rejects(first, /Fixture provider unavailable/);
    await assert.rejects(service.ask(conversation, request), /already saved/);
    const exported = service.export(conversation);
    assert.equal(exported.events.filter((e) => e.kind === 'user').length, 1);
    assert.equal(exported.events.filter((e) => e.kind === 'turn_failure').length, 1);
    assert.equal(exported.metrics.calls, 1);
    assert.equal(service.view(conversation).messages[0].answer_failed, true);
    const finished = service.activity(conversation, { after: pending.cursor });
    assert.equal(finished.busy, false);
    assert.equal(finished.latest.kind, 'turn_failure');
    assert.ok(finished.events.every((event) => event.seq > pending.cursor));
    assert.equal(JSON.parse(readFileSync(join(directory, conversation, 'converse-export.json'))).metrics.failures, 1);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});
