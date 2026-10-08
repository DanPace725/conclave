import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory() && entry.name !== 'node_modules') check(path);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status) process.exit(result.status);
    }
  }
}
for (const directory of ['src', 'scripts', 'test', 'integrations']) check(directory);
if (existsSync('packages')) check('packages');
for (const args of [['--check', 'playwright.handoff.config.js'], ['--check', 'playwright.dashboard.config.js'], ['scripts/build-handoff-ui.js', '--check']]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
if (existsSync('memory-selection-eval')) {
  const result = spawnSync(process.execPath, ['scripts/sanitize-artifacts.js','--check','memory-selection-eval'], {stdio:'inherit'});
  if (result.status) process.exit(result.status);
}
console.log('Syntax and evaluation credential checks passed');
