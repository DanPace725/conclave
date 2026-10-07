import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { ConclaveService } from '../src/service.js';
import { OpenAIProvider } from '../src/provider.js';
import { automaticEffortLevels, reasoningDecisionPayload } from '../src/auto-reasoning.js';
import { transcriptView } from '../src/transcript.js';

const result = (payload, choice = 'high', extras = {}) => ({ model: 'gpt-6-luna', status: 'completed', output: [],
  usage: { input_tokens: 100, output_tokens: 0 },
  answers: [{ type: 'choice', name: 'reasoning_effort', choice, confidence: 0.9,
    probabilities: payload.questions[0].choices.map(c => ({ value: c.value, probability: c.value === choice ? 1 : 0 })) }], ...extras });
const completed = payload => ({ status: 'completed', model: payload.model, usage: { input_tokens: 20, output_tokens: 3 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: 'Completed.' }] }] });
function fixture({ decide = payload => result(payload), respond = completed, openai = true, anthropic = false } = {}) {
  const store = new Store(undefined, { memory: true }), decisions = [], answers = [], factories = [];
  const service = new ConclaveService(store, { memoryModel: false, embeddingEnabled: false,
    availability: () => ({ openai, anthropic, jev: true }), decisionFactory: () => null,
    providerFactory: name => {
      factories.push(name);
      return { name, decide: async (payload, options) => { decisions.push(payload); return decide(payload, options); },
        respond: async payload => { answers.push(payload); return respond(payload); } };
    } });
  const id = service.create('Automatic reasoning test').conversation_id;
  return { store, service, id, decisions, answers, factories };
}
const request = (reasoning = 'auto', provider = 'openai', model = 'gpt-6-luna') => ({
  message_id: 'first', content: 'Diagnose a concurrency failure and propose a fix.', settings: { reasoning, provider, model, jev: false, output: 1024 },
});

test('Auto applies a valid supported choice and persists its request, usage and transcript receipt', async () => {
  const f = fixture();
  try {
    const stream = [];
    const view = await f.service.ask(f.id, request(), { onEvent: event => stream.push(event) });
    assert.equal(f.decisions.length, 1);
    assert.equal(f.answers.length, 1);
    assert.equal(f.answers[0].reasoning.effort, 'high');
    assert.equal(view.settings.reasoning, 'auto');
    assert.equal(view.messages.at(-1).reasoning_selection.selected, 'high');
    assert.equal(view.metrics.input_tokens, 120);
    const events = f.store.events(f.id), selection = events.find(e => e.kind === 'reasoning_selection');
    const answer = events.find(e => e.kind === 'inference_request' && e.content === 'answer');
    assert.equal(answer.metadata.reasoning_selection_id, selection.id);
    assert.equal(selection.metadata.selector_request_id, events.find(e => e.content === 'reasoning-selection' && e.kind === 'inference_request').id);
    assert.equal(stream.find(e => e.type === 'start').reasoning_selection.selected, 'high');
    assert.equal(transcriptView(events, f.id, { revision: view.context.revision }).messages.at(-1).reasoning_selection.selected, 'high');
    const before = f.decisions.length;
    f.service.view(f.id); f.service.transcript(f.id); f.service.modelInput(f.id); f.service.export(f.id);
    await f.service.ask(f.id, request());
    assert.equal(f.decisions.length, before, 'Inspection/reload/duplicate completed messages make no paid call');
    assert.ok(f.service.audit(f.id, { kind: 'context' }).records.some(r => r.kind === 'reasoning_selection'));
  } finally { f.store.close(); }
});

test('manual effort bypasses Decisions, and management payloads never carry auto', async () => {
  const f = fixture();
  try {
    await f.service.ask(f.id, request('low'));
    assert.equal(f.decisions.length, 0); assert.equal(f.answers[0].reasoning.effort, 'low');
    const h = f.service.harness(f.id, f.service.settings(request().settings), true);
    assert.equal(h.payload([{ role: 'user', content: 'Compaction.' }]).reasoning.effort, undefined);
    await h.call(h.payload([{ role: 'user', content: 'Compaction.' }]), 'compaction');
    assert.equal(f.decisions.length, 0);
  } finally { f.store.close(); }
});

for (const mode of ['refusal', 'unsupported', 'incomplete_distribution', 'uncertain', 'failure']) {
  test(`Auto ${mode} retains the model default and records the fallback`, async () => {
    const f = fixture({ decide: payload => {
      if (mode === 'failure') throw Error('Fixture outage');
      if (mode === 'refusal') return result(payload, 'high', { answers: [{ type: 'refusal', name: 'reasoning_effort' }] });
      const response = result(payload);
      if (mode === 'unsupported') response.answers[0].choice = 'ultra';
      if (mode === 'incomplete_distribution') response.answers[0].probabilities.pop();
      if (mode === 'uncertain') response.answers[0].confidence = 0.2;
      return response;
    } });
    try {
      const view = await f.service.ask(f.id, request());
      assert.equal(f.answers[0].reasoning.effort, undefined);
      assert.equal(view.messages.at(-1).reasoning_selection.selected, 'default');
      assert.notEqual(view.messages.at(-1).reasoning_selection.reason, 'selected');
      assert.equal(view.settings.reasoning, 'auto');
    } finally { f.store.close(); }
  });
}

