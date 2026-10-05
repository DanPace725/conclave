// Applies a hand-written label map (lines of "item.passage code") to a label file.
// Codes: s skip, o optional, k keep, p preference, c claim, q question.
import { readFileSync, writeFileSync } from 'node:fs';
const [file, mapFile] = process.argv.slice(2);
const codes = { s: 'skip', o: 'optional', k: 'keep', p: 'preference', c: 'claim', q: 'question' };
const f = JSON.parse(readFileSync(file, 'utf8'));
const seen = new Set();
for (const token of readFileSync(mapFile, 'utf8').split(/\s+/).filter(Boolean)) {
  const m = token.match(/^(\d+)\.(\d+)=([sokpcq])$/);
  if (!m) throw Error(`Bad token ${token}`);
  const passage = f.items[+m[1]]?.passages.find(p => p.passage_id === +m[2]);
  if (!passage) throw Error(`No passage ${token}`);
  if (seen.has(m[1] + '.' + m[2])) throw Error(`Duplicate ${token}`);
  seen.add(m[1] + '.' + m[2]); passage.label = codes[m[3]];
}
const missing = f.items.flatMap((it, i) => it.passages.filter(p => !p.label).map(p => `${i}.${p.passage_id}`));
const ordered = { version: f.version, source: f.source, conversation_id: f.conversation_id, labeler: 'agent', instructions: f.instructions, items: f.items };
writeFileSync(file, JSON.stringify(ordered, null, 2));
const counts = {}; for (const it of f.items) for (const p of it.passages) counts[p.label ?? 'unlabeled'] = (counts[p.label ?? 'unlabeled'] || 0) + 1;
console.log(JSON.stringify({ file, labeled: seen.size, missing, counts }));
