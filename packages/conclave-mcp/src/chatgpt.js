import { existsSync, mkdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { defaultDirectory } from './local.js';
import { writeChatgptPlugin } from './write-configs.js';

const checkout = fileURLToPath(new URL('../../../', import.meta.url));
export const tunnelDirectory = join(checkout, '.conclave', 'chatgpt-tunnel');
const defaultClient = join(checkout, '.conclave', 'tunnel-client', process.platform === 'win32' ? 'tunnel-client.exe' : 'tunnel-client');
const launcher = fileURLToPath(new URL('./stdio.js', import.meta.url));
const profile = join(tunnelDirectory, 'conclave.yaml');

// Forward slashes work on Windows and avoid ambiguity in the vendor client's
// command-string tokenizer. This command is parsed as argv, never a shell.
export function tunnelCommand(node = process.execPath, script = launcher) {
  if (![node, script].every(isAbsolute) || [node, script].some(value => /[\r\n\0"]/.test(value)))
    throw Error('Supply absolute Node and launcher paths without quotes or control characters.');
  return [node, script].map(value => `"${value.replaceAll('\\', '/')}"`).join(' ');
}

export function tunnelInitArguments(tunnelId, directory = tunnelDirectory) {
  // Preserve namespaced IDs verbatim. Platform, not this helper, owns ID validity.
  if (typeof tunnelId !== 'string' || !/^tunnel_[A-Za-z0-9_-]{8,160}$/.test(tunnelId))
    throw Error('Copy the complete tunnel ID from OpenAI tunnel settings.');
  return ['init', '--sample', 'sample_mcp_stdio_local', '--profile', 'conclave', '--profile-dir', resolve(directory),
    '--tunnel-id', tunnelId, '--mcp-command', tunnelCommand(), '--health-listen-addr', '127.0.0.1:3215'];
}

export async function checkLocalTools(entry = { command: process.execPath, args: [launcher] }) {
  // Discovery uses disposable storage; checking a connection cannot add user packets.
  const directory = await mkdtemp(join(tmpdir(), 'conclave-chatgpt-check-'));
  const client = new Client({ name: 'conclave-chatgpt-check', version: '1' });
  try {
    await client.connect(new StdioClientTransport({ ...entry, env: { ...process.env, ...entry.env, CONCLAVE_HANDOFF_DATA: directory }, stderr: 'pipe' }));
    return (await client.listTools()).tools.map(tool => tool.name);
  } finally { await client.close(); await rm(directory, { recursive: true, force: true }); }
}

export function checkHandoffId(handoffId, directory = process.env.CONCLAVE_HANDOFF_DATA || defaultDirectory) {
  if (!/^conv_[A-Za-z0-9_-]+$/.test(handoffId)) throw Error('Supply the ID returned by save_handoff.');
  const path = join(directory, 'conclave.sqlite');
  if (!existsSync(path)) return { found: false };
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const event = db.prepare("SELECT metadata FROM events WHERE conversation_id = ? AND kind = 'handoff_packet' ORDER BY seq DESC LIMIT 1").get(handoffId);
    return event ? { found: true, revision: JSON.parse(event.metadata).revision } : { found: false };
  } finally { db.close(); }
}

async function invoke(args) {
  const binary = process.env.CONCLAVE_TUNNEL_CLIENT || defaultClient;
  if (!existsSync(binary)) throw Error('Download the official tunnel-client and set CONCLAVE_TUNNEL_CLIENT to its executable path. See docs/CHATGPT_LOCAL.md.');
  await new Promise((done, reject) => {
    const child = spawn(binary, args, { stdio: 'inherit', windowsHide: true,
      env: { ...process.env, CONCLAVE_HANDOFF_DATA: process.env.CONCLAVE_HANDOFF_DATA || defaultDirectory } });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? done() : reject(Error('tunnel-client failed. Follow its diagnostic above.')));
  });
}

export async function chatgptSetup(args) {
  const [action, option, value, ...extra] = args;
  if (extra.length) throw Error('Unexpected setup arguments. See docs/CHATGPT_LOCAL.md.');
  if (action === 'check' && (!option || option === '--handoff-id') && (!option || value)) {
    const tools = await checkLocalTools();
    console.log(`Local MCP discovery succeeded: ${tools.join(', ')}.`);
    console.log('This verifies the server, not tool attachment in a ChatGPT conversation.');
    if (value) console.log(`Requested ID in local handoff storage: ${JSON.stringify(checkHandoffId(value))}. Ordinary Converse chats are separate.`);
  } else if (action === 'prepare' && option === '--tunnel-id' && value) {
    const parameters = tunnelInitArguments(value);
    mkdirSync(tunnelDirectory, { recursive: true });
    await invoke(parameters); // Vendor init refuses to replace an existing profile.
    console.log('Profile prepared. The runtime key is referenced through CONTROL_PLANE_API_KEY; it is not saved here.');
  } else if (['doctor', 'run'].includes(action) && !option) {
    if (!existsSync(profile)) throw Error('First run prepare with the tunnel ID from OpenAI settings.');
    if (!process.env.CONTROL_PLANE_API_KEY) throw Error('Set CONTROL_PLANE_API_KEY privately in this terminal. Do not paste it into chat.');
    await invoke([action, '--profile-file', profile, ...(action === 'doctor' ? ['--explain'] : [])]);
  } else if (action === 'link' && option === '--app-id' && value) {
    const output = writeChatgptPlugin({ appId: value });
    console.log(`Registered-app plugin package written to ${output.marketplace}. Install from conclave-chatgpt if you want the bundled workflows.`);
    console.log('Registration, tunnel access and model tool attachment still need a fresh-chat test.');
  } else throw Error('Usage: npm run mcp:chatgpt -- check [--handoff-id ID] | prepare --tunnel-id ID | doctor | run | link --app-id ID');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await chatgptSetup(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
