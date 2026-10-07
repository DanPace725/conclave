import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { ConclaveService } from '../src/service.js';
import { captureMemory } from '../src/memory-controller.js';
import { memoryView } from '../src/memory.js';
import { SELECTOR_MODELS, selectorProvider } from '../src/selector-fallback.js';

const native = (text, model) => ({ status: 'completed', model, usage: { input_tokens: 20, output_tokens: 10 },
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
function fixture(provider, options = {}) {
  const store = new Store(undefined, { memory: true }), calls = [];
  const service = new ConclaveService(store, { memoryModel: true, embeddingEnabled: false,
    availability: () => ({ [provider]: true, jev: false }),
    decisionFactory: () => assert.fail('No Jev credential'),
    providerFactory: name => {
      assert.equal(name, provider, 'Never try another provider or its credentials');
      return { name, respond: async payload => {
        calls.push(payload);
        const input = JSON.parse(payload.input[0].content.startsWith('{') ? payload.input[0].content : '{}');
        const text = payload.text?.format?.name === 'memory_candidates'
          ? JSON.stringify({ records: [{ passage_id: input.passages[0].passage_id, kind: 'preference' }] })
          : payload.text?.format?.name === 'bounded_attention'
            ? JSON.stringify({ decisions: input.candidates.map(c => ({ bundle_id: c.bundle_id, action: 'retain', priority: 2, reason: 'Uncertain' })) })
            : 'Done.';
        return native(text, payload.model);
      } };
    }, ...options });
  const id = service.create('No Jev key').conversation_id;
  return { store, service, id, calls, settings: { provider, model: provider === 'anthropic' ? 'claude-large-fixture' : 'gpt-large-fixture', jev: false } };
}

for (const provider of Object.keys(SELECTOR_MODELS)) {
  test(`${provider}: Context and Agent capture exact candidates with the small model and account provider`, async () => {
    const f = fixture(provider);
    try {
      await f.service.ask(f.id, { message_id: 'context', content: 'Budget preference: perhaps $600.', settings: f.settings });
      const r = memoryView(f.store, f.id).records[0];
      assert.equal(r.content, 'Budget preference: perhaps $600.');
      assert.equal(r.binding, false); assert.equal(r.resolution, 'unresolved');
      assert.equal(r.selection_source.selector, 'model-fallback');
      assert.equal(r.selection_source.provider, provider); assert.equal(r.extraction_model, SELECTOR_MODELS[provider]);
      const agent = await f.service.agentStart(f.id, { message_id: 'agent', content: 'Budget preference: perhaps $500.', settings: f.settings });
      await f.service.agentStep(f.id, { run_id: agent.agent.run_id, expected_step: 0 });
      const a = memoryView(f.store, f.id).records.at(-1);
      assert.equal(a.content, 'Budget preference: perhaps $500.');
      assert.equal(a.extraction_model, SELECTOR_MODELS[provider]);
      assert.equal(a.scope.objective_id, f.store.events(f.id).findLast(e => e.kind === 'user').id);
      assert.ok(f.calls.some(p => p.model === f.settings.model), 'Answer keeps the selected model');
      assert.ok(f.calls.filter(p => p.text?.format?.name === 'memory_candidates').every(p => p.model === SELECTOR_MODELS[provider]));
      assert.equal(f.store.events(f.id).filter(e => e.kind === 'memory_selection').length, 0, 'No false Jev call');
      assert.equal(f.service.status().selector_fallback[provider].available, true);
      const run = f.service.view(f.id).agent;
      assert.ok(run.input_tokens >= 40, 'Agent totals include answer and memory selector usage');
    } finally { f.store.close(); }
  });

  test(`${provider}: attention fallback respects protection and preserves context on invalid output`, async () => {
    const f = fixture(provider);
    try {
      const h = f.service.harness(f.id, { ...f.settings, recent: 1 }, true);
      h.addMessage('user', 'Routine note. '.repeat(120)); h.pin('Keep this caveat verbatim.'); h.addMessage('user', 'Current request.');
      const before = f.store.context(f.id);
      assert.equal((await h.selectionPlan('current request', [], true)).selection_source, 'bounded-model');
      const call = f.calls.at(-1); assert.equal(call.model, SELECTOR_MODELS[provider]); assert.equal(call.max_output_tokens, 600);
      h.decisionAdapter.provider.respond = async () => native('{"decisions":[]}', SELECTOR_MODELS[provider]);
      assert.equal((await h.selectionPlan('another review', [], true)).selection_source, 'deterministic-fallback');
      assert.deepEqual(f.store.context(f.id), before);
    } finally { f.store.close(); }
  });

  test(`${provider}: stopping an Agent aborts an in-flight fallback and admits no partial memory`, async () => {
    let entered, cancelled = false;
    const ready = new Promise(resolve => entered = resolve);
    const f = fixture(provider, { providerFactory: name => ({ name, respond: async (payload, { signal }) => {
      assert.equal(payload.model, SELECTOR_MODELS[provider]);
      entered();
      return new Promise((_, reject) => signal.addEventListener('abort', () => { cancelled = true; reject(signal.reason); }, { once: true }));
    } }) });
    try {
      const started = await f.service.agentStart(f.id, { message_id: 'stopped', content: 'Budget preference: perhaps $500.', settings: f.settings });
      const running = f.service.agentStep(f.id, { run_id: started.agent.run_id, expected_step: 0 });
      await ready;
      await f.service.agentStop(f.id, { run_id: started.agent.run_id });
      await running;
      assert.equal(cancelled, true); assert.equal(f.service.view(f.id).agent.status, 'stopped');
      assert.equal(memoryView(f.store, f.id).records.length, 0);
    } finally { f.store.close(); }
  });
}

test('task-model opt-in and an available Jev retain their existing selectors', () => {
  const f = fixture('openai', { memorySelector: 'task-model' });
  try {
    const options = f.service.selectionOptions(f.settings);
    assert.equal(options.memorySelector, 'task-model'); assert.equal(options.memoryFallback, undefined);
    const jev = { provider: { name: 'typesafe' } };
    f.service.availability = () => ({ openai: true, jev: true }); f.service.decisionFactory = () => jev;
    assert.equal(f.service.selectionOptions({ ...f.settings, jev: true }).decisionAdapter, jev);
    assert.equal(f.service.selectionOptions(f.settings).decisionAdapter, null);
    f.service.availability = () => ({ openai: false, anthropic: true, jev: false });
    assert.equal(f.service.selectionOptions(f.settings).decisionAdapter, null);
  } finally { f.store.close(); }
});

test('fallback failures retain exact sources and deterministic commitments', async () => {
  const f = fixture('anthropic', { providerFactory: name => ({ name, respond: async () => { throw Error('Anthropic 401'); } }) });
  try {
    const h = f.service.harness(f.id, f.settings, true);
    await captureMemory(h, h.addMessage('user', 'Keep it below $500.').event);
    const event = h.addMessage('user', 'Budget preference: perhaps $400.').event;
    await captureMemory(h, event);
    assert.equal(memoryView(f.store, f.id).capture.status, 'failed');
    assert.equal(memoryView(f.store, f.id).records[0].content, 'Keep it below $500.');
    assert.equal(f.store.event(f.id, event.id).content, event.content);
  } finally { f.store.close(); }
});

test('fallback wrapper rejects wrong models, tools, output overruns and oversized inputs before transport', async () => {
  let calls = 0;
  const provider = selectorProvider({ name: 'anthropic', respond: async () => { calls++; } });
  const valid = { model: SELECTOR_MODELS.anthropic, max_output_tokens: 600, input: [] };
  for (const changes of [{ model: 'claude-opus' }, { tools: [{}] }, { max_output_tokens: 601 }, { max_output_tokens: 0 }, { input: 'x'.repeat(12000) }])
    assert.throws(() => provider.respond({ ...valid, ...changes }), /only bounded/);
  assert.equal(calls, 0); await provider.respond(valid); assert.equal(calls, 1);
});
