import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { ConclaveService } from '../src/service.js';
import { ContextRepository } from '../src/context-repository.js';
import { memoryView, commitMemory, changeMemory } from '../src/memory.js';
import { captureMemory, selectMemory } from '../src/memory-controller.js';
import { extractExplicit } from '../src/memory-extractor.js';
import { requestBreakdown } from '../src/request-comparison.js';

const reply = text => ({ status: 'completed', model: 'fixture', usage: { input_tokens: 10, output_tokens: 5 },
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
const provider = { name: 'openai', respond: async () => reply('Saved.') };
function fixture(options = {}) {
  const store = new Store(undefined, { memory: true });
  const id = store.create('Memory fixture');
  const h = new Harness(store, id, provider, { budget: 64000, freezeProjection: true, ...options });
  return { store, id, h };
}
const user = (h, text, metadata = {}) => h.addMessage('user', text, {}, metadata).event;
const capture = async (h, text, metadata) => { const event = user(h, text, metadata); await captureMemory(h, event); return event; };
const records = (s, id) => memoryView(s, id).records;

test('exact budgets, decimals, clearance conditions and negative boundaries survive eviction, restart and a model switch', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'memory-restart-'));
  let s = new Store(dir);
  try {
    const id = s.create(); const h = new Harness(s, id, provider, { budget: 64000, recent: 1 });
    await h.ask('Keep it below $500.50. Only use staff with clearance if children attend. Never charge a fee.');
    assert.equal(records(s, id).length, 3);
    const originalRevision = s.context(id).revision;
    for (let n = 0; n < 5; n++) h.addMessage('assistant', 'Historical planning detail. '.repeat(40));
    h.addMessage('user', 'Write the final plan.');
    const old = s.context(id).segments.filter(r => r.type === 'user').slice(0, 1);
    h.edit({ expected_revision: s.context(id).revision, remove_ids: old.map(r => r.id), additions: [] });
    s.restore(id, originalRevision);
    const memory = memoryView(s, id); s.close(); s = new Store(dir);
    assert.deepEqual(memoryView(s, id), memory);
    const claude = new Harness(s, id, { name: 'anthropic' }, { model: 'claude-fixture', budget: 64000 });
    const payload = claude.answerPayload();
    const block = payload.input.find(i => i.content.startsWith('Conversation memory:'));
    assert.match(block.content, /\$500.50/); assert.match(block.content, /clearance if children attend/); assert.match(block.content, /Never charge/);
    assert.ok(requestBreakdown(payload, claude.provider).parts.some(p => p.key === 'memory' && p.items.some(i => i.kind === 'memory')));
  } finally { s.close(); rmSync(dir, { recursive: true }); }
});

test('tentative, quoted, document, assistant and explicit user decisions have distinct authority; incomplete output is rejected', async () => {
  const { store: s, id, h } = fixture();
  try {
    await capture(h, 'Maybe $500.');
    await capture(h, 'The article says "Keep it below $900."');
    await capture(h, "The article says 'Some text. Never charge a fee.'");
    await capture(h, 'Keep it below $700.');
    assert.equal(records(s, id).length, 2);
    assert.equal(records(s, id)[0].authority, 'user_reported'); assert.equal(records(s, id)[0].resolution, 'unresolved');
    assert.equal(records(s, id)[1].authority, 'user_committed');
    const doc = s.append(id, 'document', 'Keep it below $100.', {}, 'human');
    assert.throws(() => commitMemory(s, id, [{ kind: 'commitment', span_start: 0, span_end: doc.content.length }], { event: doc, expected_revision: 2 }), /binding/);
    const assistant = h.addMessage('assistant', 'Use $900.').event;
    assert.throws(() => commitMemory(s, id, [{ kind: 'claim', span_start: 0, span_end: assistant.content.length }], { event: assistant, expected_revision: 2 }), /Incomplete/);
    s.append(id, 'turn_complete', '', { assistant_event_id: assistant.id });
    commitMemory(s, id, [{ kind: 'claim', span_start: 0, span_end: assistant.content.length }], { event: assistant, expected_revision: 2 });
    assert.equal(records(s, id).at(-1).authority, 'model_proposed');
    assert.equal(records(s, id).at(-1).confidence, null);
    const conditional = user(h, 'Keep it below $500 only if fees apply.');
    assert.throws(() => commitMemory(s, id, [{ kind: 'commitment', span_start: 0, span_end: 18 }], { event: conditional, expected_revision: 3 }), /binding/);
  } finally { s.close(); }
});

