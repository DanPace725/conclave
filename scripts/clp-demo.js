import { Store, registerFrame, attestSource, recordBundle, linkBundles, queryBundles } from '../src/index.js';

// Six synthetic bundles, no network or inference. Real callers use the same
// operations through service methods, CLI JSON inputs, or the HTTP API.
const store = new Store(undefined, { memory: true });
try {
  const conversation = store.create('CLP six-bundle toy');
  for (const name of ['claim', 'news.report']) registerFrame(store, conversation, {
    name, version: '1.0', required_fields: ['text'], validators: [{ field: 'text', rule: 'type', args: 'string' }],
  });
  const record = (frame, text, source_event_ids = [], min_support = 1) => recordBundle(store, conversation, {
    frame, frame_version: '1.0', content: { text }, source_event_ids, resolution: { min_support },
  });
  const evidence = ['alpha.example', 'beta.test', 'gamma.org'].map((domain, index) => {
    const source = store.append(conversation, 'document', `Synthetic earthquake observation ${index + 1}`, {}, 'human');
    attestSource(store, conversation, { source_event_id: source.id, origin_uri: `https://${domain}/report` });
    return record('news.report', source.content, [source.id]);
  });
  const supported = record('claim', 'Earthquake: three-source claim', [], 3);
  const thin = record('claim', 'Earthquake: thin claim', [], 3);
  const refuted = record('claim', 'Earthquake: refuted claim');
  const link = (from, to, relation = 'supports') => linkBundles(store, conversation, { from: from.id, to: to.id, relation });
  evidence.forEach(bundle => link(bundle, supported));
  link(evidence[0], thin); link(evidence[0], refuted); link(evidence[2], refuted, 'refutes');
  console.log(JSON.stringify(queryBundles(store, conversation, { intent: 'Inspect the toy claims', frame: ['claim'],
    filters: { keyword: 'earthquake' }, attention_budget: 'low', evidence: ['symbolic', 'lineage'] }), null, 2));
} finally { store.close(); }
