import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { Harness } from './harness.js';
import { OpenAIProvider, JevProvider, environment, redact } from './provider.js';
import { JevDecisionAdapter } from './jev.js';
import { stateView } from './state.js';

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
  node src/cli.js state --conversation ID
  node src/cli.js state-update JSON_PATH --conversation ID
  node src/cli.js remember KEY TYPE "text" --conversation ID
  node src/cli.js decide [task keywords] --decision-model MODEL --conversation ID
  node src/cli.js decide [task keywords] --decision-provider jev --conversation ID
  node src/cli.js export PATH --conversation ID
  node src/cli.js reindex
  node src/cli.js models
Options: --data DIR (default .conclave), --mode layered|append|summary,
  --budget 24000 (conservative UTF-8 units, including output reserve),
  --output 4096, --max-calls 5, --recent 4, --reasoning none, --tool-reserve 2000,
  --policy balanced|legacy (default balanced)
  --focus "task keywords" (ingest: choose a matching source chunk)
  --decision-model MODEL (optional, off by default; layered mode only)
  --decision-provider openai|jev (default openai; jev enables jev-latest)
  --jev-confidence 0.65 --jev-key-env TYPESAFE_API_KEY
  --decision-budget 8000 --decision-output 600 --decision-candidates 6 (maximum 12)
Interactive commands: /context /diff /history /stats /attention /memory [query]
  /state /remember KEY TYPE TEXT /state-update PATH /decide [task keywords]
  /compact /pin TEXT /ingest PATH /offload BUNDLE_ID /restore REVISION /quit
