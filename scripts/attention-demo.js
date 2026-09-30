import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';

// Small offline walkthrough of the actual CLI. Creates isolated data and spends no API tokens.
const store = new Store('.conclave/attention-demo');
try {
  const conversation = store.create('Attention and recovery walkthrough');
  const commands = [];
  const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
  const run = (command, ...args) => {
    commands.push(command);
    return execFileSync(process.execPath, [cli, command, ...args, '--data', store.directory,
      '--conversation', conversation, '--model', 'offline-demo'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  };
  const sourcePath = join(store.directory, 'fixture.md');
  writeFileSync(sourcePath, 'Routine log, no new evidence. '.repeat(220) + '\nDeployment key: maple-812. A remains possible if X changes.');
  const sourceId = run('ingest', sourcePath, '--focus', 'maple-812');
  const original = store.context(conversation).segments[0];
  const initialRevision = store.context(conversation).revision;
  assert.match(original.content, /maple-812/);
  const beforeBytes = Buffer.byteLength(JSON.stringify(store.context(conversation).segments));
  const plan = JSON.parse(run('attention', 'deployment'));
  run('offload', original.id);
  const afterBytes = Buffer.byteLength(JSON.stringify(store.context(conversation).segments));
  const catalog = JSON.parse(run('memory', 'maple-812'));
  assert.equal(catalog[0].proximity, 'proximal');
  assert.match(JSON.parse(run('bundle', original.id)).content, /maple-812/);
  run('pin', 'Never treat the conditional viability of A as conclusive rejection.');
  run('revisions');
  run('restore', String(initialRevision));
  run('reindex');
  const hits = JSON.parse(run('search', 'maple-812'));
  assert.ok(hits.some((h) => h.event_id === sourceId && h.content.includes('maple-812')));
  const context = store.context(conversation);
  assert.ok(context.segments.some((s) => s.pinned));
  const receipt = { conversation, api_calls: 0, commands, ingress_source_id: sourceId,
    ingress_offset: Number(original.content.match(/offset (\d+)/)[1]), before_bytes: beforeBytes,
    offloaded_bytes: afterBytes, offloaded_original_proximity: catalog[0].proximity,
    restored_as_revision: context.revision, later_pin_preserved: true, exact_source_search: true,
    attention_policy: plan.policy_version };
  writeFileSync(join(store.directory, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} finally { store.close(); }