test('correction supersedes immediately; retries are idempotent and context restore cannot revive the old head', async () => {
  const { store: s, id, h } = fixture();
  try {
    const first = await capture(h, 'Keep it below $500.'); const revision = s.context(id).revision;
    const next = await capture(h, 'Correction: keep it below $700.');
    const before = memoryView(s, id); await captureMemory(h, next);
    assert.deepEqual(memoryView(s, id), before);
    assert.equal(before.records[0].lifecycle, 'superseded');
    assert.deepEqual(before.records[1].supersedes, [before.records[0].memory_id]);
    s.restore(id, revision);
    assert.doesNotMatch(JSON.stringify(h.input()), /Keep it below \$500/);
    assert.match(JSON.stringify(h.input()), /keep it below \$700/);
    assert.equal(s.source(id, first.id).content, 'Keep it below $500.');
    assert.throws(() => commitMemory(s, id, extractExplicit(next), { event: next, expected_revision: 0 }), /Stale memory/);
    const other = s.create();
    assert.throws(() => commitMemory(s, other, extractExplicit(next), { event: next, expected_revision: 0 }), /Unknown source/);
  } finally { s.close(); }
});

test('exact repeated commitments remain one head; correction retires every repeated source without gaining support', async () => {
  const { store: s, id, h } = fixture();
  try {
    await capture(h, 'Keep it below $500.'); await capture(h, 'Keep it below $500.');
    assert.equal(records(s, id).length, 1); assert.equal(records(s, id)[0].source_refs.length, 2);
    assert.equal(records(s, id)[0].origin_groups.length, 1); assert.equal(records(s, id)[0].confidence, null);
    await capture(h, 'Correction: keep it below $700.');
    assert.equal(selectMemory(s, id, '').records.length, 1);
    assert.doesNotMatch(JSON.stringify(h.input()), /500/);
  } finally { s.close(); }
});

test('unresolved competing quantities and ambiguous corrections carry both passages and never silently merge units/conditions', async () => {
  const { store: s, id, h } = fixture();
  try {
    await capture(h, 'Keep it below $500 if children attend.');
    await capture(h, 'Keep it below $700 if children attend.');
    assert.ok(records(s, id).every(r => r.resolution === 'contested'));
    await capture(h, 'Keep it below 500 euros if adults attend.');
    assert.equal(records(s, id)[2].resolution, 'reported');
    await capture(h, 'Actually, the limit should be 800.');
    const selected = selectMemory(s, id, 'Continue the plan.').records;
    assert.ok(selected.some(r => r.content === 'Actually, the limit should be 800.'));
    assert.equal(selected.filter(r => r.binding).length, 3);
    assert.ok(selected.filter(r => r.binding).every(r => r.resolution === 'contested'));
  } finally { s.close(); }
});

test('suppression blocks source lookup and derived context; restoration rechecks eligibility after a source edit', async () => {
  const { store: s, id, h } = fixture();
  try {
    const event = await capture(h, 'Keep it below $500.'); const r = records(s, id)[0];
    const current = s.context(id);
    h.edit({ expected_revision: current.revision, remove_ids: [], additions: [{ content: 'Derived budget $500', source_event_ids: [event.id], type: 'summary', status: 'active' }] });
    changeMemory(s, id, r.memory_id, 'suppress', 1);
    assert.doesNotMatch(JSON.stringify(h.input()), /500/);
    assert.equal(s.searchChunks(id, '500').length, 0);
    assert.throws(() => h.toolResult('retrieve_event', { event_id: event.id, offset: 0 }), /suppressed/);
    await capture(h, 'Keep it below $700.', { revises_event_id: event.id });
    changeMemory(s, id, r.memory_id, 'restore', memoryView(s, id).revision);
    assert.equal(records(s, id)[0].lifecycle, 'invalidated');
    assert.equal(selectMemory(s, id, 'budget').records.length, 1);
  } finally { s.close(); }
});

test('file version/removal invalidates dependent copies transitively, without changing source history', () => {
  const { store: s, id, h } = fixture();
  try {
    const doc = s.append(id, 'document', 'Limit 500 USD.', { workspace_path: 'budget.md' }, 'human');
    commitMemory(s, id, [{ kind: 'claim', span_start: 0, span_end: doc.content.length }], { event: doc, expected_revision: 0 });
    const a = records(s, id)[0]; const event = user(h, 'Budget report from file.');
    commitMemory(s, id, [{ kind: 'claim', span_start: 0, span_end: event.content.length, depends_on: [a.memory_id] }], { event, expected_revision: 1 });
    const selected = selectMemory(s, id, 'Budget report from file.').records;
    assert.equal(selected.length, 2, 'Selecting a derived report carries its source dependency even without a lexical match');
    assert.ok(selected.some(r => r.content === doc.content));
    s.append(id, 'document', 'Limit 700 USD.', { workspace_path: 'budget.md' }, 'human');
    assert.ok(records(s, id).every(r => r.lifecycle === 'invalidated'));
    assert.equal(selectMemory(s, id, 'budget').records.length, 0);
    assert.equal(s.source(id, doc.id).content, 'Limit 500 USD.');
  } finally { s.close(); }
});

