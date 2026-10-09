import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeConfigurations, writeChatgptPlugin } from '../packages/conclave-mcp/src/write-configs.js';
import { checkLocalTools, checkHandoffId, tunnelInitArguments } from '../packages/conclave-mcp/src/chatgpt.js';

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
  const origin = await connect(read(join(cache, 'mcp.json')).mcpServers.conclave_local, temporary);
  let saved;
  try {
    assert.equal((await origin.listTools()).tools.length, 7);
    saved = value(await origin.callTool({ name: 'save_handoff', arguments: { request_id: 'generated-origin',
      packet: { title: 'Coding handoff', summary: 'Use the generated cached plugin.', constraints: ['Preserve the selected branch.'], open_questions: ['Which host next?'] } } }));
  } finally { await origin.close(); }
  for (const config of ['claude-code.json', 'claude-desktop.json']) {
    const destination = await connect(read(join(generated.local.directory, config)).mcpServers.conclave_local, cache);
    try {
      const packet = value(await destination.callTool({ name: 'get_handoff', arguments: { handoff_id: saved.handoff_id, revision: saved.revision } }));
      assert.deepEqual(packet.packet.constraints, ['Preserve the selected branch.']);
      assert.deepEqual(packet.packet.open_questions, ['Which host next?']);
      assert.equal(packet.sha256, saved.sha256);
    } finally { await destination.close(); }
  }
  assert.deepEqual(checkHandoffId(saved.handoff_id, join(temporary, 'shared data')), { found: true, revision: 1 });
  assert.deepEqual(checkHandoffId(saved.handoff_id, join(temporary, 'other store')), { found: false });
});

test('ChatGPT registration binds the actual app without accidentally bundling local stdio tools', async () => {
  const temporary = mkdtempSync(join(tmpdir(), 'handoff-chatgpt-'));
  const appId = 'plugin_asdk_app_fixture_actual_connection';
  const generated = writeChatgptPlugin({ appId, output: temporary });
  assert.deepEqual(read(join(generated.plugin, '.app.json')), { apps: { conclave_local: { id: appId, required: true } } });
  assert.equal(read(join(generated.plugin, 'plugin.json')).name, 'conclave-local');
  assert.equal(read(join(generated.plugin, 'plugin.json')).extensions['com.openai'].interface.displayName, 'conclave_local');
  assert.equal(read(join(generated.plugin, 'plugin.json')).extensions['com.openai'].apps, './.app.json');
  assert.equal(read(join(generated.plugin, '.codex-plugin', 'plugin.json')).apps, './.app.json');
  assert.equal(existsSync(join(generated.plugin, 'mcp.json')), false);
  assert.equal(existsSync(join(generated.plugin, '.mcp.json')), false);
  assert.ok(existsSync(join(generated.plugin, 'skills', 'resume-handoff', 'SKILL.md')));
  for (const appId of ['conv_not_an_app', 'tunnel_not_an_app', 'asdk_app_short', 'https://example.test?secret=hidden']) {
    const output = join(temporary, 'invalid');
    assert.throws(() => writeChatgptPlugin({ appId, output }), /registered MCP app ID/);
    assert.equal(existsSync(output), false);
  }
  assert.deepEqual(new Set(await checkLocalTools()), new Set(['save_handoff', 'create_project', 'find_handoffs', 'get_handoff',
    'list_handoff_versions', 'compare_handoff_versions', 'open_handoff_library']));
});

test('tunnel setup retains the complete service ID and keeps credentials out of command arguments', () => {
  const id = 'tunnel_abcd_complete_service_identifier';
  const args = tunnelInitArguments(id);
  assert.equal(args[args.indexOf('--tunnel-id') + 1], id);
  assert.equal(args[args.indexOf('--health-listen-addr') + 1], '127.0.0.1:3215');
  assert.equal(args.includes('--force'), false);
  assert.equal(args.some(value => value.startsWith('sk-')), false);
  assert.throws(() => tunnelInitArguments('tunnel_id\n--force'), /complete tunnel ID/);
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
  const localManifest = read(join(generated.local.plugin, 'plugin.json'));
  assert.equal(localManifest.name, 'conclave-local');
  assert.equal(localManifest.extensions['com.openai'].interface.displayName, 'conclave_local');
  assert.equal(read(join(generated.online.plugin, 'plugin.json')).name, 'conclave-handoffs');
  assert.equal(read(join(generated.online.plugin, 'plugin.json')).extensions['com.openai'].interface.displayName, 'Conclave handoffs');
  for (const config of ['claude-code.json', 'claude-desktop.json', 'cursor-mcp.json', 'gemini-settings.json'])
    assert.deepEqual(Object.keys(read(join(generated.local.directory, config)).mcpServers), ['conclave_local']);
  assert.deepEqual(Object.keys(read(join(generated.local.directory, 'vscode-mcp.json')).servers), ['conclave_local']);
  assert.match(readFileSync(join(generated.local.directory, 'codex-config.toml'), 'utf8'), /^\[mcp_servers\.conclave_local\]/);
  assert.deepEqual(Object.keys(read(join(generated.local.plugin, '.mcp.json')).mcpServers), ['conclave_local']);
  assert.equal(read(join(generated.local.plugin, '.claude-plugin/plugin.json')).name, 'conclave-local');
  for (const catalog of ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json'])
    assert.equal(read(join(generated.local.marketplace, catalog)).plugins[0].name, 'conclave-local');
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
