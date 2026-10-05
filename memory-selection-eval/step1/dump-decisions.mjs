// Step 1 helper: shows the per-paragraph answers the scoring report does not store.
// Reads only choice/confidence/probabilities from successful responses.
import { readFileSync, writeFileSync } from 'node:fs';
import { JevDecisionAdapter } from '../../src/jev.js';
import { JevProvider } from '../../src/provider.js';
const [input, out] = process.argv.slice(2);
const labels = JSON.parse(readFileSync(input, 'utf8'));
const provider = new JevProvider(), adapter = new JevDecisionAdapter(provider);
const result = [];
for (const item of labels.items) {
  const raw = [];
  const r = await adapter.selectMemory(item.passages, { source_kind: item.source_kind, related: [] }, async payload => {
    const response = await provider.respond(payload);
    raw.push({ response_keys: Object.keys(response).sort(), usage: response.usage || null, model: response.model || null,
      answers: Object.fromEntries(Object.entries(response.answers).map(([k, a]) => [k, { type: a.type, choice: a.choice, confidence: a.confidence, probabilities: a.probabilities }])) });
    return response;
  });
  result.push({ event_id: item.event_id, source_kind: item.source_kind, records: r.records, decisions: r.decisions, oversized: r.oversized,
    calls: r.calls, threshold: r.threshold, decision_version: r.decision_version, raw });
}
writeFileSync(out, JSON.stringify(result, null, 2));
for (const e of result) for (const d of e.decisions) console.log(e.event_id, d.passage_id, d.choice, 'conf', d.confidence.toFixed(3), 'keep_p', d.keep_probability.toFixed(3), d.uncertain ? 'UNCERTAIN' : '');
console.log(JSON.stringify(result[0].raw[0], null, 1).slice(0, 900));
