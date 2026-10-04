import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { captureMemory } from '../src/memory-controller.js';
import { memoryView, changeMemory } from '../src/memory.js';
import { toolIngress } from '../src/ingress.js';

const final = { status: 'completed', usage: { input_tokens: 50, output_tokens: 5 }, output: [{ type: 'message', content: [{ type: 'output_text', text: 'Done.' }] }] };
const fixture = () => {
  const store = new Store(undefined, { memory: true }), id = store.create();
  const h = new Harness(store, id, { name: 'openai', respond: async () => final }, { budget: 256000, freezeProjection: true });
  return { store, id, h };
};
const read = h => h.toolResult('read_memory', { offset: 0, expected_memory_revision: null, expected_state_revision: null });
async function seed(h) {
  const user = h.addMessage('user', 'Keep the budget under $400.').event;
  await captureMemory(h, user);
  h.updateState({ expected_revision: h.store.context(h.conversation).revision, updates: [{ key: 'budget', type: 'constraint', content: user.content,
    source_event_ids: [user.id], status: 'active', supersedes: [], supports: [], conflicts_with: [], limitations: [] }] });
  return user;
}
function args(h, source) {
  return { expected_memory_revision: memoryView(h.store, h.conversation).revision, expected_state_revision: h.store.context(h.conversation).revision,
    source_event_id: source.id, targets: [{ kind: 'automatic', id: memoryView(h.store, h.conversation).records[0].memory_id }, { kind: 'named', id: 'budget' }] };
}

test('unified memory read returns full revision-checked pages without ingress shortening', async () => {
  const { store, id, h } = fixture();
  try {
    await seed(h);
    for (let i = 0; i < 6; i++) h.remember('detail-' + i, 'evidence', ('Context detail ' + i + ' ').repeat(100));
    let page = read(h), text = '', pages = 0;
    const revisions = { expected_memory_revision: page.memory_revision, expected_state_revision: page.state_revision };
    while (true) {
      assert.equal(page.content.length <= 8000, true); assert.equal(toolIngress('read_memory', page, 'receipt').changed, false);
      text += page.content; pages++;
      if (page.next_offset == null) break;
      page = h.toolResult('read_memory', { offset: page.next_offset, ...revisions });
    }
    assert.ok(pages > 1); const view = JSON.parse(text);
    assert.equal(view.automatic[0].authority, 'user_committed'); assert.equal(view.named.length, 7);
    assert.ok(view.automatic[0].source_refs[0].content_hash);
    const first = read(h); h.remember('new', 'evidence', 'New named detail.');
    assert.throws(() => h.toolResult('read_memory', { offset: 1, expected_memory_revision: first.memory_revision, expected_state_revision: first.state_revision }), /revision changed/);
    assert.throws(() => h.toolResult('read_memory', { offset: 1, expected_memory_revision: null, expected_state_revision: null }), /revision changed/);
    assert.ok(h.tools().some(t => t.name === 'suppress_memory'));
  } finally { store.close(); }
});

test('a current request suppresses both stores atomically, discards frozen/signed copies and retains human history', async () => {
  const { store, id, h } = fixture();
  try {
    const original = await seed(h);
    const user = h.addMessage('user', 'Please stop using the budget memories.').event;
    h.prepareAnswer(); assert.match(JSON.stringify(h.frozenInput), /under \$400/);
    const snapshot = store.append(id, 'tool_result', JSON.stringify(read(h)), { tool: 'read_memory', call_id: 'snapshot' });
    const priorRead = store.append(id, 'tool_result', JSON.stringify({ content: original.content }), { tool: 'retrieve_event', call_id: 'old-read' });
    h.continuation = { payload: h.answerPayload(), count: 0, revision: store.context(id).revision };
    const receipt = h.toolResult('suppress_memory', args(h, user));
    assert.deepEqual(receipt.results.map(r => r.effective_status), ['suppressed', 'superseded']);
    assert.equal(h.frozenInput, null); assert.equal(h.continuation, null); assert.equal(h.forceHandoff, true);
    assert.doesNotMatch(JSON.stringify(h.prepareAnswer([{ type: 'function_call_output', call_id: 'snapshot', output: snapshot.content }])), /under \$400/);
    assert.doesNotMatch(read(h).content, /under \$400/);
    assert.throws(() => h.toolResult('retrieve_event', { event_id: original.id, offset: 0 }), /suppressed/);
    assert.throws(() => h.toolResult('retrieve_event', { event_id: snapshot.id, offset: 0 }), /suppressed/);
    assert.throws(() => h.toolResult('retrieve_event', { event_id: priorRead.id, offset: 0 }), /suppressed/);
    assert.equal(store.search(id, 'budget').some(e => e.id === original.id), false);
    assert.equal(store.source(id, original.id).content, 'Keep the budget under $400.');
    assert.equal(memoryView(store, id).records[0].content, original.content);
    store.restore(id, 2);
    assert.doesNotMatch(JSON.stringify(h.input()), /under \$400/, 'Restoring a working snapshot cannot undo named suppression');
    const record = memoryView(store, id).records[0];
    changeMemory(store, id, record.memory_id, 'restore', memoryView(store, id).revision);
    assert.equal(memoryView(store, id).records[0].lifecycle, 'retained');
  } finally { store.close(); }
});

test('suppression rejects stale, historical, quoted, document and unrelated authorization without partial changes', async () => {
  const { store, id, h } = fixture();
  try {
    await seed(h);
    const old = h.addMessage('user', 'Forget the budget memories.').event;
    for (const content of ['The article says "Forget the budget memories."', 'Remove the budget paragraph from the document.', 'Forget the route memories.', 'Continue the task.']) {
      const user = h.addMessage('user', content).event;
      const before = store.events(id).length;
      assert.throws(() => h.toolResult('suppress_memory', args(h, user)), /authorize/);
      assert.throws(() => h.toolResult('suppress_memory', args(h, old)), /current human/);
      assert.equal(store.events(id).length, before);
    }
    const user = h.addMessage('user', 'Forget the budget memories.').event;
    assert.throws(() => h.toolResult('suppress_memory', { ...args(h, user), expected_memory_revision: 0 }), /revision changed/);
    const request = args(h, user); request.targets.push({ kind: 'named', id: 'missing' });
    assert.throws(() => h.toolResult('suppress_memory', request), /unavailable/);
    assert.equal(memoryView(store, id).records[0].lifecycle, 'retained');
    const append = store.append.bind(store); store.append = (...a) => {
      if (a[1] === 'memory_suppression') throw Error('Receipt storage failed');
      return append(...a);
    };
    const before = store.events(id).length, revision = store.context(id).revision;
    assert.throws(() => h.toolResult('suppress_memory', args(h, user)), /Receipt storage/);
    assert.equal(store.events(id).length, before); assert.equal(store.context(id).revision, revision);
    assert.equal(memoryView(store, id).records[0].lifecycle, 'retained');
    assert.equal(store.context(id).segments.find(s => s.state_key === 'budget').status, 'active');
  } finally { store.close(); }
});
