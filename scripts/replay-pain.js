// Bounded live replay of a canonical exported workload. Prepare-only by default.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { taskProvider, JevProvider, redact } from '../src/provider.js';
import { OpenAIEmbeddingProvider } from '../src/embeddings.js';
import { priceUsage } from '../src/costs.js';
import { nativeInput } from '../src/cache-trace.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export const BASELINE = '3b969ef';
export const MODELS = { openai: 'gpt-6-luna', anthropic: 'claude-haiku-4-5-20251001' };
const prices = JSON.parse(readFileSync(new URL('../src/resources/model-costs-2026-10-02.json', import.meta.url)));
// Trial-only rates: official provider pages rechecked 2026-10-05. Jev retains its dated rate.
prices.models.push({ provider: 'anthropic', model: MODELS.anthropic,
  rates: { input: 1, output: 5, cached_input: .1, cache_write: 1.25 }, cache_write_1h: 2 });
prices.models.push({ provider: 'openai', model: 'text-embedding-3-small',
  rates: { input: .02, output: 0, cached_input: null, cache_write: null } });

export function workload(record) {
  const events = record.context_layer?.events;
  if (!Array.isArray(events)) throw Error('A canonical context_layer.events export is required');
  const turns = events.filter(e => e.kind === 'user' && !e.metadata.purpose?.startsWith('manual-'));
  if (!turns.length) throw Error('No human workload found');
  const pages = events.filter(e => e.kind === 'document' && e.metadata.evidence_scope === 'page-text');
  const searches = events.filter(e => e.kind === 'document' && e.metadata.evidence_scope === 'search-summary');
  return { turns, pages, searches, events };
}

export function createGuard(ledger, signal) {
  return async (provider, model, input, output, dispatch) => {
    signal.throwIfAborted();
    if (ledger.unknown_usage || ledger.calls.length >= ledger.max_calls) throw Error('Replay call/usage allowance reached');
    const usage = { input_tokens: Buffer.byteLength(JSON.stringify(input)) + 1024, output_tokens: output,
      ...(provider === 'anthropic' ? { cache_read_input_tokens: 0, cache_creation_input_tokens: Buffer.byteLength(JSON.stringify(input)) + 1024 }
        : { input_tokens_details: { cached_tokens: 0, cache_write_tokens: Buffer.byteLength(JSON.stringify(input)) + 1024 } }) };
    const reserve = priceUsage(usage, provider, model, prices).usd_max;
    if (reserve == null || ledger.usd_max + ledger.reserved + reserve > ledger.max_usd) throw Error('Replay spending allowance reached');
    const row = { provider, model, arm: ledger.arm, turn: ledger.turn, reserve_usd: reserve, status: 'dispatched' };
    ledger.calls.push(row); ledger.reserved += reserve;
    const started = Date.now();
    try {
      const response = await dispatch();
      row.usage = response.usage || null; row.status = response.status || 'completed';
      row.cost = priceUsage(row.usage, provider, model, prices);
      if (row.cost.usd_max == null) ledger.unknown_usage = true;
      else ledger.usd_max += row.cost.usd_max;
      return response;
    } catch (error) {
      row.status = 'failed'; row.error = redact(error); row.usage = error.partial_response?.usage || null;
      row.cost = priceUsage(row.usage, provider, model, prices);
      if (row.cost.usd_max == null) ledger.unknown_usage = true;
      else ledger.usd_max += row.cost.usd_max;
      throw error;
    } finally { ledger.reserved -= reserve; row.elapsed_ms = Date.now() - started; }
  };
}

export async function modules(arm) {
  let base = root;
  if (arm === 'baseline') {
    const git = args => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, ...args], { encoding: 'utf8' });
    mkdirSync(join(root, '.conclave'), { recursive: true });
    base = mkdtempSync(join(root, '.conclave/pain-baseline-'));
    for (const name of git(['ls-tree', '-r', '--name-only', BASELINE, 'src']).trim().split('\n')) {
      const path = resolve(base, name);
      if (!path.startsWith(base + sep)) throw Error('Baseline path escaped workspace');
      mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, git(['show', `${BASELINE}:${name}`]));
    }
  }
  const load = name => import(pathToFileURL(join(base, `src/${name}.js`)).href);
  const [store, service, agent, jev, embeddings, repository] = await Promise.all(
    ['store', 'service', 'agent', 'jev', 'embedding-store', 'context-repository'].map(load));
  return { ...store, ...service, ...agent, ...jev, ...embeddings, ...repository };
}

