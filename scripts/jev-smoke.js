import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { JevProvider, redact } from '../src/provider.js';
import { JevDecisionAdapter } from '../src/jev.js';

// Opt-in live check: exactly one native decision request; no OpenAI inference.
let store;
try {
  const provider = new JevProvider();
  mkdirSync('.conclave', { recursive: true });
  const directory = mkdtempSync(resolve('.conclave/jev-smoke-'));
  store = new Store(directory);
  const conversation = store.create('Jev bounded retention check');
  const harness = new Harness(store, conversation, { name: 'local' }, { recent: 1,
    decisionAdapter: new JevDecisionAdapter(provider), decisionModel: 'jev-latest' });
  harness.addMessage('assistant', 'Synthetic fixture: old color notes about blue tiles; no new constraints or decisions. '.repeat(24));
  harness.addMessage('user', 'Synthetic fixture: choose a triangle token only if round tokens are unavailable. That condition remains unconfirmed.');
  harness.pin('Synthetic fixture: preserve the exact label CYAN_LITERAL.');
  const before = store.context(conversation);
  const proposal = await harness.selectionPlan('Organize a fictional color-and-shape puzzle; preserve unresolved alternatives.', [], true);
  const receipt = { conversation_id: conversation, preview_only: true, unchanged: store.context(conversation).revision === before.revision,
    selection_source: proposal.selection_source, decisions: proposal.entries, metrics: harness.metrics() };
  writeFileSync(join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ receipt: join(directory, 'receipt.json'), ...receipt }, null, 2));
  if (proposal.selection_source !== 'bounded-model') process.exitCode = 1;
} catch (error) { console.error(redact(error)); process.exitCode = 1; }
finally { store?.close(); }
