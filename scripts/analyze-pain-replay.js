// Offline metrics; selection/delivery counts do not certify semantic accuracy.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readHandoff, observationRanges } from '../src/continuation-evidence.js';
import { memoryPassages } from '../src/memory-extractor.js';
import { jevTelemetry } from '../src/jev-telemetry.js';
const directory = process.argv[2], comparison = JSON.parse(readFileSync(join(directory, 'comparison.json'), 'utf8'));
const count = (events, kind) => events.filter(e => e.kind === kind).length;
const analysis = { scope: 'One cheap-model pair, frozen external evidence. Mechanism checks, not statistical quality or savings proof.', arms: [] };
for (const result of comparison.results) {
  const record = JSON.parse(readFileSync(join(directory, `${result.arm}.json`), 'utf8'));
  const layer = record.context_layer, events = layer.events;
  const requests = events.filter(e => e.kind === 'inference_request' && e.content === 'answer');
  const supplied = request => {
    const calls = new Set();
    for (const item of request.metadata.payload.input || []) {
      if (item.type === 'function_call_output') calls.add(item.call_id);
      for (const r of readHandoff(item)?.fresh_tool_results || []) calls.add(r.call_id);
    }
    return calls;
  };
  const large = events.filter(e => e.kind === 'tool_result' && e.content.length > 1600).map(e => {
    const next = requests.find(r => r.seq > e.seq);
    return { event_id: e.id, tool: e.metadata.tool, characters: e.content.length, next_request_id: next?.id || null,
      delivered_as_tool_exchange_or_fresh_handoff: next ? supplied(next).has(e.metadata.call_id) : null };
  });
  const memories = layer.memory.records;
  const proposed = memories.filter(r => r.attribution.kind === 'assistant');
  const captures = events.filter(e => e.kind === 'memory_capture');
  const calls = comparison.ledger.calls.filter(c => c.arm === result.arm);
  const stops = events.filter(e => e.kind === 'agent_checkpoint' && e.metadata.state.status !== 'running')
    .map(e => ({ status: e.metadata.state.status, steps: e.metadata.state.steps, stop: e.metadata.state.stop }));
  analysis.arms.push({ arm: result.arm, turns: result.turns.map(t => ({ turn: t.turn, status: t.status,
    agent_status: t.agent_status || null, error: t.error || null, export_ms: t.export_ms, export_bytes: t.export_bytes })),
    native_calls: calls.length, native_input_tokens: calls.reduce((n, c) => n + (c.usage?.input_tokens || 0), 0),
    native_output_tokens: calls.reduce((n, c) => n + (c.usage?.output_tokens || 0), 0),
    priced_usd_min: calls.reduce((n, c) => n + (c.cost?.usd_min || 0), 0),
    priced_usd_max: calls.reduce((n, c) => n + (c.cost?.usd_max || 0), 0),
    unknown_usage_calls: calls.filter(c => !c.usage).length,
    memory: { total_records: memories.length, assistant_proposals: proposed.length,
      split_word_proposals: proposed.filter(r => r.source_refs.some(ref => {
        const text = events.find(e => e.id === ref.event_id)?.content || '';
        const word = ch => /[\p{L}\p{N}]/u.test(ch || '');
        return word(text[ref.span_start - 1]) && word(text[ref.span_start])
          || word(text[ref.span_end - 1]) && word(text[ref.span_end]);
      })).length,
      complete_paragraph_proposals: proposed.filter(r => memoryPassages(events.find(e => e.id === r.source_refs[0].event_id)).some(p => p.content === r.content)).length,
      invalid_authority_promotions: proposed.filter(r => r.binding || r.authority !== 'model_proposed' || r.resolution !== 'unresolved').length,
      paid_extraction_calls: count(events.filter(e => e.content === 'memory-extraction'), 'inference_request'),
      capture_failures: captures.filter(e => e.metadata.status === 'failed').map(e => e.metadata) },
    jev: jevTelemetry(events).summary,
    embeddings: { requests: count(events, 'embedding_request'), completed: events.filter(e => e.kind === 'embedding_response' && e.metadata.status === 'completed').length,
      failures: count(events, 'embedding_failure'), skips: count(events, 'embedding_skip') },
    tools: Object.fromEntries([...new Set(events.filter(e => e.kind === 'tool_call').map(e => e.content))].map(name => [name, events.filter(e => e.kind === 'tool_call' && e.content === name).length])),
    frozen_page_fetch_failures: count(events, 'web_fetch_failure'),
    continuation_restarts: count(events, 'continuation_restart'), fresh_large_receipts: large,
    source_ranges_supplied: requests.reduce((n, r) => n + observationRanges(r.metadata.payload).length, 0),
    shadow: events.filter(e => e.kind === 'context_economics').map(e => ({ status: e.metadata.evaluation_status, reason: e.metadata.reason, elapsed_ms: e.metadata.elapsed_ms })),
    workspace_files: events.filter(e => e.kind === 'document' && e.metadata.workspace_path).map(e => ({ path: e.metadata.workspace_path, characters: e.content.length, source_event_id: e.id })),
    stops });
}
writeFileSync(join(directory, 'analysis.json'), JSON.stringify(analysis, null, 2));
console.log(JSON.stringify(analysis.arms.map(({ fresh_large_receipts, shadow, ...a }) => ({ ...a,
  large_receipts: fresh_large_receipts.length, supplied: fresh_large_receipts.filter(r => r.delivered_as_tool_exchange_or_fresh_handoff).length,
  not_supplied: fresh_large_receipts.filter(r => r.delivered_as_tool_exchange_or_fresh_handoff === false).length })), null, 2));
