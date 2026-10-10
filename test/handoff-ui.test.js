import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Store } from '../src/store.js';
import { HandoffService } from '../src/handoffs.js';
import { createHandoffMcpServer } from '../src/handoff-mcp-server.js';
import { handoffUiUri, handoffUiMimeType } from '../src/handoff-ui.js';

async function fixture(t, options = {}) {
  const store = new Store(undefined, { memory: true }), service = new HandoffService(store);
  const saved = service.save({ packet: { title: '<script>private-title</script>', summary: 'Private packet contents', constraints: ['Keep originals.'] }, request_id: 'ui-fixture' });
  const server = createHandoffMcpServer(service, options), client = new Client({ name: 'headless-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); store.close(); });
  return { service, client, saved };
}

test('separate display tool exposes a static restricted UI resource while data tools remain headless', async t => {
  const { client, saved } = await fixture(t, { oauth: true });
  const tools = (await client.listTools()).tools, display = tools.find(tool => tool.name === 'open_handoff_library');
  assert.equal(display._meta.ui.resourceUri, handoffUiUri); assert.ok(display.outputSchema);
  assert.equal(display.annotations.readOnlyHint, true);
  assert.deepEqual(display._meta.securitySchemes, [{ type: 'oauth2', scopes: ['handoffs:read'] }]);
  assert.deepEqual(tools.find(tool => tool.name === 'save_handoff')._meta.ui.visibility, ['model']);
  for (const tool of tools.filter(tool => tool !== display)) assert.equal(tool._meta.ui.resourceUri, undefined);
  const ui = await client.readResource({ uri: handoffUiUri });
  assert.equal(ui.contents[0].mimeType, handoffUiMimeType);
  assert.deepEqual(ui.contents[0]._meta.ui.csp, { connectDomains: [], resourceDomains: [], frameDomains: [] });
  assert.ok(!ui.contents[0].text.includes(saved.handoff_id));
  assert.ok(!ui.contents[0].text.includes('Private packet contents'));
  assert.ok(!ui.contents[0].text.includes('CONCLAVE_SCRIPT'));
  const result = await client.callTool({ name: 'open_handoff_library', arguments: { handoff_id: saved.handoff_id } });
  assert.equal(result.isError, undefined); assert.equal(result.structuredContent.view, 'packet');
  assert.equal(result.structuredContent.data.handoff_id, saved.handoff_id);
  assert.equal(JSON.parse(result.content[0].text).data.packet.title, '<script>private-title</script>');
});

test('display tool returns useful paginated data to hosts without UI and handles errors without mutation', async t => {
  const { client, service, saved } = await fixture(t, { write: false });
  const page = await client.callTool({ name: 'open_handoff_library', arguments: { query: 'private', offset: 0 } });
  assert.equal(page.structuredContent.view, 'library'); assert.equal(page.structuredContent.data.total, 1);
  assert.equal(page.structuredContent.query, 'private');
  assert.equal((await client.listTools()).tools.some(tool => tool.name === 'save_handoff'), false);
  const conflict = await client.callTool({ name: 'open_handoff_library', arguments: { handoff_id: saved.handoff_id, query: 'other' } });
  assert.equal(conflict.isError, true); assert.equal(conflict.structuredContent.data.error, 'invalid_input');
  const missing = await client.callTool({ name: 'open_handoff_library', arguments: { handoff_id: 'conv_absent' } });
  assert.equal(missing.isError, true); assert.equal(missing.structuredContent.data.error, 'not_found');
  service.save({ packet: { title: 'Linked Clyp', summary: 'Explicit connection.', project: 'Graph test', objective: 'Inspect a linked handoff.', next_steps: ['Read the saved target.'],
    clamp: { version: '1.0', kind: 'clyp', links: [{ relation: 'depends_on', handoff_id: saved.readable_id, revision: 1 }] } }, request_id: 'ui-graph' });
  const graph = await client.callTool({ name: 'open_handoff_library', arguments: { view: 'graph', project: 'Graph test' } });
  assert.equal(graph.isError, undefined); assert.equal(graph.structuredContent.view, 'graph');
  assert.equal(graph.structuredContent.project, 'Graph test'); assert.equal(graph.structuredContent.data.nodes.length, 2);
  assert.equal(graph.structuredContent.data.edges[0].target, saved.handoff_id); assert.equal(graph.structuredContent.data.edges[0].target_revision, 1);
  const rawGraph = await client.callTool({ name: 'get_handoff_graph', arguments: { project: 'Graph test' } });
  assert.deepEqual(rawGraph.structuredContent, graph.structuredContent.data);
  const mixed = await client.callTool({ name: 'open_handoff_library', arguments: { view: 'graph', query: 'private' } });
  assert.equal(mixed.isError, true); assert.equal(mixed.structuredContent.data.error, 'invalid_input');
  assert.equal(service.history({ handoff_id: saved.handoff_id }).total, 1);
});

test('optional UI can be omitted while all seven data tools remain available', async t => {
  const { client } = await fixture(t, { ui: false });
  assert.equal((await client.listTools()).tools.length, 7);
  assert.equal(client.getServerCapabilities().resources, undefined);
});
