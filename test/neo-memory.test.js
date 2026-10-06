import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { ConclaveService } from '../src/service.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { memoryView, commitMemory, changeMemory } from '../src/memory.js';
import { captureMemory, selectMemory, activateMemory, prepareSemanticMemory } from '../src/memory-controller.js';
import { SemanticRetrieval } from '../src/semantic-retrieval.js';
import { SQLiteEmbeddingStore } from '../src/embedding-store.js';
import { EMBEDDING_MODEL } from '../src/embeddings.js';
import { meaningfulTerms, memoryQuery, projectNamedMemory } from '../src/memory-relevance.js';
import { memoryPassages } from '../src/memory-extractor.js';
import { jevTelemetry } from '../src/jev-telemetry.js';
import { toolIngress } from '../src/ingress.js';

const discussion = 'Memory does not really "know" why a relationship was stabilized. A digital system could preserve the origin, selection rationale and applicability of each connection. Repeated user engagement should improve accessibility without manufacturing confidence, consent or factual authority. Changing conditions should flag dependencies for reconsideration, while leaving original sources available.';
const keep = { type: 'choice', choice: 'claim', confidence: .9, probabilities: { skip: .01, claim: .9, preference: .05, question: .04 } };
function fixture() {
  const store = new Store(undefined, { memory: true }), id = store.create(); let calls = 0;
  const adapter = new JevDecisionAdapter({ name: 'typesafe', respond: async payload => {
    calls++; return { model: 'jev-fixture', answers: Object.fromEntries(Object.keys(payload.questions).map(k => [k, keep])) };
  } });
  const h = new Harness(store, id, { name: 'openai', respond: async () => { throw Error('Unexpected task-model call'); } }, {
    budget: 256000, memoryModel: true, memorySelector: 'jev', decisionAdapter: adapter });
  return { store, id, h, calls: () => calls };
}
function candidate(f, content, options = {}) {
  const e = f.store.append(f.id, 'document', content, {}, 'human');
  commitMemory(f.store, f.id, [{ kind: 'claim', span_start: 0, span_end: content.length, ...options }], {
    event: e, expected_revision: memoryView(f.store, f.id).revision });
  return memoryView(f.store, f.id).records.at(-1);
}
const revisions = f => ({ expected_memory_revision: memoryView(f.store, f.id).revision, expected_state_revision: f.store.context(f.id).revision });

test('substantive human discussion with a harmless quotation reaches Jev and remains unresolved source data', async () => {
  const f = fixture(); try {
    const e = f.h.addMessage('user', discussion).event;
    await captureMemory(f.h, e);
    assert.equal(f.calls(), 1); const r = memoryView(f.store, f.id).records[0];
    assert.equal(r.content, discussion); assert.equal(r.binding, false); assert.equal(r.resolution, 'unresolved');
    assert.equal(r.retention.source_event_id, e.id); assert.equal(r.selection_source.selector, 'jev');
    assert.equal(memoryPassages({ kind: 'user', content: '"Never charge a fee."' }).length, 0);
    assert.equal(memoryView(f.store, f.id).capture.selection_calls, 1);
  } finally { f.store.close(); }
});

test('completed conceptual answers can reach Jev without research tools; acknowledgments do not dispatch', async () => {
  const f = fixture(); try {
    const user = f.h.addMessage('user', 'Explain memory accessibility.').event;
    const source = f.h.addMessage('assistant', discussion).event;
    f.store.append(f.id, 'turn_complete', '', { user_event_id: user.id, assistant_event_id: source.id });
    await captureMemory(f.h, f.h.addMessage('user', 'Thanks!').event); assert.equal(f.calls(), 0);
    f.h.memoryCalls = 0;
    await captureMemory(f.h, f.h.addMessage('user', 'Explain this connection further.').event);
    assert.equal(f.calls(), 1); assert.equal(memoryView(f.store, f.id).records[0].source_refs[0].event_id, source.id);
    const telemetry = jevTelemetry(f.store.events(f.id)); assert.equal(telemetry.summary.attempts, 1);
    assert.ok(telemetry.records.some(r => r.kind === 'memory_capture_gate'));
  } finally { f.store.close(); }
});

test('partial assistant output is never captured and current substantive human discussion takes priority', async () => {
  const f = fixture(); try {
    const source = f.h.addMessage('assistant', discussion).event; await captureMemory(f.h, source);
    assert.equal(f.calls(), 0);
    f.store.append(f.id, 'turn_complete', '', { assistant_event_id: source.id });
    const user = f.h.addMessage('user', discussion.replace('Memory', 'Relationships')).event;
    await captureMemory(f.h, user); assert.equal(f.calls(), 1);
    assert.equal(memoryView(f.store, f.id).records[0].source_refs[0].event_id, user.id);
  } finally { f.store.close(); }
});

