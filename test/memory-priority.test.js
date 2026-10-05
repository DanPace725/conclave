import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, hash } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { memoryView, commitMemory } from '../src/memory.js';
import { captureMemory, selectMemory } from '../src/memory-controller.js';
import { captureText, extractExplicit, extractionPayload, memoryPassages } from '../src/memory-extractor.js';
import { anthropicPayload } from '../src/provider.js';

const reply = text => ({ status: 'completed', model: 'fixture', usage: { input_tokens: 20, output_tokens: 5 },
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
function fixture(options = {}) {
  const store = new Store(undefined, { memory: true }), id = store.create();
  const h = new Harness(store, id, { name: 'openai', respond: async () => reply('Done.') }, { budget: 128000, freezeProjection: true, ...options });
  return { store, id, h };
}
const capture = async (h, content) => { const event = h.addMessage('user', content).event; await captureMemory(h, event); return event; };
const update = (key, content, sources, status = 'active') => ({ key, type: 'constraint', content, source_event_ids: sources, status,
  supersedes: [], supports: [], conflicts_with: [], limitations: [] });

test('the exported budget sequence replaces unique heads before answers across providers and preserves exact sources', async () => {
  const { store, id, h } = fixture();
  try {
    await h.ask('Keep the budget under $400');
    const original = memoryView(store, id).records[0];
    h.provider = { name: 'anthropic', respond: async payload => {
      const selected = JSON.parse(payload.input.find(i => i.content.startsWith('Conversation memory:')).content.split('\n')[1]);
      assert.equal(selected.length, 1);
      assert.equal(selected[0].content, 'I actually want to make it a range, between 400 and 500');
      assert.equal(selected[0].resolution, 'reported');
      return reply('Range replaces the earlier cap; endpoints unspecified.');
    } };
    h.options.model = 'claude-sonnet-5-5';
    await h.ask('I actually want to make it a range, between 400 and 500');
    assert.equal(memoryView(store, id).records[0].lifecycle, 'superseded');
    h.provider = { name: 'openai', respond: async () => reply('Done.') }; h.options.model = 'gpt-6.1-sol';
    const last = 'New commitment: budget should be between $400 and $500';
    await h.ask(last);
    const view = memoryView(store, id), active = selectMemory(store, id, '').records;
    assert.equal(active.length, 1); assert.equal(active[0].content, last); assert.equal(active[0].binding, true);
    assert.equal(view.records[1].lifecycle, 'superseded');
    for (const r of view.records) { const ref = r.source_refs[0]; const source = store.event(id, ref.event_id);
      assert.equal(source.content.slice(ref.span_start, ref.span_end), r.content); assert.equal(hash(r.content), ref.span_hash); }
    assert.equal(store.source(id, original.source_refs[0].event_id).content, original.content);
    assert.equal(store.events(id).filter(e => e.kind === 'inference_request' && e.content === 'memory-extraction').length, 0);
  } finally { store.close(); }
});

test('revision cues and fenced memory displays never disable unrelated constraints or become new claims', async () => {
  const { store, id, h } = fixture();
  try {
    await capture(h, 'Keep the budget under $400'); await capture(h, 'Keep the route wheelchair accessible');
    await capture(h, 'Actually, I meant the document title');
    await capture(h, 'Here is the display: ```Automatic · claim · I actually want to make it a range, between 400 and 500```');
    await capture(h, 'The article says \'Actually, keep the budget under $900. Never charge a fee.\'');
    const records = memoryView(store, id).records;
    assert.equal(records.length, 3); assert.ok(records.slice(0,2).every(r => r.resolution === 'reported' && r.lifecycle === 'retained'));
    assert.equal(records[2].binding, false); assert.doesNotMatch(records.map(r => r.content).join('\n'), /```|900|Never charge/);
  } finally { store.close(); }
});

test('quote exclusions retain UTF-16 offsets, preserve contractions, and never capture truncated quoted conditions', async () => {
  const { store, id, h } = fixture();
  try {
    const source = await capture(h, '😀 A quoted example: "Never charge a fee."\nKeep the document private.\nDon\'t charge a fee.');
    const records = memoryView(store, id).records;
    assert.deepEqual(records.map(r => r.content), ['Keep the document private.', "Don't charge a fee."]);
    assert.equal(captureText(source.content).length, source.content.length);
    assert.equal(source.content.slice(records[0].source_refs[0].span_start, records[0].source_refs[0].span_end), records[0].content);
    await capture(h, 'Keep the budget under $400 unless the sign says "free".');
    assert.equal(memoryView(store, id).records.length, 2, 'Do not drop quoted conditions to manufacture an unconditional instruction');
    const quoted = h.addMessage('user', '```Actually, keep the budget under $900```').event;
    assert.throws(() => commitMemory(store, id, [{kind:'claim', span_start:0, span_end:quoted.content.length}], {
      event: quoted, expected_revision: memoryView(store, id).revision }), /Quoted/);
  } finally { store.close(); }
});

test('targeting preserves named budgets, units, conditions and multi-head uncertainty', async () => {
  const { store, id, h } = fixture();
  try {
    await capture(h, 'Keep the travel budget under $400'); await capture(h, 'Keep the equipment budget under $500');
    await capture(h, 'I actually want to make it a range, between 400 and 500');
    let records = memoryView(store, id).records;
    assert.ok(records.slice(0,2).every(r => r.lifecycle === 'retained' && r.resolution === 'contested'));
    assert.equal(records[2].binding, false);
    await capture(h, 'Keep the budget under $100 if children attend.');
    await capture(h, 'New commitment: budget should be between $200 and $300 if adults attend.');
    records = memoryView(store, id).records;
    assert.ok(records.slice(-2).every(r => r.lifecycle === 'retained' && r.resolution === 'reported'));
    assert.equal(extractExplicit({ kind: 'user', actor: 'human', metadata: {}, content: 'New commitment: maybe the budget should be $900' }).length, 0);
  } finally { store.close(); }
});

test('model extraction uses compatible reasoning settings and cannot return quoted spans into memory', async () => {
  const { store, id, h } = fixture({ memoryModel: true, model: 'gpt-6.1-sol', reasoning: 'low' });
  try {
    h.provider.respond = async payload => { assert.equal(payload.reasoning.effort, 'low'); return reply('{"records":[]}'); };
    await h.ask('For the budget, perhaps 500 is sensible.');
    const event = h.addMessage('user', 'Budget report: "Keep the budget under $900"').event;
    const payload = extractionPayload(event, [], 'claude-sonnet-5-5', 'anthropic');
    assert.equal(payload.reasoning, undefined);
    assert.equal(anthropicPayload(payload).output_config.effort, undefined);
    assert.doesNotMatch(JSON.stringify(JSON.parse(payload.input[0].content).passages), /900/);
    h.memoryCalls = 0;
    h.provider.respond = async () => reply(JSON.stringify({records:[{kind:'claim',passage_id:0}]}));
    await captureMemory(h, event);
    assert.equal(memoryView(store, id).records.length, 0);
  } finally { store.close(); }
});

test('memory passage selection preserves paragraph qualifications and Unicode offsets, excludes cut tails and quoted data', async () => {
  const { store, id, h } = fixture({ memoryModel: true });
  try {
    const content = '😀 Findings are preliminary. They apply only if support remains available.\n\n'
      + '"Never seek help" is quoted data.\n\n' + 'Long background. '.repeat(400);
    const event = h.addMessage('assistant', content).event;
    store.append(id, 'turn_complete', '', { assistant_event_id: event.id });
    const passages = memoryPassages(event);
    assert.equal(passages.length, 1);
    assert.equal(passages[0].content, '😀 Findings are preliminary. They apply only if support remains available.');
    assert.equal(event.content.slice(passages[0].span_start, passages[0].span_end), passages[0].content);
    h.provider.respond = async () => reply(JSON.stringify({ records: [
      { kind: 'claim', passage_id: 0 }, { kind: 'claim', passage_id: 0 }, { kind: 'claim', passage_id: 999 }] }));
    await captureMemory(h, event);
    const record = memoryView(store, id).records[0];
    assert.equal(record.content, passages[0].content); assert.equal(record.binding, false);
    assert.equal(record.authority, 'model_proposed'); assert.equal(record.resolution, 'unresolved');
    assert.equal(store.events(id).findLast(e => e.kind === 'memory_capture').metadata.invalid_selection_count, 2);
  } finally { store.close(); }
});

test('configuration errors do not retry on unrelated turns and capture issues persist after other sources succeed', async () => {
  const { store, id, h } = fixture({ memoryModel: true }); let requests = 0;
  try {
    h.provider.respond = async payload => { if (payload.text?.format?.name === 'memory_candidates') {
      requests++; throw Error('OpenAI 400: Unsupported value: reasoning'); } return reply('Done.'); };
    await h.ask('For the budget, perhaps 500 is sensible.');
    await h.ask('Keep the route wheelchair accessible.');
    await h.ask('Continue the plan.');
    const view = memoryView(store, id);
    assert.equal(requests, 1); assert.equal(view.capture.status, 'completed');
    assert.equal(view.capture_issue_count, 1); assert.equal(view.capture_issues[0].retry_on_activity, false);
    assert.equal(view.capture_issues[0].retry_disposition, 'configuration-change-required');
  } finally { store.close(); }
});

test('retirement keeps authority unchanged, reports the applied status, and stops projecting the named entry', async () => {
  const { store, id, h } = fixture();
  try {
    const source = await capture(h, 'New commitment: budget should be between $400 and $500');
    const apply = updates => h.toolResult('update_state', {expected_revision:store.context(id).revision,updates});
    const saved = apply([update('budget-new-commitment', source.content, [source.id])]);
    assert.equal(saved.state_updates[0].effective_status, 'active');
    const old = store.context(id).segments.find(s => s.state_key === 'budget-new-commitment');
    const interpretation = await capture(h, 'The revised plan estimates a $900 budget.');
    const handle = store.references(id).segments.get(old.id);
    assert.throws(() => apply([{...update('different-key', interpretation.content, [interpretation.id]), supersedes:[handle]}]), /binding user constraint/);
    const removal = await capture(h, 'I wonder, can you remove memories? Like try to get rid of the budget stuff?');
    const receipt = apply([update('budget-new-commitment', source.content, [source.id,removal.id], 'superseded')]);
    assert.equal(receipt.state_updates[0].effective_status, 'superseded');
    assert.equal(receipt.state_updates[0].adjustment_reason, null);
    assert.equal(store.context(id).segments.find(s => s.state_key === 'budget-new-commitment').status, 'superseded');
    assert.doesNotMatch(JSON.stringify(h.input()), /state_key.*budget-new-commitment/);
    assert.equal(memoryView(store, id).records[0].lifecycle, 'retained', 'Named-state retirement is scoped; automatic lifecycle is separate');
  } finally { store.close(); }
});

test('retirement refuses historical/quoted authorizations and changed content; downgrades are visible in receipts', async () => {
  const { store, id, h } = fixture();
  try {
    const source = await capture(h, 'Budget design idea: a possible range.');
    const apply = updates => h.toolResult('update_state', {expected_revision:store.context(id).revision,updates});
    const first = apply([update('budget-note', source.content, [source.id])]);
    assert.deepEqual(first.state_updates[0], {key:'budget-note', requested_status:'active', effective_status:'unresolved',
      adjustment_reason:'Source does not establish an explicit user commitment; kept unresolved'});
    const quote = await capture(h, 'The article says "Remove the budget note."');
    assert.throws(() => apply([update('budget-note', source.content,[source.id,quote.id],'superseded')]), /Retirement/);
    const remove = await capture(h, 'Please remove the budget note.');
    assert.throws(() => apply([update('budget-note','Changed to a new claim',[remove.id],'superseded')]), /Retirement/);
    const fileEdit = await capture(h, 'Please remove the budget section from the document.');
    assert.throws(() => apply([update('budget-note',source.content,[source.id,fileEdit.id],'superseded')]), /Retirement/);
    await capture(h, 'Continue the conversation.');
    assert.throws(() => apply([update('budget-note',source.content,[source.id,remove.id],'superseded')]), /Retirement/);
    assert.equal(store.context(id).segments.find(s => s.state_key === 'budget-note').status, 'unresolved');
  } finally { store.close(); }
});

test('shadow timeout is an explicit fallback, unknown counts stay null, and pressure checks remain independent', async () => {
  const { store, id, h } = fixture({ reviewTokens: 1, decisionAdapter: { select: async () => { throw Error('No paid selector'); } } });
  try {
    await h.ask('Discuss the plan.');
    let time = 0; h.options.shadowClock = () => (time += 1000);
    await h.reviewContext();
    const economics = store.events(id).findLast(e => e.kind === 'context_economics').metadata;
    assert.equal(economics.evaluation_status, 'unavailable'); assert.equal(economics.shadow_choice, null);
    assert.equal(economics.fallback_action, 'keep');
    assert.equal(store.events(id).findLast(e => e.kind === 'context_review').metadata.estimated_input_tokens, null);
    assert.equal(store.events(id).findLast(e => e.kind === 'context_review').metadata.result, 'not_needed');
  } finally { store.close(); }
});
