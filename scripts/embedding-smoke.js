import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { OpenAIEmbeddingProvider } from '../src/embeddings.js';
import { SQLiteEmbeddingStore } from '../src/embedding-store.js';
import { SemanticRetrieval, embeddingUsage } from '../src/semantic-retrieval.js';
import { commitMemory } from '../src/memory.js';
import { prepareSemanticMemory, activateMemory } from '../src/memory-controller.js';

if (!process.argv.includes('--live')) throw Error('Use --live for one bounded OpenAI embedding smoke call');
const store = new Store(undefined, { memory: true });
try {
  const id = store.create('Disposable native embedding check');
  const source = store.append(id, 'document', 'The recurring deployment fee is capped at twenty-five dollars.');
  store.append(id, 'document', 'The orchard produces apples every autumn.');
  store.append(id, 'document', 'A recipe calls for flour and warm water.');
  const memory = commitMemory(store, id, [{ kind: 'claim', span_start: 0, span_end: source.content.length }], { event: source, expected_revision: 0 });
  const h = new Harness(store, id, { name: 'openai' }, { budget: 64000, memoryModel: false,
    semanticRetrieval: new SemanticRetrieval(new SQLiteEmbeddingStore(store), () => new OpenAIEmbeddingProvider()) });
  const query = 'website hosting expenses';
  const lexical = store.searchChunks(id, query);
  await prepareSemanticMemory(h, query);
  const activated = activateMemory(h, query);
  const result = await h.executeTool('search_history', { query }, []);
  const usage = embeddingUsage(store.events(id));
  const evidence = { recorded_at: new Date().toISOString(), provider: usage.provider, model: usage.model,
    environment: 'live OpenAI embeddings; disposable in-memory SQLite, no answer/reranker calls',
    lexical_matches: lexical.length, history_recovered_target: result.some(r => r.event_id === source.id),
    memory_activated_target: activated.memory_ids.includes(memory.records[0].memory_id),
    results: result.map(r => ({ content: r.content, semantic_similarity: r.semantic_similarity })), usage,
    limitations: ['One small synthetic query, not a general retrieval-quality benchmark'] };
  const at = process.argv.indexOf('--out');
  if (at >= 0) {
    if (!process.argv[at + 1]) throw Error('--out requires a file');
    const path = resolve(process.argv[at + 1]); mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(evidence, null, 2) + '\n');
  }
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.history_recovered_target || !evidence.memory_activated_target || !usage.usage_complete)
    throw Error('Embedding smoke did not recover both targets with recorded usage');
} finally { store.close(); }
