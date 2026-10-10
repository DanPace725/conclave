import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Synthetic MCP clients, not ChatGPT/Claude models. No credentials or API calls.
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = resolve(root, '.conclave/pilot-rehearsals');
mkdirSync(temporary, { recursive: true });
const directory = mkdtempSync(resolve(temporary, 'run-'));
const seed = JSON.parse(readFileSync(new URL('../docs/fixtures/clamp-pilot.json', import.meta.url), 'utf8'));
const clients = [];
async function connect(name) {
  const client = new Client({ name, version: '1.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [resolve(root, 'packages/conclave-mcp/src/stdio.js')],
    env: { ...process.env, CONCLAVE_HANDOFF_DATA: directory }, stderr: 'pipe' }));
  clients.push(client); return client;
}
async function call(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw Error(JSON.stringify(result.structuredContent));
  return result.structuredContent;
}
try {
  const origin = await connect('synthetic-origin');
  const advertised = (await origin.listTools()).tools.find(t => t.name === 'save_handoff');
  assert.ok(advertised.inputSchema.properties.packet.properties.clamp);
  const supporting = await call(origin, 'save_handoff', { request_id: 'supporting-context', packet: {
    ...seed, title: 'CLAMP pilot supporting idea', summary: 'Only saved, explicit edges belong in the graph.',
    next_steps: ['Check relation labels before proposing a graph.'], source_app: 'Synthetic origin' } });
  const initial = { ...seed, source_app: 'Synthetic origin', clamp: { ...seed.clamp,
    links: [{ relation: 'depends_on', handoff_id: supporting.readable_id, revision: 1 }] } };
  const first = await call(origin, 'save_handoff', { request_id: 'pilot-1', packet: initial });
  await origin.close();
  const receiver = await connect('synthetic-receiver');
  const read = await call(receiver, 'get_handoff', { handoff_id: first.readable_id, revision: 1 });
  assert.deepEqual(read.packet.constraints, seed.constraints);
  assert.deepEqual(read.packet.open_questions, seed.open_questions);
  assert.equal(read.linked_handoffs[0].readable_id, supporting.readable_id);
  const secondPacket = { ...read.packet, source_app: 'Synthetic receiver', summary: 'Three dashboard labels proposed: Project, Clyps, Connections.',
    decisions: [...read.packet.decisions, 'Propose Project, Clyps and Connections as labels.'],
    next_steps: ['Review the labels and ask the user which view should open by default.'] };
  const second = await call(receiver, 'save_handoff', { request_id: 'pilot-2', packet: secondPacket,
    handoff_id: first.readable_id, expected_revision: 1 });
  assert.equal(second.readable_id, first.readable_id);
  assert.equal((await call(receiver, 'save_handoff', { request_id: 'pilot-2', packet: secondPacket,
    handoff_id: first.handoff_id, expected_revision: 1 })).replayed, true);
  const returned = await connect('synthetic-return');
  const latest = await call(returned, 'get_handoff', { handoff_id: first.readable_id, revision: 2 });
  assert.deepEqual(latest.packet.constraints, seed.constraints);
  assert.deepEqual(latest.packet.open_questions, seed.open_questions);
  const third = await call(returned, 'save_handoff', { request_id: 'pilot-3', handoff_id: first.readable_id,
    expected_revision: 2, packet: { ...latest.packet, title: 'CLAMP pilot reviewed project map', source_app: 'Synthetic return',
      summary: 'The labels were reviewed. The default view still needs a user decision.' } });
  assert.equal(third.readable_id, first.readable_id);
  const diff = await call(returned, 'compare_handoff_versions', { handoff_id: first.readable_id, from_revision: 1, to_revision: 3 });
  assert.ok(!diff.changes.some(c => ['constraints', 'open_questions', 'clamp'].includes(c.field)));
  const documents = [];
  for (let revision = 1; revision <= 3; revision++) {
    const saved = await call(returned, 'get_handoff', { handoff_id: first.readable_id, revision, format: 'ormd' });
    assert.ok(saved.clyp.budget.tokens <= 1500);
    assert.ok(seed.constraints.every(c => saved.ormd.includes(c)));
    documents.push({ revision, tokens: saved.clyp.budget.tokens, ormd_sha256: saved.clyp.ormd_sha256 });
  }
  console.log(JSON.stringify({ status: 'passed', evidence: 'synthetic independent stdio clients; no live models or hosted accounts',
    reference: first.readable_id, supporting_reference: supporting.readable_id,
    constraints_preserved: true, questions_preserved: true, alias_survived_rename: true, documents }, null, 2));
} finally {
  await Promise.allSettled(clients.map(client => client.close()));
}
