import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { Harness } from './harness.js';
import { OpenAIProvider, environment, redact } from './provider.js';

const help = `Conclave — local persistent history / mutable context
  node src/cli.js new [title]
  node src/cli.js list
  node src/cli.js chat [--conversation ID] [--model gpt-6-luna]
  node src/cli.js ask "message" [--conversation ID]
  node src/cli.js context|diff|history|stats --conversation ID
  node src/cli.js ingest PATH --conversation ID
  node src/cli.js search "query" --conversation ID
  node src/cli.js retrieve EVENT_ID --conversation ID
  node src/cli.js pin "exact constraint" --conversation ID
  node src/cli.js compact --conversation ID
  node src/cli.js evict BUNDLE_ID --conversation ID
  node src/cli.js offload BUNDLE_ID --conversation ID
  node src/cli.js attention [task keywords] --conversation ID
  node src/cli.js memory [query] --conversation ID
  node src/cli.js bundle BUNDLE_ID --conversation ID
  node src/cli.js revisions --conversation ID
  node src/cli.js restore REVISION --conversation ID
  node src/cli.js export PATH --conversation ID
  node src/cli.js reindex
  node src/cli.js models
Options: --data DIR (default .conclave), --mode layered|append|summary,
  --budget 24000 (conservative UTF-8 units, including output reserve),
  --output 1000, --max-calls 5, --recent 4, --reasoning none,
  --policy balanced|legacy (default balanced)
  --focus "task keywords" (ingest: choose a matching source chunk)
Interactive commands: /context /diff /history /stats /attention /memory [query]
  /compact /pin TEXT /ingest PATH /offload BUNDLE_ID /restore REVISION /quit
Keys: OPENAI_API_KEY from process or Windows User/Machine environment.
Model: --model, CONCLAVE_MODEL, then gpt-6-luna. No automatic fallback.`;

