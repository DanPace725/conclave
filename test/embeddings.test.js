import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { ConclaveService } from '../src/service.js';
import { ContextRepository } from '../src/context-repository.js';
import { OpenAIEmbeddingProvider, EMBEDDING_MODEL } from '../src/embeddings.js';
import { SQLiteEmbeddingStore, PostgresEmbeddingStore } from '../src/embedding-store.js';
import { SemanticRetrieval, retrievalCatalog, embeddingUsage, memoryLinks } from '../src/semantic-retrieval.js';
import { prepareSemanticMemory, activateMemory, selectMemory } from '../src/memory-controller.js';
import { commitMemory, memoryView, changeMemory } from '../src/memory.js';
import { agentState } from '../src/agent.js';

const v = n => Array.from({ length: 1536 }, (_, i) => i === n ? 1 : 0);
const topic = text => /deployment|hosting|expenses|infrastructure|cloud/i.test(text) ? 0 : /garden|orchard|apples/i.test(text) ? 1 : 2;
const fixture = () => {
  const calls = [];
  return { calls, provider: { model: EMBEDDING_MODEL, embed: async input => {
    calls.push(input);
    return { model: EMBEDDING_MODEL, vectors: input.map(s => v(topic(s))), usage: { input_tokens: input.length * 9, output_tokens: 0 } };
  } } };
};
const answer = { status: 'completed', model: 'fixture', usage: { input_tokens: 50, output_tokens: 5 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: 'Recorded.' }] }] };
const harness = (store, id, provider, backend = new SQLiteEmbeddingStore(store)) => new Harness(store, id,
  { name: 'openai', respond: async () => answer }, { model: 'fixture', budget: 64000, memoryModel: false,
    semanticRetrieval: new SemanticRetrieval(backend, () => provider) });
const search = (h, query) => h.executeTool('search_history', { query }, []);

test('OpenAI adapter validates ordering, dimensions, model, native usage and safe error bodies', async () => {
  let body;
  const p = new OpenAIEmbeddingProvider({ apiKey: 'fixture-secret', fetchImpl: async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ model: EMBEDDING_MODEL, usage: { total_tokens: 12 },
      data: [{ index: 1, embedding: v(1) }, { index: 0, embedding: v(0) }] }) };
  } });
  const result = await p.embed(['Deployment costs', 'Garden']);
  assert.equal(body.dimensions, 1536); assert.equal(result.vectors[0][0], 1); assert.equal(result.usage.input_tokens, 12);
  for (const invalid of [
    { model: 'other', usage: { total_tokens: 1 }, data: [{ index: 0, embedding: v(0) }] },
    { model: EMBEDDING_MODEL, data: [{ index: 0, embedding: v(0) }] },
    { model: EMBEDDING_MODEL, usage: { total_tokens: 1 }, data: [{ index: 0, embedding: [1, 2] }] },
  ]) {
    p.fetch = async () => ({ ok: true, json: async () => invalid });
    await assert.rejects(p.embed(['Costs']), /Invalid/);
  }
  p.fetch = async () => ({ ok: false, status: 401, json: async () => { throw Error('fixture-secret'); } });
  await assert.rejects(p.embed(['Costs']), error => /401/.test(error.message) && !/fixture-secret/.test(error.message));
});

test('semantic history recovers zero-keyword evidence, retains exact retrieval, caches and restarts without reindexing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'embedding-restart-'));
  let s = new Store(directory);
  const id = s.create('Embeddings');
  const source = s.append(id, 'document', 'Deployment costs are capped at $25.');
  s.append(id, 'document', 'Orchard apples need water.');
  const f = fixture();
  try {
    let h = harness(s, id, f.provider);
    assert.equal(s.searchChunks(id, 'hosting expenses').length, 0);
    const result = await search(h, 'hosting expenses');
    assert.equal(result.length, 1); assert.equal(result[0].event_id, source.id); assert.equal(result[0].semantic_similarity, 1);
    assert.match(h.toolResult('retrieve_event', { event_id: source.id, offset: 0 }, []).content, /\$25/);
    await search(h, 'hosting expenses');
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].length, 3);
    s.close(); s = new Store(directory); h = harness(s, id, f.provider);
    assert.equal((await search(h, 'hosting expenses'))[0].event_id, source.id);
    assert.equal(f.calls[1].length, 1, 'restart embeds only the query');
    assert.equal(embeddingUsage(s.events(id)).input_tokens, 36);
  } finally { s.close(); }
});

