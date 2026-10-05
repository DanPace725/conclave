import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { WorkspaceHarness } from '../src/workspace.js';
import { ConclaveService } from '../src/service.js';
import { downloadRecord } from '../src/context-repository.js';
import { taskProvider, JevProvider } from '../src/provider.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { captureMemory } from '../src/memory-controller.js';
import { memoryPassages } from '../src/memory-extractor.js';
import { memoryView } from '../src/memory.js';
import { createGuard, MODELS, workload } from './replay-pain.js';

// Explicit --live required. Usage: --live <original export> <first repaired replay export> <output dir>
if (process.argv[2] !== '--live') {
  console.log('Prepare-only; pass --live and explicit original/replay exports to run bounded native probes.');
} else {
  const [, , , originalPath, replayPath, directory] = process.argv;
  const original = JSON.parse(readFileSync(originalPath, 'utf8')), replay = JSON.parse(readFileSync(replayPath, 'utf8'));
  const events = replay.context_layer.events;
  const capture = events.find(e => e.kind === 'memory_capture' && e.metadata.source_kind === 'assistant' && e.metadata.admitted_count > 0);
  if (!capture) throw Error('Replay has no assistant extraction to retest');
  const source = events.find(e => e.id === capture.metadata.source_event_id);
  const ledger = { max_calls: 16, max_usd: .5, usd_max: 0, reserved: 0, unknown_usage: false, calls: [] };
  const signal = AbortSignal.timeout(180000), guard = createGuard(ledger, signal);
  const guarded = provider => ({ name: provider.name,
    ...(provider.requestPayload ? { requestPayload: p => provider.requestPayload(p) } : {}),
    respond: (p, options) => guard(provider.name, p.model, p, p.max_output_tokens || 0,
      () => provider.respond(p, { ...options, signal: AbortSignal.any([signal, ...(options?.signal ? [options.signal] : [])]) })) });
  mkdirSync(directory, { recursive: true });
  const report = { version: 'pain-repair-probes-v1', ledger, memory: [], retrieval: [],
    method: 'Two native extractors retest the actual malformed-memory source; Jev probe uses six exact original E2 documents. Separate controlled checks, not another full replay.' };
  const save = () => writeFileSync(join(directory, 'probes.json'), JSON.stringify(report, null, 2));
  try {
    for (const provider of process.argv.includes('--skip-memory') ? [] : ['openai', 'anthropic']) {
      const store = new Store(undefined, { memory: true }), id = store.create(`Memory fix probe ${provider}`);
      try {
        ledger.arm = `memory-${provider}`;
        const h = new Harness(store, id, guarded(taskProvider(provider)), { model: MODELS[provider], memoryModel: true, signal });
        const event = h.addMessage('assistant', source.content).event;
        store.append(id, 'turn_complete', '', { assistant_event_id: event.id });
        await captureMemory(h, event);
        const memory = memoryView(store, id);
        report.memory.push({ provider, model: MODELS[provider], original_source_event_id: source.id,
          original_bad_records: replay.context_layer.memory.records.filter(r => r.source_refs.some(s => s.event_id === source.id)).map(r => r.content),
          offered_passages: memoryPassages(event), capture: store.events(id).findLast(e => e.kind === 'memory_capture').metadata,
          records: memory.records, exact_complete_paragraphs: memory.records.every(r => memoryPassages(event).some(p => p.content === r.content)),
          authority_preserved: memory.records.every(r => r.authority === 'model_proposed' && !r.binding && r.resolution === 'unresolved') });
      } finally { store.close(); save(); }
    }
    const store = new Store(undefined, { memory: true }), id = store.create('Pain corpus Jev probe');
    const provider = guarded(taskProvider('openai'));
    try {
      ledger.arm = 'jev-corpus';
      const h = new WorkspaceHarness(store, id, provider, { model: MODELS.openai, budget: 128000, output: 4096,
        maxCalls: 10, reasoning: 'low', decisionAdapter: new JevDecisionAdapter(guarded(new JevProvider())), signal });
      for (const e of workload(original).pages.filter(e => e.metadata.source_url.includes('/ormd/'))) {
        h.ingestText(e.metadata.title || e.metadata.source_url, e.content, 'pain endurance caregiving responsibility',
          { source_url: e.metadata.source_url, original_event_id: e.id, frozen_replay: true, evidence_scope: 'page-text' });
      }
      for (const query of ['caregiving responsibility family suffering endurance', 'pain suffering responsibility', 'responsibility absorption asymmetry maintenance']) {
        const excerpts = await h.executeTool('search_history', { query }, []);
        report.retrieval.push({ query, excerpts, decision: store.events(id).findLast(e => e.kind === 'retrieval_decision')?.metadata }); save();
      }
      const answer = await h.ask('Use search_history for "caregiving responsibility family suffering endurance" and search_source for a targeted passage from Family as a Relational Field and Caregiving as an Ecosystem. Explain what this captured E2 corpus does and does not establish about learned pain endurance and gender. Distinguish conceptual overlap from empirical evidence. Save a concise synthesis in pain-corpus-probe.md and read it back.');
      report.answer = answer.text; report.status = 'completed';
    } catch (error) { report.status = 'failed'; report.error = error.message; }
    finally {
      const service = new ConclaveService(store, { providerFactory: () => provider, memoryModel: false, embeddingEnabled: false });
      report.jev = service.jevAudit(id, { enabled: true, available: true });
      writeFileSync(join(directory, 'jev-corpus.json'), JSON.stringify(downloadRecord(service, id)));
      store.close(); save();
    }
  } finally { save(); }
  console.log(JSON.stringify({ report: join(directory, 'probes.json'), calls: ledger.calls.length, usd_max: ledger.usd_max }));
  if (report.status !== 'completed') process.exitCode = 1;
}
