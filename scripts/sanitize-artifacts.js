// Scan or redact publication copies. Never prints credential values.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { sanitizeText, sanitizeExport } from '../src/export-sanitizer.js';
const args = process.argv.slice(2), write = args.includes('--write');
const paths = args.filter(arg => !['--write', '--check'].includes(arg));
if (!paths.length) throw Error('Usage: sanitize-artifacts.js --check|--write FILE_OR_FOLDER ...');
const files = path => statSync(path).isDirectory() ? readdirSync(path, { withFileTypes: true }).filter(e => !e.isSymbolicLink() && !e.name.startsWith('.'))
  .flatMap(e => files(join(path, e.name))) : [path];
let found = 0;
for (const path of [...new Set(paths.flatMap(p => files(resolve(p))))]) {
  if (!['.json', '.jsonl', '.md', '.html', '.txt'].includes(extname(path))) continue;
  const raw = readFileSync(path, 'utf8'), counts = {};
  const redacted = sanitizeText(raw, counts);
  // Scan structured credential fields as well as nested serialized strings.
  let clean = redacted;
  if (extname(path) === '.json') {
    try {
      const record = JSON.parse(raw), result = sanitizeExport(record);
      Object.assign(counts, result.sanitization.redactions);
      if (Object.keys(counts).length) clean = JSON.stringify(result, null, 2) + '\n';
    } catch { /* Some saved .json files are excerpts; scan/redact them as text. */ }
  } else if (extname(path) === '.jsonl') {
    const rows = raw.split(/\r?\n/).filter(Boolean).map(line => sanitizeExport(JSON.parse(line)));
    for (const row of rows) for (const [kind, count] of Object.entries(row.sanitization.redactions)) counts[kind] = (counts[kind] || 0) + count;
    if (Object.keys(counts).length) clean = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
  }
  if (!Object.keys(counts).length) continue;
  found++;
  if (write) writeFileSync(path, clean);
  console.log(JSON.stringify({ path, redactions: counts, written: write }));
}
console.log(JSON.stringify({ affected_files: found, mode: write ? 'redact' : 'check' }));
if (found && !write) process.exitCode = 1;
