import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../src/db-schema.js';
import { ContextRepository } from '../src/context-repository.js';
import { captureMemory } from '../src/memory-controller.js';
import { anthropicPayload } from '../src/provider.js';

const response = output => ({ status: 'completed', usage: { input_tokens: 100, output_tokens: 10 }, output });
const call = (name, args, phase) => response([{ type: 'function_call', call_id: 'flow-' + phase, name, arguments: JSON.stringify(args) }]);
const final = response([{ type: 'message', content: [{ type: 'output_text', text: 'Budget memories suppressed; two changes verified in plan.md.' }] }]);

for (const [provider, mode] of [['openai', 'context'], ['anthropic', 'agent']]) test(`hosted ${provider} ${mode} reads/suppresses both stores and applies/verifies an atomic patch across restarts`, async () => {
  const client = new PGlite({ extensions: { vector } });
  let liveStore, id, phase = 0, snapshot, file;
  try {
    for (const name of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) await client.exec(readFileSync('drizzle/' + name, 'utf8'));
    const db = drizzle(client, { schema });
    const repository = () => new ContextRepository(db, { serviceOptions: {
      availability: () => ({ openai: true, anthropic: true, jev: false }),
      providerFactory: () => ({ name: provider, ...(provider === 'anthropic' ? { requestPayload: anthropicPayload } : {}), respond: async payload => {
        const n = phase++;
        if (n >= 2) assert.doesNotMatch(JSON.stringify(payload), /under \$400/, 'No stale memory in the next inference or signed continuation');
        const output = payload.input.filter(i => i.type === 'function_call_output').at(-1);
        if (n === 0) return call('read_memory', { offset: 0, expected_memory_revision: null, expected_state_revision: null }, n);
        if (n === 1) {
          snapshot = JSON.parse(output.output); const entries = JSON.parse(snapshot.content);
          assert.equal(entries.named[0].id, 'budget'); assert.equal(entries.automatic[0].authority, 'user_committed');
          return call('suppress_memory', { expected_memory_revision: snapshot.memory_revision, expected_state_revision: snapshot.state_revision,
            source_event_id: liveStore.events(id).findLast(e => e.kind === 'user').id,
            targets: [{ kind: 'automatic', id: entries.automatic[0].memory_id }, { kind: 'named', id: 'budget' }] }, n);
        }
        if (n === 2) return call('workspace_read', { path: 'plan.md', offset: 0 }, n);
        if (n === 3) {
          file = JSON.parse(output.output); assert.ok(file.source_event_id);
          return call('workspace_patch_batch', { path: 'plan.md', expected_source_event_id: file.source_event_id,
            patches: [{ find: 'Budget: 100', replace: 'Budget: 150' }, { find: 'Guests: 12', replace: 'Guests: 10' }] }, n);
        }
        if (n === 4) { assert.equal(JSON.parse(output.output).change_summary.patch_count, 2); return call('workspace_read', { path: 'plan.md', offset: 0 }, n); }
        assert.match(JSON.parse(output.output).content, /## Access\nKeep lift access/); return final;
      } }),
    } });
    id = (await repository().create('Memory and patches')).conversation_id;
    await repository().run(id, true, async service => {
      const h = service.harness(id), source = h.addMessage('user', 'Keep the budget under $400.').event;
      await captureMemory(h, source);
      h.updateState({ expected_revision: service.store.context(id).revision, updates: [{ key: 'budget', type: 'constraint', content: source.content,
        source_event_ids: [source.id], status: 'active', supersedes: [], supports: [], conflicts_with: [], limitations: [] }] });
      h.toolResult('workspace_write', { path: 'plan.md', expected_source_event_id: null, content: '# Plan\nBudget: 100\nGuests: 12\n## Access\nKeep lift access.' });
    });
    const request = { message_id: 'memory_patch_flow', content: 'Forget the budget memories. Set the guest count to 10 and the plan budget to 150, preserving access.',
      settings: { provider, model: provider === 'anthropic' ? 'claude-fixture' : 'fixture', jev: false } };
    if (mode === 'context') await repository().run(id, true, service => { liveStore = service.store; return service.ask(id, request); });
    else {
      let view = await repository().run(id, true, service => service.agentStart(id, request));
      for (let n = 0; n < 8 && view.agent.status === 'running'; n++) {
        view = await repository().run(id, true, async service => {
          liveStore = service.store;
          await service.agentStep(id, { run_id: view.agent.run_id, expected_step: view.agent.steps });
          return service.view(id);
        });
      }
      assert.equal(view.agent.status, 'completed');
    }
    const result = await repository().run(id, false, service => service.export(id));
    assert.equal(phase, 6); assert.equal(result.memory.records[0].lifecycle, 'suppressed');
    assert.equal(result.state.entries.find(s => s.state_key === 'budget').status, 'superseded');
    assert.equal(result.events.filter(e => e.kind === 'document').length, 2);
    assert.ok(result.events.some(e => e.kind === 'memory_suppression'));
    assert.ok(result.events.some(e => e.kind === 'workspace_read' && e.metadata.source_event_id !== file.source_event_id));
    assert.match(result.events.findLast(e => e.kind === 'assistant').content, /two changes verified/);
    assert.equal(result.events.some(e => e.kind === 'tool_result' && JSON.parse(e.content).error), false);
  } finally { await client.close(); }
});
