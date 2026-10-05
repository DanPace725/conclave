// Offline export replay; no providers, credentials, or database connection.
import { readFileSync, writeFileSync } from 'node:fs';
import { Store } from '../src/store.js';
import { ConclaveService } from '../src/service.js';
import { downloadRecord } from '../src/context-repository.js';

const results = [];
for (const path of process.argv.slice(2).filter(p => !p.startsWith('--output='))) {
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
    // Exact canonical history/snapshot fidelity, including native payloads.
    const fidelity = JSON.stringify(record.context_layer.events) === JSON.stringify(layer.events)
      && JSON.stringify(record.context_layer.snapshots) === JSON.stringify(layer.snapshots);
    if (!fidelity) throw Error('Canonical export history differs');
    results.push({ path, source_bytes: readFileSync(path).length, download_bytes: Buffer.byteLength(text),
      events: layer.events.length, snapshots: layer.snapshots.length, history_reads: reads, history_decodes: misses,
      hydrate_ms: hydrated - started, build_ms: built - hydrated, serialize_ms: serialized - built,
      total_ms: serialized - started, fidelity });
  } finally { store.close(); }
}
const output = process.argv.find(p => p.startsWith('--output='))?.slice(9);
if (output) writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
