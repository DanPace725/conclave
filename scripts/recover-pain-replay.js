// Explicit bounded recovery. Original trials remain untouched, including failures.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { modules, createGuard, MODELS, workload } from './replay-pain.js';
import { taskProvider, JevProvider } from '../src/provider.js';
import { OpenAIEmbeddingProvider } from '../src/embeddings.js';
import { nativeInput } from '../src/cache-trace.js';
if (process.argv[2] !== '--live') console.log('Prepare-only. Use --live <original export> <paired directory> <recovery directory>.');
else {
  const [, , , originalPath, previousDirectory, directory] = process.argv;
  const fixture = workload(JSON.parse(readFileSync(originalPath, 'utf8')));
  const selectedArms = (process.argv.find(a => a.startsWith('--arms='))?.split('=')[1] || 'current,baseline').split(',');
  const selectedTurns = (process.argv.find(a => a.startsWith('--turns='))?.split('=')[1] || '9,10').split(',').map(Number);
  if (!selectedArms.length || selectedArms.some(a => !['current', 'baseline'].includes(a))
    || !selectedTurns.length || selectedTurns.some(t => ![9, 10].includes(t))) throw Error('Recovery supports current/baseline and original turns 9/10 only');
  const ledger = { max_calls: 40, max_usd: .5, usd_max: 0, reserved: 0, unknown_usage: false, calls: [] };
  const signal = AbortSignal.timeout(360000), guard = createGuard(ledger, signal);
  const report = { version: 'pain-recovery-v1', previous_directory: previousDirectory, ledger, results: [],
    method: 'Resume saved histories for synthesis and compaction only. Original model names in the prompts are replaced by their actual cheap-model slot names. No fresh web retrieval. Current arm includes follow-up memory/self-retrieval/telemetry repairs; this is a recovery, not a clean rerun.' };
  mkdirSync(directory, { recursive: true });
  const save = () => writeFileSync(join(directory, 'comparison.json'), JSON.stringify(report, null, 2));
  for (const arm of selectedArms) {
    const mod = await modules(arm), store = new mod.Store(undefined, { memory: true });
    const previous = JSON.parse(readFileSync(join(previousDirectory, `${arm}.json`), 'utf8'));
    const layer = previous.context_layer, id = previous.conversation_id, result = { arm, conversation_id: id, turns: [] };
    report.results.push(result);
    try {
      const insert = store.db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?)');
      const snapshot = store.db.prepare('INSERT INTO snapshots VALUES (?,?,?,?)');
      store.db.exec('BEGIN');
      for (const e of layer.events) insert.run(e.seq, e.id, e.conversation_id, e.kind, e.actor, e.timestamp, e.content, JSON.stringify(e.metadata));
      for (const s of layer.snapshots) snapshot.run(id, s.revision, JSON.stringify(s.segments), s.receipt_id);
      store.db.exec('COMMIT'); store.refreshIndex();
      const guarded = p => ({ name: p.name, ...(p.requestPayload ? { requestPayload: q => p.requestPayload(q) } : {}),
        respond: (q, options) => guard(p.name, q.model, nativeInput(q, p), q.max_output_tokens || 0,
          () => p.respond(q, { ...options, signal: AbortSignal.any([signal, ...(options?.signal ? [options.signal] : []), AbortSignal.timeout(45000)]) })) });
      const provider = guarded(taskProvider('openai'));
      const service = new mod.ConclaveService(store, { providerFactory: () => provider, memoryModel: true,
        decisionFactory: () => new mod.JevDecisionAdapter(guarded(new JevProvider())), embeddingEnabled: true,
        embeddingFactory: () => { const p = new OpenAIEmbeddingProvider(); return { embed: (input, options) =>
          guard('openai', p.model, input, 0, () => p.embed(input, { ...options, signal })) }; },
        availability: () => ({ openai: true, anthropic: true, jev: true }) });
      const proto = Object.getPrototypeOf(mod.AgentHarness.prototype), tools = proto.tools;
      proto.tools = function() { return tools.call(this).filter(t => !['web_search', 'web_fetch'].includes(t.name)); };
      try {
        for (const selectedTurn of selectedTurns) {
          const turn = selectedTurn - 1;
          ledger.arm = arm; ledger.turn = turn + 1;
          const original = fixture.turns[turn], prompt = original.content.replace(/\bSonnet\b/g, 'Claude Haiku 4.5').replace(/\bOpus\b/g, 'Claude Haiku 4.5');
          const row = { turn: turn + 1, original_prompt: original.content, prompt, status: 'running' }; result.turns.push(row); save();
          console.log(`${arm} recovery turn ${turn + 1}: started`);
          await mod.startAgent(service, id, { content: prompt, message_id: `recovery_${turn}`, settings: {
            provider: 'openai', model: MODELS.openai, output: 8192, budget: 256000, reasoning: 'low', jev: true, freezeProjection: true },
            limits: { max_steps: 12, duration_seconds: 120, max_total_tokens: 500000 } });
          let state;
          while ((state = mod.agentState(store, id)).status === 'running') await mod.stepAgent(service, id,
            { run_id: state.run_id, expected_step: state.steps }, { signal });
          row.agent_status = state.status; row.stop = state.stop; row.status = state.status === 'completed' ? 'completed' : 'failed';
          row.answer = store.events(id).findLast(e => e.kind === 'assistant' && e.seq > state.started_after_seq)?.content || null;
          const started = performance.now(), exported = JSON.stringify(mod.downloadRecord(service, id));
          row.export_ms = performance.now() - started; row.export_bytes = Buffer.byteLength(exported);
          writeFileSync(join(directory, `${arm}.json`), exported); save();
          console.log(`${arm} recovery turn ${turn + 1}: ${row.agent_status}`);
          if (signal.aborted || ledger.unknown_usage) break;
        }
      } finally { proto.tools = tools; }
    } finally { store.close(); save(); }
    if (signal.aborted || ledger.unknown_usage) break;
  }
  console.log(JSON.stringify({ report: join(directory, 'comparison.json'), calls: ledger.calls.length, usd_max: ledger.usd_max }));
  if (report.results.some(r => r.turns.some(t => t.status !== 'completed'))) process.exitCode = 1;
}
