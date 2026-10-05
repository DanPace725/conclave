import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { Harness, budgetUnits } from '../src/harness.js';
import { JevProvider } from '../src/provider.js';
import { JevDecisionAdapter } from '../src/jev.js';

const text = (content) => ({ status: 'completed', model: 'fixture', usage: { input_tokens: 10, output_tokens: 5 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: content }] }] });

test('Jev retention excludes automatic rewrites while old advisory-retained bundles remain recoverably offloadable', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-jev-retention-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    let selections = 0, answerCalls = 0;
    const decisionProvider = { name: 'typesafe', respond: async (payload) => {
      selections++;
      const answers = Object.fromEntries(Object.entries(payload.questions).map(([key, question]) => [key, question.type === 'choice'
        ? { type: 'choice', choice: key === 'action_0' ? 'retain' : 'offload', confidence: key === 'action_0' ? 0.9 : 0.2,
          probabilities: { retain: 0.1, offload: 0.7, compact: 0.1, escalate: 0.1 } }
        : { type: 'score', score: 1, confidence: 0.9, probabilities: { 0: 0, 1: 1, 2: 0, 3: 0, 4: 0 },
          legend: Object.fromEntries(question.criteria.map((label, i) => [i, label])) }]));
      return { status: 'completed', model: 'jev-fixture', answers, usage: { input_tokens: 80, output_tokens: 10 } };
    } };
    let retained;
    const provider = { name: 'offline', respond: async (payload) => {
      if (payload.text?.format) {
        const selected = JSON.parse(payload.input[0].content.slice(payload.input[0].content.indexOf('\n[') + 1));
        assert.ok(selected.every((item) => !retained.includes(item.id)), 'retained bundles must never enter a later rewrite batch');
        return text(JSON.stringify({ additions: [{ content: 'Routine historical notes.', type: 'summary', status: 'active',
          source_event_ids: [...new Set(selected.flatMap((item) => item.source_event_ids))] }] }));
      }
      answerCalls++;
      if (answerCalls === 1) return { ...text(''), output: [{ type: 'function_call', name: 'offload_context', call_id: 'retain-check',
        arguments: JSON.stringify({ bundle_ids: retained, expected_revision: store.context(conversation).revision }) }] };
      const result = payload.input.find((item) => item.type === 'function_call_output');
      const receipt = store.events(conversation).findLast(e => e.kind === 'tool_result');
      assert.equal(JSON.parse(receipt.content).error, undefined);
      assert.ok(result, 'offload result remains in the model continuation');
      return text('The retained details are still available.');
    } };
    const harness = new Harness(store, conversation, provider, { budget: 34000, recent: 1,
      decisionAdapter: new JevDecisionAdapter(decisionProvider) });
    // Six queried candidates fit alongside unqueried rewrite candidates in the
    // first bounded batch; substantial unqueried material remains for pass two.
    const originals = Array.from({ length: 11 }, (_, i) => harness.addMessage('assistant', `Planning historical note ${i}. ` + 'Routine background. '.repeat(i < 6 ? 60 : 130)).item);
    retained = originals.slice(0, 6).map((item) => item.id);
    await harness.ask('Continue the planning discussion.');
    assert.equal(selections, 1);
    const batches = store.events(conversation).filter((e) => e.kind === 'attention_decision' && e.content === 'select compaction batch');
    assert.ok(batches.length >= 1, 'fixture must review context before answering');
    for (const item of originals.slice(0, 6)) {
      assert.equal(store.resolveBundle(conversation, item.id).content, item.content);
      assert.ok(store.context(conversation).segments.some(s => s.ref_bundle_id === item.id),
        'explicit tool offload preserves a retrievable pointer');
    }
    assert.equal(harness.metrics().failures, 0);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('native Jev requests, typed coverage/confidence gates, receipts and deterministic fallback', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-jev-'));
  const store = new Store(directory);
  try {
    let uncertain = false, fail = false, wire;
    const provider = new JevProvider({ apiKey: 'fixture-secret', fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
      assert.equal(options.headers.Authorization, 'Bearer fixture-secret');
      if (fail) return { ok: false, status: 429 };
      wire = JSON.parse(options.body);
      const answers = Object.fromEntries(Object.entries(wire.questions).map(([key, question]) => [key, question.type === 'choice'
        ? { type: 'choice', choice: 'offload', confidence: uncertain ? 0.2 : 0.9,
          probabilities: { retain: 0.02, offload: 0.96, compact: 0.01, escalate: 0.01 } }
        : { type: 'score', score: 1, confidence: 0.9, probabilities: { 0: 0, 1: 1, 2: 0, 3: 0, 4: 0 },
          legend: Object.fromEntries(question.criteria.map((c, i) => [i, c])) }]));
      return { ok: true, json: async () => ({ model: 'jev-fixture', answers, usage: { input_tokens: 90, output_tokens: 20 } }) };
    } });
    const adapter = new JevDecisionAdapter(provider);
    const conversation = store.create();
    const harness = new Harness(store, conversation, { name: 'offline' }, { recent: 1, decisionAdapter: adapter });
    harness.addMessage('user', 'Old routine observation. '.repeat(100));
    harness.pin('Keep this exact restriction.');
    const before = store.context(conversation);
    const selected = await harness.selectionPlan('current task', [], true);
    assert.equal(selected.selection_source, 'bounded-model');
    assert.ok(selected.offload_bundle_ids.length);
    assert.deepEqual(store.context(conversation), before);
    assert.equal(wire.model, 'jev-latest');
    assert.ok(!('max_output_tokens' in wire));
    assert.ok(budgetUnits(wire) < 8000);
    const saved = store.events(conversation).find((e) => e.kind === 'inference_response');
    assert.ok(saved.metadata.answers.action_0.probabilities);
    assert.equal(saved.metadata.status, 'completed');
    assert.equal(store.events(conversation).find((e) => e.kind === 'inference_request').metadata.output_reserve, 0);
    uncertain = true;
    const low = await harness.selectionPlan('current task', [], true);
    assert.equal(low.entries.find((e) => !e.protected).action, 'escalate');
    assert.throws(() => adapter.validate({ answers: {} }, [{ bundle_id: 'x' }]), /coverage/);
    fail = true;
    assert.equal((await harness.selectionPlan('', [], true)).selection_source, 'deterministic-fallback');
    assert.deepEqual(store.context(conversation), before);
    assert.equal(harness.metrics().decision_calls, 3);
    assert.equal(harness.metrics().input_tokens, 180);
    assert.equal(harness.metrics().usage_complete, false);
    assert.equal(harness.metrics().usage_by_provider.typesafe.input_tokens, 180);
    assert.equal(harness.metrics().usage_by_provider.typesafe.usage_complete, false);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('tool continuation fits its budget without losing canonical retrieval, reasoning or protected context', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-continuation-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    const document = store.append(conversation, 'document', 'Historical detail. '.repeat(300));
    let calls = 0, projectedLength;
    const provider = { name: 'offline', respond: async (payload) => {
      calls++;
      assert.ok(budgetUnits(payload) + 4096 <= harness.options.budget);
      assert.match(payload.input[0].content, /Exact protected constraint/);
      if (calls === 1) return { ...text(''), output: [{ type: 'reasoning', encrypted_content: 'preserve-this-reasoning' },
        { type: 'function_call', name: 'retrieve_event', arguments: JSON.stringify({ event_id: document.id, offset: 0 }), call_id: 'call_fixture' }] };
      assert.equal(payload.input.find((s) => s.type === 'reasoning').encrypted_content, 'preserve-this-reasoning');
      const result = JSON.parse(payload.input.find((s) => s.type === 'function_call_output').output);
      assert.equal(result.event_id, document.id);
      assert.equal(result.truncated, true);
      assert.equal(result.next_offset, result.content.length);
      projectedLength = result.content.length;
      return text('Recovered the historical detail.');
    } };
    const harness = new Harness(store, conversation, provider, { toolReserve: 0 });
    harness.pin('Exact protected constraint.');
    harness.options.budget = budgetUnits(harness.answerPayload()) + 4096 + 1200;
    const result = await harness.ask('Retrieve the historical document.');
    assert.match(result.text, /Recovered/);
    assert.equal(calls, 2);
    const canonical = JSON.parse(store.events(conversation).find((e) => e.kind === 'tool_result').content);
    assert.ok(canonical.content.length > projectedLength);
    assert.equal(canonical.content, document.content.slice(0, canonical.next_offset));
    assert.ok(harness.metrics().tool_projections > 0);
    assert.equal(harness.metrics().budget_recoveries, 1);
    assert.equal(store.source(conversation, document.id).content, document.content);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('manual named state corrects with lineage; compaction preflight avoids an impossible paid reduction', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-remember-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    let calls = 0;
    const harness = new Harness(store, conversation, { name: 'offline', respond: async () => { calls++; throw Error('Unexpected paid call'); } },
      { recent: 1, budget: 40000 });
    harness.remember('program.budget', 'constraint', 'Original grant is $15,000.');
    const original = store.context(conversation).segments[0];
    harness.remember('program.budget', 'constraint', '$15,000 plus $2,000 restricted to equipment.');
    const current = store.context(conversation).segments[0];
    assert.equal(current.state_key, 'program.budget');
    assert.deepEqual(current.relations.supersedes, [original.id]);
    assert.equal(current.resolution.confidence, null);
    assert.match(store.resolveBundle(conversation, original.id).content, /Original grant/);
    harness.addMessage('assistant', 'Old text. '.repeat(110));
    harness.addMessage('assistant', 'Protected recent long report. '.repeat(260));
    const result = await harness.compact([], true);
    assert.equal(result.status, 'skipped');
    assert.match(result.reason, /empty source-linked/);
    assert.equal(calls, 0);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});