test('semantic activation adds relevant candidate memory while preserving binding authority and suppression', async () => {
  const s = new Store(undefined, { memory: true }), id = s.create('Memory');
  try {
    const source = s.append(id, 'document', 'Deployment costs are capped at $25.');
    commitMemory(s, id, [{ kind: 'claim', span_start: 0, span_end: source.content.length }], { event: source, expected_revision: 0 });
    const binding = s.append(id, 'user', 'Keep it below $500.', {}, 'human');
    commitMemory(s, id, [{ kind: 'commitment', span_start: 0, span_end: binding.content.length }], { event: binding, expected_revision: 1 });
    s.append(id, 'user', 'hosting expenses');
    const f = fixture(), h = harness(s, id, f.provider);
    assert.equal(selectMemory(s, id, 'hosting expenses').records.length, 1);
    await prepareSemanticMemory(h, 'hosting expenses');
    const activated = activateMemory(h, 'hosting expenses');
    assert.equal(activated.records.length, 2);
    const candidate = activated.records.find(r => !r.binding);
    assert.equal(candidate.authority, 'externally_reported'); assert.equal(candidate.resolution, 'unresolved');
    const fresh = harness(s, id, f.provider);
    assert.match(JSON.stringify(fresh.input()), /Deployment costs/);
    changeMemory(s, id, candidate.memory_id, 'suppress', memoryView(s, id).revision);
    assert.ok(!(await search(fresh, 'hosting expenses')).some(r => r.event_id === source.id));
    assert.doesNotMatch(JSON.stringify(fresh.input()), /Deployment costs/);
    assert.equal(memoryView(s, id).records.find(r => r.memory_id === candidate.memory_id).lifecycle, 'suppressed');
  } finally { s.close(); }
});

test('current file versions, removal and conversation scope are enforced before ranking', async () => {
  const s = new Store(undefined, { memory: true }), id = s.create('Versions'), other = s.create('Other');
  try {
    const old = s.append(id, 'document', 'Deployment costs old value $25.', { workspace_path: 'plan.md' });
    const hidden = s.append(other, 'document', 'Hosting expenses private value $99.');
    const f = fixture(), h = harness(s, id, f.provider);
    await search(h, 'hosting expenses');
    const current = s.append(id, 'document', 'Deployment costs new value $35.', { workspace_path: 'plan.md' });
    let result = await search(h, 'hosting expenses');
    assert.deepEqual(result.map(r => r.event_id), [current.id]);
    assert.ok(!retrievalCatalog(s, id).items.some(r => r.event_id === old.id || r.event_id === hidden.id));
    s.append(id, 'document_lifecycle', 'Removed', { key: 'path:plan.md', operation: 'remove' });
    assert.equal((await search(h, 'hosting expenses')).length, 0);
    s.append(id, 'document_lifecycle', 'Restored', { key: 'path:plan.md', operation: 'restore' });
    assert.equal((await search(h, 'hosting expenses'))[0].event_id, current.id);
  } finally { s.close(); }
});

test('incremental indexing and query calls are bounded; failures fall back once and preserve unknown usage', async () => {
  const s = new Store(undefined, { memory: true }), id = s.create('Bounded');
  try {
    for (let n = 0; n < 50; n++) s.append(id, 'document', `Deployment costs entry ${n}`);
    const f = fixture(), h = harness(s, id, f.provider);
    await search(h, 'hosting expenses'); await search(h, 'infrastructure charges'); await search(h, 'cloud bill');
    await search(h, 'deployment amount');
    assert.equal(f.calls.length, 3); assert.equal(f.calls[0].length, 33);
    assert.equal(h.embeddingState.indexed, 32);
    const next = harness(s, id, f.provider); await search(next, 'hosting expenses');
    assert.equal(next.embeddingState.indexed, 18);
    let failed = 0;
    const broken = harness(s, id, { embed: async () => { failed++; throw Error('fixture timeout'); } });
    const lexical = await search(broken, 'Deployment');
    assert.ok(lexical.length); await search(broken, 'Deployment'); assert.equal(failed, 1);
    assert.ok(embeddingUsage(s.events(id)).reserved_unknown_tokens > 0);
    assert.equal(embeddingUsage(s.events(id)).usage_complete, false);
    const cancelled = harness(s, id, f.provider); const controller = new AbortController(); controller.abort();
    cancelled.options.signal = controller.signal;
    await assert.rejects(search(cancelled, 'hosting expenses'), /abort/i);
  } finally { s.close(); }
});