test('meaningful word matching rejects incidental substring hits; semantic matches become bounded stubs or full text', () => {
  const f = fixture(); try {
    const rows = Array.from({ length: 8 }, (_, i) => candidate(f, `Critique ${i}: the geometric vector operator would be better with a weighted linear chord.`));
    assert.deepEqual(selectMemory(f.store, f.id, 'Yeah that would be good, thanks').memory_ids, []);
    assert.deepEqual(selectMemory(f.store, f.id, 'Embeddings and vector stores').memory_ids, []);
    const scores = new Map(rows.map(r => [r.memory_id, .35]));
    const stubbed = selectMemory(f.store, f.id, 'Semantic archive', 8000, false, scores);
    assert.equal(stubbed.records.length, 0); assert.ok(stubbed.stubs.length > 0 && stubbed.stubs.length <= 4);
    assert.ok(stubbed.stub_bytes <= 1200); assert.ok(stubbed.archived_count >= 4);
    scores.set(rows[0].memory_id, .8);
    assert.ok(selectMemory(f.store, f.id, 'Semantic archive', 8000, false, scores).memory_ids.includes(rows[0].memory_id));
    assert.equal(meaningfulTerms('be that would good thanks').size, 0);
  } finally { f.store.close(); }
});

test('acknowledgments preserve a recent substantive human query and binding dependency closure bypasses relevance', async () => {
  const f = fixture(); try {
    const related = candidate(f, 'Ecology: animals evolve protective runes.');
    f.h.addMessage('user', 'Explore ecology and evolved runes.'); f.h.addMessage('user', 'Yeah that would be good, thanks');
    assert.match(memoryQuery(f.store.events(f.id), 'Yeah that would be good, thanks'), /ecology/);
    assert.ok(selectMemory(f.store, f.id, 'Yeah that would be good, thanks').memory_ids.includes(related.memory_id));
    const e = f.h.addMessage('user', 'Never charge a fee.').event;
    commitMemory(f.store, f.id, [{ kind: 'commitment', content: e.content, span_start: 0, span_end: e.content.length, depends_on: [related.memory_id] }], { event: e, expected_revision: memoryView(f.store, f.id).revision });
    assert.equal(selectMemory(f.store, f.id, 'Unrelated hosting expenses').records.length, 2);
  } finally { f.store.close(); }
});

test('named evidence is projected under a budget without changing canonical state or operative constraints', () => {
  const f = fixture(); try {
    f.h.remember('budget', 'constraint', 'Keep spending under $400.');
    f.h.remember('ecology', 'evidence', 'Animals evolve protective runes.');
    f.h.remember('vectors', 'question', 'Explore vector retrieval and similarity thresholds.');
    const original = f.store.context(f.id), projection = projectNamedMemory(original.segments, 'Vector retrieval', new Map(), 4000);
    assert.ok(projection.segments.some(s => s.state_key === 'budget'));
    assert.ok(projection.segments.some(s => s.state_key === 'vectors'));
    assert.ok(!projection.segments.some(s => s.state_key === 'ecology'));
    assert.deepEqual(f.store.context(f.id), original);
  } finally { f.store.close(); }
});

test('engagement counts substantive human returns once, not prompt inclusion or assistant echoes', () => {
  const f = fixture(); try {
    const r = candidate(f, discussion);
    f.h.addMessage('user', discussion.replace('"know"', 'explain'));
    activateMemory(f.h, discussion); f.h.input(); f.h.input(); activateMemory(f.h, discussion);
    f.h.addMessage('assistant', discussion); activateMemory(f.h, discussion);
    assert.equal(f.store.events(f.id).filter(e => e.kind === 'memory_engagement').length, 1);
    const record = memoryView(f.store, f.id).records.find(m => m.memory_id === r.memory_id);
    assert.equal(record.authority, 'externally_reported'); assert.equal(record.binding, false);
  } finally { f.store.close(); }
});

test('named state receives persistent semantic matches and preserves them across service harnesses', async () => {
  const f = fixture(); try {
    f.h.remember('ecology', 'evidence', 'Animals evolve protective runes.');
    f.h.addMessage('user', 'Creatures carrying survival inscriptions');
    f.h.options.semanticRetrieval = new SemanticRetrieval(new SQLiteEmbeddingStore(f.store), () => ({ embed: async input => ({
      model: EMBEDDING_MODEL, vectors: input.map(() => Array(1536).fill(1)), usage: { input_tokens: 5 } }) }));
    await prepareSemanticMemory(f.h, 'Creatures carrying survival inscriptions'); activateMemory(f.h, 'Creatures carrying survival inscriptions');
    assert.ok(f.store.events(f.id).findLast(e => e.kind === 'memory_activation').metadata.named_scores.length);
    const fresh = new Harness(f.store, f.id, { name: 'openai' }, { budget: 256000 });
    assert.match(JSON.stringify(fresh.input()), /Animals evolve protective runes/);
  } finally { f.store.close(); }
});

