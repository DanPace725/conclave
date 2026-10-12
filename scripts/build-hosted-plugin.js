import { mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostedBrand as brand } from '../src/handoff-branding.js';

// Credential-free hosted distribution package. Does not install a plugin,
// load environment files, register a server, or alter local plugin packages.
export function buildHostedPlugin({ origin = 'https://conclave-mcp-production.up.railway.app', output = '.conclave/hosted-plugin' } = {}) {
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== 'https:' || url.username || url.password)
    throw Error('Use a fixed HTTPS hosted origin with no path or credentials');
  const root = resolve(output), write = (path, value) => {
    const file = join(root, path); mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  };
  const identity = { name: 'conclave', version: '0.2.0', description: brand.description,
    author: { name: brand.publisher, email: brand.email }, homepage: `${origin}/get-started`, license: 'MIT' };
  const presentation = { displayName: brand.name, shortDescription: brand.tagline, longDescription: brand.description,
    developerName: brand.publisher, category: 'Productivity', capabilities: ['Save handoffs', 'Resume work', 'Compare revisions'],
    websiteURL: `${origin}/get-started`, supportURL: `${origin}/support`, privacyPolicyURL: `${origin}/privacy`, termsOfServiceURL: `${origin}/terms`,
    defaultPrompt: brand.prompts, brandColor: brand.color, brandColorDark: '#8CB4FF',
    logo: './assets/conclave-icon.png', composerIcon: './assets/conclave-icon.png' };
  const openai = { interface: presentation, onboardingSkill: './skills/get-started/SKILL.md' };
  write('plugin.json', { $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', ...identity, extensions: { 'com.openai': openai } });
  write('mcp.json', { $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { conclave: {
    type: 'streamable-http', url: `${origin}/mcp`, extensions: { 'com.openai': { auth: {
      type: 'oauth', client: { mode: 'dcr' }, defaultScopes: ['handoffs:read', 'handoffs:write'],
    } } },
  } } });
  write('.codex-plugin/plugin.json', { ...identity, skills: './skills/', mcpServers: './.mcp.json', interface: presentation,
    extensions: { 'com.openai': { onboardingSkill: openai.onboardingSkill } } });
  write('.claude-plugin/plugin.json', identity);
  write('.mcp.json', { mcpServers: { conclave: { type: 'http', url: `${origin}/mcp` } } });
  write('README.md', `# Conclave\n\n${brand.tagline}. Published by ${brand.publisher}.\n\n${brand.description}\n\nHosted private pilot: access is by invitation. Use the same Conclave account in each app. This package connects only to ${origin}/mcp; it contains no local launcher, credentials, or saved handoffs.\n\n[Get started](${origin}/get-started) · [Privacy](${origin}/privacy) · [Terms](${origin}/terms) · [Support](${origin}/support)\n\nSupport: ${brand.email}\n\nThis package is prepared for installation/review. It is not evidence of a public directory listing or a deployed update.\n`);
  cpSync(new URL('../src/resources/branding/', import.meta.url), join(root, 'assets'), { recursive: true });
  cpSync(new URL('../packages/conclave-hosted/plugin/skills/', import.meta.url), join(root, 'skills'), { recursive: true });
  return { directory: root, origin, publisher: brand.publisher };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--origin')) throw Error('Usage: npm run hosted:package -- [--origin HTTPS_ORIGIN]');
  console.log(JSON.stringify(buildHostedPlugin({ ...(args[1] ? { origin: args[1] } : {}) }), null, 2));
}
