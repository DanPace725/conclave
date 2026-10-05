// Post-run analysis for REPORT.md. Reads the label file, the scoring reports and the
// captured per-paragraph decisions. Scores always come from src/memory-evaluation.js;
// nothing here re-implements or adjusts the grading.
import { readFileSync, writeFileSync } from 'node:fs';
import { scoreSelections, LABELS } from '../src/memory-evaluation.js';
import { parseExtraction } from '../src/memory-extractor.js';
import { priceUsage } from '../src/costs.js';

const here = new URL('./', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, here), 'utf8'));
const lines = name => readFileSync(new URL(name, here), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const snapshot = JSON.parse(readFileSync(new URL('../src/resources/model-costs-2026-10-02.json', here), 'utf8'));
const labels = read('labels-all.json');
const items = labels.items.filter(i => i.passages.some(p => LABELS.includes(p.label)));
const byEvent = new Map(items.map(i => [i.event_id, i]));
const pct = v => v == null ? 'n/a' : (100 * v).toFixed(1) + '%';
const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);
const median = list => { const s = [...list].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

// ---- captured selections ----------------------------------------------------
function jevRun(file) {
  const rows = lines(file).filter(l => l.selector === 'jev');
  const selections = {}, decisions = {}, calls = [];
  for (const row of rows) {
    const item = items[row.item_index];
    selections[item.event_id] = row.failed ? null : row.records;
    if (!row.failed) { decisions[item.event_id] = row.decisions; calls.push(...row.calls); }
  }
  return { selections, decisions, calls, threshold: rows[0].threshold, oversized: rows.flatMap(r => (r.oversized || []).map(id => ({ event_id: items[r.item_index].event_id, passage_id: id }))) };
}
function llmRun(file, model) {
  const rows = lines(file).filter(l => l.selector === 'llm' && l.model === model);
  const selections = {}, calls = {};
  for (const row of rows) {
    const item = byEvent.get(row.event_id);
    try { selections[row.event_id] = row.failed ? null : parseExtraction(row.text, item.passages).records; } catch { selections[row.event_id] = null; }
    calls[row.event_id] = row;
  }
  return { selections, calls, provider: rows[0].provider, model };
}
// The same cross-paragraph rules as selectMemory, re-applied to stored answers at another threshold.
function rethreshold(decisions, threshold) {
  const selections = {}, flagged = {};
  for (const [id, list] of Object.entries(decisions)) {
    const d = list.map(x => ({ ...x, uncertain: x.confidence < threshold }));
    flagged[id] = d;
    selections[id] = d.filter(x => x.choice !== 'skip' && !x.uncertain && !x.duplicate)
      .sort((a, b) => b.keep_probability - a.keep_probability || a.passage_id - b.passage_id).slice(0, 8)
      .sort((a, b) => a.passage_id - b.passage_id).map(x => ({ passage_id: x.passage_id, kind: x.choice }));
  }
  return { selections, decisions: flagged };
}
const fallback = decisions => { const e = Object.values(decisions); return { events: e.length, needing: e.filter(d => d.some(x => x.uncertain)).length, uncertain_passages: sum(e, d => d.filter(x => x.uncertain).length) }; };
const brief = s => ({ precision: s.precision, recall: s.recall, f1: s.f1, kind_accuracy: s.kind_accuracy, tp: s.true_positive, fp: s.false_positive, fn: s.false_negative, required: s.required, optional_selected: s.optional_selected, events: s.events, failed_events: s.failed_events });
const cacheAware = (calls, provider, model) => { const p = calls.map(c => priceUsage(c.usage, provider, model, snapshot, { tier: 'short' })); return p.some(x => x.usd_max == null) ? null : { min: sum(p, x => x.usd_min), max: sum(p, x => x.usd_max) }; };

const jev = { r1: jevRun('captures/2-jev065-luna.jsonl'), r2: jevRun('captures/5-jev065-repeat.jsonl'), r3: jevRun('captures/5b-jev065-repeat2.jsonl'),
  t50: jevRun('captures/4a-jev050.jsonl'), t80: jevRun('captures/4b-jev080.jsonl') };
const llm = { luna1: llmRun('captures/2-jev065-luna.jsonl', 'gpt-6-luna'), luna2: llmRun('captures/2b-luna-repeat.jsonl', 'gpt-6-luna'),
  sonnet: llmRun('captures/3-sonnet55.jsonl', 'claude-sonnet-5-5'), sol: llmRun('captures/3b-ref-gpt-6.1-sol.jsonl', 'gpt-6.1-sol') };
const out = {};

// ---- 1. main table (official report figures) ---------------------------------
const reportRows = [
  ['Jev, threshold 0.65 (run 1)', '2-jev065-luna.json', 'jev'], ['Jev, threshold 0.65 (run 2)', '5-jev065-repeat.json', 'jev'], ['Jev, threshold 0.65 (run 3)', '5b-jev065-repeat2.json', 'jev'],
  ['Jev, threshold 0.50', '4a-jev050.json', 'jev'], ['Jev, threshold 0.80', '4b-jev080.json', 'jev'],
  ['gpt-6-luna (run 1)', '2-jev065-luna.json', 'llm:openai:gpt-6-luna'], ['gpt-6-luna (run 2)', '2b-luna-repeat.json', 'llm:openai:gpt-6-luna'],
  ['claude-sonnet-5-5 (reference)', '3-ref-claude-sonnet-5-5.json', 'llm:anthropic:claude-sonnet-5-5'], ['gpt-6.1-sol (second reference)', '3b-ref-gpt-6.1-sol.json', 'llm:openai:gpt-6.1-sol'],
];
out.main = reportRows.map(([name, file, key]) => { const s = read('reports/' + file).selectors[key];
  return { name, report: file, ...brief(s), calls: s.usage.calls, input_tokens: s.usage.input_tokens, output_tokens: s.usage.output_tokens,
    median_ms: s.usage.elapsed_ms_median, total_ms: s.usage.elapsed_ms_total, usd: s.usd, errors: s.errors.length, fallback: s.fallback || null }; });
const recorded = read('reports/1-recorded-live.json').selectors;
out.recorded = Object.fromEntries(Object.entries(recorded).map(([k, s]) => [k, { ...brief(s), fallback: s.fallback || null }]));
// Sanity: scores recomputed from the captures must equal the official reports.
out.capture_check = { jev_r1: brief(scoreSelections(items, jev.r1.selections)).tp === out.main[0].tp && brief(scoreSelections(items, jev.r1.selections)).fp === out.main[0].fp,
  luna1: brief(scoreSelections(items, llm.luna1.selections)).tp === out.main[5].tp, sonnet: brief(scoreSelections(items, llm.sonnet.selections)).tp === out.main[7].tp,
  sol: brief(scoreSelections(items, llm.sol.selections)).tp === out.main[8].tp, t50: brief(scoreSelections(items, jev.t50.selections)).tp === out.main[3].tp };

// ---- 2. cache-aware cost ------------------------------------------------------
out.cost = {
  jev_r1: cacheAware(jev.r1.calls, 'typesafe', 'jev-latest'),
  luna1: cacheAware(Object.values(llm.luna1.calls), 'openai', 'gpt-6-luna'), luna2: cacheAware(Object.values(llm.luna2.calls), 'openai', 'gpt-6-luna'),
  sonnet: cacheAware(Object.values(llm.sonnet.calls), 'anthropic', 'claude-sonnet-5-5'), sol: cacheAware(Object.values(llm.sol.calls), 'openai', 'gpt-6.1-sol'),
  sonnet_buckets: { input: sum(Object.values(llm.sonnet.calls), c => c.usage.input_tokens), cache_write: sum(Object.values(llm.sonnet.calls), c => c.usage.cache_creation_input_tokens || 0),
    cache_read: sum(Object.values(llm.sonnet.calls), c => c.usage.cache_read_input_tokens || 0), output: sum(Object.values(llm.sonnet.calls), c => c.usage.output_tokens) },
  openai_cached: { luna1: sum(Object.values(llm.luna1.calls), c => c.usage.input_tokens_details?.cached_tokens || 0), sol: sum(Object.values(llm.sol.calls), c => c.usage.input_tokens_details?.cached_tokens || 0) },
  reasoning_tokens: { luna1: sum(Object.values(llm.luna1.calls), c => c.usage.output_tokens_details?.reasoning_tokens || 0), sol: sum(Object.values(llm.sol.calls), c => c.usage.output_tokens_details?.reasoning_tokens || 0) },
};
const sonnetCalls = Object.values(llm.sonnet.calls);
// If every call paid the cache-write rate (one extraction per turn, no reuse inside five minutes).
out.cost.sonnet_no_cache_reuse = (sum(sonnetCalls, c => c.usage.input_tokens) * 2.5 + sum(sonnetCalls, c => c.usage.output_tokens) * 10) / 1e6;
out.cost.sonnet_plain_input = (sum(sonnetCalls, c => c.usage.input_tokens) * 2 + sum(sonnetCalls, c => c.usage.output_tokens) * 10) / 1e6;

// ---- 3. breakdowns -------------------------------------------------------------
const subsets = { all: items, user: items.filter(i => i.source_kind === 'user'), assistant: items.filter(i => i.source_kind === 'assistant'),
  ...Object.fromEntries([...new Set(items.map(i => i.conversation))].map(c => [c, items.filter(i => i.conversation === c)])) };
const selectors = { 'Jev 0.65 (run 1)': jev.r1.selections, 'Jev 0.65 (run 2)': jev.r2.selections, 'Jev 0.65 (run 3)': jev.r3.selections, 'Jev 0.50': jev.t50.selections, 'Jev 0.80': jev.t80.selections,
  'gpt-6-luna (run 1)': llm.luna1.selections, 'gpt-6-luna (run 2)': llm.luna2.selections, 'claude-sonnet-5-5': llm.sonnet.selections, 'gpt-6.1-sol': llm.sol.selections };
out.breakdown = Object.fromEntries(Object.entries(subsets).map(([name, list]) => [name, { items: list.length, passages: sum(list, i => i.passages.length),
  required: sum(list, i => i.passages.filter(p => !['skip', 'optional'].includes(p.label)).length),
  selectors: Object.fromEntries(Object.entries(selectors).map(([s, sel]) => [s, brief(scoreSelections(list, sel))])) }]));
out.cap = { events_over_8_required: items.filter(i => i.passages.filter(p => !['skip', 'optional'].includes(p.label)).length > 8).map(i => ({ event_id: i.event_id, conversation: i.conversation, required: i.passages.filter(p => !['skip', 'optional'].includes(p.label)).length })),
  max_recall_under_cap: sum(items, i => Math.min(8, i.passages.filter(p => !['skip', 'optional'].includes(p.label)).length)) / sum(items, i => i.passages.filter(p => !['skip', 'optional'].includes(p.label)).length) };

// ---- 4. fallback need -----------------------------------------------------------
const need = (decisions, list = items) => { const sub = Object.fromEntries(list.filter(i => decisions[i.event_id]).map(i => [i.event_id, decisions[i.event_id]])); return fallback(sub); };
out.fallback = {
  live_runs: { 'Jev 0.50': need(jev.t50.decisions), 'Jev 0.65 (run 1)': need(jev.r1.decisions), 'Jev 0.65 (run 2)': need(jev.r2.decisions), 'Jev 0.65 (run 3)': need(jev.r3.decisions), 'Jev 0.80': need(jev.t80.decisions) },
  by_kind_run1: { user: need(jev.r1.decisions, subsets.user), assistant: need(jev.r1.decisions, subsets.assistant) },
  // What the uncertain answers were: an uncertain "skip" also triggers a fallback under the script's definition.
  uncertain_choice_run1: Object.values(jev.r1.decisions).flat().filter(d => d.uncertain).reduce((n, d) => (n[d.choice === 'skip' ? 'skip' : 'keep'] = (n[d.choice === 'skip' ? 'skip' : 'keep'] || 0) + 1, n), {}),
  events_only_uncertain_skips_run1: Object.values(jev.r1.decisions).filter(d => d.some(x => x.uncertain) && d.filter(x => x.uncertain).every(x => x.choice === 'skip')).length,
  // Paragraph count matters: more paragraphs, more chances for one to be uncertain.
  by_passage_count_run1: [[1, 1], [2, 4], [5, 8], [9, 99]].map(([lo, hi]) => { const list = items.filter(i => i.passages.length >= lo && i.passages.length <= hi); return { passages: `${lo}-${hi === 99 ? '+' : hi}`, ...need(jev.r1.decisions, list) }; }),
};
// Same stored answers (run 1), different thresholds: isolates the threshold from run-to-run noise.
out.sweep = [0.4, 0.5, 0.6, 0.65, 0.7, 0.8, 0.9].map(t => { const r = rethreshold(jev.r1.decisions, t), s = brief(scoreSelections(items, r.selections)), f = fallback(r.decisions);
  return { threshold: t, precision: s.precision, recall: s.recall, f1: s.f1, tp: s.tp, fp: s.fp, fn: s.fn, fallback_events: f.needing, fallback_rate: f.needing / f.events, uncertain_passages: f.uncertain_passages }; });

// ---- 5. run-to-run stability -----------------------------------------------------
function stability(a, b, getChoice) {
  let passages = 0, sameChoice = 0, sameSelected = 0, flips = 0, selA = 0, selB = 0, both = 0, eventsSame = 0, events = 0; const diffs = [];
  for (const item of items) {
    const da = a.decisions?.[item.event_id], db = b.decisions?.[item.event_id];
    const sa = new Set((a.selections[item.event_id] || []).map(r => r.passage_id)), sb = new Set((b.selections[item.event_id] || []).map(r => r.passage_id));
    events++; if (sa.size === sb.size && [...sa].every(x => sb.has(x))) eventsSame++;
    for (const p of item.passages) {
      passages++;
      const ina = sa.has(p.passage_id), inb = sb.has(p.passage_id);
      if (ina) selA++; if (inb) selB++; if (ina && inb) both++;
      if (ina === inb) sameSelected++; else flips++;
      if (da && db) { const x = da.find(d => d.passage_id === p.passage_id), y = db.find(d => d.passage_id === p.passage_id); if (x.choice === y.choice) sameChoice++; diffs.push(Math.abs(x.confidence - y.confidence)); }
    }
  }
  return { passages, same_selected: sameSelected / passages, flipped_passages: flips, selected_a: selA, selected_b: selB, selected_both: both, jaccard: both / (selA + selB - both), events_identical: eventsSame, events,
    ...(diffs.length ? { same_choice: sameChoice / passages, mean_abs_confidence_diff: sum(diffs, d => d) / diffs.length, max_abs_confidence_diff: Math.max(...diffs), confidence_diff_over_0_1: diffs.filter(d => d > 0.1).length } : {}) };
}
out.stability = { jev_r1_r2: stability(jev.r1, jev.r2), jev_r1_r3: stability(jev.r1, jev.r3), jev_r2_r3: stability(jev.r2, jev.r3), luna_r1_r2: stability(llm.luna1, llm.luna2) };
// Fallback flag stability: does the same event need a fallback in every run?
const needs = r => new Set(Object.entries(r.decisions).filter(([, d]) => d.some(x => x.uncertain)).map(([id]) => id));
const [n1, n2, n3] = [needs(jev.r1), needs(jev.r2), needs(jev.r3)];
out.stability.fallback_flags = { all_three: items.filter(i => n1.has(i.event_id) && n2.has(i.event_id) && n3.has(i.event_id)).length, none: items.filter(i => !n1.has(i.event_id) && !n2.has(i.event_id) && !n3.has(i.event_id)).length,
  mixed: items.filter(i => new Set([n1.has(i.event_id), n2.has(i.event_id), n3.has(i.event_id)]).size > 1).length };

// ---- 6. hybrid simulation ----------------------------------------------------------
// Event-level: keep Jev's selection when no paragraph is uncertain; otherwise use the chat model's selection for the whole event.
function hybrid(j, model, provider, modelName) {
  const selections = {}, fallbackCalls = []; let fb = 0;
  for (const item of items) {
    const d = j.decisions[item.event_id];
    if (d.some(x => x.uncertain)) { fb++; selections[item.event_id] = model.selections[item.event_id]; fallbackCalls.push(model.calls[item.event_id]); }
    else selections[item.event_id] = j.selections[item.event_id];
  }
  const cost = cacheAware(fallbackCalls, provider, modelName), jcost = cacheAware(j.calls, 'typesafe', 'jev-latest'), full = cacheAware(Object.values(model.calls), provider, modelName);
  // Events Jev handled alone, scored on their own.
  const alone = items.filter(i => !j.decisions[i.event_id].some(x => x.uncertain));
  return { ...brief(scoreSelections(items, selections)), fallback_events: fb, fallback_rate: fb / items.length, usd: jcost.max + cost.max, llm_only_usd: full.max, cost_ratio: (jcost.max + cost.max) / full.max,
    jev_alone: { events: alone.length, passages: sum(alone, i => i.passages.length), ...brief(scoreSelections(alone, j.selections)), model_on_same_events: brief(scoreSelections(alone, model.selections)) } };
}
out.hybrid = { 'Jev 0.65 + gpt-6-luna': hybrid(jev.r1, llm.luna1, 'openai', 'gpt-6-luna'), 'Jev 0.65 + claude-sonnet-5-5': hybrid(jev.r1, llm.sonnet, 'anthropic', 'claude-sonnet-5-5'),
  'Jev 0.65 + gpt-6.1-sol': hybrid(jev.r1, llm.sol, 'openai', 'gpt-6.1-sol'),
  'Jev 0.50 + claude-sonnet-5-5': hybrid({ ...jev.r1, ...rethreshold(jev.r1.decisions, 0.5) }, llm.sonnet, 'anthropic', 'claude-sonnet-5-5'),
  'Jev 0.80 + claude-sonnet-5-5': hybrid({ ...jev.r1, ...rethreshold(jev.r1.decisions, 0.8) }, llm.sonnet, 'anthropic', 'claude-sonnet-5-5') };

// ---- 7. misses and false positives (Jev run 1) ---------------------------------------
const text = (id, pid) => byEvent.get(id).passages.find(p => p.passage_id === pid);
const others = (id, pid) => Object.fromEntries(Object.entries({ luna: llm.luna1, sonnet: llm.sonnet, sol: llm.sol }).map(([k, m]) => [k, (m.selections[id] || []).find(r => r.passage_id === pid)?.kind || '-']));
const s1 = scoreSelections(items, jev.r1.selections);
const reason = d => d.choice === 'skip' ? (d.uncertain ? 'chose skip, below threshold' : 'chose skip, confident') : d.uncertain ? `chose ${d.choice}, below threshold` : d.duplicate ? 'duplicate' : 'kept by Jev but cut by the 8-per-event cap';
out.jev_misses = s1.misses.map(m => { const d = jev.r1.decisions[m.event_id].find(x => x.passage_id === m.passage_id), i = byEvent.get(m.event_id);
  return { conversation: i.conversation, source_kind: i.source_kind, event_id: m.event_id, passage_id: m.passage_id, label: m.label, jev_choice: d.choice, confidence: d.confidence, keep_probability: +d.keep_probability.toFixed(2), reason: reason(d),
    runs: [jev.r1, jev.r2, jev.r3].map(r => (r.selections[m.event_id] || []).some(x => x.passage_id === m.passage_id) ? 'kept' : 'missed').join('/'), others: others(m.event_id, m.passage_id), content: text(m.event_id, m.passage_id).content }; });
out.jev_false_positives = s1.false_positives.map(m => { const d = jev.r1.decisions[m.event_id].find(x => x.passage_id === m.passage_id), i = byEvent.get(m.event_id);
  return { conversation: i.conversation, source_kind: i.source_kind, event_id: m.event_id, passage_id: m.passage_id, label: 'skip', jev_choice: d.choice, confidence: d.confidence,
    runs: [jev.r1, jev.r2, jev.r3].map(r => (r.selections[m.event_id] || []).some(x => x.passage_id === m.passage_id) ? 'kept' : 'skipped').join('/'), others: others(m.event_id, m.passage_id), content: text(m.event_id, m.passage_id).content }; });
out.miss_reasons = out.jev_misses.reduce((n, m) => (n[m.reason] = (n[m.reason] || 0) + 1, n), {});
out.miss_by_label = out.jev_misses.reduce((n, m) => (n[m.label] = (n[m.label] || 0) + 1, n), {});
out.kind_errors = s1.kind_errors.map(k => ({ ...k, content: text(k.event_id, k.passage_id).content.slice(0, 160) }));
for (const [name, m] of Object.entries({ luna: llm.luna1, sonnet: llm.sonnet, sol: llm.sol })) {
  const s = scoreSelections(items, m.selections);
  out[name + '_false_positives'] = s.false_positives.map(f => ({ conversation: byEvent.get(f.event_id).conversation, ...f, content: text(f.event_id, f.passage_id).content }));
  out[name + '_misses'] = s.misses.map(f => ({ conversation: byEvent.get(f.event_id).conversation, source_kind: byEvent.get(f.event_id).source_kind, ...f, content: text(f.event_id, f.passage_id).content }));
}
out.oversized = Object.fromEntries(Object.entries(jev).map(([k, r]) => [k, r.oversized]));
out.tokens_per_passage = { jev: out.main[0].input_tokens / sum(items, i => i.passages.length), luna: out.main[5].input_tokens / sum(items, i => i.passages.length), sonnet: out.main[7].input_tokens / sum(items, i => i.passages.length) };
out.latency = { jev_median_per_call: out.main[0].median_ms, jev_per_event_median: median(lines('captures/2-jev065-luna.jsonl').filter(l => l.selector === 'jev').map(r => sum(r.calls, c => c.elapsed_ms))),
  jev_events_with_two_calls: lines('captures/2-jev065-luna.jsonl').filter(l => l.selector === 'jev' && l.calls.length > 1).length };

writeFileSync(new URL('analysis.json', here), JSON.stringify(out, null, 2));
const t = out.main.map(r => `| ${r.name} | ${pct(r.precision)} | ${pct(r.recall)} | ${pct(r.f1)} | ${pct(r.kind_accuracy)} | ${r.tp}/${r.fp}/${r.fn} | ${r.events}/${r.failed_events} | ${r.calls} | ${r.input_tokens.toLocaleString('en-US')} / ${r.output_tokens.toLocaleString('en-US')} | ${r.median_ms} / ${(r.total_ms / 1000).toFixed(1)} | ${r.usd.toFixed(4)} |`);
console.log(t.join('\n'));
console.log(JSON.stringify({ capture_check: out.capture_check, cost: out.cost, cap: out.cap, fallback: out.fallback, miss_reasons: out.miss_reasons, miss_by_label: out.miss_by_label, oversized: out.oversized, tokens_per_passage: out.tokens_per_passage, latency: out.latency, recorded: out.recorded }, null, 1));
