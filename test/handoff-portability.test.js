import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Store, hash } from '../src/store.js';
import { HandoffService } from '../src/handoffs.js';
import { exportHandoffBundle, importHandoffBundle, validateHandoffBundle } from '../src/handoff-portability.js';

const packet = { title: 'Portable project', summary: 'Continue in another installation.', constraints: ['Keep the originals.'], open_questions: ['Who reviews?'], source_app: 'reported-app' };
const make = t => {
  const store = new Store(undefined, { memory: true }); t.after(() => store.close());
  return { store, service: new HandoffService(store) };
};
function backup(service) {
  const first = service.save({ packet, request_id: 'portable-1' });
  service.save({ packet: { ...packet, summary: 'Updated next step.', open_questions: [] }, request_id: 'portable-2', handoff_id: first.handoff_id, expected_revision: 1 });
  return exportHandoffBundle(service, first.handoff_id);
}

test('portable export/import preserves every version and checksum with fresh IDs and unverified lineage', t => {
  const source = make(t), target = make(t), bundle = backup(source.service);
  const ordinary = source.store.create('Private chat'); source.store.append(ordinary, 'user', 'Not in the handoff backup', {}, 'human');
  assert.equal(JSON.stringify(bundle).includes('Not in the handoff backup'), false);
  const imported = importHandoffBundle(target.service, JSON.parse(JSON.stringify(bundle)));
  assert.notEqual(imported.handoff_id, bundle.source_handoff_id); assert.equal(imported.imported_revisions, 2);
  for (const entry of bundle.revisions) {
    const restored = target.service.get({ handoff_id: imported.handoff_id, revision: entry.revision });
    assert.equal(restored.sha256, entry.sha256); assert.deepEqual(restored.packet, entry.packet);
    assert.equal(restored.provenance.authority, 'external_data'); assert.equal(restored.provenance.author_claims_verified, false);
    assert.equal(restored.provenance.imported_from.handoff_id, bundle.source_handoff_id);
    assert.equal(restored.provenance.imported_from.claims_verified, false);
    assert.equal(restored.provenance.imported_from.saved_at, entry.saved_at);
  }
  assert.equal(target.store.events(imported.handoff_id).some(e => e.actor === 'human'), false);
  target.service.save({ packet, request_id: 'after-import', handoff_id: imported.handoff_id, expected_revision: 2 });
  const repeated = importHandoffBundle(target.service, { ...bundle, exported_at: new Date(Date.now() + 1000).toISOString() });
  assert.equal(repeated.replayed, true); assert.equal(repeated.handoff_id, imported.handoff_id);
  assert.equal(repeated.revision, 2); assert.equal(target.service.history({ handoff_id: imported.handoff_id }).total, 3);
});

test('backup validation rejects corrupt, reordered, missing and authority-bearing records before writing', t => {
  const source = make(t), target = make(t), bundle = backup(source.service);
  const variants = [
    b => { b.revisions[1].packet.constraints = ['Tampered']; },
    b => { b.revisions.reverse(); },
    b => { b.revisions.shift(); },
    b => { b.owner = 'another-account'; },
    b => { b.revisions[0].actor = 'human'; },
    b => { b.revisions[0].packet.provenance = 'verified'; },
    b => { b.schema_version = 99; },
    b => { b.exported_at = 'not-a-date'; },
  ];
  for (const change of variants) {
    const bad = structuredClone(bundle); change(bad);
    assert.throws(() => importHandoffBundle(target.service, bad), { code: 'invalid_input' });
  }
  assert.equal(target.store.list().length, 0);
  const reorderedKeys = structuredClone(bundle);
  reorderedKeys.revisions[0].packet = Object.fromEntries(Object.entries(reorderedKeys.revisions[0].packet).reverse());
  assert.equal(validateHandoffBundle(reorderedKeys).revisions[0].sha256, bundle.revisions[0].sha256);
});

test('portable import rolls back all revisions if storage fails partway', t => {
  const source = make(t), target = make(t), bundle = backup(source.service);
  const append = target.store.append.bind(target.store);
  target.store.append = (...args) => {
    if (args[1] === 'handoff_packet' && args[3].revision === 2) throw Error('fixture storage failure');
    return append(...args);
  };
  assert.throws(() => importHandoffBundle(target.service, bundle), /fixture storage failure/);
  assert.equal(target.store.list().length, 0);
  assert.equal(target.store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 0);
  target.store.append = append;
  assert.equal(importHandoffBundle(target.service, bundle).imported_revisions, 2);
});

test('portable bundle refuses excessive complete history rather than silently exporting a subset', t => {
  const { service } = make(t), bundle = backup(service);
  const entry = bundle.revisions[0];
  assert.throws(() => validateHandoffBundle({ ...bundle, revisions: Array.from({ length: 1001 }, (_, i) => ({ ...entry, revision: i + 1 })) }), /1–1000/);
  const large = { ...entry.packet, context: 'x'.repeat(32000) };
  assert.throws(() => validateHandoffBundle({ ...bundle, revisions: Array.from({ length: 300 }, (_, i) => ({ ...entry, revision: i + 1, packet: large, sha256: hash(large) })) }), /8 MiB/);
});

test('backup CLI round trip, dry-run, validation and no-overwrite behavior survive fresh processes', t => {
  const root = mkdtempSync(join(tmpdir(), 'handoff-backup-cli-')), sourceDir = join(root, 'source'), targetDir = join(root, 'target');
  const store = new Store(sourceDir), service = new HandoffService(store);
  const saved = service.save({ packet, request_id: 'cli-source' }); store.close();
  const launcher = fileURLToPath(new URL('../packages/conclave-mcp/src/backup.js', import.meta.url));
  const run = (directory, args) => spawnSync(process.execPath, [launcher, ...args], { encoding: 'utf8', env: { ...process.env, CONCLAVE_HANDOFF_DATA: directory } });
  const file = join(root, 'packet.json');
  assert.equal(run(sourceDir, ['export', saved.handoff_id, file]).status, 0);
  const original = readFileSync(file, 'utf8');
  const conflict = run(sourceDir, ['export', saved.handoff_id, file]); assert.equal(conflict.status, 1); assert.match(conflict.stderr, /already exists/);
  assert.equal(readFileSync(file, 'utf8'), original);
  assert.equal(run(targetDir, ['import', file, '--dry-run']).status, 0); assert.equal(existsSync(targetDir), false);
  assert.equal(run(targetDir, ['inspect', file]).status, 0); assert.equal(existsSync(targetDir), false);
  const result = run(targetDir, ['import', file]); assert.equal(result.status, 0, result.stderr);
  const imported = JSON.parse(result.stdout);
  const reopened = new Store(targetDir); t.after(() => reopened.close());
  assert.deepEqual(new HandoffService(reopened).get({ handoff_id: imported.handoff_id }).packet.constraints, packet.constraints);
  assert.equal(JSON.parse(run(targetDir, ['import', file]).stdout).replayed, true);
  writeFileSync(file, '{'); const invalid = run(join(root, 'invalid'), ['import', file]);
  assert.equal(invalid.status, 1); assert.match(invalid.stderr, /Invalid handoff backup JSON/); assert.equal(existsSync(join(root, 'invalid')), false);
  assert.equal(run(targetDir, ['import', file, '--unknown']).status, 1);
});
