import { parseArgs } from 'node:util';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { OpenAIProvider, redact } from '../src/provider.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// One small fixed task, three context policies. Run explicitly; at most 17 model calls including pressure compaction.
const { values } = parseArgs({ options: { model: { type: 'string', default: 'gpt-6-luna' },
  budget: { type: 'string', default: '30000' }, output: { type: 'string', default: '700' } } });
const fixture = {
  version: 'recovery-and-caveat-v1',
  history: [
    'The amber recovery code is orchard-719. Architecture A was tried twice. It may still work if X changes, but B currently looks easier.',
    ...Array.from({ length: 5 }, (_, i) => `Observation ${i + 1}: ` + 'Routine review found no new evidence about A or B. '.repeat(45)),
    'The working preference is B. This does not conclusively rule out architecture A.',
  ],
  question: 'Give the exact amber recovery code. Has architecture A been conclusively rejected? Explain briefly, keeping its condition attached.',
};
const store = new Store('.conclave/evaluation');
const results = [];
try {
  const provider = new OpenAIProvider();
  for (const mode of ['append', 'summary', 'layered']) {
    const conversation = store.create(`Small comparison: ${mode}`);
    const harness = new Harness(store, conversation, provider, {
      mode, model: values.model, budget: Number(values.budget), output: Number(values.output), maxCalls: 3,
    });
    for (const message of fixture.history) harness.addMessage('user', message);
    let answer = null, error = null;
    try {
      if (mode !== 'append') await harness.compact([], true);
      answer = (await harness.ask(fixture.question)).text;
    } catch (failure) { error = redact(failure); }
    results.push({ mode, conversation_id: conversation, answer, error,
      exact_code: answer?.includes('orchard-719') || false,
      caveat_review: 'Human review required: does the answer preserve that A may still work if X changes?',
      raw_code_recoverable: store.search(conversation, 'orchard-719').some((e) => e.content.includes('orchard-719')),
      metrics: harness.metrics() });
  }
  const report = { fixture, model: values.model, budget: Number(values.budget), output: Number(values.output),
    policy_version: 'retention-v2', results,
    note: 'Small smoke comparison, not a benchmark. Mode-specific compaction guidance differs; all modes have the same retrieval tools. Counts include preparation/compaction. Review caveats manually. No FLOPs or price claim.' };
  const path = join(store.directory, 'comparison.json');
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ results, report: path }, null, 2));
  if (results.some((r) => r.error || !r.exact_code)) process.exitCode = 1;
} finally { store.close(); }
