// Offline what-if on stored run-1 answers: gate on keep probability (1 - P(skip)) instead of the
// confidence of the four-way choice. Not the shipped rule; no engine change; no extra calls.
import { readFileSync, writeFileSync } from 'node:fs';
import { scoreSelections } from '../src/memory-evaluation.js';
const here = new URL('./', import.meta.url);
const items = JSON.parse(readFileSync(new URL('labels-all.json', here), 'utf8')).items;
const rows = readFileSync(new URL('captures/2-jev065-luna.jsonl', here), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(l => l.selector === 'jev');
const decisions = Object.fromEntries(rows.map(r => [items[r.item_index].event_id, r.decisions]));
const out = { variants: [] };
const all = Object.values(decisions).flat();
const lowConfKeeps = all.filter(d => d.choice !== 'skip' && d.confidence < 0.65);
out.below_threshold_keeps = { count: lowConfKeeps.length, keep_probability_at_least_0_9: lowConfKeeps.filter(d => d.keep_probability >= 0.9).length,
  keep_probability_0_65_to_0_9: lowConfKeeps.filter(d => d.keep_probability >= 0.65 && d.keep_probability < 0.9).length, keep_probability_below_0_65: lowConfKeeps.filter(d => d.keep_probability < 0.65).length };
for (const T of [0.5, 0.65, 0.8, 0.9]) {
  const selections = {}; let needing = 0, uncertain = 0;
  for (const [id, list] of Object.entries(decisions)) {
    const u = list.filter(d => d.keep_probability < T && d.keep_probability > 1 - T);
    if (u.length) needing++; uncertain += u.length;
    selections[id] = list.filter(d => d.choice !== 'skip' && d.keep_probability >= T && !d.duplicate)
      .sort((a, b) => b.keep_probability - a.keep_probability || a.passage_id - b.passage_id).slice(0, 8).map(d => ({ passage_id: d.passage_id, kind: d.choice }));
  }
  const s = scoreSelections(items, selections), assistant = scoreSelections(items.filter(i => i.source_kind === 'assistant'), selections), user = scoreSelections(items.filter(i => i.source_kind === 'user'), selections);
  out.variants.push({ keep_probability_gate: T, precision: s.precision, recall: s.recall, f1: s.f1, tp: s.true_positive, fp: s.false_positive, fn: s.false_negative, kind_accuracy: s.kind_accuracy,
    fallback_events: needing, fallback_rate: needing / items.length, uncertain_passages: uncertain,
    assistant: { precision: assistant.precision, recall: assistant.recall }, user: { precision: user.precision, recall: user.recall, tp: user.true_positive, fp: user.false_positive, fn: user.false_negative } });
}
writeFileSync(new URL('whatif-keep-probability.json', here), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
