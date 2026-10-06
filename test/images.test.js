import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { ConclaveService } from '../src/service.js';
import { validateImage, eligibleImages, materializeImages } from '../src/images.js';
import { anthropicPayload, AnthropicProvider, OpenAIProvider } from '../src/provider.js';
import { inputSize } from '../src/input-size.js';
import { requestBreakdown } from '../src/request-comparison.js';
import { retrievalCatalog } from '../src/semantic-retrieval.js';
import { ContextRepository, downloadRecord } from '../src/context-repository.js';
import { startServer } from '../src/server.js';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
const image = (id = 'att_image') => ({ attachment_id: id, name: 'pixel.png', mime_type: 'image/png', data: png });
const settings = { model: 'fixture', jev: false };
const answer = { status: 'completed', model: 'fixture', usage: { input_tokens: 10, output_tokens: 2 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: 'Image received.' }] }] };
const pixels = payload => payload.input.flatMap(i => Array.isArray(i.content) ? i.content.filter(p => p.type === 'input_image') : []);
const fixture = (store, respond) => new ConclaveService(store, { memoryModel: false,
  availability: () => ({ openai: true, anthropic: true, jev: false }), providerFactory: name => ({ name, respond }) });

test('image ingress verifies format, canonical bytes, dimensions and limits', () => {
  const valid = validateImage(image());
  assert.equal(valid.width, 1); assert.equal(valid.height, 1); assert.equal(valid.sha256.length, 64);
  assert.throws(() => validateImage({ ...image(), mime_type: 'image/svg+xml' }), /JPEG or PNG/);
  assert.throws(() => validateImage({ ...image(), name: 'pixel.jpg' }), /must match/);
  assert.throws(() => validateImage({ ...image(), data: Buffer.from('<script>').toString('base64') }), /Invalid PNG/);
  assert.throws(() => validateImage({ ...image(), data: png + '=' }), /Invalid|JPEG or PNG/);
  const huge = Buffer.from(png, 'base64'); huge.writeUInt32BE(2049, 16);
  assert.throws(() => validateImage({ ...image(), data: huge.toString('base64') }), /dimensions/);
  assert.throws(() => validateImage({ ...image(), data: 'A'.repeat(700000) }), /512 KB/);
});

test('native OpenAI and Claude requests receive pixels while accounting excludes their encoding', async () => {
  const payload = { model: 'fixture', instructions: 'Read the image.', max_output_tokens: 1024,
    input: [{ role: 'user', content: [{ type: 'input_text', text: 'What do you see?' }, { type: 'input_image', image_url: 'data:image/png;base64,' + png }] }] };
  for (const Provider of [OpenAIProvider, AnthropicProvider]) {
    let wire;
    const provider = new Provider({ apiKey: 'fixture-key', fetchImpl: async (_url, options) => {
      wire = JSON.parse(options.body);
      return new Response(JSON.stringify(Provider === AnthropicProvider ? { content: [{ type: 'text', text: 'Seen.' }], stop_reason: 'end_turn', usage: { input_tokens: 20, output_tokens: 1 } } : answer), { status: 200 });
    } });
    await provider.respond(payload);
    if (Provider === AnthropicProvider) assert.deepEqual(wire.messages[0].content.find(p => p.type === 'image').source, { type: 'base64', media_type: 'image/png', data: png });
    else assert.equal(wire.input[0].content[1].image_url, payload.input[0].content[1].image_url);
    const count = inputSize(payload, provider);
    assert.equal(count.image_count, 1); assert.equal(count.estimated_tokens, count.tokenizer_tokens + 4096);
    assert.match(count.scope, /uncalibrated/);
    const breakdown = requestBreakdown(payload, provider);
    assert.equal(breakdown.parts.find(p => p.key === 'images').tokens, 4096);
  }
  assert.equal(inputSize(payload, { name: 'openai' }).tokenizer_tokens,
    inputSize({ ...payload, input: [{ ...payload.input[0], content: [payload.input[0].content[0], { type: 'input_image', image_url: 'data:image/png;base64,' + 'A'.repeat(300000) }] }] }, { name: 'openai' }).tokenizer_tokens);
});

