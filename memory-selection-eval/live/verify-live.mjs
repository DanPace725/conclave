// Step 2 checks on the live export. Prints counts and booleans only, so labeling stays blind.
import { readFileSync, writeFileSync } from 'node:fs';
import { jevTelemetry } from '../../src/jev-telemetry.js';
const r = JSON.parse(readFileSync(process.argv[2], 'utf8')), ev = r.events;
const shadows = ev.filter(e => e.kind === 'memory_shadow');
const span = p => `${p.span_start}-${p.span_end}`;
const perEvent = shadows.map(s => {
  const m = s.metadata, spans = new Map(m.passages.map(p => [p.passage_id, span(p)]));
  const llm = new Set((m.llm?.records || []).map(x => spans.get(x.passage_id)));
  const jev = new Set((m.jev?.records || []).map(x => spans.get(x.passage_id)));
  const saved = new Set(r.memory.records.flatMap(rec => rec.source_refs.filter(ref => ref.event_id === m.source_event_id).map(span)));
  return { source_kind: m.source_kind, applied: m.applied, passages: m.passage_count, llm_picks: llm.size, jev_picks: jev.size, saved: saved.size,
    saved_all_from_llm: [...saved].every(x => llm.has(x)), llm_all_saved: [...llm].every(x => saved.has(x)),
    jev_only_picks: [...jev].filter(x => !llm.has(x)).length, jev_only_saved: [...jev].filter(x => !llm.has(x) && saved.has(x)).length,
    jev_error: m.error, jev_calls: m.jev?.calls.length ?? 0, jev_elapsed_ms: m.jev?.elapsed_ms ?? null, llm_elapsed_ms: m.llm?.elapsed_ms ?? null,
    uncertain_passages: m.jev?.decisions.filter(d => d.uncertain).length ?? null, oversized: m.jev?.oversized.length ?? null };
});
const requests = ev.filter(e => e.kind === 'inference_request');
const responses = new Map(ev.filter(e => e.kind === 'inference_response').map(e => [e.metadata.request_id, e.metadata]));
const sel = requests.filter(e => e.content === 'memory-selection'), ext = requests.filter(e => e.content === 'memory-extraction');
const usage = list => list.reduce((n, e) => { const u = responses.get(e.id)?.usage; return { input: n.input + (u?.input_tokens || 0), output: n.output + (u?.output_tokens || 0) }; }, { input: 0, output: 0 });
const telemetry = jevTelemetry(ev, { enabled: true, available: true });
const sourcesWithShadow = new Set(shadows.map(s => s.metadata.source_event_id));
const out = {
  check_1_memory_shadow_events: shadows.length, check_1_all_applied_false: shadows.every(s => s.metadata.applied === false),
  check_2_saved_only_task_model_picks: perEvent.every(p => p.saved_all_from_llm && p.jev_only_saved === 0),
  check_2_jev_only_picks_total: perEvent.reduce((n, p) => n + p.jev_only_picks, 0), check_2_jev_only_picks_saved: perEvent.reduce((n, p) => n + p.jev_only_saved, 0),
  check_2_memory_records_total: r.memory.records.length,
  check_2_records_outside_shadowed_sources: r.memory.records.filter(rec => !rec.source_refs.some(ref => sourcesWithShadow.has(ref.event_id))).length,
  check_3_memory_selection_requests: sel.length, check_3_providers: [...new Set(sel.map(e => e.metadata.provider))],
  check_3_models: [...new Set(sel.map(e => responses.get(e.id)?.model))], check_3_usage: usage(sel),
  memory_extraction_requests: ext.length, memory_extraction_providers: [...new Set(ext.map(e => e.metadata.provider || e.actor))], memory_extraction_usage: usage(ext),
  check_4_telemetry_summary: telemetry.summary, per_event: perEvent };
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