let store;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    conversation: { type: 'string' }, model: { type: 'string' }, data: { type: 'string', default: '.conclave' },
    mode: { type: 'string', default: 'layered' }, budget: { type: 'string', default: '24000' },
    output: { type: 'string', default: '1000' }, 'max-calls': { type: 'string', default: '5' },
    recent: { type: 'string', default: '4' }, reasoning: { type: 'string', default: 'none' }, help: { type: 'boolean' },
    policy: { type: 'string', default: 'balanced' },
    focus: { type: 'string' },
  } });
  const [command = 'help', ...rest] = positionals;
  const argument = rest.join(' ');
  if (values.help || command === 'help') {
    console.log(help);
  } else if (command === 'models') {
    console.log((await new OpenAIProvider().models()).join('\n'));
  } else {
    store = new Store(values.data);
    if (command === 'new') console.log(store.create(argument || 'Untitled'));
    else if (command === 'list') console.table(store.list());
    else if (command === 'reindex') { store.reindex(); console.log(`Context catalog and source chunks rebuilt. History search: ${store.fts ? 'FTS5' : 'lexical fallback'}`); }
    else {
      const conversation = values.conversation || (['chat', 'ask'].includes(command) ? store.create(argument.slice(0, 60) || 'Chat') : null);
      if (!conversation) throw Error('--conversation ID is required');
      const live = ['chat', 'ask', 'compact'].includes(command);
      const provider = live ? new OpenAIProvider() : { name: 'local' };
      const harness = new Harness(store, conversation, provider, {
        model: values.model || environment('CONCLAVE_MODEL') || 'gpt-6-luna', mode: values.mode,
        budget: Number(values.budget), output: Number(values.output), maxCalls: Number(values['max-calls']),
        recent: Number(values.recent), reasoning: values.reasoning, policy: values.policy,
      });
      const transcript = () => store.events(conversation).filter((e) => ['user', 'assistant', 'document'].includes(e.kind))
        .map((e) => `[${e.kind} ${e.id} seq=${e.seq}]\n${e.content}`).join('\n\n');
      const showStats = () => console.log(JSON.stringify(harness.metrics(), null, 2));
      if (command === 'context') console.log(store.writeView(conversation));
      else if (command === 'diff') console.log(JSON.stringify(store.diff(conversation), null, 2));
      else if (command === 'history') console.log(transcript());
      else if (command === 'stats') showStats();
      else if (command === 'search') console.log(JSON.stringify(harness.toolResult('search_history', { query: argument }, []), null, 2));
      else if (command === 'retrieve') console.log(JSON.stringify(store.source(conversation, argument), null, 2));
      else if (command === 'ingest') console.log(harness.ingest(argument, values.focus || '').id);
      else if (command === 'pin') console.log(harness.pin(argument).id);
      else if (command === 'compact') {
        const result = await harness.compact([], true);
        console.log(result.status === 'skipped' ? `Compaction skipped: ${result.reason}` : `Context compacted at revision ${result.revision}.`);
        console.log(store.writeView(conversation));
      }
      else if (command === 'evict') console.log(harness.edit({ expected_revision: store.context(conversation).revision, remove_ids: [argument], additions: [] }));
      else if (command === 'offload') console.log(JSON.stringify(harness.offload([argument]), null, 2));
      else if (command === 'attention') console.log(JSON.stringify(harness.attentionPlan(argument), null, 2));
      else if (command === 'memory') console.log(JSON.stringify(store.memory(conversation, argument), null, 2));
      else if (command === 'bundle') console.log(JSON.stringify(store.resolveBundle(conversation, argument), null, 2));
      else if (command === 'revisions') console.table(store.db.prepare('SELECT revision,receipt_id FROM snapshots WHERE conversation_id=? ORDER BY revision').all(conversation));
      else if (command === 'restore') {
        if (!argument.trim()) throw Error('Restore revision required');
        const restored = store.restore(conversation, Number(argument));
        console.log(`Restored revision ${argument} as new revision ${restored.revision}; later pins preserved.`);
      }
      else if (command === 'export') {
        if (!argument) throw Error('Export path required');
        writeFileSync(resolve(argument), JSON.stringify({ schema_version: 1, conversation_id: conversation,
          events: store.events(conversation), context: store.context(conversation), metrics: harness.metrics() }, null, 2));
        console.log(`Exported ${resolve(argument)}`);
      } else if (command === 'ask') {
        console.log(`Conversation: ${conversation}`);
        console.log((await harness.ask(argument)).text);
        showStats();
      } else if (command === 'chat') {
        console.log(`Conversation: ${conversation}\nModel: ${harness.options.model}; mode: ${harness.options.mode}; policy: ${harness.options.policy}\n/context /diff /history /stats /attention /memory /compact /pin TEXT /ingest PATH /offload ID /restore REVISION /quit`);
        const readline = createInterface({ input: stdin, output: stdout });
        try {
          for (;;) {
            let line;
            try { line = (await readline.question('You> ')).trim(); } catch { break; }
            if (!line || line === '/quit') { if (line === '/quit') break; continue; }
            try {
              if (line === '/context') console.log(store.writeView(conversation));
              else if (line === '/diff') console.log(JSON.stringify(store.diff(conversation), null, 2));
              else if (line === '/history') console.log(transcript());
              else if (line === '/stats') showStats();
              else if (line === '/attention') console.log(JSON.stringify(harness.attentionPlan(), null, 2));
              else if (line === '/memory' || line.startsWith('/memory ')) console.log(JSON.stringify(store.memory(conversation, line.slice(8)), null, 2));
              else if (line.startsWith('/offload ')) console.log(JSON.stringify(harness.offload([line.slice(9).trim()]), null, 2));
              else if (line.startsWith('/restore ')) {
                const restored = store.restore(conversation, Number(line.slice(9).trim()));
                console.log(`Restored as revision ${restored.revision}; later pins preserved.`);
              }
              else if (line === '/compact') {
                const result = await harness.compact([], true);
                console.log(result.status === 'skipped' ? `Compaction skipped: ${result.reason}` : `Context compacted at revision ${result.revision}.`);
              }
              else if (line.startsWith('/pin ')) console.log(`Pinned ${harness.pin(line.slice(5)).id}`);
              else if (line.startsWith('/ingest ')) console.log(`Stored ${harness.ingest(line.slice(8)).id}`);
              else if (line.startsWith('/')) console.log('Unknown command.');
              else console.log(`Assistant> ${(await harness.ask(line)).text}`);
            } catch (error) { console.error(redact(error)); }
          }
        } finally { readline.close(); }
      } else throw Error(`Unknown command: ${command}`);
    }
  }
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
} finally { store?.close(); }
