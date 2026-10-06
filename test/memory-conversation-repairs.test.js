import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, hash } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { captureMemory, selectMemory } from '../src/memory-controller.js';
import { commitMemory, memoryView } from '../src/memory.js';
import { extractExplicit, extractionPayload, memoryPassages } from '../src/memory-extractor.js';
import { effortLevels } from '../src/effort.js';
import { memoryTopic } from '../src/memory-scope.js';

function fixture() {
  const store = new Store(undefined, { memory: true }), id = store.create(); let calls = 0;
  const provider = { name: 'openai', respond: async () => { calls++; return { model: 'fixture', status: 'completed', usage: { input_tokens: 0, output_tokens: 0 }, output: [{ type: 'message', content: [{ type: 'output_text', text: '{"records":[]}' }] }] }; } };
  const h = new Harness(store, id, provider, { budget: 128000, memoryModel: true, model: 'gpt-6-astra' });
  const capture = async text => { h.memoryCalls = 0; const event = h.addMessage('user', text).event; await captureMemory(h, event); return event; };
  return { store, id, h, capture, calls: () => calls };
}
const octopus = 'We are planning a 60-minute public library event called “Octopus Intelligence: Minds Unlike Ours.”\n\nCurrent requirements:\n\nTotal budget: $1,800\n\nAudience: ages 10 through adult\n\nExpected attendance: 30 people\n\nExactly 4 activity stations\n\nNo live animals\n\nAt least one activity must demonstrate camouflage\n\nAt least one activity must address cognition\n\nEverything must fit inside one ordinary library meeting room';
const robotics = 'New topic. We are now planning a different library event called “Deep-Sea Robotics: Exploring Where Humans Can’t Go.”\n\nTotal budget: $1,800\n\nExpected attendance: 30 people\n\nExactly 4 activity stations\n\nDuration: 75 minutes';

test('Astra extraction and shared UI capabilities use supported reasoning', () => {
  const event = { id: 'source', kind: 'user', content: 'Budget preference: perhaps $500.', metadata: {} };
  assert.deepEqual(effortLevels('openai', 'gpt-6-astra'), ['low', 'medium', 'high', 'xhigh', 'max']);
  assert.equal(extractionPayload(event, [], 'gpt-6-astra').reasoning.effort, 'low');
  assert.equal(extractionPayload(event, [], 'gpt-6.1-sol').reasoning.effort, 'low');
  assert.equal(extractionPayload(event, [], 'claude-sonnet-5-5', 'anthropic').reasoning, undefined);
});

test('real multi-clause corrections capture substantive constraints without losing exact source spans', async () => {
  const f = fixture(); try {
    await f.capture(octopus);
    await f.capture('New requirement: the event must now be accessible to someone who is blind or has low vision. At least one major activity therefore needs a meaningful nonvisual component rather than merely an audio description of something visual.\n\nKeep working on the plan.');
    await f.capture('Correction: I checked the funding email. The budget was not $1,800.\n\nThe actual total budget is $1,500.\n\nEverything else remains unchanged unless I explicitly change it.');
    await f.capture("The requirement for exactly four stations is withdrawn. We now need exactly three stations because one side of the room has to remain open for another program's equipment.\nAlso, expected attendance is now 36 people, not 30.");
    const view = memoryView(f.store, f.id), selected = selectMemory(f.store, f.id, '', 16000);
    const text = selected.records.map(r => r.content).join('\n');
    assert.match(text, /60-minute/); assert.match(text, /\$1,500/); assert.match(text, /36 people/); assert.match(text, /exactly three stations/); assert.match(text, /meaningful nonvisual component/); assert.match(text, /one side of the room/);
    assert.doesNotMatch(text, /\$1,800|Expected attendance: 30|Exactly 4|Keep working|funding email/);
    assert.equal(view.records.filter(r => r.lifecycle === 'superseded').length, 3);
    assert.equal(f.calls(), 0, 'Explicit requirements do not depend on model extraction');
    for (const r of view.records) for (const ref of r.source_refs) { const source = f.store.event(f.id, ref.event_id); assert.equal(source.content.slice(ref.span_start, ref.span_end), r.content); assert.equal(hash(r.content), ref.span_hash); }
  } finally { f.store.close(); }
});

test('identical fields in different projects stay separate, and returning selects only that project', async () => {
  const f = fixture(); try {
    await f.capture(octopus); await f.capture('Correction: The actual total budget is $1,500.');
    await f.capture(robotics); await f.capture('Correction for Deep-Sea Robotics only:\nThe event duration is actually 90 minutes, not 75.');
    let selected = selectMemory(f.store, f.id, '', 16000).records;
    assert.ok(selected.every(r => r.scope.topic_name.startsWith('Deep-Sea Robotics')));
    assert.match(JSON.stringify(selected), /\$1,800|90 minutes/); assert.doesNotMatch(JSON.stringify(selected), /75 minutes|\$1,500/);
    const budgets = memoryView(f.store, f.id).records.filter(r => r.content === 'Total budget: $1,800');
    assert.equal(budgets.length, 2); assert.notEqual(budgets[0].scope.topic_id, budgets[1].scope.topic_id); assert.equal(budgets[1].source_refs.length, 1);
    await f.capture('Return to “Octopus Intelligence: Minds Unlike Ours.”\n\nGive me its current requirements and budget.');
    selected = selectMemory(f.store, f.id, 'requirements budget', 16000).records;
    assert.ok(selected.every(r => r.scope.topic_name.startsWith('Octopus Intelligence')));
    assert.match(JSON.stringify(selected), /\$1,500/); assert.doesNotMatch(JSON.stringify(selected), /90 minutes|Deep-Sea Robotics/);
  } finally { f.store.close(); }
});

