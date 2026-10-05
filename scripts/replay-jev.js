// Bounded retrieval-quality probe. Default is offline; --live makes at most
// three Jev calls. It does not replay answers, rewrite state, or edit exports.
import { readFileSync, writeFileSync } from 'node:fs';
import { JevProvider } from '../src/provider.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { retrievalCandidate } from '../src/retrieval-evidence.js';

const paths = process.argv.slice(2).filter(p => !p.startsWith('--'));
const live = process.argv.includes('--live'), provider = live ? new JevProvider() : null;
const adapter = new JevDecisionAdapter(provider), cases = [];
for (const path of paths) {
  const json = JSON.parse(readFileSync(path, 'utf8')), layer = json.context_layer || json, events = layer.events;
  for (const decision of events.filter(e => e.kind === 'retrieval_decision' && e.metadata.assessment?.decisions).slice(0, 2)) {
    if (cases.length >= 2) break;
    const request = events.findLast(e => e.seq < decision.seq && e.kind === 'inference_request' && e.content === 'retrieval-reranking');
    const oldCandidates = Object.values(request?.metadata.payload?.questions || {}).map(q => q.instructions.candidate);
    const candidates = decision.metadata.assessment.decisions.map((d, i) => {
      const event = events.find(e => e.id === d.id), excerpt = oldCandidates[i]?.excerpt;
      if (!event || !excerpt) return null;
      const offset = event.content.indexOf(excerpt);
      if (offset < 0) return null;
      return retrievalCandidate({ event_id: event.id, kind: event.kind, offset, content: event.content.slice(offset, offset + 1600) },
        event, null, decision.metadata.query);
    }).filter(Boolean);
    cases.push({ type: 'saved retrieval', conversation_id: layer.conversation_id, decision_seq: decision.seq,
      query: decision.metadata.query, original: decision.metadata.assessment, candidates });
  }
}
// An explicit positive control detects a selector that only ever falls back.
cases.push({ type: 'synthetic positive control', query: 'How many participants did the orbital archive study include?',
  candidates: [0, 1, 2, 3, 4].map(i => ({ id: 'distractor-' + i, kind: 'document', excerpt: 'The orbital archive describes building repairs and the history of its library. The study sample is not mentioned.' }))
    .concat({ id: 'answer', kind: 'document', excerpt: 'The orbital archive study included exactly 129 participants. This is the final enrolled sample.' }) });
for (const item of cases) {
  if (!live) continue;
  const started = performance.now(); let usage = null;
  try {
    item.revised = await adapter.rerank(item.candidates, item.query, async payload => {
      const response = await provider.respond(payload, { signal: AbortSignal.timeout(15000) });
      usage = response.usage || null; return response;
    });
    item.elapsed_ms = performance.now() - started; item.usage = usage;
  } catch (error) { item.error = error.message; item.usage = usage; }
}
const output = { live, scope: 'At most two historical decisions and one synthetic control. Selection is not evidence of answer quality or measured savings.', cases };
const outputPath = process.argv.find(p => p.startsWith('--output='))?.slice(9);
if (outputPath) writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ live, cases: cases.map(c => ({ type: c.type, query: c.query, candidates: c.candidates.length,
  original_fallback: c.original?.fallback, revised_fallback: c.revised?.fallback,
  positive_judgments: c.revised?.decisions.filter(d => !d.uncertain && ['useful', 'direct'].includes(d.category)).length,
  first: c.revised?.ids[0], usage: c.usage, elapsed_ms: c.elapsed_ms, error: c.error })) }, null, 2));
