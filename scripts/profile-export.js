// Offline export replay; no providers, credentials, or database connection.
import { readFileSync, writeFileSync } from 'node:fs';
import { Store } from '../src/store.js';
import { ConclaveService } from '../src/service.js';
import { downloadRecord } from '../src/context-repository.js';
import { Harness } from '../src/harness.js';
import { anthropicPayload } from '../src/provider.js';

const results = [];
for (const path of process.argv.slice(2).filter(p => !p.startsWith('--'))) {
  const started = performance.now();
  const original = JSON.parse(readFileSync(path, 'utf8'));
  const layer = original.context_layer || original;
  const store = new Store(undefined, { memory: true });
  try {
    const insert = store.db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?)');
    store.db.exec('BEGIN');
    for (const e of layer.events) insert.run(e.seq, e.id, e.conversation_id, e.kind, e.actor, e.timestamp, e.content, JSON.stringify(e.metadata));
    const snapshot = store.db.prepare('INSERT INTO snapshots VALUES (?,?,?,?)');
    for (const s of layer.snapshots) snapshot.run(layer.conversation_id, s.revision, JSON.stringify(s.segments), s.receipt_id);
    store.db.exec('COMMIT');
    store.refreshIndex();
    const hydrated = performance.now();
    let reads = 0, misses = 0;
    const events = store.events.bind(store);
    store.events = id => { reads++; if (!store.readCache?.has(id)) misses++; return events(id); };
    const service = new ConclaveService(store, { providerFactory: () => { throw Error('Offline export must never invoke a provider'); } });
    const record = downloadRecord(service, layer.conversation_id);
    const built = performance.now();
    const text = JSON.stringify(record);
    const serialized = performance.now();
    const exportReads = reads, exportMisses = misses;
    // Exact canonical history/snapshot fidelity, including native payloads.
    const fidelity = JSON.stringify(record.context_layer.events) === JSON.stringify(layer.events)
      && JSON.stringify(record.context_layer.snapshots) === JSON.stringify(layer.snapshots);
    if (!fidelity) throw Error('Canonical export history differs');
    let controller = null;
    if (process.argv.includes('--shadow')) {
      const last = layer.events.findLast(e => e.kind === 'inference_request' && e.content === 'answer');
      const name = last?.metadata.provider || 'openai', model = last?.metadata.payload?.model || 'gpt-6-luna';
      const provider = { name, ...(name === 'anthropic' ? { requestPayload: anthropicPayload } : {}) };
      const h = new Harness(store, layer.conversation_id, provider, { model, budget: last?.metadata.input_budget || 256000 });
      const fullBytes = Buffer.byteLength(JSON.stringify(store.events(layer.conversation_id)));
      const projectedBytes = store.withControllerHistory(layer.conversation_id, name, model,
        () => Buffer.byteLength(JSON.stringify(store.events(layer.conversation_id))));
      const result = h.evaluateShadow();
      controller = { full_history_bytes: fullBytes, controller_history_bytes: projectedBytes,
        evaluation_status: result.evaluation_status, elapsed_ms: result.elapsed_ms, profile: result.profile,
        scope: 'local controller projection bytes; not measured provider-token or cost savings' };
    }
    results.push({ path, source_bytes: readFileSync(path).length, download_bytes: Buffer.byteLength(text),
      events: layer.events.length, snapshots: layer.snapshots.length, history_reads: exportReads, history_decodes: exportMisses,
      hydrate_ms: hydrated - started, build_ms: built - hydrated, serialize_ms: serialized - built,
      total_ms: serialized - started, fidelity, ...(controller ? { controller } : {}) });
  } finally { store.close(); }
}
const output = process.argv.find(p => p.startsWith('--output='))?.slice(9);
if (output) writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
