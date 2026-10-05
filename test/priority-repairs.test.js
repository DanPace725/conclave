import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { matchingWindow, retrievalCandidate } from '../src/retrieval-evidence.js';
import { readHandoff, observationRanges } from '../src/continuation-evidence.js';
import { fitToolExchanges } from '../src/tool-context.js';
import { SemanticRetrieval } from '../src/semantic-retrieval.js';
import { captureMemory } from '../src/memory-controller.js';
import { memoryView } from '../src/memory.js';
import { jevTelemetry } from '../src/jev-telemetry.js';

const fixture = options => {
  const store = new Store(undefined, { memory: true }), id = store.create();
  return { store, id, h: new Harness(store, id, { name: 'openai' }, { model: 'gpt-6', budget: 64000, ...options }) };
};

test('fresh Claude handoff preserves exact unseen text, fits by paging and archives only delivered observations', () => {
  const { store, id, h } = fixture();
  try {
    h.addMessage('user', 'Read this source.');
    const source = h.addMessage('document', 'Unique evidence. '.repeat(1100)).event;
    const value = { event_id: source.id, offset: 0, content: source.content, next_offset: null };
    const receipt = store.append(id, 'tool_result', JSON.stringify(value), { call_id: 'fresh', tool: 'retrieve_event' });
    const pending = [{ type: 'function_call_output', call_id: 'fresh', output: JSON.stringify(value) }];
    const handoff = h.continuationHandoff(pending);
    assert.equal(readHandoff(handoff).fresh_tool_results[0].result.content, source.content);
    assert.equal(readHandoff(handoff).fresh_tool_results[0].event_id, receipt.id);
    const fit = fitToolExchanges({ input: [handoff] }, 6000);
    const paged = readHandoff(fit.payload.input[0]).fresh_tool_results[0].result;
    assert.ok(paged.content.length > 800 && paged.content.length < source.content.length);
    assert.equal(paged.next_offset, paged.content.length);
    assert.equal(observationRanges(fit.payload)[0].end_offset, paged.content.length);
    const request = store.append(id, 'inference_request', 'answer', { payload: fit.payload });
    store.append(id, 'inference_response', 'answer', { request_id: request.id, status: 'completed' });
    const archived = readHandoff(h.continuationHandoff([fit.payload.input[0]]));
    assert.equal(archived.fresh_tool_results.length, 0);
    assert.equal(archived.completed_tool_results[0].truncated, true);
    assert.equal(JSON.parse(store.event(id, receipt.id).content).content, source.content);
  } finally { store.close(); }
});

test('match-centered Jev can promote a direct passage beyond the original first 600 characters without lowering uncertainty gates', async () => {
  const passage = 'Unrelated opening. '.repeat(40) + 'The orbital archive confirms 38.5 percent of participants.';
  assert.ok(matchingWindow(passage, 'orbital archive participants').offset > 600);
  const candidate = retrievalCandidate({ event_id: 'target', kind: 'document', offset: 1440, content: passage }, { metadata: { title: 'Archive' } }, 'E1', 'orbital participants');
  assert.ok(candidate.source.offset > 2040);
  const adapter = new JevDecisionAdapter({ name: 'typesafe' });
  let payload;
  const result = await adapter.rerank([{ id: 'noise', kind: 'reasoning', excerpt: 'Speculation.' }, candidate], 'orbital participants', async p => {
    payload = p;
    return { answers: { item_0: { type: 'choice', choice: 'irrelevant', confidence: 0.3, probabilities: { irrelevant: 1, useful: 0 } },
      item_1: { type: 'choice', choice: 'useful', confidence: 0.9, probabilities: { irrelevant: 0, useful: 1 } } } };
  });
  assert.equal(result.fallback, false); assert.deepEqual(result.ids, ['target', 'noise']);
  assert.match(payload.questions.item_1.instructions.candidate.excerpt, /38.5 percent/);
  assert.equal(result.threshold, 0.65);
});

test('Jev byte fitting preserves the complete shortlist and reports the exact supplied ranges', async () => {
  const adapter = new JevDecisionAdapter({ name: 'typesafe' });
  const candidates = Array.from({ length: 6 }, (_, n) => ({ id: String(n), kind: 'document', excerpt: ('orbital participants evidence ' + n + ' ').repeat(40),
    source: { title: 'Archive '.repeat(20), url: 'https://example.test/' + 'path/'.repeat(40), offset: 1440, end_offset: 2600 } }));
  let seen;
  const result = await adapter.rerank(candidates, 'orbital participants', async payload => {
    seen = payload;
    return { answers: Object.fromEntries(Object.keys(payload.questions).map(k => [k, { type: 'choice', choice: 'useful', confidence: 0.9, probabilities: { useful: 1, irrelevant: 0 } }])) };
  });
  assert.equal(Object.keys(seen.questions).length, 6); assert.equal(result.fallback, false);
  assert.ok(Buffer.byteLength(JSON.stringify(seen)) <= 8000);
  assert.equal(result.candidates.length, 6);
  assert.ok(result.candidates.some(c => c.excerpt.length < 800));
  for (const c of result.candidates) assert.equal(c.source.end_offset - c.source.offset, c.excerpt.length);
  assert.ok(candidates.every(c => c.excerpt.length > 800), 'caller evidence is unchanged');
});

