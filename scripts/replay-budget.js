import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Store } from '../src/store.js';
import { Harness, budgetUnits } from '../src/harness.js';

// Replay the recorded failed continuation in a fresh store. No API calls and no
// edits to the user's database. Imported events retain their original IDs.
const record = JSON.parse(readFileSync(process.argv[2] || '.conclave/transcript.json', 'utf8'));
const exported = record.context_layer || record;
const events = exported.events;
const last = events.filter((e) => e.kind === 'inference_request' && e.content === 'answer').at(-1);
const response = events.find((e) => e.kind === 'inference_response' && e.metadata.request_id === last.id);
const results = events.filter((e) => e.kind === 'tool_result' && e.seq > response.seq);
if (!response.metadata.output.some((o) => o.type === 'function_call') || !results.length) throw Error('Export does not end in a recorded tool continuation');
mkdirSync('.conclave', { recursive: true });
const directory = mkdtempSync(resolve('.conclave/budget-replay-'));
const store = new Store(directory);
try {
  const insertEvent = store.db.prepare('INSERT INTO events (seq,id,conversation_id,kind,actor,timestamp,content,metadata) VALUES (?,?,?,?,?,?,?,?)');
  const insertSnapshot = store.db.prepare('INSERT INTO snapshots (conversation_id,revision,segments,receipt_id) VALUES (?,?,?,?)');
  store.db.exec('BEGIN');
  for (const event of events) {
    insertEvent.run(event.seq, event.id, event.conversation_id, event.kind, event.actor, event.timestamp, event.content, JSON.stringify(event.metadata));
  }
  const snapshots = exported.snapshots || events.filter(e => e.kind === 'context_transform').map(e => ({
    revision: e.metadata.revision, segments: e.metadata.segments, receipt_id: e.id,
  }));
  for (const snapshot of snapshots)
    insertSnapshot.run(exported.conversation_id, snapshot.revision, JSON.stringify(snapshot.segments), snapshot.receipt_id);
  store.db.exec('COMMIT');
  store.reindex();
  const harness = new Harness(store, exported.conversation_id, { name: 'openai', respond: () => { throw Error('Replay must not call a provider'); } }, {
    budget: process.argv[3] ? Number(process.argv[3]) : last.metadata.input_budget, output: last.metadata.output_reserve, model: last.metadata.payload.model,
    reasoning: last.metadata.payload.reasoning.effort,
  });
  const pending = [...last.metadata.payload.input.slice(1), ...response.metadata.output,
    ...results.map((r) => ({ type: 'function_call_output', call_id: r.metadata.call_id, output: r.content }))];
  const current = store.context(exported.conversation_id);
  const pins = current.segments.filter((s) => s.pinned || s.verbatim_required);
  const latestUser = [...current.segments].reverse().find((s) => s.type === 'user');
  const before = budgetUnits(harness.answerPayload(pending));
  let payload, failure = null;
  try { payload = harness.prepareAnswer(pending, [latestUser.id]); }
  catch (error) { failure = error.message; payload = harness.answerPayload(pending); }
  const after = store.context(exported.conversation_id);
  const fits = !failure && budgetUnits(payload) + harness.options.output <= harness.options.budget;
  assert.ok(pins.every((p) => after.segments.some((s) => s.id === p.id && s.content === p.content)));
  assert.equal(store.source(exported.conversation_id, latestUser.source_event_ids[0]).content, latestUser.content);
  const receipt = { conversation_id: exported.conversation_id, api_calls: 0, input_before: before, input_after: budgetUnits(payload),
    output_reserve: harness.options.output, budget: harness.options.budget, original_budget: last.metadata.input_budget,
    fits, failure, pins_preserved: true,
    new_events: store.events(exported.conversation_id).filter((e) => e.seq > events.at(-1).seq).map((e) => ({ kind: e.kind, content: e.content, metadata: e.kind === 'context_transform' ? { revision: e.metadata.revision } : e.metadata })) };
  writeFileSync(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ ...receipt, new_events: receipt.new_events.map((e) => e.kind), receipt: join(directory, 'receipt.json') }, null, 2));
} finally { store.close(); }
