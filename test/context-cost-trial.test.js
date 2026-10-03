import test from 'node:test';
import assert from 'node:assert/strict';
import { runContextTrial, spendGuard, loadBaseline, BASELINE_COMMIT, grade } from '../scripts/context-cost-trial.js';
const usage = { input_tokens: 1000, output_tokens: 10, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } };
const answer = { status: 'completed', usage, output: [{ type: 'message', content: [{ type: 'output_text',
  text: JSON.stringify({ code: 'orchard-719', cap: 250, seats: 12, architecture_a_rejected: false, condition: 'X changes' }) }] }] };

test('fidelity accepts limited grammatical equivalents but rejects altered conditions and certainty', () => {
  const check = (condition, rejected = false) => grade(JSON.stringify({ code: 'orchard-719', cap: 250,
    seats: 12, architecture_a_rejected: rejected, condition })).conditional_alternative;
  assert.equal(check('Architecture A may work if X changes.'), true);
  assert.equal(check('if X changes'), true);
  assert.equal(check('X does not change'), false);
  assert.equal(check('X changes and Y fails'), false);
  assert.equal(check('X changes', true), false);
});

test('trial has isolated counterbalanced arms, exact-field/source checks and complete cost records', async () => {
  const report = await runContextTrial({ providers: [{ provider: { name: 'openai', respond: async () => answer }, model: 'gpt-6-luna' }],
    cases: ['warm-cache', 'correction'], output: 256 });
  assert.deepEqual(report.results.map(r => r.arm), ['baseline', 'current', 'current', 'baseline']);
  assert.equal(new Set(report.results.map(r => r.conversation_id)).size, 4);
  assert.ok(report.results.every(r => r.fidelity_pass));
  assert.equal(report.ledger.dispatched, 6);
  assert.ok(report.results.every(r => r.costs.calls.length === r.turns.length));
  assert.ok(report.results.every(r => r.costs.context.working_characters > 0));
  assert.equal(report.baseline_commit, BASELINE_COMMIT);
});

test('a hard dispatch ceiling prevents another paid call, including within a tool loop', async () => {
  let sent = 0;
  const report = await runContextTrial({ providers: [{ provider: { name: 'openai', respond: async () => {
    sent++; return { ...answer, output: [{ type: 'function_call', call_id: 'tool-' + sent, name: 'calculate',
      arguments: JSON.stringify({ operation: 'add', values: [1, 1] }) }] };
  } }, model: 'gpt-6-luna' }], cases: ['warm-cache'], maxCalls: 1 });
  assert.equal(sent, 1); assert.equal(report.ledger.dispatched, 1); assert.ok(report.stopped);
});

test('spending/unknown-usage guards prevent dispatch and unpriced usage cannot mean zero cost', async () => {
  let sent = 0;
  const provider = { name: 'openai', respond: async () => { sent++; return { ...answer, usage: null }; } };
  const ledger = { max_calls: 5, max_usd: 0.000001, dispatched: 0, spent_usd_max: 0, calls: [] };
  const guarded = spendGuard(provider, ledger);
  const payload = { model: 'gpt-6-luna', input: [{ role: 'user', content: 'test' }], max_output_tokens: 256 };
  await assert.rejects(guarded.respond(payload), /spending/); assert.equal(sent, 0);
  ledger.max_usd = 1; await guarded.respond(payload); assert.equal(ledger.unpriced, true);
  await assert.rejects(guarded.respond(payload), /coverage/); assert.equal(sent, 1);
});

test('recovery workload records two genuine tool retrievals and their additional answer calls', async () => {
  let n = 0;
  const provider = { name: 'openai', respond: async payload => {
    n++;
    const user = payload.input.findLast(i => i.role === 'user')?.content || '';
    if (payload.input.some(i => i.type === 'function_call_output')) return answer;
    const handle = user.match(/Use resolve_context on (S\d+)/)?.[1];
    return { ...answer, output: [{ type: 'function_call', call_id: 'recover-' + n, name: 'resolve_context',
      arguments: JSON.stringify({ bundle_id: handle, offset: 0 }) }] };
  } };
  const report = await runContextTrial({ providers: [{ provider, model: 'gpt-6-luna' }], cases: ['recovery'] });
  assert.ok(report.results.every(r => r.retrieval_calls === 2 && r.fidelity_pass));
  assert.equal(report.ledger.dispatched, 8);
});

test('baseline loader uses the actual pinned pre-controller source', async () => {
  const Baseline = await loadBaseline();
  assert.equal(typeof Baseline, 'function');
  assert.equal(Baseline.prototype.evaluateShadow, undefined);
});