test('Context preserves image sources across restart and follow-ups without repeating base64 in audits', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-images-')); let store = new Store(directory);
  let calls = 0;
  const respond = async payload => { calls++; assert.equal(pixels(payload)[0].image_url, 'data:image/png;base64,' + png); return answer; };
  try {
    let service = fixture(store, respond), id = service.create('Saved image').conversation_id;
    const view = await service.ask(id, { message_id: 'msg_image', content: 'Describe the image.', attachments: [image()], settings });
    const source = view.attachments[0].source_event_id;
    assert.equal(view.attachments[0].data, undefined); assert.equal(service.sourceEvent(id, source).metadata.image_data, undefined);
    assert.equal(service.imageFile(id, source).data, png);
    assert.equal(JSON.stringify(service.transcript(id)).includes(png), false);
    assert.ok(retrievalCatalog(store, id).items.every(item => !item.content.includes(png)));
    const canonical = downloadRecord(service, id);
    assert.equal(canonical.context_layer.events.find(e => e.kind === 'image').metadata.image_data, png);
    assert.equal(canonical.context_layer.events.filter(e => JSON.stringify(e).includes(png)).length, 1);
    store.close(); store = new Store(directory); service = fixture(store, respond);
    await service.ask(id, { message_id: 'msg_followup', content: 'Look at the image again.', settings });
    assert.equal(calls, 2);
    assert.ok(store.events(id).filter(e => e.kind === 'inference_request').every(e => JSON.stringify(e).includes('conclave-image:') && !JSON.stringify(e).includes(png)));
    assert.equal(JSON.stringify(service.activity(id)).includes(png), false);
    assert.throws(() => service.imageFile(service.create().conversation_id, source), /not found/);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('view_image switches older pixels through a fresh signed Claude continuation', async () => {
  const store = new Store(undefined, { memory: true });
  try {
    let older, phase = 0;
    const service = fixture(store, async payload => {
      if (phase++ < 2) return answer;
      if (phase === 3) return { ...answer, output: [
        { type: 'reasoning', anthropic_content: { type: 'thinking', thinking: 'Read earlier pixels.', signature: 'signed-fixture' } },
        { type: 'function_call', call_id: 'call_image', name: 'view_image', arguments: JSON.stringify({ event_id: older }) },
      ] };
      assert.equal(pixels(payload).length, 1);
      assert.equal(JSON.stringify(payload).includes('signed-fixture'), false);
      assert.ok(JSON.stringify(anthropicPayload(payload)).includes(png));
      return answer;
    });
    const id = service.create().conversation_id;
    const first = await service.ask(id, { message_id: 'msg_one', content: 'First image.', attachments: [image('att_one')], settings }); older = first.attachments[0].source_event_id;
    await service.ask(id, { message_id: 'msg_two', content: 'Second image.', attachments: [image('att_two')], settings });
    await service.ask(id, { message_id: 'msg_older', content: 'Revisit the first image.', settings: { provider: 'anthropic', model: 'claude-fixture', jev: false } });
    const last = store.events(id).findLast(e => e.kind === 'inference_request');
    assert.equal(pixels(last.metadata.payload)[0].image_url, 'conclave-image:' + older);
    assert.equal(phase, 4);
    await service.ask(id, { message_id: 'msg_older_followup', content: 'And its top corner?', settings });
    assert.equal(pixels(store.events(id).findLast(e => e.kind === 'inference_request').metadata.payload)[0].image_url, 'conclave-image:' + older);
  } finally { store.close(); }
});

test('revised and removed images stay in history but cannot re-enter model requests', async () => {
  const store = new Store(undefined, { memory: true });
  try {
    const service = fixture(store, async () => answer), id = service.create().conversation_id;
    const first = await service.ask(id, { message_id: 'msg_one', content: 'Original.', attachments: [image('att_one')], settings });
    const original = first.attachments[0];
    const revised = await service.ask(id, { message_id: 'msg_revision', revises_message_id: 'msg_one', content: 'Corrected question.', attachments: [{ ...original, attachment_id: 'att_copy' }], settings });
    const copy = revised.attachments.find(a => a.attachment_id === 'att_copy');
    assert.deepEqual(eligibleImages(store, id).map(e => e.id), [copy.source_event_id]);
    assert.ok(retrievalCatalog(store, id).excluded.has(original.source_event_id));
    assert.throws(() => materializeImages({ input: [{ content: [{ type: 'input_image', image_url: 'conclave-image:' + original.source_event_id }] }] }, store, id), /revised/);
    await service.changeDocument(id, { operation: 'remove', source_event_id: copy.source_event_id, expected_source_event_id: copy.source_event_id });
    assert.equal(eligibleImages(store, id).length, 0); assert.throws(() => service.imageFile(id, copy.source_event_id), /unavailable/);
    assert.equal(store.events(id).filter(e => e.kind === 'image').length, 2);
    const third = await service.ask(id, { message_id: 'msg_replace', content: 'A fresh image.', attachments: [image('att_replace')], settings });
    await service.ask(id, { message_id: 'msg_no_image', revises_message_id: 'msg_replace', content: 'Text instead.', settings });
    assert.equal(eligibleImages(store, id).length, 0);
    assert.equal(pixels(store.events(id).findLast(e => e.kind === 'inference_request').metadata.payload).length, 0);
    assert.ok(third.attachments.some(a => a.attachment_id === 'att_replace'));
  } finally { store.close(); }
});

test('Agent resumes saved image projections in a fresh service and stops without losing sources', async () => {
  const store = new Store(undefined, { memory: true }); let count = 0;
  const respond = async payload => {
    assert.equal(pixels(payload)[0].image_url, 'data:image/png;base64,' + png);
    return count++ === 0 ? { ...answer, output: [{ type: 'function_call', call_id: 'calc_image', name: 'calculate', arguments: '{"expression":"2+2"}' }] } : answer;
  };
  try {
    let service = fixture(store, respond), id = service.create().conversation_id;
    let view = await service.agentStart(id, { message_id: 'msg_agent', content: 'Inspect this image.', attachments: [image()], settings, limits: { max_steps: 5 } });
    view = await service.agentStep(id, { run_id: view.agent.run_id, expected_step: 0 });
    assert.equal(view.agent.status, 'running'); assert.equal(view.agent.steps, 1);
    assert.ok(store.events(id).filter(e => e.kind === 'agent_projection' || e.kind === 'agent_checkpoint').every(e => !JSON.stringify(e).includes(png)));
    service = fixture(store, respond);
    view = await service.agentStep(id, { run_id: view.agent.run_id, expected_step: 1 });
    assert.equal(view.agent.status, 'completed'); assert.equal(count, 2);
    view = await service.agentStart(id, { message_id: 'msg_stop', content: 'Continue with this image.', settings, limits: { max_steps: 5 } });
    view = await service.agentStop(id, { run_id: view.agent.run_id });
    assert.equal(view.agent.status, 'stopped'); assert.equal(service.imageFile(id, view.attachments[0].source_event_id).data, png);
  } finally { store.close(); }
});

test('hosted images survive fresh HTTP repositories and load without transcript pixel transfer', async () => {
  const client = new PGlite({ extensions: { vector } }); let server;
  const previous = process.env.APP_PASSWORD; delete process.env.APP_PASSWORD;
  try {
    const migrations = new URL('../drizzle/', import.meta.url);
    for (const file of readdirSync(migrations).filter(n => n.endsWith('.sql')).sort()) for (const statement of readFileSync(new URL(file, migrations), 'utf8').split('--> statement-breakpoint')) if (statement.trim()) await client.exec(statement);
    server = await startServer({ port: 0, database: () => drizzle(client, { schema }), serviceOptions: {
      memoryModel: false, availability: () => ({ openai: true, jev: false }), providerFactory: () => ({ name: 'openai', respond: async payload => { assert.equal(pixels(payload)[0].image_url, 'data:image/png;base64,' + png); return answer; } }) } });
    const url = `http://127.0.0.1:${server.address().port}/api/conclave`;
    const post = async body => { const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const result = await res.json(); assert.ok(res.ok, JSON.stringify(result)); return result; };
    const id = (await post({ action: 'create' })).conversation_id;
    const view = await post({ action: 'ask', conversation_id: id, message_id: 'msg_hosted_image', content: 'Inspect pixels.', attachments: [image()], settings });
    const source = view.attachments[0].source_event_id, imageURL = `${url}?action=image&conversation=${id}&event=${source}`;
    const res = await fetch(imageURL); assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await res.arrayBuffer()).toString('base64'), png);
    try { await new ContextRepository(drizzle(client, { schema })).transcript(id); } catch (error) { throw Error(error.cause?.message || error.message); }
    const tr = await fetch(`${url}?action=transcript&conversation=${id}`); const transcript = await tr.json(); assert.ok(tr.ok, JSON.stringify(transcript));
    assert.equal(transcript.attachments[0].source_event_id, source); assert.equal(JSON.stringify(transcript).includes(png), false);
    await post({ action: 'ask', conversation_id: id, message_id: 'msg_hosted_followup', content: 'Inspect again.', settings });
    const other = (await post({ action: 'create' })).conversation_id;
    assert.equal((await fetch(`${url}?action=image&conversation=${other}&event=${source}`)).status, 404);
    process.env.APP_PASSWORD = 'fixture-password'; assert.equal((await fetch(imageURL)).status, 401); delete process.env.APP_PASSWORD;
    await post({ action: 'document_lifecycle', conversation_id: id, operation: 'remove', source_event_id: source, expected_source_event_id: source });
    assert.equal((await fetch(imageURL)).status, 404);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve)); await client.close();
    if (previous === undefined) delete process.env.APP_PASSWORD; else process.env.APP_PASSWORD = previous;
  }
});
