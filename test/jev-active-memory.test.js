import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { ConclaveService } from '../src/service.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { captureMemory } from '../src/memory-controller.js';
import { memoryView } from '../src/memory.js';
import { jevTelemetry } from '../src/jev-telemetry.js';

const typed = probabilities => ({ type: 'choice', choice: Object.keys(probabilities).sort((a,b) => probabilities[b]-probabilities[a])[0], confidence: Math.max(...Object.values(probabilities)), probabilities });
const keep = typed({ skip: .02, preference: .1, claim: .8, question: .08 });
const skip = typed({ skip: .9, preference: .03, claim: .04, question: .03 });
const unsure = typed({ skip: .5, preference: .1, claim: .3, question: .1 });
const native = text => ({ status: 'completed', model: 'task-fixture', usage: { input_tokens: 20, output_tokens: 10 }, output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
function fixture(options = {}) {
  const store = new Store(undefined, { memory: true }), id = store.create(); let taskCalls = 0;
  const provider = { name: 'openai', respond: async () => { taskCalls++; return native('{"records":[{"passage_id":2,"kind":"question"}]}'); } };
  const adapter = new JevDecisionAdapter({ name: 'typesafe', respond: async payload => ({ model: 'jev-fixture', answers: Object.fromEntries(Object.entries(payload.questions).map(([key, q]) => [key, q.instructions.candidate.passage.startsWith('Finding') ? keep : q.instructions.candidate.passage.startsWith('Uncertain') ? unsure : skip])) }) });
  const h = new Harness(store, id, provider, { memoryModel: true, memorySelector: 'jev', decisionAdapter: adapter, budget: 64000, ...options });
  const research = () => { h.memoryCalls = 0; const event = h.addMessage('assistant', 'Finding: trial enrolled 120 adults, conditional on funding.\n\nUncertain finding.\n\nOpen question?').event; store.append(id, 'turn_complete', '', { assistant_event_id: event.id }); return event; };
  return { store, id, h, research, taskCalls: () => taskCalls };
}

test('active Jev commits its choices with exact unresolved authority and leaves uncertainty for review without task calls', async () => {
  const f = fixture(); try {
    const event = f.research(); await captureMemory(f.h, event);
    const view = memoryView(f.store, f.id);
    assert.equal(f.taskCalls(), 0); assert.equal(view.records.length, 1);
    const r = view.records[0]; assert.equal(r.content, event.content.split('\n\n')[0]); assert.equal(r.binding, false); assert.equal(r.authority, 'model_proposed'); assert.equal(r.resolution, 'unresolved'); assert.equal(r.selection_source.selector, 'jev'); assert.equal(r.extraction_model, 'jev-fixture');
    assert.deepEqual(view.capture.deferred_passage_ids, [1]); assert.equal(view.capture.selection_calls, 1);
    assert.equal(f.store.event(f.id, event.id).content, event.content);
    assert.equal(f.store.events(f.id).filter(e => ['memory_shadow', 'memory_comparison'].includes(e.kind)).length, 0);
    const audit = jevTelemetry(f.store.events(f.id)); assert.equal(audit.summary.memory_jev_applied, 1); assert.equal(audit.summary.memory_hybrid_applied, 0);
    assert.match(audit.records.find(r => r.kind === 'memory_selection_applied').outcome, /Jev candidates committed/);
  } finally { f.store.close(); }
});

test('optional reverse comparison records task-model disagreement without changing Jev memory', async () => {
  const f = fixture({ memoryComparison: true }); try {
    await captureMemory(f.h, f.research());
    assert.equal(f.taskCalls(), 1); assert.equal(memoryView(f.store, f.id).records.length, 1);
    assert.match(memoryView(f.store, f.id).records[0].content, /^Finding/);
    const e = f.store.events(f.id).findLast(e => e.kind === 'memory_comparison');
    assert.equal(e.metadata.applied, false); assert.equal(e.metadata.active_selector, 'jev');
    assert.deepEqual(e.metadata.comparison.first_only, [0]); assert.deepEqual(e.metadata.comparison.second_only, [2]);
    assert.equal(f.store.events(f.id).filter(e => e.kind === 'inference_request' && e.content === 'memory-extraction').length, 0);
    assert.equal(f.store.events(f.id).filter(e => e.kind === 'inference_request' && e.content === 'memory-comparison').length, 1);
    assert.equal(jevTelemetry(f.store.events(f.id)).summary.memory_comparisons, 1);
  } finally { f.store.close(); }
});

test('failed comparison preserves the applied capture; failed or unavailable Jev never calls the task model', async () => {
  const f = fixture({ memoryComparison: true }); try {
    f.h.provider.respond = async () => { throw Error('OpenAI 503'); };
    await captureMemory(f.h, f.research());
    assert.equal(memoryView(f.store, f.id).capture.status, 'completed'); assert.equal(memoryView(f.store, f.id).records.length, 1); assert.equal(jevTelemetry(f.store.events(f.id)).summary.memory_comparison_failures, 1);
    f.h.options.memoryComparison = false; f.h.decisionAdapter.provider.respond = async () => { throw Error('TypeSafe 503'); };
    await captureMemory(f.h, f.research());
    assert.equal(memoryView(f.store, f.id).capture.status, 'failed'); assert.equal(memoryView(f.store, f.id).records.length, 1); assert.equal(f.taskCalls(), 0);
    f.h.decisionAdapter = null;
    await captureMemory(f.h, f.research());
    assert.equal(memoryView(f.store, f.id).capture.retry_disposition, 'configuration-change-required'); assert.equal(memoryView(f.store, f.id).capture.paid_extraction, false); assert.equal(memoryView(f.store, f.id).capture.selection_calls, 0);
  } finally { f.store.close(); }
});

test('explicit human corrections still work with Jev unavailable and make no model calls', async () => {
  const f = fixture({ decisionAdapter: null }); try {
    const first = f.h.addMessage('user', 'Keep the budget below $900.').event; await captureMemory(f.h, first);
    const second = f.h.addMessage('user', 'Correction: keep the budget below $700.').event; await captureMemory(f.h, second);
    const rows = memoryView(f.store, f.id).records; assert.equal(rows[0].lifecycle, 'superseded'); assert.equal(rows[1].binding, true); assert.equal(f.taskCalls(), 0);
    assert.equal(memoryView(f.store, f.id).capture.selection_calls, 0);
  } finally { f.store.close(); }
});

test('Stop aborts active Jev capture before committing any candidates', async () => {
  const controller = new AbortController(), f = fixture({ signal: controller.signal }); let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  f.h.decisionAdapter.provider.respond = async (_payload, { signal }) => { entered(); return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); };
  try {
    const run = captureMemory(f.h, f.research()); await ready; controller.abort(Error('Stopped active Jev'));
    await assert.rejects(run, /Stopped/); assert.equal(memoryView(f.store, f.id).records.length, 0); assert.equal(f.taskCalls(), 0);
  } finally { f.store.close(); }
});

test('service defaults and Agent steps use active Jev with comparison disabled', async () => {
  const store = new Store(undefined, { memory: true });
  const service = new ConclaveService(store, { memoryModel: true, embeddingEnabled: false,
    availability: () => ({ openai: true, jev: true }), providerFactory: () => ({ name: 'openai', respond: async () => native('Done.') }),
    decisionFactory: () => new JevDecisionAdapter({ name: 'typesafe', respond: async payload => ({ model: 'jev-fixture', usage: { input_tokens: 5, output_tokens: 0 }, answers: Object.fromEntries(Object.keys(payload.questions).map(key => [key, keep])) }) }) });
  try {
    assert.equal(service.memorySelector, 'jev'); assert.equal(service.memoryComparison, false);
    const id = service.create('Active Jev').conversation_id;
    await service.ask(id, { message_id: 'context_memory', content: 'Budget preference: perhaps $600.', settings: { model: 'fixture', jev: true } });
    assert.equal(memoryView(store, id).records[0].selection_source.selector, 'jev');
    const agent = await service.agentStart(id, { message_id: 'agent_memory', content: 'Budget preference: perhaps $500.', settings: { model: 'fixture', jev: true } });
    await service.agentStep(id, { run_id: agent.agent.run_id, expected_step: 0 });
    assert.equal(memoryView(store, id).records.at(-1).selection_source.selector, 'jev');
    assert.equal(memoryView(store, id).records.at(-1).scope.objective_id, store.events(id).findLast(e => e.kind === 'user').id);
    assert.equal(store.events(id).filter(e => e.kind === 'inference_request' && ['memory-extraction', 'memory-comparison'].includes(e.content)).length, 0);
  } finally { store.close(); }
});
