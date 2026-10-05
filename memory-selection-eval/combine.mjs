// Combines the per-conversation label files into one file for the live scoring runs.
import { readFileSync, writeFileSync } from 'node:fs';
const names = ['homelessness', 'pain', 'brain', 'feedback', 'live'];
const items = [], sources = [], counts = {};
for (const name of names) {
  const f = JSON.parse(readFileSync(`labels-${name}.json`, 'utf8'));
  sources.push({ name, source: f.source, conversation_id: f.conversation_id, items: f.items.length, passages: f.items.reduce((n, i) => n + i.passages.length, 0) });
  for (const item of f.items) { items.push({ conversation: name, ...item }); for (const p of item.passages) counts[p.label] = (counts[p.label] || 0) + 1; }
}
if (new Set(items.map(i => i.event_id)).size !== items.length) throw Error('Duplicate event IDs');
writeFileSync('labels-all.json', JSON.stringify({ version: 'memory-labels-v1', labeler: 'agent', labeled_before_any_selector_ran: true, sources, label_counts: counts, items }, null, 2));
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(JSON.stringify({ items: items.length, passages: total, counts, optional_share: counts.optional / total, required: total - counts.skip - counts.optional,
  user_items: items.filter(i => i.source_kind === 'user').length, assistant_items: items.filter(i => i.source_kind === 'assistant').length }));
