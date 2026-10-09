import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
// Use an available test port without disturbing an existing dashboard preview.
const probe = createServer();
await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done); });
const port = probe.address().port;
await new Promise(done => probe.close(done));
const temporary = resolve('.conclave/dashboard-browser-temp'); mkdirSync(temporary, { recursive: true });
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.dashboard.config.js', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, TEMP: temporary, TMP: temporary, CONCLAVE_DASHBOARD_PREVIEW_PORT: String(port) },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
