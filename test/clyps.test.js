import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Store } from '../src/store.js';
import { HandoffService } from '../src/handoffs.js';
import { createHandoffMcpServer } from '../src/handoff-mcp-server.js';
import { clypBudget, documentHash } from '../src/clyps.js';
import { exportHandoffBundle, importHandoffBundle } from '../src/handoff-portability.js';

const packet = (extra = {}) => ({ title: 'Continue CLAMP', summary: 'The profile is drafted.', objective: 'Verify model handoffs.',
  decisions: ['Use revision-pinned links.'], constraints: ['Keep every essential constraint.'],
  open_questions: ['Which model resumes first?'], next_steps: ['Read the profile and test a continuation.'],
  context: 'Core context.\n\nSupporting context.', source_app: 'Codex', project: 'CLAMP',
  clamp: { version: '1.0', kind: 'clyp', links: [] }, ...extra });
const save = (service, request_id, extra = {}, update = {}) => service.save({ packet: packet(extra), request_id, ...update });

test('complete Clyp ORMD survives restart, retries and focus without changing authority', () => {
  const directory = mkdtempSync(join(tmpdir(), 'clyps-'));
  let store = new Store(directory), service = new HandoffService(store);
  const saved = save(service, 'original');
  const doc = service.get({ handoff_id: saved.handoff_id, format: 'ormd' });
  assert.match(doc.ormd, /^<!-- ormd:1.0 -->\n---\n/);
  assert.match(doc.ormd, /# Continue CLAMP\n/);
  assert.ok(doc.ormd.includes('Keep every essential constraint.'));
  assert.equal(doc.packet, undefined);
  assert.equal(doc.clyp.ormd_sha256, documentHash(doc.ormd));
  assert.deepEqual(doc.clyp.budget, clypBudget(doc.ormd));
  assert.ok(doc.clyp.budget.tokens <= 1500);
  assert.equal(store.events(saved.handoff_id).at(-1).content, doc.ormd);
  assert.equal(doc.provenance.authority, 'external_data');
  store.close(); store = new Store(directory); service = new HandoffService(store);
  try {
    assert.equal(save(service, 'original').replayed, true);
    assert.equal(service.get({ handoff_id: saved.readable_id, format: 'ormd' }).ormd, doc.ormd);
    const focused = service.get({ handoff_id: saved.handoff_id, focus: 'Supporting' });
    assert.equal(focused.packet.context, packet().context);
    assert.equal(focused.selection.complete, true);
    assert.throws(() => service.get({ handoff_id: saved.handoff_id, format: 'ormd', focus: 'Core' }), { code: 'invalid_input' });
  } finally { store.close(); }
});

test('over-budget, missing continuation fields and invalid profiles fail atomically without clipping text', () => {
  const store = new Store(undefined, { memory: true }), service = new HandoffService(store);
  try {
    const before = store.list().length;
    assert.throws(() => save(service, 'large', { context: 'many separate tokens '.repeat(1400) }), { code: 'capacity' });
    for (const extra of [{ objective: '' }, { next_steps: [] }, { constraints: Array(9).fill('keep') },
      { clamp: { version: '2.0', kind: 'clyp' } }, { clamp: { version: '1.0', kind: 'clyp', authority: 'human' } }])
      assert.throws(() => save(service, 'invalid', extra), { code: 'invalid_input' });
    assert.equal(store.list().length, before);
    const first = save(service, 'initial');
    assert.throws(() => save(service, 'downgrade', { clamp: undefined }, { handoff_id: first.handoff_id, expected_revision: 1 }), { code: 'invalid_input' });
    assert.equal(service.history({ handoff_id: first.handoff_id }).total, 1);
  } finally { store.close(); }
});

test('explicit links pin revisions, validate visibility, and project graphs load one boundary hop', () => {
  const store = new Store(undefined, { memory: true }), service = new HandoffService(store);
  try {
    const c = save(service, 'c', { title: 'C', project: 'Third' });
    const link = (id, revision = 1) => ({ relation: 'depends_on', handoff_id: id, revision });
    const b = save(service, 'b', { title: 'B', project: 'Other', clamp: { version: '1.0', kind: 'clyp', links: [link(c.readable_id)] } });
    assert.equal(service.get({ handoff_id: b.readable_id }).packet.clamp.links[0].handoff_id, c.handoff_id);
    assert.equal(service.get({ handoff_id: b.readable_id }).linked_handoffs[0].readable_id, c.readable_id);
    const a = save(service, 'a', { title: 'A', clamp: { version: '1.0', kind: 'clyp', links: [link(b.handoff_id)] } });
    save(service, 'b2', { title: 'B', project: 'Other' }, { handoff_id: b.handoff_id, expected_revision: 1 });
    const graph = service.graph({ project: 'CLAMP' });
    assert.deepEqual(new Set(graph.nodes.map(n => n.id)), new Set([a.handoff_id, b.handoff_id]));
    assert.equal(graph.edges.length, 1); assert.equal(graph.edges[0].target_revision, 1);
    assert.equal(graph.nodes.find(n => n.id === b.handoff_id).revision, 2);
    for (const bad of [link('conv_missing'), link(b.handoff_id, 99)])
      assert.throws(() => save(service, 'bad-link', { clamp: { version: '1.0', kind: 'clyp', links: [bad] } }), { code: 'not_found' });
    assert.throws(() => save(service, 'self', { clamp: { version: '1.0', kind: 'clyp', links: [link(a.handoff_id)] } },
      { handoff_id: a.handoff_id, expected_revision: 1 }), { code: 'invalid_input' });
  } finally { store.close(); }
});

test('Clyp backup imports generate bounded ORMD with new identity and declared import lineage', () => {
  const source = new Store(undefined, { memory: true }), target = new Store(undefined, { memory: true });
  try {
    const service = new HandoffService(source), first = save(service, 'backup');
    const bundle = exportHandoffBundle(service, first.readable_id);
    const imported = importHandoffBundle(new HandoffService(target), bundle);
    const doc = new HandoffService(target).get({ handoff_id: imported.handoff_id, format: 'ormd' });
    assert.notEqual(imported.handoff_id, first.handoff_id);
    assert.equal(imported.sha256, first.sha256);
    assert.ok(doc.ormd.includes(imported.handoff_id));
    assert.equal(doc.clyp.ormd_sha256, documentHash(doc.ormd));
    assert.equal(doc.provenance.imported_from.claims_verified, false);
  } finally { source.close(); target.close(); }
});

test('graphs refuse oversized results instead of silently losing connections', () => {
  const store = new Store(undefined, { memory: true }), service = new HandoffService(store);
  try {
    for (let i = 0; i < 101; i++) service.save({ request_id: `node-${i}`, packet: { title: `Node ${i}`, summary: 'Saved work', project: i ? 'Large' : 'Small' } });
    assert.throws(() => service.graph(), { code: 'capacity' });
    assert.equal(service.graph({ project: 'Large' }).nodes.length, 100);
    assert.equal(service.graph({ project: 'Small' }).nodes.length, 1);
  } finally { store.close(); }
});

test('MCP discovery advertises CLAMP and separate clients save/read complete bounded documents', async t => {
  const store = new Store(undefined, { memory: true }), service = new HandoffService(store);
  const clients = [];
  for (const name of ['writer', 'reader']) {
    const server = createHandoffMcpServer(service), client = new Client({ name, version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
    clients.push(client); t.after(async () => { await client.close(); await server.close(); });
  }
  t.after(() => store.close());
  const tools = (await clients[0].listTools()).tools;
  assert.ok(tools.find(tool => tool.name === 'save_handoff').inputSchema.properties.packet.properties.clamp);
  const result = await clients[0].callTool({ name: 'save_handoff', arguments: { packet: packet(), request_id: 'cross-client' } });
  assert.equal(result.isError, undefined);
  const doc = await clients[1].callTool({ name: 'get_handoff', arguments: { handoff_id: result.structuredContent.readable_id, format: 'ormd' } });
  assert.equal(doc.isError, undefined); assert.match(doc.structuredContent.ormd, /Keep every essential constraint/);
  assert.ok(doc.structuredContent.clyp.budget.tokens <= 1500);
});