test('Claude Auto uses the scoped OpenAI selector; absent OpenAI key makes no cross-provider call', async () => {
  for (const openai of [true, false]) {
    const f = fixture({ openai, anthropic: true });
    try {
      await f.service.ask(f.id, request('auto', 'anthropic', 'claude-sonnet-5-5'));
      assert.equal(f.decisions.length, openai ? 1 : 0);
      assert.equal(f.answers[0].model, 'claude-sonnet-5-5');
      assert.equal(f.answers[0].reasoning.effort, openai ? 'high' : undefined);
      assert.equal(f.factories.includes('openai'), openai);
    } finally { f.store.close(); }
  }
});

test('Auto capabilities exclude unsupported levels and unknown models use default without selection', async () => {
  assert.deepEqual(automaticEffortLevels('openai', 'gpt-6-astra'), ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.deepEqual(automaticEffortLevels('openai', 'gpt-6.1-sol'), ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.ok(automaticEffortLevels('openai', 'gpt-6-luna').includes('none'));
  assert.deepEqual(automaticEffortLevels('anthropic', 'claude-haiku-4-5'), []);
  assert.deepEqual(automaticEffortLevels('openai', 'gpt-6-unknown'), []);
  assert.deepEqual(automaticEffortLevels('openai', 'gpt-5.6-chat'), []);
  const f = fixture();
  try {
    await f.service.ask(f.id, request('auto', 'openai', 'gpt-4o'));
    assert.equal(f.decisions.length, 0); assert.equal(f.answers[0].reasoning.effort, undefined);
  } finally { f.store.close(); }
});

test('classifier evidence is bounded and excludes image data, signatures and opaque reasoning', () => {
  const body = reasoningDecisionPayload({ model: 'gpt-6-luna', input: [
    { type: 'reasoning', encrypted_content: 'PRIVATE_REASONING', summary: [] },
    { role: 'user', content: [{ type: 'input_text', text: 'x'.repeat(100000) }, { type: 'input_image', image_url: 'PRIVATE_IMAGE' }] },
    { type: 'function_call_output', output: 'y'.repeat(100000) },
  ] }, 'openai', 'z'.repeat(100000));
  assert.ok(Buffer.byteLength(JSON.stringify(body)) < 24000);
  assert.doesNotMatch(body.input, /PRIVATE_REASONING|PRIVATE_IMAGE/);
  assert.match(body.input, /excerpt omitted/);
});

test('native Decisions transport uses its own key and endpoint with zero output generation', async () => {
  const own = 'private-fixture-key';
  let captured;
  const api = new OpenAIProvider({ apiKey: own, fetchImpl: async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify(result(JSON.parse(options.body))), { status: 200 });
  } });
  const body = reasoningDecisionPayload({ model: 'gpt-6-astra', input: [] }, 'openai', 'Task');
  const response = await api.decide(body);
  assert.equal(captured.url, 'https://api.openai.com/v1/decisions');
  assert.equal(captured.options.headers.Authorization, `Bearer ${own}`);
  assert.equal(response.usage.output_tokens, 0);
  assert.equal(response.status, 'completed');
  assert.throws(() => new OpenAIProvider({ apiKey: null }), /No OpenAI API key/);
  await assert.rejects(api.decide({ ...body, tools: [] }), /Invalid bounded/);
});

test('Agent accounts for selector usage and rechecks the total-token guard before the answer', async () => {
  const f = fixture({ decide: payload => result(payload, 'high', { usage: { input_tokens: 2900, output_tokens: 0 } }) });
  try {
    const started = await f.service.agentStart(f.id, { ...request(), limits: { max_steps: 2, duration_seconds: 120, max_total_tokens: 3500 } });
    const view = await f.service.agentStep(f.id, { run_id: started.agent.run_id, expected_step: 0 });
    assert.equal(f.decisions.length, 1);
    assert.equal(f.answers.length, 0, 'Answer blocked after selector spending is counted');
    assert.equal(view.agent.status, 'token_limit');
    assert.equal(view.agent.input_tokens, 2900);
  } finally { f.store.close(); }
});

test('Agent Stop aborts in-flight selection and never starts the answer', async () => {
  let entered; const ready = new Promise(resolve => entered = resolve);
  const f = fixture({ decide: (payload, { signal }) => {
    entered(); return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  try {
    const started = await f.service.agentStart(f.id, request());
    const pending = f.service.agentStep(f.id, { run_id: started.agent.run_id, expected_step: 0 });
    await ready;
    await f.service.agentStop(f.id, { run_id: started.agent.run_id });
    await pending;
    assert.equal(f.answers.length, 0);
    assert.equal(f.service.view(f.id).agent.status, 'stopped');
  } finally { f.store.close(); }
});

test('Agent reevaluates effort after a tool step and counts both selector calls', async () => {
  let selections = 0, answers = 0;
  const f = fixture({ decide: payload => result(payload, ++selections === 1 ? 'high' : 'low'),
    respond: payload => ++answers === 1 ? { ...completed(payload), output: [{ type: 'function_call', call_id: 'calc1', name: 'calculate',
      arguments: JSON.stringify({ operation: 'add', values: [2, 3] }) }] } : completed(payload) });
  try {
    const started = await f.service.agentStart(f.id, request());
    const first = await f.service.agentStep(f.id, { run_id: started.agent.run_id, expected_step: 0 });
    assert.equal(first.agent.status, 'running');
    const second = await f.service.agentStep(f.id, { run_id: started.agent.run_id, expected_step: 1 });
    assert.equal(second.agent.status, 'completed');
    assert.deepEqual(f.answers.map(p => p.reasoning.effort), ['high', 'low']);
    assert.equal(f.decisions.length, 2);
    assert.match(f.decisions[1].input, /tool/);
    assert.equal(second.agent.input_tokens, 240);
  } finally { f.store.close(); }
});
