import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { stateView } from '../src/state.js';

const update = (key, type, content, source) => ({ key, type, content, source_event_ids: [source],
  status: 'active', supersedes: [], conflicts_with: [], supports: [], limitations: ['Source report; not independently verified.'] });
const response = (text) => ({ status: 'completed', model: 'fixture', usage: { input_tokens: 10, output_tokens: 5 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(text) }] }] });

test('state correction preserves lineage, unresolved alternatives, source attribution and restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-state-'));
  let store = new Store(directory);
  try {
    const conversation = store.create();
    const harness = new Harness(store, conversation, { name: 'offline' });
    const source = harness.addMessage('user', 'Prefer B. A remains viable if X changes.').event;
    const apply = (updates) => harness.updateState({ expected_revision: store.context(conversation).revision, updates });
    apply([update('parser.choice', 'decision', 'Prefer B.', source.id)]);
    const original = stateView(store, conversation).entries[0];
    apply([{ ...update('parser.alternative', 'question', 'Could A become preferable if X changes?', source.id), conflicts_with: [original.id] }]);
    assert.ok(stateView(store, conversation).entries.every((s) => s.effective_status === 'unresolved'));
    const alternative = stateView(store, conversation).entries.find((s) => s.state_key === 'parser.alternative');
    const correction = harness.addMessage('user', 'Use A for the prototype if X is confirmed; B is the fallback.').event;
    apply([{ ...update('parser.choice', 'decision', 'A is conditional on confirming X; B is fallback.', correction.id),
      conflicts_with: [alternative.id], status: 'unresolved' }]);
    const corrected = stateView(store, conversation).entries.find((s) => s.state_key === 'parser.choice');
    assert.deepEqual(corrected.relations.supersedes, [original.id]);
    assert.equal(corrected.attribution[0].actor, 'human');
    assert.equal(corrected.resolution.confidence, null);
    assert.equal(store.memory(conversation, 'Prefer B.').find((s) => s.id === original.id).proximity, 'archived');
    assert.equal(store.resolveBundle(conversation, original.id).content, 'Prefer B.');
    assert.throws(() => harness.edit({ expected_revision: store.context(conversation).revision, remove_ids: [corrected.id], additions: [] }), /Protected/);
    assert.throws(() => harness.offload([corrected.id]), /Protected/);
    const before = store.context(conversation);
    assert.throws(() => apply([update('valid.entry', 'evidence', 'Report', source.id), update('bad.entry', 'decision', 'Fabrication', 'missing')]), /Unknown source/);
    assert.deepEqual(store.context(conversation), before);
    assert.ok(harness.attentionPlan('', [], true).entries.filter((e) => [corrected.id, alternative.id].includes(e.bundle_id)).every((e) => e.protected));
    apply([{ ...update('parser.choice', 'decision', 'A if X is confirmed; otherwise use B.', correction.id),
      conflicts_with: [alternative.id], status: 'unresolved' }]);
    assert.equal(store.memory(conversation, 'Prefer B.').find((s) => s.id === original.id).proximity, 'archived');
    assert.equal(store.memory(conversation, 'A is conditional').find((s) => s.id === corrected.id).proximity, 'archived');
    const view = stateView(store, conversation);
    store.reindex(); store.close(); store = new Store(directory);
    assert.deepEqual(stateView(store, conversation), view);
    assert.equal(store.source(conversation, source.id).content, 'Prefer B. A remains viable if X changes.');
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('bounded proposals do not change state; offload uses one separate decision call with complete usage', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-bounded-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    const requests = [];
    const provider = { name: 'offline-selector', respond: async (payload) => {
      requests.push(payload);
      const { candidates } = JSON.parse(payload.input[0].content);
      return response({ decisions: candidates.map((c) => ({ bundle_id: c.bundle_id, action: 'offload', priority: 1, reason: 'Routine history remains retrievable.' })) });
    } };
    const harness = new Harness(store, conversation, provider, { model: 'answer-model', decisionModel: 'small-model', recent: 1 });
    const old = harness.addMessage('user', 'Routine observation; no new findings. '.repeat(80));
    harness.pin('Keep this caveat verbatim.');
    harness.addMessage('user', 'Next task.');
    const before = store.context(conversation);
    const proposal = await harness.selectionPlan('next task', [], true);
    assert.equal(proposal.selection_source, 'bounded-model');
    assert.deepEqual(store.context(conversation), before);
    const result = await harness.compact([], true);
    assert.equal(result.status, 'offloaded');
    assert.equal(requests.length, 2); // One manual preview and one real context-management invocation.
    assert.ok(requests.every((p) => p.model === 'small-model' && p.max_output_tokens === 600));
    assert.equal(store.resolveBundle(conversation, old.item.id).content, old.item.content);
    const metrics = harness.metrics();
    assert.equal(metrics.decision_calls, 2);
    assert.equal(metrics.compaction_calls, 0);
    assert.equal(metrics.input_tokens, 20);
    assert.equal(metrics.decision_input_tokens, 20);
    const receipt = store.events(conversation).find((e) => e.kind === 'inference_request');
    assert.equal(receipt.metadata.input_budget, 8000);
    assert.equal(receipt.metadata.output_reserve, 600);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('invalid decisions, provider failures and decision-budget overflow fall back without editing context', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-fallback-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    let calls = 0, fail = false;
    const provider = { name: 'offline', respond: async () => {
      calls++;
      if (fail) throw Error('fixture provider unavailable');
      return response({ decisions: [{ bundle_id: 'unknown', action: 'offload', priority: 0, reason: 'Invalid fixture' }] });
    } };
    const harness = new Harness(store, conversation, provider, { decisionModel: 'small-model', recent: 1 });
    harness.addMessage('user', 'Old source '.repeat(120));
    harness.pin('Protected caveat.');
    harness.addMessage('user', 'Current request.');
    const before = store.context(conversation);
    assert.equal((await harness.selectionPlan('', [], true)).selection_source, 'deterministic-fallback');
    fail = true;
    assert.equal((await harness.selectionPlan('', [], true)).selection_source, 'deterministic-fallback');
    const tiny = new Harness(store, conversation, provider, { decisionModel: 'small-model', decisionBudget: 100, recent: 1 });
    assert.equal((await tiny.selectionPlan('', [], true)).selection_source, 'deterministic-fallback');
    assert.equal(calls, 2); // Oversized decision is rejected before provider submission.
    const disabled = new Harness(store, conversation, provider);
    assert.equal((await disabled.selectionPlan('', [], true)).selection_source, 'deterministic');
    assert.equal(calls, 2);
    assert.deepEqual(store.context(conversation), before);
    assert.equal(store.events(conversation).filter((e) => e.kind === 'decision_rejection').length, 3);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});
