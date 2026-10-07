import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const temporary = resolve('.conclave/ui-browser-temp'); mkdirSync(temporary, { recursive: true });
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.handoff.config.js', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, TEMP: temporary, TMP: temporary },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