test('saved suppression proposals require explicit current approval of the exact unchanged target set', () => {
  const f = fixture(); try {
    const r = candidate(f, 'Early critique: weighted chords are linear.');
    const targets = [{ kind: 'automatic', id: r.memory_id }];
    f.h.toolResult('propose_memory_suppression', { ...revisions(f), key: 'cleanup', targets });
    const unrelated = f.h.addMessage('user', 'Continue discussing memory.').event;
    assert.throws(() => f.h.toolResult('suppress_memory', { ...revisions(f), source_event_id: unrelated.id, proposal_key: 'cleanup', targets }), /exact saved proposal/);
    const yes = f.h.addMessage('user', 'Suppress the memories in cleanup.').event;
    f.h.toolResult('suppress_memory', { ...revisions(f), source_event_id: yes.id, proposal_key: 'cleanup', targets });
    assert.equal(memoryView(f.store, f.id).records[0].lifecycle, 'suppressed');
    const text = f.h.toolResult('read_memory', { offset: 0, expected_memory_revision: null, expected_state_revision: null }).content;
    assert.doesNotMatch(text, /weighted chords/);
    assert.equal(memoryView(f.store, f.id).suppression_proposals[0].applied, true);
  } finally { f.store.close(); }
});

test('single-memory retrieval keeps exact paged content and rejects stale revisions and suppressed entries', () => {
  const f = fixture(); try {
    const r = candidate(f, 'Detailed ecology evidence. '.repeat(200));
    const args = { ...revisions(f), kind: 'automatic', id: r.memory_id, offset: 0 };
    const read = f.h.toolResult('retrieve_memory', args); assert.match(read.content, /Detailed ecology/);
    assert.equal(toolIngress('retrieve_memory', read, 'receipt').changed, false);
    candidate(f, 'Another unrelated record.'); assert.throws(() => f.h.toolResult('retrieve_memory', args), /revision changed/);
    changeMemory(f.store, f.id, r.memory_id, 'suppress', memoryView(f.store, f.id).revision);
    assert.throws(() => f.h.toolResult('retrieve_memory', { ...args, ...revisions(f) }), /unavailable/);
  } finally { f.store.close(); }
});

test('approval cannot authorize a proposal replaced after the human reviewed it or a changed target', () => {
  const f = fixture(); try {
    const r = candidate(f, 'Original critique to review.');
    const targets = [{ kind: 'automatic', id: r.memory_id }];
    f.h.toolResult('propose_memory_suppression', { ...revisions(f), key: 'cleanup', targets });
    const human = f.h.addMessage('user', 'Suppress the memories in cleanup.').event;
    f.h.toolResult('propose_memory_suppression', { ...revisions(f), key: 'cleanup', targets });
    assert.throws(() => f.h.toolResult('suppress_memory', { ...revisions(f), source_event_id: human.id, proposal_key: 'cleanup', targets }), /exact saved proposal/);
    const next = f.h.addMessage('user', 'Suppress the memories in cleanup.').event;
    f.store.append(f.id, 'memory_delta', '', { changes: [{ memory_id: r.memory_id, depends_on: ['new-dependency'] }] });
    assert.throws(() => f.h.toolResult('suppress_memory', { ...revisions(f), source_event_id: next.id, proposal_key: 'cleanup', targets }), /target changed/);
    assert.equal(memoryView(f.store, f.id).records[0].lifecycle, 'candidate');
  } finally { f.store.close(); }
});

test('direct capture bounds native selection to two calls and reports unassessed complete passages', async () => {
  const f = fixture(); try {
    const source = f.h.addMessage('assistant', Array.from({ length: 40 }, (_, i) => `Finding ${i}: preserve the complete source conditions and uncertainty.`).join('\n\n')).event;
    f.store.append(f.id, 'turn_complete', '', { assistant_event_id: source.id });
    await captureMemory(f.h, source);
    assert.equal(f.calls(), 2); assert.ok(memoryView(f.store, f.id).capture.deferred_passage_ids.length > 0);
  } finally { f.store.close(); }
});

test('manual proposal approval uses the same exact target checks and makes no inference calls', async () => {
  const f = fixture(); try {
    const r = candidate(f, 'Obsolete early critique.');
    const proposal = f.h.toolResult('propose_memory_suppression', { ...revisions(f), key: 'cleanup', targets: [{ kind: 'automatic', id: r.memory_id }] });
    const service = new ConclaveService(f.store, { embeddingEnabled: false });
    await service.approveMemorySuppression(f.id, { proposal_key: 'cleanup', proposal_event_id: proposal.proposal_event_id,
      expected_revision: f.store.context(f.id).revision, expected_memory_revision: memoryView(f.store, f.id).revision });
    assert.equal(memoryView(f.store, f.id).records[0].lifecycle, 'suppressed'); assert.equal(f.calls(), 0);
  } finally { f.store.close(); }
});
