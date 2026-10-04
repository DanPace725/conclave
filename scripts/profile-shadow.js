import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Store } from '../src/store.js';
import { WorkspaceHarness } from '../src/workspace.js';
import { anthropicPayload } from '../src/provider.js';

export function recordedPrefix(data, request) {
  const store = new Store(undefined, { memory: true });
  const layer = data.context_layer || data;
  // Disposable index with canonical IDs/offsets. Never import into a live chat.
  for (const e of layer.events.filter(e => e.seq < request.seq)) store.db.prepare(
    'INSERT INTO events(seq,id,conversation_id,kind,actor,timestamp,content,metadata) VALUES (?,?,?,?,?,?,?,?)'
  ).run(e.seq, e.id, e.conversation_id, e.kind, e.actor, e.timestamp, e.content, JSON.stringify(e.metadata));
  const receipts = new Set(store.events(data.conversation_id).filter(e => e.kind === 'context_transform').map(e => e.id));
  for (const s of layer.snapshots.filter(s => receipts.has(s.receipt_id))) store.db.prepare('INSERT INTO snapshots VALUES (?,?,?,?)')
    .run(data.conversation_id, s.revision, JSON.stringify(s.segments), s.receipt_id);
  store.refreshIndex();
  return store;
}

export function profileExport(data, limit = 3) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8) throw Error('Use a sample limit from 1 to 8');
  const layer = data.context_layer || data;
  const requests = layer.events.filter(e => e.kind === 'inference_request' && e.content === 'answer');
  const selected = [...new Set(Array.from({ length: Math.min(limit, requests.length) }, (_, i) =>
    requests[Math.round(i * (requests.length - 1) / Math.max(1, Math.min(limit, requests.length) - 1))]))];
  const rows = [];
  for (const request of selected) {
    const store = recordedPrefix(data, request);
    try {
      const provider = { name: request.metadata.provider || 'openai', respond: () => { throw Error('Offline profiling cannot call providers'); } };
      if (provider.name === 'anthropic') provider.requestPayload = anthropicPayload;
      const h = new WorkspaceHarness(store, data.conversation_id, provider, { model: request.metadata.payload.model,
        budget: 256000, output: request.metadata.payload.max_output_tokens || 16384, freezeProjection: true });
      const evaluate = allowance => {
        h.options.shadowEvaluationMs = allowance;
        const result = h.evaluateShadow();
        return { processing_budget_ms: allowance, elapsed_ms: result.elapsed_ms, status: result.evaluation_status,
          reason: result.reason || null, cache_hit: result.cache_hit || false, profile: result.profile };
      };
      const bounded = evaluate(200), expanded = evaluate(2000), repeated = evaluate(200);
      rows.push({ request_id: request.id, request_seq: request.seq, provider: provider.name, model: h.options.model,
        revision: store.context(data.conversation_id).revision, bounded, expanded, repeated });
    } finally { store.close(); }
  }
  return { version: 'shadow-profile-replay-v1', recorded_requests: requests.length, sampled_requests: rows.length,
    scope: 'Offline current-policy evaluation on evenly sampled recorded prefixes; 256000-byte guard. Tool definitions/projection policy may differ from the original. No provider calls, answer quality or cost savings measured. Sequential stages and synchronous tokenizers may overrun cooperative allowances.', rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node scripts/profile-shadow.js export.json report.json [sample-limit]');
  const result = profileExport(JSON.parse(readFileSync(process.argv[2], 'utf8')), Number(process.argv[4] || 3));
  writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ sampled_requests: result.sampled_requests, rows: result.rows.map(r => ({ seq: r.request_seq,
    bounded: r.bounded.status, bounded_ms: r.bounded.elapsed_ms, expanded: r.expanded.status, expanded_ms: r.expanded.elapsed_ms,
    repeated_ms: r.repeated.elapsed_ms, dominant: Object.entries(r.expanded.profile.stages).sort((a, b) => b[1].elapsed_ms - a[1].elapsed_ms)[0]?.[0] })) }, null, 2));
}