test('equivalent repeated fallback decisions cool down; a different task is eligible and cache still works', async () => {
  let calls = 0;
  const decisionAdapter = { provider: { name: 'typesafe' }, options: { model: 'jev-latest', candidates: 6, budget: 8000 }, rerank: async candidates => {
    calls++; return { ids: candidates.map(c => c.id), fallback: true, decision_version: 'jev-selection-v4', decisions: candidates.map(c => ({ id: c.id, uncertain: true })) };
  } };
  const { store, id, h } = fixture({ decisionAdapter, delegationCache: false, model: 'gpt-6.1-sol' });
  try {
    for (let n = 0; n < 6; n++) h.addMessage('document', 'orbital archive participants quantity comparison ' + n);
    await h.executeTool('search_history', { query: 'orbital archive participants' }, []);
    await h.executeTool('search_history', { query: 'participants orbital archive' }, []);
    await h.executeTool('search_history', { query: 'the orbital archive participants' }, []);
    assert.equal(calls, 2);
    assert.match(store.events(id).at(-1).metadata.reason, /cooldown/);
    await h.executeTool('search_history', { query: 'quantity comparison' }, []);
    assert.equal(calls, 3);
    h.options.delegationCache = true;
    await h.executeTool('search_history', { query: 'quantity comparison' }, []);
    assert.equal(calls, 3); assert.equal(store.events(id).at(-1).metadata.cache_hit, true);
  } finally { store.close(); }
});

test('source-specific search returns exact match ranges and excludes suppressed sources', () => {
  const { store, id, h } = fixture();
  try {
    const source = h.addMessage('document', 'Intro. '.repeat(200) + 'Orbital archive sample size 129.').event;
    h.addMessage('reasoning', 'Orbital archive sample size speculation.');
    const rows = h.toolResult('search_source', { event_id: source.id, query: 'sample size 129' }, []);
    assert.equal(rows.length, 1); assert.match(rows[0].content, /129/);
    assert.equal(rows[0].content, source.content.slice(rows[0].offset, rows[0].offset + rows[0].content.length));
    store.append(id, 'document_lifecycle', 'remove', { key: 'source:' + source.id, source_event_id: source.id, operation: 'remove' });
    assert.throws(() => h.toolResult('search_source', { event_id: source.id, query: 'sample size' }, []), /removed/);
  } finally { store.close(); }
});

test('persistent SQL configuration failure is diagnosed once across fresh harnesses and retried after cooldown', async () => {
  const { store, id, h } = fixture(); let reads = 0;
  const backend = { keys: async () => { reads++; throw Error('Wrapped database failure', { cause: Object.assign(Error('missing relation'), { code: '42P01' }) }); } };
  const semantic = new SemanticRetrieval(backend, () => { throw Error('No paid model call expected'); });
  try {
    h.addMessage('document', 'Orbital source.');
    await semantic.matches(h, 'orbital', 'source');
    const other = new Harness(store, id, { name: 'openai' });
    await semantic.matches(other, 'orbital', 'source');
    assert.equal(reads, 1);
    const failure = store.events(id).find(e => e.kind === 'embedding_failure');
    assert.equal(failure.metadata.configuration_code, '42P01');
    const expiry = store.append(id, 'embedding_failure', 'Expired cooldown', { ...failure.metadata, retry_after: Date.now() - 1 });
    await semantic.matches(new Harness(store, id, { name: 'openai' }), 'orbital', 'source');
    assert.equal(reads, 2); assert.ok(expiry);
  } finally { store.close(); }
});

test('completed research is captured once on the next turn as an exact unresolved assistant claim; save directive is not a commitment', async () => {
  const { store, id, h } = fixture({ memoryModel: true }); let calls = 0;
  h.provider.respond = async payload => {
    calls++;
    return { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ records: [{ kind: 'claim', passage_id: 0 }] }) }] }] };
  };
  try {
    const user = h.addMessage('user', 'Research the archive.').event;
    const assistant = h.addMessage('assistant', 'The orbital archive lists a sample of 129 participants.').event;
    store.append(id, 'turn_complete', '', { user_event_id: user.id, assistant_event_id: assistant.id });
    const next = h.addMessage('user', 'Save these findings in memory.').event;
    await captureMemory(h, next);
    const rows = memoryView(store, id).records;
    assert.equal(rows.length, 1); assert.equal(rows[0].content, assistant.content);
    assert.equal(rows[0].authority, 'model_proposed'); assert.equal(rows[0].resolution, 'unresolved');
    assert.equal(rows[0].binding, false); assert.equal(rows[0].source_refs[0].event_id, assistant.id);
    await captureMemory(h, next); assert.equal(calls, 1);
    assert.equal(store.events(id).find(e => e.kind === 'memory_capture' && e.metadata.source_event_id === assistant.id).metadata.admitted_count, 1);
    assert.equal(store.events(id).at(-1).metadata.admitted_count, 0);
  } finally { store.close(); }
});

