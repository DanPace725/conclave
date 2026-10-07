import { writeFileSync, mkdirSync } from 'node:fs';
import { OpenAIProvider, taskProvider, redact } from '../src/provider.js';
import { Store } from '../src/store.js';
import { ConclaveService } from '../src/service.js';
import { reasoningDecisionPayload } from '../src/auto-reasoning.js';

const directory = new URL('../docs/archive/2026-10-06/', import.meta.url);
const api = new OpenAIProvider();
const cases = [
  { name: 'copy', provider: 'openai', model: 'gpt-6-luna', content: 'Reply with exactly READY.' },
  { name: 'explanation', provider: 'openai', model: 'gpt-6.1-sol', content: 'Explain a binary search tree in one sentence for a beginner.' },
  { name: 'concurrency', provider: 'openai', model: 'gpt-6-astra', content: 'Diagnose intermittent duplicate debits in a payment service with at-least-once queue delivery. Explain the race between two workers using SELECT then INSERT and design an atomic idempotency transaction, considering crashes before acknowledgement and conflicting payloads using the same key.' },
  { name: 'architecture', provider: 'anthropic', model: 'claude-sonnet-5-5', content: 'Design and verify a distributed transaction protocol under network partitions. Reconcile availability, linearizable writes, crash recovery and fencing tokens; prove the invariants and explain which guarantees cannot simultaneously hold.' },
];
const report = { checked_at: new Date().toISOString(), scope: 'Four synthetic selector probes and two native Context answers. Task difficulty estimates, not a calibrated quality or savings benchmark.', probes: [], answers: [] };
for (const sample of cases) {
  const start = Date.now();
  try {
    const body = reasoningDecisionPayload({ model: sample.model, input: [{ role: 'user', content: sample.content }], max_output_tokens: 1024 }, sample.provider, sample.content);
    const response = await api.decide(body);
    report.probes.push({ ...sample, elapsed_ms: Date.now() - start, response });
  } catch (error) { report.probes.push({ ...sample, error: redact(error) }); }
}
const store = new Store(undefined, { memory: true });
try {
  const service = new ConclaveService(store, { memoryModel: false, embeddingEnabled: false,
    availability: () => ({ openai: true, anthropic: false, jev: true }), decisionFactory: () => null,
    providerFactory: provider => taskProvider(provider, { requestSignal: AbortSignal.timeout(30000) }),
  });
  for (const sample of [cases[0], cases[2]]) {
    const id = service.create(sample.name).conversation_id;
    const start = Date.now();
    try {
      const view = await service.ask(id, { message_id: 'smoke', content: sample.content,
        settings: { provider: 'openai', model: 'gpt-6-luna', reasoning: 'auto', jev: false, output: 8192 } });
      const events = store.events(id), message = view.messages.at(-1);
      report.answers.push({ name: sample.name, elapsed_ms: Date.now() - start, selection: message.reasoning_selection,
        answer: message.content, generation_settings: message.invocation.generation_settings,
        usage_by_purpose: view.metrics.usage_by_purpose,
        selector_usage: events.find(e => e.kind === 'inference_response' && e.content === 'reasoning-selection')?.metadata.usage,
        answer_usage: message.usage,
        passed: message.role === 'assistant' && message.reasoning_selection?.reason === 'selected'
          && message.invocation.generation_settings.reasoning.effort === message.reasoning_selection.selected
          && (sample.name !== 'copy' || message.content.trim() === 'READY') });
    } catch (error) {
      const events = store.events(id);
      report.answers.push({ name: sample.name, passed: false, elapsed_ms: Date.now() - start, error: redact(error),
        selection: events.findLast(e => e.kind === 'reasoning_selection')?.metadata,
        selector_usage: events.find(e => e.kind === 'inference_response' && e.content === 'reasoning-selection')?.metadata.usage,
        answer_usage: events.findLast(e => e.kind === 'inference_response' && e.content === 'answer')?.metadata.usage });
    }
  }
} finally { store.close(); }
report.passed = report.probes.every(p => !p.error) && report.answers.every(a => a.passed);
report.selector_input_tokens = report.probes.reduce((n, p) => n + (p.response?.usage?.input_tokens || 0), 0)
  + report.answers.reduce((n, a) => n + (a.selector_usage?.input_tokens || 0), 0);
report.estimated_selector_base_cost_usd = report.selector_input_tokens * 0.10 / 1000000;
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('auto-reasoning-live.json', directory), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
