import { openSync, closeSync, readFileSync, writeFileSync, fstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openHandoffs } from './local.js';
import { exportHandoffBundle, importHandoffBundle, validateHandoffBundle, MAX_HANDOFF_BUNDLE_BYTES } from '../../../src/handoff-portability.js';

const usage = 'Usage: npm run mcp:backup -- export HANDOFF_ID FILE | inspect FILE | import FILE [--dry-run]';
export function runBackup(args) {
  const [command, first, second, ...rest] = args;
  if (!['export', 'inspect', 'import'].includes(command) || !first || rest.length ||
    (command === 'export' ? !second : second !== undefined && !(command === 'import' && second === '--dry-run')))
    throw Object.assign(Error(usage), { code: 'invalid_input' });
  if (command === 'export') {
    const local = openHandoffs();
    try {
      const bundle = exportHandoffBundle(local.service, first);
      const encoded = JSON.stringify(bundle) + '\n';
      if (Buffer.byteLength(encoded) > MAX_HANDOFF_BUNDLE_BYTES)
        throw Object.assign(Error('Handoff backup exceeds 8 MiB'), { code: 'capacity' });
      // Exclusive creation prevents accidentally overwriting another backup.
      writeFileSync(resolve(second), encoded, { flag: 'wx', mode: 0o600 });
      return { exported: true, handoff_id: first, revisions: bundle.revisions.length };
    } finally { local.close(); }
  }
  const fd = openSync(resolve(first), 'r');
  let bundle;
  try {
    if (!fstatSync(fd).isFile() || fstatSync(fd).size > MAX_HANDOFF_BUNDLE_BYTES)
      throw Object.assign(Error('Choose a regular handoff backup file no larger than 8 MiB'), { code: 'invalid_input' });
    const bytes = readFileSync(fd);
    if (bytes.length > MAX_HANDOFF_BUNDLE_BYTES) throw Object.assign(Error('Handoff backup exceeds 8 MiB'), { code: 'invalid_input' });
    try { bundle = validateHandoffBundle(JSON.parse(bytes.toString('utf8'))); }
    catch (error) {
      if (error.code === 'invalid_input') throw error;
      throw Object.assign(Error('Invalid handoff backup JSON'), { code: 'invalid_input' });
    }
  } finally { closeSync(fd); }
  if (command === 'inspect' || second === '--dry-run') return { valid: true, changes_saved: false,
    source_handoff_id: bundle.source_handoff_id, revisions: bundle.revisions.length,
    title: bundle.revisions.at(-1).packet.title, note: 'Checksums detect corruption; source claims remain unverified. Backup contains private packet text.' };
  const local = openHandoffs();
  try { return importHandoffBundle(local.service, bundle); } finally { local.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(runBackup(process.argv.slice(2)))); }
  catch (error) {
    const message = error.code === 'EEXIST' ? 'That output file already exists. Choose a new backup filename.'
      : ['invalid_input', 'not_found', 'capacity'].includes(error.code) ? error.message : 'The backup operation failed. Check the file and local storage permissions.';
    console.error(message); process.exitCode = 1;
  }
}