test('Neon pgvector path persists across fresh services, filters removed sources, and never embeds on read', async () => {
  const client = new PGlite({ extensions: { vector } });
  try {
    for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) await client.exec(readFileSync(join('drizzle', file), 'utf8'));
    const db = drizzle(client, { schema }), f = fixture();
    const options = { serviceOptions: { embeddingEnabled: true, embeddingFactory: () => f.provider,
      providerFactory: () => ({ name: 'openai', respond: async payload => {
        if (!payload.input.some(i => i.type === 'function_call_output')) return { ...answer, output: [
          { type: 'function_call', name: 'search_history', call_id: 'lookup', arguments: JSON.stringify({ query: 'hosting expenses' }) }] };
        return answer;
      } }), availability: () => ({ openai: true, jev: false }) } };
    const repo = () => new ContextRepository(db, options);
    const id = (await repo().create('Hosted vector')).conversation_id;
    await repo().run(id, true, service => service.uploadDocument(id, { name: 'costs.md', content: 'Deployment costs are capped at $25.' }));
    await repo().run(id, true, service => service.ask(id, { message_id: 'm1', content: 'Look that up.', settings: { model: 'fixture', jev: false } }));
    assert.ok(f.calls.length);
    const indexed = await client.query('SELECT count(*)::int AS n FROM conclave.embeddings');
    assert.ok(indexed.rows[0].n > 0);
    const before = f.calls.length;
    const fresh = await import('../src/context-repository.js?vector-cold');
    let loading;
    await new fresh.ContextRepository(db, { ...options, onLoad: metrics => { loading = metrics; } }).run(id, false, s => s.view(id));
    assert.equal(f.calls.length, before); assert.ok(loading.event_rows > 0); assert.ok(loading.service_ms >= 0);
    const result = await repo().run(id, true, service => search(service.harness(id, {}, true), 'hosting expenses'));
    assert.match(result[0].content, /\$25/);
    assert.equal(f.calls.at(-1).length, 2, 'only the newer assistant source and query were embedded');
    await repo().run(id, true, service => service.changeDocument(id, { path: 'costs.md', operation: 'remove',
      expected_source_event_id: result[0].event_id, expected_change_id: null }));
    const removed = await repo().run(id, true, service => search(service.harness(id, {}, true), 'hosting expenses'));
    assert.equal(removed.length, 0);
  } finally { await client.close(); }
});

// Graded fixtures: every cost memory leans on axis 0 by a different amount.
const blend = (axis, weight) => Array.from({ length: 1536 }, (_, i) => i === 0 ? weight : i === axis ? Math.sqrt(1 - weight ** 2) : 0);
const linked = { 'Deployment costs are capped at $25.': v(0), 'Hosting expenses must stay low.': blend(1, .9),
  'Cloud bills arrive monthly.': blend(2, .8), 'Deployment windows are on Fridays.': blend(3, .7), 'Orchard apples need water.': v(5) };
const indexMemories = (backend, store, id) => backend.put(id, retrievalCatalog(store, id).items
  .filter(r => r.kind === 'memory' && linked[r.content]).map(r => ({ ...r, vector: linked[r.content] })));

test('memory links read stored vectors only, keep mutual nearest neighbours and follow lifecycle', async () => {
  const s = new Store(undefined, { memory: true }), f = fixture();
  const options = { providerFactory: () => ({ name: 'openai', respond: async () => answer }), availability: () => ({ openai: true, jev: false }) };
  const service = new ConclaveService(s, { ...options, embeddingEnabled: true, embeddingFactory: () => f.provider });
  try {
    const id = service.create('Links').conversation_id, backend = new SQLiteEmbeddingStore(s);
    for (const [n, text] of [...Object.keys(linked), 'Unindexed reminder about parking.'].entries())
      commitMemory(s, id, [{ kind: 'claim', span_start: 0, span_end: text.length }], { event: s.append(id, 'document', text), expected_revision: n });
    const ids = Object.fromEntries(memoryView(s, id).records.map(r => [r.content, r.memory_id]));
    const [costs, hosting, , , orchard] = Object.keys(linked).map(text => ids[text]);
    await indexMemories(backend, s, id);
    const before = s.events(id).length;
    const all = await service.memoryLinks(id);
    assert.equal(all.enabled, true); assert.equal(all.memories, 6); assert.equal(all.indexed, 5);
    assert.equal(all.links.length, 6, 'every pair among the four cost memories');
    assert.deepEqual([all.links[0].from, all.links[0].to].sort(), [costs, hosting].sort()); assert.equal(all.links[0].similarity, .9);
    assert.ok(!all.links.some(l => [l.from, l.to].includes(orchard)));
    const nearest = await memoryLinks(s, id, backend, { perMemory: 1 });
    assert.equal(nearest.links.length, 1, 'one-sided neighbours are dropped');
    assert.deepEqual([nearest.links[0].from, nearest.links[0].to].sort(), [costs, hosting].sort());
    assert.equal((await memoryLinks(s, id, backend, { floor: .75 })).links.length, 2);
    changeMemory(s, id, hosting, 'suppress', memoryView(s, id).revision);
    const after = await service.memoryLinks(id);
    assert.equal(after.links.length, 3); assert.ok(!after.links.some(l => [l.from, l.to].includes(hosting)));
    assert.equal(f.calls.length, 0, 'reading links never embeds');
    assert.equal(s.events(id).length, before + 1, 'only the suppression was recorded');
    assert.deepEqual(memoryView(s, id).records.flatMap(r => [...r.depends_on, ...r.conflicts_with, ...r.supersedes]), []);
    assert.deepEqual(await new ConclaveService(s, options).memoryLinks(id), { enabled: false, memories: 0, indexed: 0, links: [] });
  } finally { s.close(); }
});

