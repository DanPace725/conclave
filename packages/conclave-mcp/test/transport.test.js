import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Store } from '../../../src/store.js';
import { HandoffService } from '../../../src/handoffs.js';
import { startHandoffHttpServer } from '../src/http.js';

const input = { request_id: 'cross-app-save', packet: { title: 'Prototype handoff', summary: 'Continue the prototype in another app.',
  constraints: ['Preserve the original diagram.'], decisions: ['Use editable geometry.'], source_app: 'app-a',
  context: 'Geometry remains editable.\n\nThe color palette uses blue.' } };
const decode = result => { assert.equal(result.isError, undefined, JSON.stringify(result)); return result.structuredContent || JSON.parse(result.content[0].text); };
const launcher = fileURLToPath(new URL('../src/stdio.js', import.meta.url));
async function connectStdio(directory, name) {
  const client = new Client({ name, version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [launcher],
    env: { ...process.env, CONCLAVE_HANDOFF_DATA: directory }, stderr: 'pipe' });
  await client.connect(transport);
  return client;
}

test('independent stdio clients save, restart, find and retrieve the same durable packet', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'handoff-mcp-'));
  const first = await connectStdio(directory, 'origin-app');
  let saved;
  try {
    const tools = (await first.listTools()).tools;
    assert.deepEqual(tools.map(tool => tool.name), ['save_handoff', 'find_handoffs', 'get_handoff', 'list_handoff_versions', 'compare_handoff_versions', 'open_handoff_library']);
    assert.equal(tools.find(tool => tool.name === 'save_handoff').annotations.readOnlyHint, false);
    assert.equal(tools.find(tool => tool.name === 'get_handoff').annotations.readOnlyHint, true);
    saved = decode(await first.callTool({ name: 'save_handoff', arguments: input }));
  } finally { await first.close(); }
  const second = await connectStdio(directory, 'destination-app');
  try {
    const found = decode(await second.callTool({ name: 'find_handoffs', arguments: { query: 'Prototype' } }));
    assert.equal(found.handoffs[0].handoff_id, saved.handoff_id);
    const pulled = decode(await second.callTool({ name: 'get_handoff', arguments: { handoff_id: saved.handoff_id, focus: 'palette' } }));
    assert.equal(pulled.packet.context, 'The color palette uses blue.');
    assert.deepEqual(pulled.packet.constraints, ['Preserve the original diagram.']);
    assert.equal(pulled.packet.source_app, 'app-a');
    assert.equal(pulled.provenance.author_claims_verified, false);
    const history = decode(await second.callTool({ name: 'list_handoff_versions', arguments: { handoff_id: saved.handoff_id } }));
    assert.equal(history.revisions[0].sha256, saved.sha256);
    const updated = decode(await second.callTool({ name: 'save_handoff', arguments: { ...input, request_id: 'cross-app-update',
      handoff_id: saved.handoff_id, expected_revision: 1, packet: { ...input.packet, constraints: [] } } }));
    assert.equal(updated.revision, 2);
    const compared = decode(await second.callTool({ name: 'compare_handoff_versions', arguments: { handoff_id: saved.handoff_id, from_revision: 1 } }));
    assert.deepEqual(compared.changes.find(x => x.field === 'constraints'), { field: 'constraints', before: input.packet.constraints, after: [] });
    assert.equal(decode(await second.callTool({ name: 'save_handoff', arguments: input })).replayed, true);
    const missing = await second.callTool({ name: 'get_handoff', arguments: { handoff_id: 'conv_missing' } });
    assert.equal(missing.isError, true);
    assert.equal(missing.structuredContent.error, 'not_found');
  } finally { await second.close(); }
});

test('separate simultaneous stdio processes commit one save for identical retries', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'handoff-parallel-'));
  const first = await connectStdio(directory, 'one'), second = await connectStdio(directory, 'two');
  try {
    const results = (await Promise.all([first, second].map(client => client.callTool({ name: 'save_handoff', arguments: input })))).map(decode);
    assert.equal(results[0].handoff_id, results[1].handoff_id);
    assert.equal(results.filter(result => result.replayed).length, 1);
    assert.equal(decode(await first.callTool({ name: 'find_handoffs', arguments: {} })).total, 1);
  } finally { await Promise.all([first.close(), second.close()]); }
});

test('HTTP requires a secret, blocks foreign origins/hosts, and shares packets with an SDK client', async () => {
  const store = new Store(undefined, { memory: true }), service = new HandoffService(store);
  const token = 'fixture-only-secret-with-more-than-32-characters';
  const server = await startHandoffHttpServer({ service, token, port: 0 });
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  const client = new Client({ name: 'http-app', version: '1.0.0' });
  try {
    assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { authorization: 'Bearer wrong' }, body: '{}' })).status, 401);
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    assert.equal((await fetch(url, { method: 'POST', headers: { ...auth, origin: 'https://hostile.example' }, body: '{}' })).status, 403);
    // fetch normalizes Host; use native HTTP to exercise an actual hostile header.
    const hostileHost = await new Promise((resolveStatus, reject) => {
      const req = request(url, { method: 'POST', headers: { ...auth, host: 'hostile.example' } }, res => { res.resume(); resolveStatus(res.statusCode); });
      req.on('error', reject); req.end('{}');
    });
    assert.equal(hostileHost, 403);
    assert.equal((await fetch(url, { headers: auth })).status, 405);
    assert.equal((await fetch(url, { method: 'POST', headers: auth, body: '{' })).status, 400);
    const initialize = await fetch(url, { method: 'POST', headers: { ...auth, accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'protocol-probe', version: '1' },
      } }) });
    const negotiated = (await initialize.json()).result;
    assert.equal(negotiated.protocolVersion, '2025-11-25');
    await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: auth } }));
    const saved = decode(await client.callTool({ name: 'save_handoff', arguments: input }));
    const packet = decode(await client.callTool({ name: 'get_handoff', arguments: { handoff_id: saved.handoff_id } }));
    assert.deepEqual(packet.packet.constraints, input.packet.constraints);
    assert.equal(packet.selection.complete, true);
    assert.equal((await fetch(url, { method: 'POST', headers: auth, body: JSON.stringify({ large: 'x'.repeat(110000) }) })).status, 413);
  } finally {
    await client.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
});

test('HTTP refuses weak authentication configuration before listening', async () => {
  await assert.rejects(startHandoffHttpServer({ service: {}, token: 'short', port: 0 }), /at least 32/);
});