test('model state writer cannot replace user budget with arithmetic or promote a recommendation', async () => {
  const { store: s, id, h } = fixture();
  try {
    const source = await capture(h, 'Keep it below $500.');
    const assistant = h.addMessage('assistant', 'The budget is $900.').event;
    const update = { key: 'budget', type: 'constraint', content: 'The budget is $900.', source_event_ids: [source.id, assistant.id], status: 'active', supersedes: [], conflicts_with: [], supports: [], limitations: [] };
    assert.throws(() => h.toolResult('update_state', { expected_revision: s.context(id).revision, updates: [update] }), /exact source wording/);
    h.toolResult('update_state', { expected_revision: s.context(id).revision, updates: [{ ...update, key: 'recommendation', type: 'decision', source_event_ids: [assistant.id] }] });
    assert.equal(s.context(id).segments.find(r => r.state_key === 'recommendation').status, 'unresolved');
    assert.equal(records(s, id)[0].content, source.content);
    const quoted = user(h, 'The article says "Keep it below $900."');
    h.toolResult('update_state', { expected_revision: s.context(id).revision, updates: [{ ...update, key: 'quoted', content: 'Keep it below $900.', source_event_ids: [quoted.id] }] });
    assert.equal(s.context(id).segments.find(r => r.state_key === 'quoted').status, 'unresolved', 'Quoted imperatives cannot bypass the ledger gate through named state');
  } finally { s.close(); }
});

test('binding overflow is explicit while inspection stays usable; a frozen tool projection holds its memory selection', async () => {
  const { store: s, id, h } = fixture();
  try {
    await capture(h, 'Keep it below $500.');
    h.prepareAnswer(); const frozen = structuredClone(h.frozenInput);
    await capture(h, 'Correction: keep it below $700.');
    assert.deepEqual(h.frozenInput, frozen);
    assert.match(JSON.stringify(h.answerPayload()), /500/);
    h.refreshProjection('safe boundary', false); assert.match(JSON.stringify(h.answerPayload()), /700/);
    assert.throws(() => selectMemory(s, id, '', 10), /Binding memory capacity exceeded/);
    assert.match(selectMemory(s, id, '', 10, true).capacity_error, /capacity/);
    const inspect = new ConclaveService(s, { providerFactory: () => provider });
    assert.equal(inspect.view(id).memory.records.length, 2);
  } finally { s.close(); }
});

test('bounded model capture records usage/failure, persists source first, rejects unsupported promotions and does not execute tools', async () => {
  const { store: s, id, h } = fixture({ memoryModel: true });
  try {
    const flushes = []; s.flush = async () => flushes.push(s.events(id).at(-1).kind);
    let seen = 0;
    h.provider = { name: 'openai', respond: async payload => {
      seen++; assert.equal(payload.max_output_tokens, 600); assert.equal(payload.tools, undefined);
      const source = JSON.parse(payload.input[0].content).content;
      return reply(JSON.stringify({ records: [{ kind: 'claim', span_start: 0, span_end: source.length }] }));
    } };
    await capture(h, 'For this budget, perhaps $500 is sensible.');
    assert.equal(seen, 1); assert.ok(flushes.length >= 3);
    assert.equal(records(s, id)[0].authority, 'user_reported'); assert.equal(records(s, id)[0].binding, false);
    assert.ok(s.events(id).some(e => e.kind === 'inference_request' && e.content === 'memory-extraction'));
    changeMemory(s, id, records(s, id)[0].memory_id, 'suppress', memoryView(s, id).revision);
    h.provider.respond = async payload => {
      assert.equal(JSON.parse(payload.input[0].content).related_heads.length, 0, 'Suppressed heads must also be excluded from the extraction model');
      return reply(JSON.stringify({ records: [{ kind: 'commitment', span_start: 0, span_end: 5 }] }));
    };
    h.memoryCalls = 0; // A new authorized turn has its own allowance.
    await capture(h, 'Another tentative budget perhaps.');
    assert.equal(memoryView(s, id).capture.status, 'failed'); assert.equal(records(s, id).length, 1);
    assert.ok(s.events(id).some(e => e.kind === 'user' && e.content === 'Another tentative budget perhaps.'));
  } finally { s.close(); }
});