test('hosted memory links use pgvector on read without provider calls', async () => {
  const client = new PGlite({ extensions: { vector } });
  try {
    for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) await client.exec(readFileSync(join('drizzle', file), 'utf8'));
    const db = drizzle(client, { schema }), f = fixture();
    const repo = () => new ContextRepository(db, { serviceOptions: { embeddingEnabled: true, embeddingFactory: () => f.provider,
      providerFactory: () => ({ name: 'openai', respond: async () => answer }), availability: () => ({ openai: true, jev: false }) } });
    const id = (await repo().create('Hosted links')).conversation_id;
    await repo().run(id, true, service => {
      for (const [n, text] of Object.keys(linked).entries())
        commitMemory(service.store, id, [{ kind: 'claim', span_start: 0, span_end: text.length }],
          { event: service.store.append(id, 'document', text), expected_revision: n });
    });
    await repo().run(id, false, service => indexMemories(new PostgresEmbeddingStore(db), service.store, id));
    const result = await repo().run(id, false, service => service.memoryLinks(id));
    assert.equal(result.enabled, true); assert.equal(result.indexed, 5); assert.equal(result.links.length, 6);
    assert.equal(result.links[0].similarity, .9); assert.equal(result.links.at(-1).similarity, .56);
    assert.equal(f.calls.length, 0);
  } finally { await client.close(); }
});

test('Agent embedding usage participates in run limits and diagnostics', async () => {
  const s = new Store(undefined, { memory: true }), f = fixture();
  const service = new ConclaveService(s, { embeddingEnabled: true, embeddingFactory: () => f.provider,
    providerFactory: () => ({ name: 'openai', respond: async () => answer }), availability: () => ({ openai: true, jev: false }) });
  try {
    const id = service.create('Agent embeddings').conversation_id;
    await service.agentStart(id, { message_id: 'agent-embeddings', content: 'Keep deployment costs below $25.',
      settings: { model: 'fixture', jev: false }, limits: { max_steps: 3, duration_seconds: 300, max_total_tokens: 250000 } });
    const run = agentState(s, id);
    await service.agentStep(id, { run_id: run.run_id, expected_step: 0 });
    const completed = agentState(s, id);
    assert.equal(completed.status, 'completed');
    assert.ok(completed.embedding_usage.input_tokens > 0);
    assert.equal(completed.input_tokens, 50 + completed.embedding_usage.input_tokens);
  } finally { s.close(); }
});

test('Agent Stop cancels an embedding request before the task model and keeps uncertain usage explicit', async () => {
  const s = new Store(undefined, { memory: true });
  let entered, taskCalls = 0;
  const ready = new Promise(resolve => { entered = resolve; });
  const service = new ConclaveService(s, { embeddingEnabled: true, embeddingFactory: () => ({ embed: async (_input, { signal }) => {
    entered();
    return new Promise((_, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); });
  } }), providerFactory: () => ({ name: 'openai', respond: async () => { taskCalls++; return answer; } }),
  availability: () => ({ openai: true, jev: false }) });
  try {
    const id = service.create('Stop embeddings').conversation_id;
    await service.agentStart(id, { message_id: 'stop-embedding', content: 'Keep deployment costs below $25.',
      settings: { model: 'fixture', jev: false }, limits: { max_steps: 3, duration_seconds: 300, max_total_tokens: 250000 } });
    const run = agentState(s, id);
    const pending = service.agentStep(id, { run_id: run.run_id, expected_step: 0 });
    await ready;
    await service.agentStop(id, { run_id: run.run_id });
    await pending;
    const stopped = agentState(s, id);
    assert.equal(stopped.status, 'stopped'); assert.equal(taskCalls, 0);
    assert.equal(stopped.embedding_usage.usage_complete, false);
    assert.ok(stopped.embedding_usage.reserved_unknown_tokens > 0);
  } finally { s.close(); }
});
