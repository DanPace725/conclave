import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { Store } from '../src/store.js';
import { WorkspaceHarness } from '../src/workspace.js';
import { taskProvider, JevProvider, responseText, redact } from '../src/provider.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { BoundedDecisionAdapter } from '../src/decision.js';
import { priceUsage, conversationCosts } from '../src/costs.js';
import { nativeInput } from '../src/cache-trace.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const prices = JSON.parse(readFileSync(new URL('../src/resources/model-costs-2026-10-02.json', import.meta.url)));
export const BASELINE_COMMIT = '90640b66a9c8ece5a636277428e04e994363280c';
export const CASES = ['warm-cache', 'new-prefix', 'recovery', 'correction'];

export async function loadBaseline() {
  const git = args => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, ...args], { encoding: 'utf8' });
  mkdirSync(join(root, '.conclave'), { recursive: true });
  const directory = mkdtempSync(join(root, '.conclave/cost-baseline-'));
  for (const name of git(['ls-tree', '-r', '--name-only', BASELINE_COMMIT, 'src']).trim().split('\n')) {
    const path = resolve(directory, name);
    if (!path.startsWith(directory + sep)) throw Error('Baseline path escaped the isolated directory');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, git(['show', `${BASELINE_COMMIT}:${name}`]));
  }
  return (await import(pathToFileURL(join(directory, 'src/workspace.js')).href)).WorkspaceHarness;
}

export function spendGuard(provider, ledger, signal) {
  return { name: provider.name,
    ...(provider.requestPayload ? { requestPayload: p => provider.requestPayload(p) } : {}),
    respond: async (payload, options = {}) => {
      signal?.throwIfAborted();
      if (ledger.unpriced || ledger.dispatched >= ledger.max_calls) throw Error('Trial call/coverage allowance reached');
      // Serialized bytes plus framing slack deliberately over-reserve input.
      // This is a spending guard estimate, not a provider/invoice guarantee.
      const input = Buffer.byteLength(JSON.stringify(nativeInput(payload, provider))) + 1024;
      const usage = { input_tokens: input, output_tokens: payload.max_output_tokens || 0,
        ...(provider.name === 'anthropic' ? { cache_read_input_tokens: 0, cache_creation_input_tokens: input }
          : { input_tokens_details: { cached_tokens: 0, cache_write_tokens: input } }) };
      const reserve = priceUsage(usage, provider.name, payload.model, prices).usd_max;
      if (reserve == null || ledger.spent_usd_max + reserve > ledger.max_usd) throw Error('Trial price/spending allowance reached');
      ledger.dispatched++;
      const track = response => {
        const cost = priceUsage(response?.usage, provider.name, payload.model, prices);
        ledger.calls.push({ provider: provider.name, model: payload.model, reserve_usd: reserve,
          reported_usage: response?.usage || null, cost });
        if (cost.usd_max == null) ledger.unpriced = true;
        else ledger.spent_usd_max += cost.usd_max;
      };
      try {
        const response = await provider.respond(payload, { ...options,
          signal: AbortSignal.any([...(options.signal ? [options.signal] : []), ...(signal ? [signal] : []), AbortSignal.timeout(30000)]) });
        track(response); return response;
      } catch (error) { track(error.partial_response); throw error; }
    } };
}

function seed(h, scenario) {
  h.pin('Exact seat limit: 12. Preserve this quantity.');
  h.remember('cap', 'constraint', scenario === 'correction'
    ? 'Confirmed budget cap: 250. Earlier assistant estimate 400 is superseded.' : 'Confirmed budget cap: 250.');
  const source = h.addMessage('assistant', 'Recovery code: orchard-719. Architecture A may work if X changes; it has not been conclusively rejected.\n'
    + 'Supporting historical detail with no additional decision. '.repeat(70));
  for (let i = 0; i < 5; i++) h.addMessage('assistant', `Routine note ${i}: ` + 'Routine background with no new decision. '.repeat(40));
  if (scenario === 'recovery') h.offload([source.item.id]);
  if (scenario === 'correction') h.addMessage('assistant', 'Superseded assistant estimate: budget 400.', { status: 'superseded' });
  return source;
}
export function grade(answer) {
  let object = null;
  try { object = JSON.parse(answer); } catch { /* Strict output is part of this task. */ }
  const condition = typeof object?.condition === 'string' ? object.condition.trim().toLowerCase().replace(/\.$/, '') : '';
  const equivalents = ['x changes', 'if x changes', 'may work if x changes', 'architecture a may work if x changes',
    'architecture a may work if x changes; it has not been conclusively rejected'];
  return { exact_code: object?.code === 'orchard-719', cap: object?.cap === 250, seats: object?.seats === 12,
    conditional_alternative: object?.architecture_a_rejected === false && equivalents.includes(condition),
    review: 'Automatic checks cover these fields only; inspect the full answer for fidelity.' };
}

