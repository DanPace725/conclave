import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = path => existsSync(path) ? digest(readFileSync(path)) : null;
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
function within(rootPath, path) {
  const suffix = relative(rootPath, path);
  if (!suffix || suffix.startsWith('..') || resolve(rootPath, suffix) !== path)
    throw Error(`Path outside migration root: ${path}`);
  return path;
}

export function syncConverse(target, { apply = false, bootstrap = false, verifyCommit = true } = {}) {
  const targetRoot = resolve(target);
  if (targetRoot === resolve(root)) throw Error('Converse must be a different repository');
  const pkg = JSON.parse(readFileSync(join(targetRoot, 'package.json'), 'utf8'));
  if (pkg.name !== 'converse') throw Error('Target is not the Converse repository');
  const mappings = files(join(root, 'src')).filter(path => !['cli.js', 'service-cli.js'].includes(relative(join(root, 'src'), path)))
    .map(path => ({ source: relative(root, path).replaceAll('\\', '/'),
      target: 'lib/conclave/' + relative(join(root, 'src'), path).replaceAll('\\', '/') }));
  for (const path of files(join(root, 'integrations/converse')))
    mappings.push({ source: relative(root, path).replaceAll('\\', '/'),
      target: relative(join(root, 'integrations/converse'), path).replaceAll('\\', '/') });
  for (const path of files(join(root, 'drizzle')))
    mappings.push({ source: relative(root, path).replaceAll('\\', '/'),
      target: relative(root, path).replaceAll('\\', '/') });
  // The UI and engine use the same provider effort table. Keep the existing
  // browser URL stable while the canonical implementation lives in Conclave.
  mappings.push({ source: 'src/effort.js', target: 'public/effort.js' });
  mappings.push({ source: 'src/export-name.js', target: 'public/export-name.js' });
  mappings.push({ source: 'src/resources/app-guide.md', target: 'public/app-guide.md' });
  mappings.push({ source: 'src/resources/model-costs-2026-10-02.json', target: 'docs/model-costs-2026-10-02.json' });
  const manifestPath = join(targetRoot, 'lib/conclave/manifest.json');
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const required = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies;
  const missingDependencies = Object.entries(required).filter(([name, range]) => pkg.dependencies?.[name] !== range);
  if (bootstrap && previous) throw Error('Bootstrap is only for the first migration');
  if (apply && !previous && !bootstrap) throw Error('First migration requires --bootstrap');
  const records = mappings.map(mapping => ({ ...mapping,
    sha256: hashFile(within(resolve(root), resolve(root, mapping.source))) }));
  const differences = records.filter(record => record.sha256 !== hashFile(within(targetRoot, resolve(targetRoot, record.target))))
    .map(record => record.target);
  const managed = new Set(records.map(record => record.target));
  const extras = files(join(targetRoot, 'lib/conclave')).filter(path => path.endsWith('.js')
    && !managed.has(relative(targetRoot, path).replaceAll('\\', '/')));
  if (extras.length) throw Error(`Unmanaged engine modules; migrate them to Conclave first: ${extras.map(path => relative(targetRoot,path)).join(', ')}`);
  if (!apply) {
    const recorded = previous && previous.files.length === records.length && records.every(record => previous.files.some(old =>
      old.source === record.source && old.target === record.target && old.sha256 === record.sha256));
    if (differences.length || !recorded || missingDependencies.length) throw Error(`Conclave/Converse parity failed (${differences.length} changed files): ${differences.join(', ') || 'migration manifest or dependencies missing/stale'}`);
    return { status: 'matched', files: records.length, source_commit: previous.source_commit };
  }
  if (previous) {
    for (const record of previous.files) {
      const destination = within(targetRoot, resolve(targetRoot, record.target));
      const actual = hashFile(destination);
      const next = records.find(item => item.target === record.target);
      if (!next) throw Error(`Managed file removed from Conclave; plan its removal explicitly: ${record.target}`);
      if (actual !== record.sha256 && actual !== next.sha256)
        throw Error(`Converse has an independent edit; port it to Conclave before migrating: ${record.target}`);
    }
  }
  const git = args => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\','/')}`, '-C', root, ...args], { encoding: 'utf8' }).trim();
  const dirty = !!git(['status', '--porcelain', '--', 'src', 'integrations', 'drizzle', 'package.json', 'package-lock.json']);
  if (verifyCommit && dirty) throw Error('Commit the verified Conclave source before migrating');
  // Validate every input before writing any file. Runtime has no dependency on
  // this checkout; only this development-time migration crosses repositories.
  for (const record of records) {
    const destination = within(targetRoot, resolve(targetRoot, record.target));
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, readFileSync(resolve(root, record.source)));
  }
  if (missingDependencies.length) {
    pkg.dependencies = { ...pkg.dependencies, ...required };
    writeFileSync(join(targetRoot, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  }
  const sourceCommit = git(['rev-parse', 'HEAD']);
  const manifest = { schema_version: 1, source_repository: 'https://github.com/DanPace725/conclave',
    source_commit: sourceCommit, source_worktree_dirty: dirty,
    migrated_at: new Date().toISOString(), dependencies: required, files: records };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { status: 'migrated', files: records.length, changed: differences.length, source_commit: sourceCommit };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), targetAt = args.indexOf('--target');
    const target = targetAt < 0 ? fileURLToPath(new URL('../../../converse', import.meta.url)) : args[targetAt + 1];
    const apply = args.includes('--apply');
    if (args.some((arg, index) => !['--apply', '--check', '--bootstrap', '--target'].includes(arg)
      && !(targetAt >= 0 && index === targetAt + 1))) throw Error('Use --check or --apply [--target PATH]');
    if (targetAt >= 0 && !args[targetAt + 1]) throw Error('--target requires a path');
    if (args.includes('--apply') && args.includes('--check')) throw Error('Choose --check or --apply');
    if (args.includes('--bootstrap') && !apply) throw Error('--bootstrap requires --apply');
    console.log(JSON.stringify(syncConverse(target, { apply, bootstrap: args.includes('--bootstrap') }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
