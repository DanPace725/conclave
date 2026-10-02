import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tokenize, inputSize } from '../src/input-size.js';
import { Store } from '../src/store.js';
import { Harness, budgetUnits } from '../src/harness.js';
import { ConclaveService } from '../src/service.js';

test('local preview counts tools and Unicode, excludes output settings, and invalidates changed input', () => {
  const provider = { name: 'openai' };
  const payload = { model: 'gpt-6-luna', instructions: 'Keep caveats.', input: [{ role: 'user', content: '你好 🌱 <|endoftext|>' }],
    tools: [{ name: 'retrieve_event', description: 'Read a source' }], max_output_tokens: 100, store: false };
  assert.equal(tokenize('hello world'), 2);
  assert.doesNotThrow(() => tokenize('<|endoftext|>'));
  const count = inputSize(payload, provider);
  const { max_output_tokens, store, ...input } = payload;
  assert.equal(count.tokenizer_tokens, tokenize(JSON.stringify(input)));
  assert.equal(count.provider_count, null);
  assert.equal(count.fingerprint, inputSize({ ...payload, max_output_tokens: 200 }, provider).fingerprint);
  assert.notEqual(count.fingerprint, inputSize({ ...payload, tools: [] }, provider).fingerprint);
  assert.notEqual(count.fingerprint, inputSize({ ...payload, model: 'other-model' }, provider).fingerprint);
  assert.notEqual(count.tokenizer_tokens, count.bytes / 3);
});

test('request counts persist without changing the payload or guard; legacy counts stay visibly incomplete', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'conclave-token-count-'));
  const store = new Store(directory);
  try {
    const conversation = store.create();
    const provider = { name: 'openai', respond: async payload => ({ model: payload.model, status: 'completed',
      output: [], usage: { input_tokens: 91, output_tokens: 4, input_tokens_details: { cached_tokens: 0 } } }) };
    const harness = new Harness(store, conversation, provider, { budget: 40000 });
    const payload = harness.answerPayload([]);
    const before = structuredClone(payload);
    await harness.call(payload, 'answer');
    assert.deepEqual(payload, before);
    const request = store.events(conversation).find(e => e.kind === 'inference_request');
    assert.equal(request.metadata.estimated_input_units, budgetUnits(payload));
    assert.equal(request.metadata.token_count.tokenizer_tokens, inputSize(payload, provider).tokenizer_tokens);
    assert.equal(harness.metrics().local_tokenizer_counts_complete, true);
    assert.equal(harness.metrics().input_tokens, 91);
    assert.equal(harness.metrics().next_request_input.method, 'local-o200k_base-serialized-input');
    store.append(conversation, 'inference_request', 'answer', { provider: 'openai', estimated_input_units: 100 });
    assert.equal(harness.metrics().local_tokenizer_counts_complete, false);
    assert.equal(harness.metrics().local_tokenizer_counted_requests, 1);
    store.append(conversation, 'user', 'Preview the saved model', { web_settings: {
      model: 'gpt-6-sol', reasoning: 'low', budget: 80000, output: 8000, jev: false } });
    const service = new ConclaveService(store);
    assert.equal(service.view(conversation).metrics.next_request_input.model, 'gpt-6-sol');
    assert.equal(service.view(conversation).metrics.next_request_input.provider, 'openai');
  } finally {
    store.close();
    rmSync(directory, { recursive: true });
  }
});
