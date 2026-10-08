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

test('projects are exact reported names that persist across updates, filter discovery and leave earlier packets unchanged', () => fixture(service => {
  const plain = service.save(request('plain'));
  assert.equal(plain.project, null);
  assert.deepEqual(Object.keys(service.get({ handoff_id: plain.handoff_id }).packet), ['title', 'summary', 'objective', 'context',
    'decisions', 'constraints', 'open_questions', 'next_steps', 'references', 'source_app', 'source_model']);
  const alpha = service.save(request('alpha-1', { title: 'Alpha', project: '  Launch  ' }));
  assert.equal(alpha.project, 'Launch');
  const update = request('alpha-2', { title: 'Alpha', summary: 'Updated.' }, { handoff_id: alpha.handoff_id, expected_revision: 1 });
  assert.equal(service.save(update).project, 'Launch');
  assert.equal(service.save(update).replayed, true);
  service.save(request('beta', { title: 'Beta', project: 'launch' }));
  const found = service.find({ project: 'Launch' });
  assert.deepEqual(found.handoffs.map(row => row.handoff_id), [alpha.handoff_id]);
  assert.deepEqual(found.projects, [{ name: 'launch', handoffs: 1 }, { name: 'Launch', handoffs: 1 }]);
  assert.equal(service.find({ project: 'Missing' }).total, 0);
  const cleared = service.save(request('alpha-3', { title: 'Alpha', summary: 'Updated.', project: '' }, { handoff_id: alpha.handoff_id, expected_revision: 2 }));
  assert.equal(cleared.project, null);
  assert.deepEqual(service.compare({ handoff_id: alpha.handoff_id, from_revision: 2 }).changes, [{ field: 'project', before: 'Launch', after: '' }]);
  assert.equal(service.get({ handoff_id: alpha.handoff_id, revision: 2 }).packet.project, 'Launch');
  assert.deepEqual(service.find().projects, [{ name: 'launch', handoffs: 1 }]);
  assert.throws(() => service.find({ project: '' }), { code: 'invalid_input' });
  assert.throws(() => service.save(request('long', { project: 'x'.repeat(121) })), { code: 'invalid_input' });
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

test('version history pages newest first and comparisons expose changed and removed binding fields', () => fixture(service => {
  const saved = service.save(request('history-1'));
  service.save(request('history-2', { constraints: ['Keep the fee under $25.'], open_questions: [], summary: 'Budget corrected.' },
    { handoff_id: saved.handoff_id, expected_revision: 1 }));
  const first = service.history({ handoff_id: saved.handoff_id, limit: 1 });
  assert.equal(first.revisions[0].revision, 2); assert.equal(first.total, 2); assert.equal(first.next_offset, 1);
  const older = service.history({ handoff_id: saved.handoff_id, limit: 1, offset: first.next_offset });
  assert.equal(older.revisions[0].sha256, saved.sha256); assert.equal(older.next_offset, null);
  assert.equal(first.revisions[0].previous_event_id, older.revisions[0].event_id);
  const diff = service.compare({ handoff_id: saved.handoff_id, from_revision: 1 });
  assert.equal(diff.to_revision, 2); assert.equal(diff.from_sha256, saved.sha256);
  assert.deepEqual(diff.changes.find(x => x.field === 'constraints'), { field: 'constraints', before: ['Keep the fee under $40.'], after: ['Keep the fee under $25.'] });
  assert.deepEqual(diff.changes.find(x => x.field === 'open_questions').after, []);
  assert.equal(diff.changes.some(x => x.field === 'decisions'), false);
  assert.equal(service.compare({ handoff_id: saved.handoff_id, from_revision: 1, to_revision: 1 }).identical, true);
  assert.throws(() => service.compare({ handoff_id: saved.handoff_id, from_revision: 3 }), { code: 'not_found' });
  assert.throws(() => service.history({ handoff_id: 'conv_absent' }), { code: 'not_found' });
  assert.throws(() => service.history({ handoff_id: saved.handoff_id, limit: 21 }), { code: 'invalid_input' });
}));

test('comparison capacity fails without clipping the original or replacement constraints', () => fixture(service => {
  const saved = service.save(request('compare-large-1', { constraints: ['A'.repeat(1900)] }));
  service.save(request('compare-large-2', { constraints: ['B'.repeat(1900)] }, { handoff_id: saved.handoff_id, expected_revision: 1 }));
  assert.throws(() => service.compare({ handoff_id: saved.handoff_id, from_revision: 1, max_characters: 2000 }), { code: 'capacity' });
  assert.equal(service.compare({ handoff_id: saved.handoff_id, from_revision: 1 }).changes[0].before[0].length, 1900);
}));
