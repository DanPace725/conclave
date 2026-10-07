import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { HandoffService } from '../src/handoffs.js';

const packet = overrides => ({ title: 'Conclave launch', summary: 'Continue the MCP handoff work.',
  objective: 'Save in one app and retrieve in another.', constraints: ['Keep the fee under $40.'],
  decisions: ['Use Conclave for storage.'], open_questions: ['Which app goes first?'], next_steps: ['Test the connector.'],
  source_app: 'ChatGPT', source_model: 'reported-model', ...overrides });
const request = (request_id, overrides = {}, extra = {}) => ({ request_id, packet: packet(overrides), ...extra });
function fixture(run) {
  const store = new Store(undefined, { memory: true });
  try { run(new HandoffService(store), store); } finally { store.close(); }
}

test('handoff saves external data without human memory, model calls, or leaking other conversations', () => fixture((service, store) => {
  const ordinary = store.create('Private ordinary conversation');
  store.append(ordinary, 'user', 'Never show this in handoff search', {}, 'human');
  const saved = service.save(request('save-1'));
  const result = service.get({ handoff_id: saved.handoff_id });
  assert.deepEqual(result.packet.constraints, ['Keep the fee under $40.']);
  assert.equal(result.provenance.authority, 'external_data');
  assert.equal(result.provenance.author_claims_verified, false);
  assert.equal(store.events(saved.handoff_id).filter(event => event.actor === 'human').length, 0);
  assert.equal(store.events(saved.handoff_id).filter(event => event.kind.includes('inference')).length, 0);
  assert.deepEqual(service.find().handoffs.map(row => row.handoff_id), [saved.handoff_id]);
  assert.throws(() => service.get({ handoff_id: ordinary }), { code: 'not_found' });
}));

test('handoff persists across SQLite restart and duplicate requests remain idempotent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'handoff-restart-'));
  let store = new Store(directory);
  const first = new HandoffService(store).save(request('durable-save'));
  store.close();
  store = new Store(directory);
  try {
    const service = new HandoffService(store), replay = service.save(request('durable-save'));
    assert.equal(replay.handoff_id, first.handoff_id);
    assert.equal(replay.replayed, true);
    assert.equal(service.find().total, 1);
    assert.equal(service.get({ title: 'Conclave launch' }).packet.objective, 'Save in one app and retrieve in another.');
    assert.throws(() => service.save(request('durable-save', { summary: 'Different content' })), { code: 'conflict' });
  } finally { store.close(); }
});

test('revision checks preserve correction lineage and an older retried update', () => fixture((service, store) => {
  const first = service.save(request('v1'));
  const input = request('v2', { constraints: ['Keep the fee under $25.'] }, { handoff_id: first.handoff_id, expected_revision: 1 });
  const second = service.save(input);
  service.save(request('v3', { summary: 'New next step' }, { handoff_id: first.handoff_id, expected_revision: 2 }));
  assert.equal(service.save(input).revision, 2);
  assert.equal(service.get({ handoff_id: first.handoff_id, revision: 1 }).packet.constraints[0], 'Keep the fee under $40.');
  assert.equal(service.get({ handoff_id: first.handoff_id }).latest_revision, 3);
  assert.throws(() => service.save(request('stale', {}, { handoff_id: first.handoff_id, expected_revision: 1 })), { code: 'conflict' });
  const events = store.events(first.handoff_id).filter(event => event.kind === 'handoff_packet');
  assert.equal(events[1].metadata.previous_event_id, first.event_id);
  assert.equal(events[2].metadata.previous_event_id, second.event_id);
}));

test('finding packets is deterministic, paginated, and ambiguous titles never select silently', () => fixture(service => {
  service.save(request('one', { summary: 'Authentication and OAuth.' }));
  service.save(request('two', { summary: 'Authentication and scopes.' }));
  const page = service.find({ query: 'Authentication', limit: 1 });
  assert.equal(page.total, 2); assert.equal(page.next_offset, 1);
  assert.notEqual(page.handoffs[0].handoff_id, service.find({ query: 'Authentication', limit: 1, offset: 1 }).handoffs[0].handoff_id);
  assert.deepEqual(service.find({ query: 'OAuth' }), service.find({ query: 'OAuth' }));
  assert.throws(() => service.get({ title: 'Conclave launch' }), { code: 'ambiguous' });
}));

test('focus keeps complete matching passages and every decision, constraint, and open question', () => fixture(service => {
  const saved = service.save(request('focused', { context: 'Storage uses SQLite.\n\nAuthentication uses OAuth with account scopes.\n\nThe interface shows a handoff ID.' }));
  const result = service.get({ handoff_id: saved.handoff_id, focus: 'OAuth' });
  assert.equal(result.packet.context, 'Authentication uses OAuth with account scopes.');
  assert.equal(result.selection.omitted_context_passages, 2);
  assert.deepEqual(result.packet.constraints, packet().constraints);
  assert.deepEqual(result.packet.decisions, packet().decisions);
  assert.deepEqual(result.packet.open_questions, packet().open_questions);
  assert.equal(service.get({ handoff_id: saved.handoff_id }).selection.complete, true);
  assert.equal(service.get({ handoff_id: saved.handoff_id, focus: 'nonmatching' }).selection.complete, true);
}));

test('capacity and invalid arguments fail before mutation or silent loss of binding text', () => fixture((service, store) => {
  const saved = service.save(request('large', { constraints: ['A'.repeat(1900), 'B'.repeat(1900)] }));
  assert.throws(() => service.get({ handoff_id: saved.handoff_id, max_characters: 2000, focus: 'unrelated' }), { code: 'capacity' });
  const before = store.list().length;
  for (const input of [request('authority', { actor: 'human' }), request('url', { references: [{ label: 'unsafe', url: 'javascript:alert(1)' }] }),
    request('credentials', { references: [{ label: 'unsafe', url: 'https://user:password@example.com/' }] }),
    request('oversize', { context: 'A'.repeat(33000) }), request('schema', { constraints: [42] }),
    request('bad-revision', {}, { expected_revision: 1 })]) assert.throws(() => service.save(input));
  assert.equal(store.list().length, before);
  assert.throws(() => service.get({ handoff_id: saved.handoff_id, title: 'Conclave launch' }));
  assert.throws(() => service.get({ handoff_id: saved.handoff_id, revision: 0 }));
}));