export async function runContextTrial({ providers, selector = null, BaselineHarness = WorkspaceHarness,
  cases = CASES, maxCalls = 48, maxUsd = 1, durationMs = 300000, output = 1024, directory = null } = {}) {
  if (!providers?.length || cases.some(c => !CASES.includes(c))) throw Error('Select available providers and valid cases');
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || !Number.isFinite(maxUsd) || maxUsd <= 0
    || !Number.isSafeInteger(durationMs) || durationMs < 1) throw Error('Positive trial limits required');
  const ledger = { max_calls: maxCalls, max_usd: maxUsd, dispatched: 0, spent_usd_max: 0, unpriced: false, calls: [] };
  const signal = AbortSignal.timeout(durationMs), results = [];
  const report = { fixture: 'context-cost-trial-v2', grader: 'fixed-field-equivalents-v2', baseline_commit: BASELINE_COMMIT,
    pricing_date: prices.checked_date, limits: { maxCalls, maxUsd, durationMs, output }, ledger, results,
    notes: ['Separate synthetic conversations and counterbalanced arm order; stochastic trajectories can differ.',
      'Cold/new-prefix and warm labels are cache attempts; actual read/write usage determines hits.',
      'No cache-expiry wait or background keepalive calls. Source/prompt IDs can affect caching.',
      'All inference purposes and retrieval-triggered answer calls are counted; public-rate valuation excludes native tool fees.',
      'Hard call/time bounds; USD uses conservative pre-dispatch reservation estimates, not an invoice guarantee.',
      'Fidelity checks cover fixed fields; broader quality and savings remain unmeasured.'] };
  const save = () => { if (directory) { mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'comparison.json'), JSON.stringify(report, null, 2)); } };
  save();
  let index = 0;
  for (const selected of providers) for (const scenario of cases) {
    const order = index++ % 2 ? ['current', 'baseline'] : ['baseline', 'current'];
    for (const arm of order) {
      const store = new Store(undefined, { memory: true });
      const id = store.create(`Cost trial: ${selected.provider.name}/${scenario}/${arm}`);
      const guarded = spendGuard(selected.provider, ledger, signal);
      const guardedSelector = selector ? spendGuard(selector.provider, ledger, signal) : null;
      const adapter = guardedSelector ? (selector.provider.name === 'typesafe' ? new JevDecisionAdapter(guardedSelector)
        : new BoundedDecisionAdapter(guardedSelector, { model: selector.model, output: 512 })) : null;
      const Class = arm === 'baseline' ? BaselineHarness : WorkspaceHarness;
      const h = new Class(store, id, guarded, { model: selected.model, output, reasoning: 'low', recent: 1,
        budget: 256000, maxCalls: scenario === 'recovery' ? 5 : 3, decisionAdapter: adapter, signal });
      const result = { provider: selected.provider.name, model: selected.model, scenario, arm, conversation_id: id,
        turns: [], status: 'pending', retrieval_calls: 0, canonical_source_preserved: false };
      results.push(result);
      try {
        const source = seed(h, scenario);
        const basePayload = h.payload.bind(h);
        h.payload = (...args) => { const p = basePayload(...args); return { ...p,
          instructions: `Trial namespace ${id}.\n${p.instructions}` }; };
        if (scenario === 'new-prefix') h.options.budget = Math.ceil((Buffer.byteLength(JSON.stringify(h.answerPayload())) + output) / 0.8);
        const handle = store.references(id).segments.get(source.item.id);
        const question = `Return only JSON: {"code":<exact recovery code>,"cap":<confirmed budget number>,"seats":<exact seat limit>,"architecture_a_rejected":<boolean>,"condition":<condition string>}. Preserve corrections and uncertainty.`;
        const rounds = scenario === 'warm-cache' || scenario === 'recovery' ? 2 : 1;
        for (let turn = 0; turn < rounds; turn++) {
          const query = scenario === 'recovery' ? `Use resolve_context on ${handle} to read the evidence page at offset 0 on this turn, even if its preview contains the answer. The later supporting filler is not needed for this question. ${question}` : question;
          const response = await h.ask(query);
          result.turns.push({ answer: response.text, checks: grade(response.text) });
        }
        result.canonical_source_preserved = store.source(id, source.event.id).content === source.event.content;
        result.status = 'completed';
      } catch (error) { result.status = 'failed'; result.error = redact(error); }
      finally {
        const events = store.events(id);
        result.retrieval_calls = events.filter(e => e.kind === 'tool_call' && ['resolve_context', 'retrieve_event', 'retrieve_range', 'search_history'].includes(e.content)).length;
        result.costs = conversationCosts({ events, context: store.context(id) }, prices);
        result.reconciliations = events.filter(e => e.kind === 'context_cost_reconciliation').map(e => e.metadata);
        result.fidelity_pass = result.status === 'completed' && result.canonical_source_preserved
          && result.turns.every(t => Object.entries(t.checks).every(([k, v]) => k === 'review' || v))
          && (scenario !== 'recovery' || result.retrieval_calls >= 2);
        if (directory) writeFileSync(join(directory, `${id}.json`), JSON.stringify({ conversation_id: id, events, context: store.context(id) }, null, 2));
        store.close(); save();
      }
      if (signal.aborted || ledger.unpriced || ledger.dispatched >= maxCalls) { report.stopped = 'Call/time/usage coverage guard'; save(); return report; }
    }
  }
  save(); return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { live: { type: 'boolean', default: false }, providers: { type: 'string', default: 'openai,anthropic' },
      cases: { type: 'string', default: CASES.join(',') }, 'max-calls': { type: 'string', default: '48' }, 'max-usd': { type: 'string', default: '1' } } });
    if (!values.live) { console.log(JSON.stringify({ mode: 'prepare-only; no provider calls', baseline: BASELINE_COMMIT, cases: CASES,
      command: 'node scripts/context-cost-trial.js --live --max-calls 48 --max-usd 1' }, null, 2)); }
    else {
      const providers = values.providers.split(',').map(name => ({ provider: taskProvider(name), model: name === 'anthropic' ? 'claude-sonnet-5-5' : 'gpt-6-luna' }));
      let selector;
      try { selector = { provider: new JevProvider(), model: 'jev-latest' }; }
      catch { const openai = providers.find(p => p.provider.name === 'openai'); if (openai) selector = { provider: openai.provider, model: openai.model }; }
      const directory = join(root, '.conclave/context-cost-trials', new Date().toISOString().replaceAll(':', '-'));
      mkdirSync(directory, { recursive: true });
      const report = await runContextTrial({ providers, selector, BaselineHarness: await loadBaseline(), cases: values.cases.split(','),
        maxCalls: Number(values['max-calls']), maxUsd: Number(values['max-usd']), directory });
      console.log(JSON.stringify({ report: join(directory, 'comparison.json'), dispatched: report.ledger.dispatched,
        usd_max: report.ledger.spent_usd_max, results: report.results.map(r => ({ provider: r.provider, scenario: r.scenario, arm: r.arm,
          status: r.status, fidelity_pass: r.fidelity_pass, error: r.error })) }, null, 2));
      if (report.stopped || report.results.some(r => !r.fidelity_pass)) process.exitCode = 1;
    }
  } catch (error) { console.error(redact(error)); process.exitCode = 1; }
}
