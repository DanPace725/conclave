import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { DemoProvider, runDemo } from '../scripts/demo.js';

test('one complete loop: edit changes next request, history survives eviction and restart, retrieval recovers exact fact', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-loop-'));
  try {
    const result = await runDemo(directory);
    assert.equal(result.restart_matches, true);
    assert.match(result.recovered, /orchard-719/);
    assert.match(result.old_source_intact, /may still work/);
    const store = new Store(directory);
    try {
      const requests = store.events(result.conversation).filter((e) => e.kind === 'inference_request');
      assert.match(requests[0].metadata.payload.input[0].content, /Architecture A was tried twice/);
      assert.doesNotMatch(requests[1].metadata.payload.input[0].content, /Architecture A was tried twice/);
      assert.match(requests[1].metadata.payload.input[0].content, /A may still work if X changes/);
      assert.doesNotMatch(requests.at(-2).metadata.payload.input[0].content, /orchard-719/);
      assert.throws(() => store.db.exec('DELETE FROM events'), /append-only/);
    } finally { store.close(); }
  } finally { rmSync(directory, { recursive: true }); }
});

test('pin, source, revision and budget checks reject bad edits without changing committed context', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-guards-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    const provider = new DemoProvider();
    const harness = new Harness(store, conversation, provider, { budget: 14000 });
    harness.pin('Keep this exact constraint.');
    const current = store.context(conversation);
    assert.throws(() => harness.edit({ expected_revision: current.revision, remove_ids: [current.segments[0].id], additions: [] }), /Protected/);
    assert.throws(() => harness.edit({ expected_revision: 0, remove_ids: [], additions: [] }), /Stale/);
    assert.throws(() => harness.edit({ expected_revision: current.revision, remove_ids: [], additions: [{
      content: 'Fabricated source', source_event_ids: ['missing'], type: 'summary', status: 'active',
    }] }), /Unknown source/);
    assert.deepEqual(store.context(conversation), current);
    await assert.rejects(harness.ask('x'.repeat(20000)), /budget|No older unprotected/);
    assert.equal(provider.requests.length, 0);
    assert.equal(store.events(conversation).at(-1).kind, 'turn_failure');
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('oversized observation is persisted fully but only an excerpt enters context; provider failure is saved', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-ingress-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    const provider = { name: 'failing-demo', respond: async () => { throw Error('offline fixture failure'); } };
    const harness = new Harness(store, conversation, provider);
    const document = 'filler '.repeat(5000) + ' exact-late-marker';
    const path = join(directory, 'observation.txt');
    writeFileSync(path, document);
    const event = harness.ingest(path);
    assert.equal(store.source(conversation, event.id).content, document);
    assert.ok(store.context(conversation).segments[0].content.length < 2500);
    assert.equal(store.search(conversation, 'exact-late-marker')[0].id, event.id);
    const match = harness.toolResult('search_history', { query: 'exact-late-marker' }, [])[0];
    assert.ok(match.offset > 2000);
    assert.match(match.content, /exact-late-marker/);
    await assert.rejects(harness.ask('Summarize the excerpt.'), /offline fixture failure/);
    const events = store.events(conversation);
    assert.ok(events.some((e) => e.kind === 'inference_request'));
    assert.ok(events.some((e) => e.kind === 'inference_failure'));
    assert.ok(!events.some((e) => e.kind === 'assistant'));
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});

test('runtime identity reaches every payload and low-value compactions are skipped', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-compaction-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    const provider = new DemoProvider();
    const harness = new Harness(store, conversation, provider);
    const old = harness.addMessage('user', 'Hello, how are you?');
    for (let i = 0; i < 4; i++) harness.addMessage('user', `Recent note ${i}`);
    const identity = harness.payload([], { instructions: 'Compact historical data.' }).instructions;
    assert.match(identity, /provider=scripted-demo; requested model=gpt-6-luna/);
    assert.match(identity, /Compact historical data/);
    const before = store.context(conversation);
    const skipped = await harness.compact([], true);
    assert.equal(skipped.status, 'skipped');
    assert.equal(provider.requests.length, 0);
    assert.deepEqual(store.context(conversation), before);
    const marginal = harness.edit({ expected_revision: before.revision, remove_ids: [old.item.id], additions: [{
      content: 'Greeting.', source_event_ids: [old.event.id], type: 'summary', status: 'active',
    }] }, [], true, 0.15);
    assert.equal(marginal.status, 'skipped');
    assert.deepEqual(store.context(conversation), before);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});
