import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { OpenAIProvider } from '../src/provider.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Explicitly opt in: one bounded real-model conversation, not a benchmark.
const store = new Store('.conclave/live-smoke');
try {
  const conversation = store.create('Luna retrieval and context edit smoke');
  const harness = new Harness(store, conversation, new OpenAIProvider(), { output: 700, maxCalls: 4 });
  harness.pin('Architecture A may still work if X changes. Never turn this possibility into a rejection.');
  const code = harness.addMessage('user', 'The amber recovery code is orchard-719.');
  harness.addMessage('user', 'Continue after recording that code.');
  harness.edit({ expected_revision: store.context(conversation).revision, remove_ids: [code.item.id], additions: [] });
  const result = await harness.ask('First search_history for "amber recovery code". Then use edit_context to add a short evidence bundle containing the recovered code and its source_event_ids, without removing any existing bundle. Finally give the code and state whether architecture A has been conclusively rejected.');
  const context = store.context(conversation);
  const report = { conversation_id: conversation, answer: result.text,
    answer_contains_exact_code: result.text.includes('orchard-719'),
    model_saved_recovered_evidence: context.segments.some((s) => s.type === 'evidence' && s.content.includes('orchard-719')),
    pinned_constraint_intact: context.segments.some((s) => s.pinned && s.content.includes('may still work')),
    metrics: harness.metrics(), note: 'One smoke conversation. No claim of general fidelity or cost savings.' };
  const path = join(store.directory, 'receipt.json');
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, receipt: path }, null, 2));
  if (!report.answer_contains_exact_code || !report.model_saved_recovered_evidence || !report.pinned_constraint_intact) process.exitCode = 1;
} finally { store.close(); }
