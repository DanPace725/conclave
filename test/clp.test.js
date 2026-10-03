import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, Harness, ConclaveService, registerFrame, attestSource, recordBundle, linkBundles, queryBundles } from '../src/index.js';
import { serviceCommand } from '../src/service-cli.js';

const frame = name => ({ name, version: '1.0', required_fields: ['text'], validators: [{ field: 'text', rule: 'type', args: 'string' }] });
function fixture() {
  const store = new Store(undefined, { memory: true }), conversation = store.create('CLP acceptance fixture');
  registerFrame(store, conversation, frame('claim'));
  registerFrame(store, conversation, frame('news.report'));
  const record = (text, sources = [], type = 'claim', resolution = {}) => recordBundle(store, conversation, {
    frame: type, frame_version: '1.0', content: { text }, source_event_ids: sources, resolution,
  });
  const source = (content, url, metadata = {}) => store.append(conversation, 'document', content,
    { source_url: url, evidence_scope: 'page-text', ...metadata }, 'web');
  const originals = ['alpha.example', 'beta.test', 'gamma.org'].map((domain, index) => source(`Earthquake report ${index}`, `https://${domain}/report`));
  const evidence = originals.map(event => record(event.content, [event.id], 'news.report'));
  const supported = record('Earthquake supported claim', [], 'claim', { min_support: 3 });
  const thin = record('Earthquake thin claim', [], 'claim', { min_support: 3 });
  const refuted = record('Earthquake refuted claim');
  const link = (from, to, relation = 'supports') => linkBundles(store, conversation, { from: from.id, to: to.id, relation });
  evidence.forEach(bundle => link(bundle, supported));
  link(evidence[0], thin); link(evidence[0], refuted); link(evidence[2], refuted, 'refutes');
  const query = (input = {}) => queryBundles(store, conversation, { frame: ['claim'], ...input });
  return { store, conversation, originals, evidence, supported, thin, refuted, record, source, link, query };
}
function check(run) { const f = fixture(); try { run(f); } finally { f.store.close(); } }

test('CLP acceptance 1: frame scoping excludes every out-of-frame row', () => check(f => {
  assert.deepEqual(f.query().rows.map(row => row.id), [f.supported.id]);
  assert.ok(f.query().telemetry.unresolved_clusters.every(item => item.frame === 'claim'));
  assert.equal(f.query({ frame: ['news.report'] }).rows.length, 3);
}));
test('CLP acceptance 2: thin support is withheld in unresolved_clusters', () => check(f => {
  const result = f.query();
  assert.ok(!result.rows.some(row => row.id === f.thin.id));
  assert.equal(result.telemetry.unresolved_clusters.find(item => item.key === f.thin.id).reason, 'support<3 (1)');
  assert.match(result.telemetry.unresolved_clusters.find(item => item.key === f.refuted.id).reason, /refuted/);
}));
test('CLP acceptance 3: identical queries yield deterministic rows and ordered explanations', () => check(f => {
  const query = { filters: { keyword: 'earthquake', date_gte: '2020-01-01' }, evidence: ['symbolic', 'lineage'] };
  assert.deepEqual(f.query(query), f.query(query));
  assert.deepEqual(f.query(query).explain[0].why, ['filter.frame; filter.date_gte', 'filter.keyword', 'supports.depth=1; resolution.met']);
}));
test('CLP acceptance 4: low attention explanations have at most three lines per result', () => check(f => {
  const result = f.query({ attention_budget: 'low', filters: { keyword: 'earthquake', date_gte: '2020-01-01' } });
  const explanations = [...result.explain, ...result.telemetry.unresolved_clusters.map(item => item.explain)];
  assert.ok(explanations.every(item => item.why.length <= 3));
}));
test('CLP acceptance 5: repeated domains, copied lineages and exact copies grant no extra support', () => check(f => {
  const first = f.source('Separate page, same publisher', 'https://other.alpha.example/report');
  const second = f.source(f.originals[0].content, 'https://copy.net/report');
  const third = f.source('Paraphrased copy', 'https://mirror.io/report', { copied_from_source_event_id: f.originals[0].id });
  for (const event of [first, second, third]) f.link(f.record(event.content, [event.id], 'news.report'), f.thin);
  const result = f.query().telemetry.unresolved_clusters.find(item => item.key === f.thin.id);
  assert.equal(result.explain.evidence.support_count, 1);
  assert.equal(result.explain.evidence.diversity, 1);
  assert.ok(result.explain.evidence.independent_groups[0].domains.includes('copy.net'));
}));
test('CLP acceptance 6: each admitted row cites immutable events and its exact frame version', () => check(f => {
  const explain = f.query().explain[0];
  assert.equal(explain.frame_version, '1.0');
  assert.ok(explain.event_ids.includes(f.supported.event_id));
  assert.ok(explain.event_ids.includes(f.supported.frame_event_id));
  for (const event of f.originals) assert.ok(explain.event_ids.includes(event.id));
  assert.ok(explain.event_ids.every(id => f.store.events(f.conversation).some(event => event.id === id)));
}));