test('Agent captures before answering, preserves objective scope, and Stop aborts memory inference', async () => {
  const s = new Store(undefined, { memory: true });
  const controller = new AbortController(); let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const service = new ConclaveService(s, { memoryModel: true, availability: () => ({ openai: true }), providerFactory: () => ({ name: 'openai', respond: async (_payload, { signal }) => {
    entered(); await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); return reply('Unexpected');
  } }) });
  try {
    const id = service.create('Stop capture').conversation_id;
    const start = await service.agentStart(id, { message_id: 'memory_agent', content: 'For this budget, perhaps 500 is sensible.', settings: { model: 'fixture', jev: false } });
    const running = service.agentStep(id, { run_id: start.agent.run_id, expected_step: 0 }, { signal: controller.signal });
    await started; controller.abort(Error('Stopped')); await running;
    assert.equal(service.view(id).agent.status, 'stopped'); assert.equal(records(s, id).length, 0);
    assert.equal(s.events(id).filter(e => e.kind === 'inference_request' && e.content === 'answer').length, 0);
    const fast = new ConclaveService(s, { providerFactory: () => provider, availability: () => ({ openai: true }) });
    const next = await fast.agentStart(id, { message_id: 'memory_agent2', content: 'Keep it below $500.', settings: { model: 'fixture', jev: false } });
    await fast.agentStep(id, { run_id: next.agent.run_id, expected_step: 0 });
    assert.equal(records(s, id)[0].scope.objective_id, s.events(id).findLast(e => e.kind === 'user').id);
    await fast.ask(id, { message_id: 'new_topic', content: 'An unrelated new topic.', settings: { model: 'fixture', jev: false } });
    assert.equal(selectMemory(s, id, 'budget').records.length, 0);
  } finally { s.close(); }
});

test('a failed capture retries on subsequent Context activity within one paid-call allowance', async () => {
  const { store: s, id, h } = fixture({ memoryModel: true });
  let memoryCalls = 0, answerCalls = 0;
  h.provider = { name: 'openai', respond: async payload => {
    if (payload.text?.format?.name === 'memory_candidates') {
      memoryCalls++;
      if (memoryCalls === 1) return reply('{malformed');
      const content = JSON.parse(payload.input[0].content).content;
      return reply(JSON.stringify({ records: [{ kind: 'claim', span_start: 0, span_end: content.length }] }));
    }
    answerCalls++; return reply('Completed');
  } };
  try {
    await h.ask('Perhaps the budget is $500.');
    assert.equal(memoryView(s, id).capture.status, 'failed');
    await h.ask('Continue with that plan.');
    assert.equal(memoryCalls, 2); assert.equal(answerCalls, 2);
    assert.equal(records(s, id).length, 1); assert.equal(records(s, id)[0].binding, false);
    assert.equal(s.events(id).filter(e => e.kind === 'memory_capture' && e.metadata.status === 'failed').length, 1);
  } finally { s.close(); }
});

test('PostgreSQL ledger survives fresh repository instances, user edits, suppression, stale fences and export', async () => {
  const client = new PGlite();
  try {
    for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) await client.exec(readFileSync(join('drizzle', file), 'utf8'));
    const db = drizzle(client, { schema });
    const options = { serviceOptions: { providerFactory: () => provider, availability: () => ({ openai: true }) } };
    const repository = () => new ContextRepository(db, options);
    const id = (await repository().create('Hosted memory')).conversation_id;
    await repository().run(id, true, service => service.ask(id, { message_id: 'hosted_memory', content: 'Keep it below $500.', settings: { model: 'fixture', jev: false } }));
    let view = await repository().run(id, false, service => service.view(id));
    const r = view.memory.records[0]; assert.equal(r.content, 'Keep it below $500.');
    await repository().run(id, true, service => service.saveMemory(id, { memory_id: r.memory_id, expected_memory_revision: view.memory.revision, content: 'Keep it below $700.', kind: 'commitment' }));
    await assert.rejects(repository().run(id, true, service => service.memoryLifecycle(id, { memory_id: r.memory_id, expected_memory_revision: 1, operation: 'suppress' })), /changed|Stale/);
    view = await repository().run(id, false, service => service.view(id));
    assert.equal(view.memory.records[0].lifecycle, 'superseded'); assert.equal(view.memory.records[1].content, 'Keep it below $700.');
    await repository().run(id, true, service => service.memoryLifecycle(id, { memory_id: view.memory.records[1].memory_id, expected_memory_revision: view.memory.revision, operation: 'suppress' }));
    const exported = await repository().run(id, false, service => service.export(id));
    assert.equal(exported.memory.records[1].lifecycle, 'suppressed');
    assert.ok(exported.events.some(e => e.kind === 'memory_delta'));
    assert.equal(exported.model_input.next.memory_capacity_error, undefined);
  } finally { await client.close(); }
});
