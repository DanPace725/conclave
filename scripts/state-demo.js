import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';

const store = new Store('.conclave/state-demo');
try {
  const conversation = store.create('Structured task state walkthrough');
  const harness = new Harness(store, conversation, { name: 'offline' });
  const source = harness.addMessage('user', 'Prefer B for the parser. A may work if X changes.').event;
  harness.pin('Never turn conditional viability into conclusive rejection.');
  const commands = [];
  const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
  const run = (command, ...args) => {
    commands.push(command);
    return execFileSync(process.execPath, [cli, command, ...args, '--data', store.directory, '--conversation', conversation,
      '--model', 'offline-demo'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  };
  const base = (key, type, content) => ({ key, type, content, source_event_ids: [source.id], status: 'unresolved',
    supersedes: [], conflicts_with: [], supports: [], limitations: ['X has not been tested; preserve both alternatives.'] });
  const apply = (updates, filename) => {
    const path = join(store.directory, filename);
    writeFileSync(path, JSON.stringify({ expected_revision: store.context(conversation).revision, updates }, null, 2));
    return JSON.parse(run('state-update', path));
  };
  let view = apply([base('parser.choice', 'decision', 'B is the current preference; A remains conditional on X.')], 'initial.json');
  const previous = view.entries[0];
  view = apply([{ ...base('parser.alternative', 'question', 'Would changing X make A preferable?'), conflicts_with: [previous.id] }], 'alternative.json');
  const alternative = view.entries.find((s) => s.state_key === 'parser.alternative');
  view = apply([{ ...base('parser.choice', 'decision', 'Use B as fallback while investigating X for A.'), conflicts_with: [alternative.id] }], 'correction.json');
  const inspected = JSON.parse(run('state'));
  assert.equal(inspected.entries.length, 2);
  assert.ok(inspected.entries.every((s) => s.effective_status === 'unresolved' && s.resolution.confidence === null));
  assert.equal(JSON.parse(run('bundle', previous.id)).content, previous.content);
  run('reindex');
  assert.deepEqual(JSON.parse(run('state')), inspected);
  const receipt = { conversation, api_calls: 0, commands, revision: inspected.revision,
    state_keys: inspected.entries.map((s) => s.state_key), previous_bundle: previous.id,
    supersession_preserved: inspected.entries.find((s) => s.state_key === 'parser.choice').relations.supersedes.includes(previous.id),
    conflicts_unresolved: true, confidence_unknown: true, sources_attributed: true };
  writeFileSync(join(store.directory, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} finally { store.close(); }