test('research read episodes trigger next-turn capture automatically while partial or suppressed output never invokes extraction', async () => {
  const { store, id, h } = fixture({ memoryModel: true }); let calls = 0;
  h.provider.respond = async () => { calls++; return { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"records":[]}' }] }] }; };
  try {
    const user = h.addMessage('user', 'Investigate the archive.').event;
    const partial = h.addMessage('assistant', 'Partial discovery.').event;
    await captureMemory(h, partial); assert.equal(calls, 0);
    for (let i = 0; i < 3; i++) store.append(id, 'tool_result', '{}', { tool: 'retrieve_event' });
    const completed = h.addMessage('assistant', 'Archive sample findings remain unresolved.').event;
    store.append(id, 'turn_complete', '', { user_event_id: user.id, assistant_event_id: completed.id });
    await captureMemory(h, h.addMessage('user', 'Continue the investigation.').event);
    assert.equal(calls, 1);
    const checked = store.events(id).find(e => e.kind === 'memory_capture' && e.metadata.source_event_id === completed.id);
    assert.equal(checked.metadata.admitted_count, 0); assert.equal(checked.metadata.paid_extraction, true);
    const suppressed = h.addMessage('assistant', 'Suppressed discovery.').event;
    store.append(id, 'turn_complete', '', { user_event_id: user.id, assistant_event_id: suppressed.id });
    store.append(id, 'memory_suppression', '', { targets: [{ kind: 'named', id: 'episode', source_event_ids: [suppressed.id] }] });
    await captureMemory(h, suppressed); assert.equal(calls, 1);
  } finally { store.close(); }
});

test('controller history keeps latest native prefix and scalar accounting while canonical requests/checkpoints are untouched', () => {
  const { store, id } = fixture();
  try {
    const old = store.append(id, 'inference_request', 'answer', { provider: 'openai', payload: { model: 'gpt-6', input: [{ content: 'old'.repeat(10000) }] } });
    const latest = store.append(id, 'inference_request', 'answer', { provider: 'openai', payload: { model: 'gpt-6', input: [{ content: 'current' }] }, provider_payload: { input: 'duplicate' } });
    const checkpoint = store.append(id, 'agent_checkpoint', '', { state: { pending: 'huge'.repeat(10000) }, run_id: 'run' });
    store.withControllerHistory(id, 'openai', 'gpt-6', () => {
      const events = store.events(id);
      assert.equal(events.find(e => e.id === old.id).metadata.payload.input, undefined);
      assert.deepEqual(events.find(e => e.id === latest.id).metadata.payload.input, latest.metadata.payload.input);
      assert.equal(events.find(e => e.id === checkpoint.id).metadata.state, undefined);
    });
    assert.deepEqual(store.event(id, old.id).metadata, old.metadata);
    assert.deepEqual(store.event(id, checkpoint.id).metadata, checkpoint.metadata);
    store.withReadCache(() => {
      store.events(id);
      store.withControllerHistory(id, 'openai', 'gpt-6', () => store.append(id, 'context_economics', 'Fresh audit'));
      assert.equal(store.events(id).at(-1).content, 'Fresh audit');
    });
  } finally { store.close(); }
});

test('Jev telemetry distinguishes failed/missing usage, cached fallback, changed selection and bounded pagination', () => {
  const { store, id } = fixture();
  try {
    const request = store.append(id, 'inference_request', 'retrieval-reranking', { provider: 'typesafe', payload: { model: 'jev-latest' } });
    store.append(id, 'inference_response', '', { request_id: request.id, status: 'failed', elapsed_ms: 15 });
    store.append(id, 'retrieval_decision', '', { assessment: { fallback: true }, cache_hit: true });
    store.append(id, 'retrieval_decision', '', { outcome: 'selection changed', baseline_event_ids: ['a'], selected_event_ids: ['b'] });
    const page = jevTelemetry(store.events(id), { limit: 2 });
    assert.equal(page.summary.failed, 1); assert.equal(page.summary.unknown_usage_calls, 1);
    assert.equal(page.summary.changed_selections, 1); assert.equal(page.summary.cache_hits, 1);
    assert.equal(page.records.length, 2); assert.equal(page.has_more, true);
    const next = jevTelemetry(store.events(id), { before_seq: page.before_cursor, limit: 2 });
    assert.equal(next.records[0].request_id, request.id); assert.equal(next.records[0].usage, null);
  } finally { store.close(); }
});

test('legacy Jev typed responses without native status are received rather than missing', () => {
  const { store, id } = fixture();
  try {
    const request = store.append(id, 'inference_request', 'retrieval-reranking', { provider: 'typesafe', payload: { model: 'jev-latest' } });
    store.append(id, 'inference_response', '', { request_id: request.id, answers: { item_0: { choice: 'useful' } }, usage: { input_tokens: 20, output_tokens: 2 } });
    const page = jevTelemetry(store.events(id));
    assert.equal(page.summary.completed, 1); assert.equal(page.summary.inferred_completed, 1);
    assert.equal(page.summary.missing_responses, 0);
    assert.match(page.records[0].outcome, /typed response received/);
  } finally { store.close(); }
});
