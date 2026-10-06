// Labeled-passage comparison of memory selectors. Labels grade selection only;
// they do not verify facts. Live selectors are opt-in and spend provider credit.
//
//   node scripts/evaluate-memory-selection.js prepare EXPORT.json [--out labels.json] [--no-user]
//   node scripts/evaluate-memory-selection.js score labels.json [--recorded labels.recorded.json]
//        [--jev] [--llm openai:gpt-6-luna] [--confidence 0.65] [--out report.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { memoryPassages } from '../src/memory-extractor.js';
import { MEMORY_LABELS_VERSION, LABELS, labelItems, scoreSelections, compareSelections } from '../src/memory-evaluation.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { JevProvider, taskProvider, redact } from '../src/provider.js';
import { extractPassages } from '../src/memory-selection.js';
import { sanitizeExport } from '../src/export-sanitizer.js';
import { priceUsage } from '../src/costs.js';

const [command, input, ...rest] = process.argv.slice(2);
const flag = name => rest.includes(name);
const option = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, data) => writeFileSync(path, JSON.stringify(sanitizeExport(data), null, 2));
const costs = readJson(new URL('../src/resources/model-costs-2026-10-02.json', import.meta.url));
// Shared pricing, so cache reads and writes are valued at their own rates.
const price = (calls, provider, model) => {
  if (calls.some(c => !c.usage)) return null;
  const priced = calls.map(c => priceUsage(c.usage, provider, model, costs, { tier: 'short' }));
  return priced.some(p => p.usd_max == null) ? null : priced.reduce((n, p) => n + p.usd_max, 0);
};

function prepare() {
  const record = readJson(input), events = (record.context_layer || record).events;
  if (!Array.isArray(events)) throw Error('Expected a canonical export with events');
  const items = labelItems(events, memoryPassages, { includeUser: !flag('--no-user') });
  const out = option('--out') || 'memory-labels.json';
  writeJson(out, { version: MEMORY_LABELS_VERSION, source: input,
    conversation_id: record.conversation_id || record.context_layer?.conversation_id || null,
    instructions: `Set each passage label to one of: ${LABELS.join(', ')}. "keep" grades selection without kind; "optional" is neither a miss nor a false positive. Label before opening the recorded file.`,
    items });
  // Recorded active/comparison selections stay apart so labeling stays blind.
  const shadows = events.filter(e => ['memory_shadow', 'memory_comparison'].includes(e.kind)
    || e.kind === 'memory_selection' && e.metadata.selector === 'jev');
  const recorded = { llm: {}, jev: {}, jev_decisions: {} };
  for (const e of shadows) {
    if (e.kind !== 'memory_selection') recorded.llm[e.metadata.source_event_id] = e.metadata.llm?.records ?? null;
    recorded.jev[e.metadata.source_event_id] = e.metadata.jev?.records ?? null;
    if (e.metadata.jev) recorded.jev_decisions[e.metadata.source_event_id] = e.metadata.jev.decisions;
  }
  const recordedPath = out.replace(/\.json$/, '') + '.recorded.json';
  if (shadows.length) writeJson(recordedPath, recorded);
  console.log(JSON.stringify({ labels: out, items: items.length, passages: items.reduce((n, i) => n + i.passages.length, 0),
    recorded: shadows.length ? recordedPath : null, recorded_events: shadows.length }, null, 2));
}

async function runJev(items) {
  const provider = new JevProvider();
  const adapter = new JevDecisionAdapter(provider, { confidence: Number(option('--confidence') ?? 0.65) });
  const selections = {}, decisions = {}, calls = [], errors = [];
  for (const item of items) {
    try {
      const result = await adapter.selectMemory(item.passages, { source_kind: item.source_kind, related: item.related || [] },
        payload => provider.respond(payload));
      selections[item.event_id] = result.records; decisions[item.event_id] = result.decisions; calls.push(...result.calls);
    } catch (e) { selections[item.event_id] = null; errors.push({ event_id: item.event_id, error: redact(e) }); }
  }
  return { selections, decisions, calls, errors, usd: price(calls, 'typesafe', adapter.options.model) };
}

