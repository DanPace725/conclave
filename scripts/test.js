import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Windows sandbox temp directories can reject atomic renames. Keep test stores
// inside this checkout, without changing process-wide or user environment.
const temporary = resolve('.conclave/test-temp');
mkdirSync(temporary, { recursive: true });
const files = process.argv.slice(2);
const result = spawnSync(process.execPath, ['--test', ...(files.length ? files :
  readdirSync('test').filter(file => file.endsWith('.test.js')).map(file => `test/${file}`))], {
  stdio: 'inherit', env: { ...process.env, TEMP: temporary, TMP: temporary },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
