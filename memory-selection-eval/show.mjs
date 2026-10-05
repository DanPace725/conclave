// Compact view of a label file for hand labeling: item index, kind, passage id, text.
import { readFileSync } from 'node:fs';
const f = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const from = Number(process.argv[3] ?? 0), to = Number(process.argv[4] ?? f.items.length);
f.items.slice(from, to).forEach((item, k) => {
  console.log(`\n##### ITEM ${from + k} [${item.source_kind}] ${item.event_id}`);
  for (const p of item.passages) console.log(`--- ${from + k}.${p.passage_id}${p.label ? ' {' + p.label + '}' : ''}\n${p.content}`);
});
