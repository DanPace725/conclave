import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';

// Exercises the real persistence/edit/retrieval loop; responses are scripted, not an LLM evaluation.
export class DemoProvider {
  name = 'scripted-demo';
  requests = [];
  async respond(payload) {
    this.requests.push(payload);
    const context = JSON.parse(payload.input[0].content.split('\n')[1]);
    const last = payload.input.at(-1);
    const make = (output) => ({ id: `demo_${this.requests.length}`, model: 'scripted-demo', status: 'completed', output });
    const answer = (text) => make([{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }]);
    const call = (name, args) => make([{ type: 'function_call', call_id: `call_${this.requests.length}`, name, arguments: JSON.stringify(args) }]);
    if (last.type === 'function_call_output') {
      const result = JSON.parse(last.output);
      if (result.error) return answer(`Tool error: ${result.error}`);
      if (Array.isArray(result)) {
        const source = result.find((e) => e.content.includes('orchard-719'));
        return answer(source ? `The amber recovery code is orchard-719 [${source.event_id}].` : 'Code not found.');
      }
      return answer(`Context edit committed at revision ${result.revision}.`);
    }
    const latest = [...context].reverse().find((s) => s.type === 'user')?.content || '';
    if (latest === 'Compact the old architecture note.') {
      const old = context.find((s) => s.content.startsWith('Architecture A'));
      const revision = Number(payload.input[0].content.match(/revision (\d+)/)[1]);
      return call('edit_context', { expected_revision: revision, remove_ids: [old.id], additions: [{
        content: 'B currently looks easier; A may still work if X changes.',
        source_event_ids: old.source_event_ids, type: 'decision', status: 'unresolved',
      }] });
    }
    if (latest.includes('amber recovery code')) return call('search_history', { query: 'amber recovery code' });
    return answer('Ready.');
  }
}

export async function runDemo(directory = '.conclave/demo') {
  let store = new Store(directory);
  const conversation = store.create('Offline recovery demo');
  const provider = new DemoProvider();
  let harness = new Harness(store, conversation, provider);
  harness.pin('Never drop the caveat that architecture A may still work if X changes.');
  const old = harness.addMessage('user', 'Architecture A was tried twice. It may still work if X changes, but B currently looks easier.');
  const code = harness.addMessage('user', 'The amber recovery code is orchard-719.');
  harness.edit({ expected_revision: store.context(conversation).revision, remove_ids: [code.item.id], additions: [] });
  const edited = await harness.ask('Compact the old architecture note.');
  const saved = store.context(conversation);
  store.close();
  store = new Store(directory);
  harness = new Harness(store, conversation, provider);
  const restored = store.context(conversation);
  const recovered = await harness.ask('What is the amber recovery code?');
  const output = { conversation, edited: edited.text, restart_revision: restored.revision,
    restart_matches: JSON.stringify(saved) === JSON.stringify(restored), recovered: recovered.text,
    old_source_intact: store.source(conversation, old.event.id).content,
    code_source_intact: store.source(conversation, code.event.id).content,
    context_file: `${store.directory}/${conversation}/context.md`, metrics: harness.metrics() };
  store.close();
  return output;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/demo.js')) {
  console.log(JSON.stringify(await runDemo(), null, 2));
}
