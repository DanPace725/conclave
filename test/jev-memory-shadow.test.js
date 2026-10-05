import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { captureMemory } from '../src/memory-controller.js';
import { memoryView } from '../src/memory.js';
import { memoryPassages, parseExtraction } from '../src/memory-extractor.js';
import { scoreSelections, compareSelections, labelItems } from '../src/memory-evaluation.js';
import { jevTelemetry } from '../src/jev-telemetry.js';

const reply = text => ({ status: 'completed', model: 'fixture', usage: { input_tokens: 10, output_tokens: 5 },
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
const kinds = ['skip', 'preference', 'claim', 'question'];
const answer = (choice, confidence = 0.9) => ({ type: 'choice', choice, confidence,
  probabilities: Object.fromEntries(kinds.map(k => [k, k === choice ? confidence : (1 - confidence) / 3])) });
// Fake Jev: choose by the passage's first word; record each payload.
const byPrefix = text => answer(text.startsWith('Finding') ? 'claim' : text.startsWith('Open') ? 'question' : 'skip');
function jevFake(choose = byPrefix) {
  const payloads = [];
  return { payloads, provider: { name: 'typesafe', respond: async payload => {
    payloads.push(payload);
    return { status: 'completed', model: 'jev-fixture', usage: { input_tokens: 50, output_tokens: 0 },
      answers: Object.fromEntries(Object.entries(payload.questions).map(([key, q]) => [key, choose(q.instructions.candidate.passage)])) };
  } } };
}
const wrap = choose => text => { const c = choose(text); return typeof c === 'string' ? answer(c) : c; };
const passages = texts => texts.map((content, passage_id) => ({ passage_id, content }));

test('Jev memory selection judges whole paragraphs, batches on the byte guard and keeps cross-passage rules in code', async () => {
  const fake = jevFake();
  const adapter = new JevDecisionAdapter(fake.provider, { budget: 3000 });
  const long = 'Finding: ' + 'detail '.repeat(150);
  const input = passages([long, 'Thanks for asking.', 'Open: should we include rural sites?', 'x'.repeat(4000),
    ...Array.from({ length: 10 }, (_, i) => `Finding ${i}: measured value ${i}.`)]);
  const invoke = (payload, purpose, limits) => { assert.equal(purpose, 'memory-selection'); return limits.provider.respond(payload); };
  const result = await adapter.selectMemory(input, { source_kind: 'assistant', related: [{ content: 'Finding 3: measured value 3.' }] }, invoke);
  assert.ok(fake.payloads.length >= 2, 'batches split on the byte guard');
  for (const p of fake.payloads) assert.ok(Buffer.byteLength(JSON.stringify(p)) <= 3000 && Object.keys(p.questions).length <= 12);
  const sent = fake.payloads.flatMap(p => Object.values(p.questions).map(q => q.instructions.candidate.passage));
  assert.ok(sent.includes(long), 'paragraphs are never truncated');
  assert.deepEqual(result.oversized, [3]);
  assert.ok(result.decisions.find(d => d.passage_id === 7).duplicate, 'saved memory is not proposed twice');
  assert.equal(result.records.length, 8, 'at most 8 selections');
  assert.ok(result.records.every((r, i, a) => !i || a[i - 1].passage_id < r.passage_id));
  assert.ok(!result.records.some(r => r.passage_id === 1 || r.passage_id === 7));
  assert.equal(result.calls.length, fake.payloads.length);

  const unsure = jevFake(wrap(text => text.startsWith('Open') ? answer('question', 0.4) : 'claim'));
  const hesitant = await new JevDecisionAdapter(unsure.provider).selectMemory(passages(['Finding A.', 'Open B?']), {}, (p, _, l) => l.provider.respond(p));
  assert.deepEqual(hesitant.records, [{ passage_id: 0, kind: 'claim' }]);
  assert.equal(hesitant.decisions[1].uncertain, true, 'uncertain answers are left for a fallback, not saved');

  const broken = { name: 'typesafe', respond: async () => ({ answers: { passage_0: answer('claim') } }) };
  await assert.rejects(new JevDecisionAdapter(broken).selectMemory(passages(['A.', 'B.']), {}, (p, _, l) => l.provider.respond(p)), /coverage/);
});

function fixture(options = {}) {
  const store = new Store(undefined, { memory: true });
  const id = store.create('Memory shadow');
  const fake = jevFake();
  const h = new Harness(store, id, { name: 'openai', respond: async () => reply(JSON.stringify({ records: [{ kind: 'claim', passage_id: 0 }] })) },
    { budget: 64000, freezeProjection: true, memoryModel: true, decisionAdapter: new JevDecisionAdapter(fake.provider), ...options });
  return { store, id, h, fake };
}
const research = h => {
  const event = h.addMessage('assistant', 'Finding: trial A enrolled 120 adults.\n\nThanks for reading.\n\nOpen: does the effect hold for children?').event;
  h.store.append(h.conversation, 'turn_complete', '', { assistant_event_id: event.id });
  return event;
};

test('memory capture records a Jev shadow beside the task-model selection without committing it', async () => {
  const { store: s, id, h, fake } = fixture();
  try {
    const event = research(h);
    await captureMemory(h, event);
    const view = memoryView(s, id);
    assert.equal(view.capture.status, 'completed');
    assert.equal(view.records.length, 1, 'only the task-model selection is committed');
    const shadow = s.events(id).findLast(e => e.kind === 'memory_shadow').metadata;
    assert.equal(shadow.applied, false); assert.equal(shadow.source_event_id, event.id);
    assert.deepEqual(shadow.llm.records, [{ passage_id: 0, kind: 'claim' }]);
    assert.deepEqual(shadow.jev.records, [{ passage_id: 0, kind: 'claim' }, { passage_id: 2, kind: 'question' }]);
    assert.deepEqual(shadow.comparison.second_only, [2]); assert.equal(shadow.comparison.kind_matches, 1);
    assert.equal(fake.payloads.length, 1);
    assert.ok(s.events(id).some(e => e.kind === 'inference_request' && e.content === 'memory-selection' && e.metadata.provider === 'typesafe'));
    const telemetry = jevTelemetry(s.events(id));
    assert.equal(telemetry.summary.memory_shadows, 1); assert.equal(telemetry.summary.memory_shadow_mean_jaccard, 0.5);
    assert.match(telemetry.records.find(r => r.kind === 'memory_shadow').outcome, /not applied/);
  } finally { s.close(); }
});

test('Jev shadow failures are recorded and never change capture; the shadow can be disabled', async () => {
  const failing = fixture();
  failing.h.decisionAdapter = new JevDecisionAdapter({ name: 'typesafe', respond: async () => { throw Error('TypeSafe 503: request failed'); } });
  try {
    await captureMemory(failing.h, research(failing.h));
    assert.equal(memoryView(failing.store, failing.id).capture.status, 'completed');
    assert.equal(memoryView(failing.store, failing.id).records.length, 1);
    const shadow = failing.store.events(failing.id).findLast(e => e.kind === 'memory_shadow').metadata;
    assert.equal(shadow.jev, null); assert.match(shadow.error, /503/);
  } finally { failing.store.close(); }

  const llmFails = fixture();
  llmFails.h.provider = { name: 'openai', respond: async () => reply('{malformed') };
  try {
    await captureMemory(llmFails.h, research(llmFails.h));
    assert.equal(memoryView(llmFails.store, llmFails.id).capture.status, 'failed');
    const shadow = llmFails.store.events(llmFails.id).findLast(e => e.kind === 'memory_shadow').metadata;
    assert.equal(shadow.llm.records, null); assert.ok(shadow.llm.error); assert.equal(shadow.jev.records.length, 2);
    assert.equal(shadow.comparison, null);
  } finally { llmFails.store.close(); }

  const off = fixture({ memoryShadow: false });
  try {
    await captureMemory(off.h, research(off.h));
    assert.equal(off.fake.payloads.length, 0);
    assert.ok(!off.store.events(off.id).some(e => e.kind === 'memory_shadow'));
  } finally { off.store.close(); }
});

test('labeled scoring separates misses, false positives, optional passages, kinds and failed events', () => {
  const items = [
    { event_id: 'a', passages: [{ passage_id: 0, label: 'claim' }, { passage_id: 1, label: 'skip' }, { passage_id: 2, label: 'optional' },
      { passage_id: 3, label: 'question' }, { passage_id: 4, label: null }] },
    { event_id: 'b', passages: [{ passage_id: 0, label: 'keep' }] },
    { event_id: 'c', passages: [{ passage_id: 0, label: 'claim' }] },
  ];
  const score = scoreSelections(items, { a: [{ passage_id: 0, kind: 'question' }, { passage_id: 1, kind: 'claim' }, { passage_id: 2, kind: 'claim' }],
    b: [{ passage_id: 0, kind: 'preference' }], c: null });
  assert.equal(score.events, 2); assert.equal(score.failed_events, 1);
  assert.equal(score.true_positive, 2); assert.equal(score.false_positive, 1); assert.equal(score.false_negative, 1);
  assert.equal(score.optional_selected, 1); assert.equal(score.unlabeled_passages, 1);
  assert.equal(score.precision, 2 / 3); assert.equal(score.recall, 2 / 3);
  assert.equal(score.kind_graded, 1); assert.equal(score.kind_accuracy, 0);
  assert.deepEqual(score.misses, [{ event_id: 'a', passage_id: 3, label: 'question' }]);
  assert.deepEqual(compareSelections([{ passage_id: 0, kind: 'claim' }], [{ passage_id: 0, kind: 'claim' }, { passage_id: 1, kind: 'question' }]),
    { both: 1, first_only: [], second_only: [1], kind_matches: 1, jaccard: 0.5 });

  const events = [{ id: 'u', kind: 'user', actor: 'human', content: 'First.\n\nSecond.', metadata: {} },
    { id: 'm', kind: 'user', actor: 'human', content: 'Manual.', metadata: { purpose: 'manual-note' } },
    { id: 'x', kind: 'assistant', actor: 'openai', content: 'Unfinished.', metadata: {} },
    { id: 'y', kind: 'assistant', actor: 'openai', content: 'Done.', metadata: {} },
    { id: 't', kind: 'turn_complete', actor: 'system', content: '', metadata: { assistant_event_id: 'y' } }];
  const prepared = labelItems(events, memoryPassages);
  assert.deepEqual(prepared.map(i => i.event_id), ['u', 'y']);
  assert.deepEqual(prepared[0].passages.map(p => p.content), ['First.', 'Second.']);
  assert.ok(prepared.every(i => i.passages.every(p => p.label === null)));
  assert.throws(() => parseExtraction(JSON.stringify({ records: [{ kind: 'commitment', passage_id: 0 }] }), [{}]), /schema/);
  assert.deepEqual(parseExtraction(JSON.stringify({ records: [{ kind: 'claim', passage_id: 0 }, { kind: 'claim', passage_id: 0 }, { kind: 'claim', passage_id: 9 }] }), [{}]),
    { records: [{ passage_id: 0, kind: 'claim' }], invalid: 2 });
});
