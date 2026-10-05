// Lists paragraphs the capture path never offers to a selector: beyond the 4,000-character
// prefix, cut by it, longer than 2,000 characters, or containing quoted/masked text.
import { readFileSync, writeFileSync } from 'node:fs';
import { memoryPassages, captureText } from '../src/memory-extractor.js';
const [labelsPath, outPath] = process.argv.slice(2);
const labels = JSON.parse(readFileSync(labelsPath, 'utf8'));
const record = JSON.parse(readFileSync(labels.source, 'utf8')), events = (record.context_layer || record).events;
const byId = new Map(events.map(e => [e.id, e]));
const out = { source: labels.source, events: [] }, totals = { events: 0, offered: 0, beyond_prefix: 0, cut_by_prefix: 0, over_2000: 0, masked: 0, chars: 0, chars_offered: 0 };
for (const item of labels.items) {
  const e = byId.get(item.event_id), offered = memoryPassages(e), eligible = captureText(e.content);
  const row = { event_id: e.id, source_kind: e.kind, chars: e.content.length, offered: offered.length, excluded: [] };
  for (const m of e.content.matchAll(/\S[\s\S]*?(?=\n\s*\n|$)/g)) {
    const content = m[0].trimEnd(), start = m.index, end = start + content.length;
    if (offered.some(p => p.span_start === start && p.span_end === end)) continue;
    const reason = start >= 4000 ? 'beyond_prefix' : end > 4000 || e.content.length > 4000 && m.index + m[0].length >= 4000 ? 'cut_by_prefix'
      : content.length > 2000 ? 'over_2000' : eligible.slice(start, end) !== content ? 'masked' : 'other';
    row.excluded.push({ reason, start, chars: content.length, content });
    totals[reason] = (totals[reason] || 0) + 1;
  }
  totals.events++; totals.offered += offered.length; totals.chars += e.content.length; totals.chars_offered += offered.reduce((n, p) => n + p.content.length, 0);
  out.events.push(row);
}
out.totals = totals;
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(labelsPath, JSON.stringify(totals));