export async function replay(record, { directory, arms = ['current', 'baseline'], maxCalls = 120, maxUsd = 2.5,
  durationMs = 900000, output = 8192, budget = 256000 } = {}) {
  const fixture = workload(record);
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || !Number.isFinite(maxUsd) || maxUsd <= 0
    || !Number.isSafeInteger(durationMs) || durationMs < 1 || !arms.length || arms.some(a => !['current', 'baseline'].includes(a))) throw Error('Invalid replay bounds/arms');
  mkdirSync(directory, { recursive: true });
  const signal = AbortSignal.timeout(durationMs);
  const ledger = { max_calls: maxCalls, max_usd: maxUsd, usd_max: 0, reserved: 0, unknown_usage: false, calls: [] };
  const guard = createGuard(ledger, signal), instances = [];
  const report = { version: 'pain-live-replay-v1', original_conversation_id: record.conversation_id,
    baseline_commit: BASELINE, current_commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    models: MODELS, limits: { maxCalls, maxUsd, durationMs, output, budget }, ledger, results: [],
    method: ['Original human prompts in order; prior assistant answers and workspace files are regenerated, never seeded.',
      'Separate conversations, alternating arm order by turn; one stochastic pair, not a statistical quality/cost estimate.',
      'Captured original search summaries/page text replace external retrieval; no fresh medical research or live search fees.',
      'Original provider slots map to cheap GPT/Claude. Original agent objectives use checkpointed Agent execution.',
      'Output ceiling reduced from 16384 to 8192; context byte guard remains 256000.',
      'Native reported usage for answers, management and embeddings; conservative pre-dispatch price reservation, not an invoice cap.',
      'Public rates snapshot 2026-10-02 plus Haiku/embedding rates rechecked 2026-10-05; missing usage halts further dispatch.'] };
  const save = () => writeFileSync(join(directory, 'comparison.json'), JSON.stringify(report, null, 2));
  try {
    for (const arm of arms) {
      const mod = await modules(arm), store = new mod.Store(undefined, { memory: true });
      const id = store.create(`Pain replay: ${arm}`), result = { arm, conversation_id: id, turns: [] };
      const guarded = provider => ({ name: provider.name,
        ...(provider.requestPayload ? { requestPayload: p => provider.requestPayload(p) } : {}),
        respond: (p, options = {}) => guard(provider.name, p.model, nativeInput(p, provider), p.max_output_tokens || 0,
          () => provider.respond(p, { ...options, signal: AbortSignal.any([signal, ...(options.signal ? [options.signal] : []), AbortSignal.timeout(45000)]) })) });
      const providers = Object.fromEntries(Object.keys(MODELS).map(n => [n, guarded(taskProvider(n))]));
      const selector = guarded(new JevProvider());
      const service = new mod.ConclaveService(store, { providerFactory: n => providers[n], memoryModel: true,
        decisionFactory: () => new mod.JevDecisionAdapter(selector), embeddingEnabled: true,
        embeddingFactory: () => { const p = new OpenAIEmbeddingProvider(); return { embed: (input, options) =>
          guard('openai', p.model, input, 0, () => p.embed(input, { ...options, signal })) }; },
        availability: () => ({ openai: true, anthropic: true, jev: true }),
        pageFetcher: async url => {
          const doc = fixture.pages.find(e => [e.metadata.source_url, e.metadata.requested_url].includes(url));
          if (!doc || doc.seq >= fixture.turns[instances.find(x => x.arm === arm).turn + 1]?.seq) throw Error('URL unavailable in captured workload at this turn');
          const response = fixture.events.find(e => e.id === doc.metadata.response_event_id);
          return { ...doc.metadata, title: doc.metadata.title || '', content: doc.content, raw: response?.content || doc.content,
            limitations: doc.metadata.limitations + ' Frozen replay of original capture; no live HTTP request.' };
        } });
      // Replace web discovery only. All subsequent retrieval/context/memory/Workspace tools are engine implementations.
      const proto = Object.getPrototypeOf(mod.AgentHarness.prototype);
      const execute = proto.executeTool;
      proto.executeTool = async function(name, args, ...rest) {
          if (name !== 'web_search') return execute.call(this, name, args, ...rest);
          const turn = instances.find(x => x.arm === arm).turn;
          const eligible = fixture.searches.filter(e => e.seq < (fixture.turns[turn + 1]?.seq || Infinity));
          const terms = args.query.toLowerCase().split(/\W+/).filter(t => t.length > 3);
          const best = eligible.map(e => ({ e, score: terms.filter(t => e.metadata.query?.toLowerCase().includes(t)).length }))
            .sort((a, b) => b.score - a.score)[0]?.e;
          if (!best) return { error: 'No captured search evidence available for this turn', frozen_replay: true };
          const doc = this.ingestText(best.metadata.filename, best.content, args.query, { ...best.metadata, original_event_id: best.id, frozen_replay: true });
          return { source_event_id: doc.id, content: best.content, citations: best.metadata.citations,
            evidence_scope: 'search-summary', frozen_replay: true, limitations: 'Nearest captured original query by lexical match. No new search was run.' };
      };
      instances.push({ arm, mod, store, service, id, result, turn: 0, restore: () => { proto.executeTool = execute; } });
      report.results.push(result);
    }
    for (let turn = 0; turn < fixture.turns.length; turn++) {
      for (const instance of (turn % 2 ? [...instances].reverse() : instances)) {
        const { arm, mod, store, service, id, result } = instance;
        instance.turn = turn; ledger.arm = arm; ledger.turn = turn + 1;
        const original = fixture.turns[turn], settings = { ...original.metadata.web_settings,
          model: MODELS[original.metadata.web_settings.provider], output, budget,
          reasoning: original.metadata.web_settings.provider === 'openai' ? 'low' : 'default' };
        const row = { turn: turn + 1, original_event_id: original.id, prompt: original.content, settings, status: 'running' };
        result.turns.push(row); save(); console.log(`${arm} turn ${turn + 1}: started`);
        const started = Date.now();
        try {
          if (original.metadata.purpose === 'agent-objective') {
            await mod.startAgent(service, id, { content: original.content, message_id: `replay_${turn}`, settings,
              limits: { max_steps: 24, duration_seconds: 180, max_total_tokens: 400000 } });
            let state;
            while ((state = mod.agentState(store, id)).status === 'running') await mod.stepAgent(service, id,
              { run_id: state.run_id, expected_step: state.steps }, { signal });
            row.agent_status = state.status; row.agent_stop = state.stop || null;
            row.status = state.status === 'completed' ? 'completed' : 'failed'; row.error = state.error || null;
            row.answer = store.events(id).findLast(e => e.kind === 'assistant' && e.seq > state.started_after_seq)?.content || null;
          } else {
            const h = service.harness(id, settings, true); h.options.signal = signal;
            row.answer = (await h.ask(original.content, { metadata: { web_settings: settings } })).text; row.status = 'completed';
          }
        } catch (error) { row.status = 'failed'; row.error = redact(error); }
        row.elapsed_ms = Date.now() - started;
        const t = performance.now(), exported = mod.downloadRecord(service, id), text = JSON.stringify(exported);
        row.export_ms = performance.now() - t; row.export_bytes = Buffer.byteLength(text);
        writeFileSync(join(directory, `${arm}.json`), text);
        save(); console.log(`${arm} turn ${turn + 1}: ${row.status}; calls=${ledger.calls.length}; priced_max=$${ledger.usd_max.toFixed(4)}`);
        if (signal.aborted || ledger.unknown_usage || ledger.calls.length >= maxCalls || row.error?.includes('allowance reached')) {
          report.stopped = 'Global time/call/spend/usage guard'; return report;
        }
      }
    }
    return report;
  } finally { for (const x of instances) { x.restore(); x.store.close(); } save(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { file: { type: 'string' }, live: { type: 'boolean', default: false },
      directory: { type: 'string' }, arms: { type: 'string', default: 'current,baseline' } } });
    const record = JSON.parse(readFileSync(values.file, 'utf8')), fixture = workload(record);
    if (!values.live) console.log(JSON.stringify({ mode: 'prepare-only; no credentials/provider calls', turns: fixture.turns.length,
      captured_pages: fixture.pages.length, captured_searches: fixture.searches.length, models: MODELS, baseline: BASELINE }));
    else {
      const directory = values.directory || join(root, '.conclave/pain-replays', new Date().toISOString().replaceAll(':', '-'));
      const report = await replay(record, { directory, arms: values.arms.split(',') });
      console.log(JSON.stringify({ report: join(directory, 'comparison.json'), stopped: report.stopped || null,
        calls: report.ledger.calls.length, usd_max: report.ledger.usd_max }));
      if (report.stopped || report.results.some(r => r.turns.some(t => t.status !== 'completed'))) process.exitCode = 1;
    }
  } catch (error) { console.error(redact(error)); process.exitCode = 1; }
}
