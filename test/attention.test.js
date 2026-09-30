import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';

test('focused ingress, offload, index rebuild, restart and restore keep originals and later pins', () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-index-'));
  let store = new Store(directory);
  try {
    const conversation = store.create('Attention lifecycle');
    let harness = new Harness(store, conversation, { name: 'offline' });
    const text = 'Irrelevant introduction. '.repeat(250) + '\nDeployment marker: maple-812. Keep the unresolved alternative.';
    const path = join(directory, 'source.md');
    writeFileSync(path, text);
    const source = harness.ingest(path, 'maple-812');
    const original = store.context(conversation).segments[0];
    assert.match(original.content, /maple-812/);
    assert.match(original.content, /Task-matched excerpt/);
    const firstRevision = store.context(conversation).revision;
    harness.pin('A may still work if X changes.');
    const pin = store.context(conversation).segments.at(-1);
    harness.offload([original.id]);
    assert.doesNotMatch(harness.input()[0].content, /maple-812/);
    assert.equal(store.memory(conversation, 'maple-812')[0].proximity, 'proximal');
    assert.match(harness.toolResult('resolve_context', { bundle_id: original.id }, []).content, /maple-812/);
    assert.match(harness.toolResult('search_history', { query: 'maple-812' }, [])[0].content, /maple-812/);
    assert.throws(() => harness.offload([pin.id]), /Protected/);
    const eventsBefore = store.events(conversation);
    store.reindex();
    assert.deepEqual(store.events(conversation), eventsBefore);
    assert.equal(store.source(conversation, source.id).content, text);
    store.close();
    store = new Store(directory);
    harness = new Harness(store, conversation, { name: 'offline' });
    assert.equal(store.memory(conversation, 'maple-812')[0].proximity, 'proximal');
    const before = store.context(conversation).revision;
    const restored = store.restore(conversation, firstRevision);
    assert.equal(restored.revision, before + 1);
    assert.ok(restored.segments.some((s) => s.id === original.id));
    assert.deepEqual(restored.segments.find((s) => s.id === pin.id), pin);
    assert.equal(store.snapshot(conversation, firstRevision).segments.length, 1);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('attention selects low-priority material before task state and logs selection separately from transformation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-policy-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    const requests = [];
    const provider = { name: 'offline', respond: async (payload) => {
      requests.push(payload);
      const selected = JSON.parse(payload.input[0].content.split('\n').at(-1));
      return { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ additions: [{
        content: 'Parser decision remains conditional; old routine observations superseded.',
        source_event_ids: selected.flatMap((s) => s.source_event_ids), type: 'decision', status: 'unresolved',
      }] }) }] }] };
    } };
    const harness = new Harness(store, conversation, provider, { recent: 1, budget: 18000, output: 500 });
    const decision = harness.addMessage('user', 'Parser may use B; A remains viable if X changes. '.repeat(35), { type: 'decision', status: 'unresolved' });
    const old = harness.addMessage('user', 'Routine observation with no new evidence. '.repeat(35), { status: 'superseded' });
    harness.pin('Never claim architecture A was conclusively rejected.');
    const latest = harness.addMessage('user', 'Continue the parser task.');
    const plan = harness.attentionPlan('parser', [latest.item.id], true);
    assert.deepEqual(plan.selected_bundle_ids, [old.item.id, decision.item.id]);
    assert.ok(plan.entries.filter((e) => e.protected).every((e) => e.action === 'retain'));
    await harness.compact([latest.item.id], true);
    assert.equal(requests.length, 1);
    const receipt = store.events(conversation).find((e) => e.kind === 'attention_decision');
    assert.equal(receipt.metadata.policy_version, 'attention-v1');
    assert.deepEqual(receipt.metadata.selected_bundle_ids, plan.selected_bundle_ids);
    assert.ok(store.context(conversation).segments.some((s) => s.pinned));
    assert.match(store.resolveBundle(conversation, old.item.id).content, /Routine observation/);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});
