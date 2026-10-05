// Brief per-turn status from an export; prints counts only.
import { readFileSync } from 'node:fs';
const r = JSON.parse(readFileSync(process.argv[2], 'utf8')), ev = r.events;
const count = k => ev.filter(e => e.kind === k).length;
const lastA = ev.findLast(e => e.kind === 'assistant');
const fetches = {}; for (const e of ev.filter(e => e.kind === 'tool_result')) fetches[e.metadata.tool] = (fetches[e.metadata.tool] || 0) + 1;
console.log(JSON.stringify({ events: ev.length, user: count('user'), assistant: count('assistant'), turn_complete: count('turn_complete'), turn_failure: count('turn_failure'),
  tool_results: fetches, last_answer_chars: lastA?.content.length,
  memory_capture: ev.filter(e => e.kind === 'memory_capture').map(e => `${e.metadata.source_kind}:${e.metadata.status}:paid=${e.metadata.paid_extraction}:admitted=${e.metadata.admitted_count}`),
  memory_shadow: ev.filter(e => e.kind === 'memory_shadow').map(e => `${e.metadata.source_kind}:applied=${e.metadata.applied}:jev=${e.metadata.jev ? e.metadata.jev.records.length : 'failed'}:llm=${e.metadata.llm?.records?.length ?? 'failed'}`),
  memory_records: r.memory?.records?.length }));