Keys: OPENAI_API_KEY; Jev: TYPESAFE_API_KEY or JEV_API_KEY.
TYPE: objective|constraint|decision|question|evidence. Reuse KEY to correct state.
Model: --model, CONCLAVE_MODEL, then gpt-6-luna. No automatic fallback.`;

let store;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    conversation: { type: 'string' }, model: { type: 'string' }, data: { type: 'string', default: '.conclave' },
    mode: { type: 'string', default: 'layered' }, budget: { type: 'string', default: '24000' },
    output: { type: 'string', default: '4096' }, 'max-calls': { type: 'string', default: '5' },
    recent: { type: 'string', default: '4' }, reasoning: { type: 'string', default: 'none' }, help: { type: 'boolean' },
    'tool-reserve': { type: 'string', default: '2000' },
    policy: { type: 'string', default: 'balanced' },
    focus: { type: 'string' },
    'decision-model': { type: 'string' }, 'decision-budget': { type: 'string', default: '8000' },
    'decision-output': { type: 'string', default: '600' }, 'decision-candidates': { type: 'string', default: '6' },
    'decision-provider': { type: 'string', default: 'openai' }, 'jev-confidence': { type: 'string', default: '0.65' },
    'jev-key-env': { type: 'string', default: 'TYPESAFE_API_KEY' },
  } });
  const [command = 'help', ...rest] = positionals;
  if (!['openai', 'jev'].includes(values['decision-provider'])) throw Error('--decision-provider must be openai or jev');
  const argument = rest.join(' ');
  if (values.help || command === 'help') {
    console.log(help);
  } else if (command === 'models') {
    console.log((await (values['decision-provider'] === 'jev' ? new JevProvider({ keyEnv: values['jev-key-env'] }) : new OpenAIProvider()).models()).join('\n'));
  } else {
    store = new Store(values.data);
    if (command === 'new') console.log(store.create(argument || 'Untitled'));
    else if (command === 'list') console.table(store.list());
    else if (command === 'reindex') { store.reindex(); console.log(`Context catalog and source chunks rebuilt. History search: ${store.fts ? 'FTS5' : 'lexical fallback'}`); }
    else {
      const conversation = values.conversation || (['chat', 'ask'].includes(command) ? store.create(argument.slice(0, 60) || 'Chat') : null);
      if (!conversation) throw Error('--conversation ID is required');
      if (command === 'decide' && !values['decision-model'] && values['decision-provider'] !== 'jev') throw Error('Set --decision-model or --decision-provider jev to request bounded selection');
      const live = ['chat', 'ask', 'compact', 'decide'].includes(command);
      const jev = live && values['decision-provider'] === 'jev';
      const provider = live && !(command === 'decide' && jev) ? new OpenAIProvider() : { name: 'local' };
      const decisionModel = values['decision-model'] || (jev ? 'jev-latest' : null);
      const decisionAdapter = jev ? new JevDecisionAdapter(new JevProvider({ keyEnv: values['jev-key-env'] }), {
        model: decisionModel, budget: Number(values['decision-budget']), candidates: Number(values['decision-candidates']),
        confidence: Number(values['jev-confidence']),
      }) : undefined;
      const harness = new Harness(store, conversation, provider, {
        model: values.model || environment('CONCLAVE_MODEL') || 'gpt-6-luna', mode: values.mode,
        budget: Number(values.budget), output: Number(values.output), maxCalls: Number(values['max-calls']),
        recent: Number(values.recent), reasoning: values.reasoning, policy: values.policy,
        toolReserve: Number(values['tool-reserve']), decisionAdapter,
        decisionModel: decisionModel, decisionBudget: Number(values['decision-budget']),
        decisionOutput: Number(values['decision-output']), decisionCandidates: Number(values['decision-candidates']),
      });
      const transcript = () => store.events(conversation).filter((e) => ['user', 'assistant', 'document'].includes(e.kind))
        .map((e) => `[${e.kind} ${e.id} seq=${e.seq}]\n${e.content}`).join('\n\n');
      const showStats = () => console.log(JSON.stringify(harness.metrics(), null, 2));
      const remember = (text) => {
        const match = text.match(/^(\S+)\s+(\S+)\s+([\s\S]+)$/);
        if (!match) throw Error('Use /remember KEY TYPE TEXT; TYPE is objective, constraint, decision, question, or evidence');
        const state = harness.remember(match[1], match[2], match[3]);
        console.log(`Saved ${match[1]} at revision ${state.revision}. Reuse the key to correct it; /state shows current entries.`);
      };
      const propose = async (query = '') => {
        if (!harness.decisionAdapter || harness.options.mode !== 'layered') throw Error('Bounded selection requires layered mode and --decision-model');
        return { ...await harness.selectionPlan(query, [], true), applied: false };
      };
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
        console.log(result.status === 'skipped' ? `Compaction skipped: ${result.reason}` : `Context ${result.status} at revision ${result.revision}.`);
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
      else if (command === 'state') console.log(JSON.stringify(stateView(store, conversation), null, 2));
      else if (command === 'state-update') console.log(JSON.stringify(harness.updateState(JSON.parse(readFileSync(argument, 'utf8'))), null, 2));
      else if (command === 'remember') remember(argument);
      else if (command === 'decide') console.log(JSON.stringify(await propose(argument), null, 2));
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
        console.log(`Conversation: ${conversation}\nModel: ${harness.options.model}; mode: ${harness.options.mode}; policy: ${harness.options.policy}; decision model: ${harness.options.decisionModel || 'off'}\n/context /diff /history /stats /attention /memory /state /remember /state-update PATH /decide /compact /pin TEXT /ingest PATH /offload ID /restore REVISION /quit\n/remember KEY TYPE TEXT saves a named entry without an API call. Reuse KEY to correct it.`);
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
              else if (line === '/state') console.log(JSON.stringify(stateView(store, conversation), null, 2));
              else if (line.startsWith('/remember ')) remember(line.slice(10));
              else if (line.startsWith('/state-update ')) console.log(JSON.stringify(harness.updateState(JSON.parse(readFileSync(line.slice(14).trim(), 'utf8'))), null, 2));
              else if (line === '/decide' || line.startsWith('/decide ')) console.log(JSON.stringify(await propose(line.slice(8)), null, 2));
              else if (line === '/memory' || line.startsWith('/memory ')) console.log(JSON.stringify(store.memory(conversation, line.slice(8)), null, 2));
              else if (line.startsWith('/offload ')) console.log(JSON.stringify(harness.offload([line.slice(9).trim()]), null, 2));
              else if (line.startsWith('/restore ')) {
                const restored = store.restore(conversation, Number(line.slice(9).trim()));
                console.log(`Restored as revision ${restored.revision}; later pins preserved.`);
              }
              else if (line === '/compact') {
                const result = await harness.compact([], true);
                console.log(result.status === 'skipped' ? `Compaction skipped: ${result.reason}` : `Context ${result.status} at revision ${result.revision}.`);
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
