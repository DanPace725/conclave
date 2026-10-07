import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeConfigurations } from '../packages/conclave-mcp/src/write-configs.js';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const value = result => { assert.equal(result.isError, undefined); return result.structuredContent; };
async function connect(entry, cwd) {
  const client = new Client({ name: 'generated-config-fixture', version: '1' });
  await client.connect(new StdioClientTransport({ command: entry.command, args: entry.args, env: { ...process.env, ...entry.env }, cwd, stderr: 'pipe' }));
  return client;
}

test('cached plugin and independently generated desktop/Code configurations resume one durable local handoff', async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'handoff-config space-'));
  const generated = writeConfigurations({ output: join(temporary, 'examples'), dataDirectory: join(temporary, 'shared data') });
  const cache = join(temporary, 'installed plugin'); cpSync(generated.local.plugin, cache, { recursive: true });
  const origin = await connect(read(join(cache, 'mcp.json')).mcpServers.conclave, temporary);
  let saved;
  try {
    assert.equal((await origin.listTools()).tools.length, 6);
    saved = value(await origin.callTool({ name: 'save_handoff', arguments: { request_id: 'generated-origin',
      packet: { title: 'Coding handoff', summary: 'Use the generated cached plugin.', constraints: ['Preserve the selected branch.'], open_questions: ['Which host next?'] } } }));
  } finally { await origin.close(); }
  for (const config of ['claude-code.json', 'claude-desktop.json']) {
    const destination = await connect(read(join(generated.local.directory, config)).mcpServers.conclave, cache);
    try {
      const packet = value(await destination.callTool({ name: 'get_handoff', arguments: { handoff_id: saved.handoff_id, revision: saved.revision } }));
      assert.deepEqual(packet.packet.constraints, ['Preserve the selected branch.']);
      assert.deepEqual(packet.packet.open_questions, ['Which host next?']);
      assert.equal(packet.sha256, saved.sha256);
    } finally { await destination.close(); }
  }
});

test('hosted templates preserve one HTTPS endpoint with per-host transports and no copied credentials or local paths', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'handoff-online-config-'));
  const generated = writeConfigurations({ output: temporary, origin: 'https://pilot.example.test/' });
  const portable = read(join(generated.online.plugin, 'mcp.json')).mcpServers.conclave;
  assert.deepEqual(portable, { type: 'streamable-http', url: 'https://pilot.example.test/mcp' });
  assert.deepEqual(read(join(generated.online.plugin, '.mcp.json')).mcpServers.conclave, { type: 'http', url: portable.url });
  assert.deepEqual(read(join(generated.online.directory, 'gemini-settings.json')).mcpServers.conclave, { httpUrl: portable.url });
  assert.equal(readFileSync(join(generated.online.directory, 'codex-config.toml'), 'utf8'), '[mcp_servers.conclave]\nurl = "https://pilot.example.test/mcp"\n');
  const marketplace = read(join(generated.online.marketplace, '.agents/plugins/marketplace.json'));
  assert.ok(existsSync(join(generated.online.marketplace, marketplace.plugins[0].source.path, 'plugin.json')));
  assert.equal(generated.local.marketplaceName, 'conclave-local'); assert.equal(generated.online.marketplaceName, 'conclave-online');
  assert.equal(existsSync(join(generated.online.directory, 'claude-desktop.json')), false);
});

test('invalid hosted origins fail before generating any files and never echo credential-bearing input', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'handoff-invalid-config-'));
  for (const origin of ['http://example.test', 'https://example.test/mcp', 'https://user:private-password@example.test', 'https://example.test?token=private-token', 'https://example.test/#fragment']) {
    const output = join(temporary, 'untouched');
    assert.throws(() => writeConfigurations({ output, origin }), error => !error.message.includes('private-'));
    assert.equal(existsSync(output), false);
  }
});
