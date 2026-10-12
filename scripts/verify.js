import { spawnSync } from 'node:child_process';

// Complete offline verification. All stores and host identities are synthetic;
// this never loads .env, calls a model, or connects to a production account.
console.log('Browser prerequisites: installed Microsoft Edge, local listeners, and permission to launch browser processes.');
for (const args of [
  ['scripts/check.js'],
  ['scripts/test.js'],
  ['scripts/test.js', 'packages/conclave-mcp/test/transport.test.js', 'packages/conclave-hosted/test/consent-browser.test.js'],
  ['scripts/test-handoff-ui.js'],
  ['scripts/test-dashboard-ui.js'],
]) {
  console.log(`Running: node ${args.join(' ')}`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Complete offline verification passed. Real-client and deployment acceptance are separate.');