test('offline requirement is captured instead of a generic keep-developing instruction', async () => {
  const f = fixture(); try {
    await f.capture(robotics);
    await f.capture('Add this requirement to the Deep-Sea Robotics event:\nAt least one station must work without requiring internet access, because the library’s guest Wi-Fi is unreliable.\nKeep developing the plan.');
    const text = JSON.stringify(selectMemory(f.store, f.id, '', 16000).records);
    assert.match(text, /without requiring internet access/); assert.doesNotMatch(text, /Keep developing/); assert.equal(f.calls(), 0);
  } finally { f.store.close(); }
});

test('unapproved proposals stay unresolved and audit requests cause no memory-model dispatch', async () => {
  const f = fixture(); try {
    await f.capture(octopus);
    await f.capture('A participant proposes adding UV cards at $6 per attendee.\n\nThis is only a proposal. I am not approving or rejecting it yet.\n\nContinue.');
    const proposal = memoryView(f.store, f.id).records.at(-1);
    assert.equal(proposal.kind, 'question'); assert.equal(proposal.binding, false); assert.equal(proposal.resolution, 'unresolved'); assert.match(proposal.content, /not approving or rejecting/);
    await f.capture('Return to “Octopus Intelligence: Minds Unlike Ours.”\n\nGive me its authoritative requirements, budget and unresolved proposals.');
    await f.capture('Produce the final plan. Include the current requirements and rough budget.');
    assert.equal(f.calls(), 0); assert.equal(memoryView(f.store, f.id).records.length, 10);
  } finally { f.store.close(); }
});

test('quotes, hypothetical declarations and conditional corrections cannot gain unconditional authority', async () => {
  const f = fixture(); try {
    await f.capture('The article says “Total budget: $900. No live animals.”');
    await f.capture('```We are planning a 60-minute public library event called "False project".\nTotal budget: $900```');
    await f.capture('We are planning a 60-minute public library event called “Conditional” if funding is approved.');
    assert.equal(memoryView(f.store, f.id).records.length, 0);
    await f.capture('Total budget: $1,800'); await f.capture('Correction: The actual total budget is $1,500 if funding is approved.');
    assert.equal(memoryView(f.store, f.id).records[0].lifecycle, 'retained');
    assert.ok(memoryView(f.store, f.id).records.at(-1).content.includes('if funding is approved'));
  } finally { f.store.close(); }
});

test('legacy cross-project merged heads stay inspectable but are excluded from activation', async () => {
  const f = fixture(); try {
    const first = await f.capture(octopus); const second = await f.capture(robotics);
    const rows = memoryView(f.store, f.id).records.filter(r => r.content === 'Total budget: $1,800');
    const legacy = structuredClone(rows[0]); delete legacy.scope.topic_id; delete legacy.scope.topic_name; legacy.binding = false; legacy.authority = 'user_reported'; legacy.lifecycle = 'candidate'; legacy.memory_id = 'legacy-cross-topic'; legacy.source_refs.push(rows[1].source_refs[0]);
    f.store.append(f.id, 'memory_delta', '', { records: [legacy], changes: [] });
    assert.equal(memoryView(f.store, f.id).records.at(-1).scope.topic_ambiguous, true);
    assert.ok(!selectMemory(f.store, f.id, 'budget', 16000).memory_ids.includes(legacy.memory_id));
    assert.equal(f.store.event(f.id, first.id).content, octopus); assert.equal(f.store.event(f.id, second.id).content, robotics);
  } finally { f.store.close(); }
});

test('zero eligible passages report no extraction dispatch and no paid extraction', async () => {
  const f = fixture(); try {
    await f.capture('Budget report: “Keep the budget under $900”.');
    const capture = f.store.events(f.id).findLast(e => e.kind === 'memory_capture');
    assert.equal(capture.metadata.paid_extraction, false); assert.equal(capture.metadata.passage_coverage.offered_paragraphs, 0); assert.equal(f.calls(), 0);
    assert.equal(f.h.memoryCalls, 0, 'An ineligible source does not consume the per-turn allowance');
  } finally { f.store.close(); }
});

test('quoted and fenced project declarations cannot switch the active project or drop global binding constraints', async () => {
  const f = fixture(); try {
    await f.capture('Never charge a fee.');
    await f.capture(octopus);
    const quoted = await f.capture('```\nWe are planning an event called "Fake project".\n```');
    assert.ok(memoryTopic(f.store.events(f.id), quoted).topic_name.startsWith('Octopus Intelligence'));
    const selected = selectMemory(f.store, f.id, '', 16000).records;
    assert.ok(selected.some(r => r.content === 'Never charge a fee.'));
    await f.capture(robotics);
    assert.ok(selectMemory(f.store, f.id, '', 16000).records.some(r => r.content === 'Never charge a fee.'));
  } finally { f.store.close(); }
});