async function runLlm(items, spec) {
  const [name, model] = spec.split(':');
  if (!name || !model) throw Error('--llm expects provider:model');
  const provider = taskProvider(name);
  const selections = {}, calls = [], errors = [];
  for (const item of items) {
    const event = { id: item.event_id, kind: item.source_kind, content: '', metadata: {} };
    try {
      const h = { options: {model}, provider, call: async (payload, purpose, limits) => {
        const began = Date.now(), response = await provider.respond(payload, {signal:limits.signal});
        calls.push({passages:JSON.parse(payload.input[0].content).passages.length,elapsed_ms:Date.now()-began,usage:response.usage || null,model:response.model || model});
        return response;
      }};
      selections[item.event_id] = (await extractPassages(h,event,item.related || [],item.passages)).records;
    } catch (e) { selections[item.event_id] = null; errors.push({ event_id: item.event_id, error: redact(e) }); }
  }
  return { selections, calls, errors, usd: price(calls, name, model), provider: name, model };
}

function summarize(calls) {
  const elapsed = calls.map(c => c.elapsed_ms).sort((a, b) => a - b);
  return { calls: calls.length, input_tokens: calls.reduce((n, c) => n + (c.usage?.input_tokens || 0), 0),
    output_tokens: calls.reduce((n, c) => n + (c.usage?.output_tokens || 0), 0), unknown_usage_calls: calls.filter(c => !c.usage).length,
    elapsed_ms_total: elapsed.reduce((n, v) => n + v, 0), elapsed_ms_median: elapsed.length ? elapsed[Math.floor(elapsed.length / 2)] : null };
}

// Events where Jev left any passage uncertain would need an LLM fallback call.
function fallbackNeed(decisions) {
  const events = Object.values(decisions);
  return { scope: 'event has any escalated passage; only those passages require fallback', events: events.length, needing_fallback: events.filter(d => d.some(x => x.uncertain)).length,
    uncertain_passages: events.reduce((n, d) => n + d.filter(x => x.uncertain).length, 0) };
}

async function score() {
  const labels = readJson(input);
  if (labels.version !== MEMORY_LABELS_VERSION) throw Error(`Expected ${MEMORY_LABELS_VERSION} labels`);
  const items = labels.items.filter(i => i.passages.some(p => LABELS.includes(p.label)));
  const report = { scope: 'Labeled selection agreement only; not factual accuracy, answer quality or whole-task savings.',
    labels: input, labeled_items: items.length, selectors: {} };
  const add = (name, selections, extra = {}) => { report.selectors[name] = { ...scoreSelections(items, selections), ...extra }; };
  if (option('--recorded')) {
    const recorded = readJson(option('--recorded'));
    add('recorded_llm', recorded.llm);
    add('recorded_jev', recorded.jev, { fallback: fallbackNeed(recorded.jev_decisions || {}) });
  }
  let jev, llm;
  if (flag('--jev')) {
    jev = await runJev(items);
    add('jev', jev.selections, { usage: summarize(jev.calls), usd: jev.usd, errors: jev.errors, fallback: fallbackNeed(jev.decisions) });
  }
  if (option('--llm')) {
    llm = await runLlm(items, option('--llm'));
    add(`llm:${llm.provider}:${llm.model}`, llm.selections, { usage: summarize(llm.calls), usd: llm.usd, errors: llm.errors });
  }
  if (jev && llm) {
    const shared = items.filter(i => jev.selections[i.event_id] && llm.selections[i.event_id]);
    const comparisons = shared.map(i => compareSelections(llm.selections[i.event_id], jev.selections[i.event_id]));
    report.agreement = { events: shared.length,
      mean_jaccard: comparisons.length ? comparisons.reduce((n, c) => n + c.jaccard, 0) / comparisons.length : null,
      kind_matches: comparisons.reduce((n, c) => n + c.kind_matches, 0), both: comparisons.reduce((n, c) => n + c.both, 0) };
  }
  if (!Object.keys(report.selectors).length) throw Error('Nothing to score: pass --recorded, --jev and/or --llm');
  const out = option('--out');
  if (out) writeJson(out, report);
  const brief = Object.fromEntries(Object.entries(report.selectors).map(([name, s]) => [name, {
    precision: s.precision, recall: s.recall, f1: s.f1, kind_accuracy: s.kind_accuracy, events: s.events,
    failed_events: s.failed_events, usd: s.usd ?? null, calls: s.usage?.calls ?? null, fallback: s.fallback ?? null }]));
  console.log(JSON.stringify({ ...(out ? { report: out } : {}), labeled_items: items.length, selectors: brief, agreement: report.agreement || null }, null, 2));
}

try {
  if (command === 'prepare' && input) prepare();
  else if (command === 'score' && input) await score();
  else { console.error('Usage: evaluate-memory-selection.js prepare EXPORT.json [--out labels.json] [--no-user] | score labels.json [--recorded FILE] [--jev] [--llm provider:model] [--out report.json]'); process.exitCode = 2; }
} catch (error) { console.error(redact(error)); process.exitCode = 1; }