test('CLP confidence/separation remain unmeasured and stricter stored floors cannot be weakened', () => check(f => {
  const result = f.query({ resolution: { confidence: 0.95, min_separation: 0.2, min_support: 0 } });
  assert.equal(result.rows.length, 0);
  const supported = result.telemetry.unresolved_clusters.find(item => item.key === f.supported.id);
  assert.equal(supported.explain.evidence.confidence, null);
  assert.equal(supported.explain.evidence.separation, null);
  assert.match(supported.reason, /confidence unmeasured; separation unmeasured/);
  assert.match(result.telemetry.unresolved_clusters.find(item => item.key === f.thin.id).reason, /support<3/);
}));
test('CLP unknown origins and model/search summaries cannot manufacture independent support', () => check(f => {
  for (const [kind, scope] of [['assistant', 'page-text'], ['reasoning', 'page-text'], ['document', 'search-summary'], ['document', 'search-snippet']]) {
    const event = f.store.append(f.conversation, kind, `${kind} ${scope}`, { source_url: `https://${kind}.com`, evidence_scope: scope }, 'openai');
    f.link(f.record('Derived estimate', [event.id], 'news.report'), f.thin);
  }
  const local = f.store.append(f.conversation, 'document', 'Unattributed text', {}, 'human');
  f.link(f.record('Local text', [local.id], 'news.report'), f.thin);
  assert.equal(f.query().telemetry.unresolved_clusters.find(item => item.key === f.thin.id).explain.evidence.support_count, 1);
  assert.throws(() => attestSource(f.store, f.conversation, { source_event_id: f.originals[0].id, origin_uri: 'https://forged.net' }), /cannot replace/);
}));
test('CLP honors removed sources, current workspace versions, bundle supersession and contested support', () => check(f => {
  f.store.append(f.conversation, 'document_lifecycle', '', { key: `source:${f.originals[1].id}`, operation: 'remove' });
  assert.match(f.query().telemetry.unresolved_clusters.find(item => item.key === f.supported.id).reason, /support<3 \(2\)/);
  const old = f.source('Old version', 'https://version.net', { workspace_path: 'report.md' });
  const oldBundle = f.record('Old claim', [old.id]);
  f.source('New version', 'https://version.net', { workspace_path: 'report.md' });
  assert.match(f.query().telemetry.unresolved_clusters.find(item => item.key === oldBundle.id).reason, /source unavailable/);
  const newer = f.record('Updated claim', [f.originals[0].id]);
  f.link(newer, oldBundle, 'supersedes');
  assert.ok(!f.query().telemetry.unresolved_clusters.some(item => item.key === oldBundle.id));
  f.link(f.evidence[2], f.evidence[0], 'refutes');
  assert.equal(f.query().telemetry.unresolved_clusters.find(item => item.key === f.thin.id).explain.evidence.support_count, 0);
}));
test('CLP validates immutable frames, fails closed on unsupported query features, and pages without hiding unresolved results', () => check(f => {
  assert.throws(() => registerFrame(f.store, f.conversation, frame('claim')), /immutable/);
  assert.throws(() => f.record(42), /validation/);
  assert.throws(() => recordBundle(f.store, f.conversation, { frame: 'claim', frame_version: '1.0', content: { text: 'Bad JSON', value: Infinity } }), /JSON values/);
  assert.throws(() => f.record('Bad floor', [], 'claim', { confidence: null }), /confidence/);
  assert.throws(() => f.query({ frame: ['unknown'] }), /Unknown query frame/);
  assert.throws(() => f.query({ evidence: ['vector'] }), /Only symbolic/);
  assert.throws(() => f.query({ policy_view: 'effective' }), /Invalid CLP query fields/);
  assert.throws(() => f.query({ filters: { amount: 2 } }), /Invalid query filter/);
  assert.throws(() => f.query({ resolution: { min_support: -1 } }), /min_support/);
  const first = f.query({ limit: 1 }), second = f.query({ limit: 1, offset: first.next_offset });
  assert.equal(first.rows[0].id, f.supported.id);
  assert.equal(second.rows.length, 0);
  assert.equal(second.telemetry.unresolved_clusters[0].key, f.thin.id);
  assert.equal(f.query({ limit: 1, offset: 2 }).next_offset, null);
  const other = f.store.create('Other');
  assert.throws(() => queryBundles(f.store, other, { frame: ['claim'] }), /Unknown query frame/);
}));

