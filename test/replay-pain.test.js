import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuard, workload } from '../scripts/replay-pain.js';

const ledger = () => ({ max_calls: 2, max_usd: 1, usd_max: 0, reserved: 0, calls: [], unknown_usage: false });
test('Pain workload excludes manual edits and retains human objectives in order', () => {
  const events = [{ kind: 'user', content: 'first', metadata: {} },
    { kind: 'user', content: 'edit', metadata: { purpose: 'manual-memory' } },
    { kind: 'user', content: 'continue', metadata: { purpose: 'agent-objective' } }];
  assert.deepEqual(workload({ context_layer: { events } }).turns.map(e => e.content), ['first', 'continue']);
  assert.throws(() => workload({}), /canonical/);
});
test('Replay rejects unknown prices and exhausted bounds before dispatch', async () => {
  const l = ledger(), guard = createGuard(l, new AbortController().signal);
  let dispatched = 0;
  const dispatch = async () => { dispatched++; return { usage: { input_tokens: 100, output_tokens: 20 } }; };
  await assert.rejects(guard('openai', 'unpriced-model', 'input', 100, dispatch), /spending/);
  l.max_usd = .000001;
  await assert.rejects(guard('openai', 'gpt-6-luna', 'input', 100, dispatch), /spending/);
  l.max_usd = 1; l.max_calls = 0;
  await assert.rejects(guard('openai', 'gpt-6-luna', 'input', 100, dispatch), /call/);
  assert.equal(dispatched, 0);
});
test('Replay records native usage and failures, then blocks unknown-usage followups', async () => {
  const l = ledger(), guard = createGuard(l, new AbortController().signal);
  await guard('openai', 'gpt-6-luna', 'input', 100, async () => ({ usage: { input_tokens: 100, output_tokens: 20 } }));
  assert.ok(l.usd_max > 0); assert.equal(l.reserved, 0);
  await assert.rejects(guard('openai', 'gpt-6-luna', 'input', 100, async () => { throw Error('failed'); }), /failed/);
  assert.equal(l.calls[1].status, 'failed'); assert.equal(l.unknown_usage, true); assert.equal(l.reserved, 0);
  l.max_calls = 10;
  await assert.rejects(guard('openai', 'gpt-6-luna', 'input', 100, async () => assert.fail('must not dispatch')), /usage/);
});
test('Replay cancellation prevents dispatch', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createGuard(ledger(), controller.signal)('openai', 'gpt-6-luna', '', 100,
    async () => assert.fail('must not dispatch')), { name: 'AbortError' });
});
