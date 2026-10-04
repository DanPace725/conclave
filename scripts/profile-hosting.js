import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';
import { ContextRepository } from '../src/context-repository.js';

// Offline saved-conversation loading probe. No provider calls or network database.
const client = new PGlite({ extensions: { vector } });
try {
  for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort())
    await client.exec(readFileSync('drizzle/' + file, 'utf8'));
  const db = drizzle(client, { schema });
  const serviceOptions = { availability: () => ({ openai: true, jev: false }),
    providerFactory: () => ({ name: 'openai', respond: async () => ({ status: 'completed', model: 'fixture',
      usage: { input_tokens: 100, output_tokens: 5 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Saved.' }] }] }) }) };
  const repository = new ContextRepository(db, { serviceOptions });
  const id = (await repository.create('Offline loading probe')).conversation_id;
  for (let n = 0; n < 12; n++) await repository.run(id, true, s => s.ask(id, {
    message_id: 'probe_' + n, content: 'Turn ' + n + ' ' + 'ordinary conversation text '.repeat(160), settings: { model: 'fixture', jev: false },
  }));
  const samples = [];
  for (const mode of ['cold', 'warm']) for (let n = 0; n < 3; n++) {
    const module = mode === 'cold' ? await import('../src/context-repository.js?profile=' + n) : { ContextRepository };
    let metrics;
    const reader = new module.ContextRepository(db, { serviceOptions, onLoad: m => { metrics = m; } });
    if (mode === 'warm') await reader.run(id, false, s => s.view(id));
    const start = performance.now();
    let modelInputCalls = 0;
    const view = await reader.run(id, false, s => {
      const method = s.modelInput.bind(s);
      s.modelInput = (...args) => { modelInputCalls++; return method(...args); };
      return s.view(id);
    });
    samples.push({ mode, ...metrics, total_ms: performance.now() - start,
      response_bytes: Buffer.byteLength(JSON.stringify(view)), messages: view.messages.length, model_input_calls: modelInputCalls });
  }
  const transcript_samples = [];
  for (let n = 0; n < 3; n++) {
    let metrics;
    const reader = new ContextRepository(db, { onLoad: m => { metrics = m; } });
    reader.service = () => { throw Error('Transcript instantiated the engine'); };
    const start = performance.now();
    const view = await reader.transcript(id);
    transcript_samples.push({ ...metrics, total_ms: performance.now() - start, messages: view.messages.length });
  }
  const result = { recorded_at: new Date().toISOString(), environment: 'offline PGlite; no Neon/Vercel network or production timings',
    turns: 12, samples, transcript_samples, limitations: ['Small synthetic fixture', 'Warm caches are process-local', 'Database timings include local WASM execution, not network latency'] };
  const at = process.argv.indexOf('--out');
  if (at >= 0) {
    if (!process.argv[at + 1]) throw Error('--out requires a file');
    const path = resolve(process.argv[at + 1]); mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify(result, null, 2));
} finally { await client.close(); }