test('CLP required fields, one_of validators and stricter frame floors apply to every record', () => check(f => {
  registerFrame(f.store, f.conversation, { name: 'finance.invoice', version: '1.2', required_fields: ['currency'],
    validators: [{ field: 'currency', rule: 'one_of', args: ['USD', 'EUR', 'GBP'] }], defaults: { resolution: { min_support: 3 } } });
  const input = { frame: 'finance.invoice', frame_version: '1.2', source_event_ids: [f.originals[0].id], resolution: { min_support: 0 } };
  assert.throws(() => recordBundle(f.store, f.conversation, { ...input, content: {} }), /Missing required/);
  assert.throws(() => recordBundle(f.store, f.conversation, { ...input, content: { currency: 'JPY' } }), /validation/);
  const invoice = recordBundle(f.store, f.conversation, { ...input, content: { currency: 'USD' } });
  assert.equal(invoice.resolution.min_support, 3);
  const result = f.query({ frame: ['finance.invoice'], resolution: { min_support: 0 } });
  assert.equal(result.rows.length, 0);
  assert.equal(result.telemetry.unresolved_clusters[0].reason, 'support<3 (1)');
}));

test('CLP service CLI attestations, lineage and model queries survive SQLite restart and stay out of ordinary state', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'clp-'));
  let store = new Store(folder);
  try {
    let service = new ConclaveService(store), conversation = service.create('CLP restart').conversation_id;
    const command = async (method, input) => {
      // Exercise the CLI JSON input path rather than bypassing its dispatch.
      const { writeFileSync } = await import('node:fs');
      const path = join(folder, 'input.json'); writeFileSync(path, JSON.stringify(input));
      return serviceCommand(['call', method, path, '--conversation', conversation], { service, write: () => {} });
    };
    assert.ok(!new Harness(store, conversation, { name: 'fixture' }).tools().some(tool => tool.name === 'query_clp'));
    await command('clpRegisterFrame', frame('claim'));
    const original = store.append(conversation, 'document', 'Original observation', {}, 'human');
    const copied = store.append(conversation, 'document', 'Reworded observation', {}, 'human');
    await command('clpAttest', { source_event_id: original.id, origin_uri: 'https://source.example/report' });
    await command('clpAttest', { source_event_id: copied.id, origin_uri: 'https://copy.example/report', parents: [original.id] });
    const bundle = await command('clpRecord', { frame: 'claim', frame_version: '1.0', content: { text: 'Observation' }, source_event_ids: [copied.id] });
    const before = await command('clpQuery', { frame: ['claim'] });
    assert.equal(before.explain[0].evidence.independent_groups[0].domains[0], 'source.example');
    assert.ok(!service.view(conversation).state.entries.length);
    store.close(); store = new Store(folder); service = new ConclaveService(store);
    assert.deepEqual(await command('clpQuery', { frame: ['claim'] }), before);
    assert.equal((await command('clpBundle', { bundle_id: bundle.id })).id, bundle.id);
    const h = new Harness(store, conversation, { name: 'fixture' });
    assert.ok(h.tools().some(tool => tool.name === 'query_clp'));
    assert.equal(h.toolResult('query_clp', { frame: [], offset: 0 }, []).frames[0].name, 'claim');
    assert.equal(h.toolResult('query_clp', { frame: ['claim'], keyword: '', offset: 0, min_support: 1, confidence: 0, min_separation: 0 }, []).rows[0].id, bundle.id);
    assert.ok(service.export(conversation).events.some(event => event.kind === 'clp_attestation'));
  } finally { store.close(); rmSync(folder, { recursive: true }); }
});
