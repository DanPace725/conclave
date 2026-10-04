import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { WorkspaceHarness, workspaceFiles } from '../src/workspace.js';
import { toolIngress, projectReceipts } from '../src/ingress.js';

function fixture() {
  const store = new Store(undefined, { memory: true }), id = store.create();
  const h = new WorkspaceHarness(store, id, { name: 'openai' }, { budget: 256000 });
  const original = h.toolResult('workspace_write', { path: 'plan.md', content: '# Plan\nBudget: 100\nGuests: 12\n## Access\nKeep lift access.', expected_source_event_id: null });
  h.addMessage('user', 'Update the budget and guests; preserve access.');
  h.toolResult('workspace_read', { path: 'plan.md', offset: 0 });
  const args = { path: 'plan.md', expected_source_event_id: original.source_event_id,
    patches: [{ find: 'Budget: 100', replace: 'Budget: 150' }, { find: 'Guests: 12', replace: 'Guests: 10' }] };
  return { store, id, h, original, args };
}

test('atomic patches preserve unmatched text, save one version, and require complete current readback', () => {
  const { store, id, h, original, args } = fixture();
  try {
    const receipt = h.toolResult('workspace_patch_batch', args);
    assert.equal(receipt.change_summary.patch_count, 2); assert.equal(receipt.previous_source_event_id, original.source_event_id);
    assert.equal(store.events(id).filter(e => e.kind === 'document').length, 2);
    assert.equal(workspaceFiles(store, id)[0].content, '# Plan\nBudget: 150\nGuests: 10\n## Access\nKeep lift access.');
    assert.match(h.completionCheck(), /read every page/i);
    h.toolResult('workspace_read', { path: 'plan.md', offset: 0 }); assert.equal(h.completionCheck(), null);
    assert.throws(() => h.toolResult('workspace_patch_batch', args), /Stale workspace/);
    assert.equal(store.source(id, original.source_event_id).content.includes('Budget: 100'), true);
    assert.equal(toolIngress('workspace_patch_batch', receipt, 'r').changed, false);
    const saved = store.append(id, 'tool_result', JSON.stringify(receipt), { call_id: 'batch', tool: 'workspace_patch_batch' });
    const projection = projectReceipts({ input: [{ type: 'function_call', call_id: 'batch', name: 'workspace_patch_batch', arguments: 'x'.repeat(4100) },
      { type: 'function_call_output', call_id: 'batch', output: JSON.stringify(receipt) }] }, store.events(id));
    assert.equal(JSON.parse(projection.payload.input[0].arguments).receipt_event_id, saved.id);
  } finally { store.close(); }
});

test('a bad, overlapping, cascading, oversized or unread batch leaves files and context unchanged', () => {
  const { store, id, h, args } = fixture();
  try {
    const before = store.events(id).length, revision = store.context(id).revision;
    for (const patches of [[], [{ find: 'Budget: 100', replace: 'Budget: 150' }, { find: 'missing', replace: 'x' }],
      [{ find: 'Budget: 100', replace: 'x' }, { find: '100', replace: 'y' }],
      [{ find: 'Budget: 100', replace: 'Budget: 150' }, { find: '150', replace: '200' }],
      [{ find: 'Guests: 12', replace: 'x'.repeat(100001) }]]) {
      assert.throws(() => h.toolResult('workspace_patch_batch', { ...args, patches }));
      assert.equal(store.events(id).length, before); assert.equal(store.context(id).revision, revision);
    }
    const append = store.append.bind(store); store.append = (...a) => {
      if (a[1] === 'context_transform') throw Error('Commit fixture failed'); return append(...a);
    };
    assert.throws(() => h.toolResult('workspace_patch_batch', args), /Commit fixture failed/);
    assert.equal(store.events(id).length, before); assert.equal(workspaceFiles(store, id)[0].content.includes('Budget: 100'), true);
    store.append = append;
    h.addMessage('user', 'Another update.'); assert.throws(() => h.toolResult('workspace_patch_batch', args), /Read every page/);
  } finally { store.close(); }
});
