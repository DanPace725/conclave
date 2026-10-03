import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncConverse } from '../scripts/sync-converse.js';
import { checkEngine } from '../integrations/converse/scripts/check-engine.js';

test('migration preserves independent app files, records exact engine parity, and rejects downstream drift before writing', () => {
  const target = mkdtempSync(join(tmpdir(), 'conclave-migration-'));
  try {
    mkdirSync(join(target, 'lib/conclave'), { recursive: true });
    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'converse', dependencies: { unrelated: '1.0.0' } }));
    writeFileSync(join(target, 'lib/app-only.js'), 'export const application = true;\n');
    assert.throws(() => syncConverse(target, { apply: true }), /bootstrap/);
    const migrated = syncConverse(target, { apply: true, bootstrap: true, verifyCommit: false });
    assert.ok(migrated.files > 40);
    assert.equal(syncConverse(target).status, 'matched');
    assert.equal(checkEngine(target), migrated.files);
    assert.equal(JSON.parse(readFileSync(join(target, 'package.json'))).dependencies.unrelated, '1.0.0');
    assert.equal(readFileSync(join(target, 'lib/app-only.js'), 'utf8'), 'export const application = true;\n');
    const provider = join(target, 'lib/conclave/provider.js');
    writeFileSync(provider, '// independent downstream edit\n');
    assert.throws(() => syncConverse(target), /parity failed/);
    assert.throws(() => checkEngine(target), /Conclave migration/);
    const before = readFileSync(join(target, 'lib/conclave/service.js'), 'utf8');
    assert.throws(() => syncConverse(target, { apply: true }), /independent edit/);
    assert.equal(readFileSync(provider, 'utf8'), '// independent downstream edit\n');
    assert.equal(readFileSync(join(target, 'lib/conclave/service.js'), 'utf8'), before);
  } finally { rmSync(target, { recursive: true }); }
});
