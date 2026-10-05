import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Harness } from '../src/harness.js';
import { ConclaveService } from '../src/service.js';
import { JevDecisionAdapter } from '../src/jev.js';
import { captureMemory } from '../src/memory-controller.js';
import { memoryView } from '../src/memory.js';
import { memoryPassages, parseExtraction } from '../src/memory-extractor.js';
import { extractPassages } from '../src/memory-selection.js';
import { sanitizeExport, sanitizeText } from '../src/export-sanitizer.js';
import { jevTelemetry } from '../src/jev-telemetry.js';
import { createContextHandler } from '../src/http.js';

const typed = probabilities => ({ type: 'choice', choice: Object.keys(probabilities).sort((a,b) => probabilities[b]-probabilities[a])[0],
  confidence: Math.max(...Object.values(probabilities)), probabilities });
const keep = typed({ skip: 0.02, preference: 0.32, claim: 0.34, question: 0.32 });
const skip = typed({ skip: 0.9, preference: 0.03, claim: 0.04, question: 0.03 });
const unsure = typed({ skip: 0.5, preference: 0.1, claim: 0.3, question: 0.1 });
const native = records => ({ status:'completed', model:'task-fixture', usage:{ input_tokens:20, output_tokens:10 },
  output:[{ type:'message', content:[{ type:'output_text', text:JSON.stringify({ records }) }] }] });

function fixture(choose, task = ids => ids.map(passage_id => ({ passage_id, kind:'claim' }))) {
  const store = new Store(undefined, { memory:true }), id = store.create('Plumbing');
  const requested = [];
  const adapter = new JevDecisionAdapter({ name:'typesafe', respond:async payload => ({ model:'jev-fixture',
    answers:Object.fromEntries(Object.entries(payload.questions).map(([key,q]) => [key, choose(q.instructions.candidate.passage)])) }) });
  const h = new Harness(store,id,{ name:'openai',respond:async payload => {
    const passages = JSON.parse(payload.input[0].content).passages; requested.push(passages);
    return native(task(passages.map(p => p.passage_id)));
  } },{ budget:64000, memoryModel:true, memorySelector:'jev-hybrid', decisionAdapter:adapter });
  return { store,id,h,requested };
}
function research(f,content) {
  const event = f.h.addMessage('assistant',content).event;
  f.store.append(f.id,'turn_complete','',{ assistant_event_id:event.id }); return event;
}

test('keep confidence survives split kinds and rejects a skip even with uncertain kind confidence', async () => {
  const f = fixture(text => text === 'Keep.' ? keep : { ...skip, confidence:0.2 });
  try {
    const result = await f.h.decisionAdapter.selectMemory([{ passage_id:0,content:'Keep.' },{ passage_id:1,content:'Skip.' }],{},f.h.call.bind(f.h));
    assert.deepEqual(result.records,[{ passage_id:0,kind:'claim' }]);
    assert.ok(result.decisions.every(d => !d.uncertain)); assert.equal(result.decisions[0].kind_uncertain,true);
    assert.equal(result.confidence_target,'keep-or-skip');
  } finally { f.store.close(); }
});

test('hybrid escalates only uncertain source-local IDs and commits combined unresolved candidates',async () => {
  const f = fixture(text => text.startsWith('Confident') ? keep : text.startsWith('Uncertain') ? unsure : skip);
  try {
    await captureMemory(f.h,research(f,'Confident finding.\n\nRoutine narration.\n\nUncertain finding.'));
    assert.deepEqual(f.requested.map(p => p.map(r => r.passage_id)),[[2]]);
    assert.deepEqual(memoryView(f.store,f.id).records.map(r => r.content),['Confident finding.','Uncertain finding.']);
    assert.ok(memoryView(f.store,f.id).records.every(r => !r.binding && r.authority === 'model_proposed'));
    assert.deepEqual(memoryView(f.store,f.id).records.map(r=>r.selection_source.selector),['jev','task-model']);
    assert.deepEqual(memoryView(f.store,f.id).records.map(r=>r.extraction_model),['jev-fixture','task-fixture']);
    assert.equal(jevTelemetry(f.store.events(f.id)).summary.memory_hybrid_applied,1);
    assert.equal(f.store.events(f.id).filter(e => e.kind === 'memory_shadow').length,0);
    assert.deepEqual(f.store.events(f.id).findLast(e => e.kind === 'memory_selection').metadata.fallback_passage_ids,[2]);
  } finally { f.store.close(); }
});

test('hybrid makes no task-model call for confident decisions, falls back on Jev failure, and preserves Stop',async () => {
  const f = fixture(() => keep);
  try {
    await captureMemory(f.h,research(f,'A confident finding.')); assert.equal(f.requested.length,0);
    f.h.memoryCalls=0; f.h.decisionAdapter.provider.respond=async () => { throw Error('TypeSafe 503'); };
    await captureMemory(f.h,research(f,'Fallback finding.')); assert.equal(f.requested.length,1);
    assert.equal(memoryView(f.store,f.id).records.length,2);
    f.h.memoryCalls=0; const controller = new AbortController(); f.h.options.signal=controller.signal; controller.abort();
    await assert.rejects(captureMemory(f.h,research(f,'Stopped finding.')),/abort/i);
    assert.equal(memoryView(f.store,f.id).records.length,2);
  } finally { f.store.close(); }
});

test('complete quoted assistant findings beyond 4000 chars retain exact Unicode spans and longer paragraphs',async () => {
  const f = fixture(() => keep);
  try {
    const event = research(f,'😀 '+ 'background '.repeat(460)+'\n\nThe source reports "qualified" results with `inline code`, conditional on funding.');
    const passages=memoryPassages(event); assert.equal(passages.length,2); assert.ok(passages[1].span_start>4000);
    for (const p of passages) assert.equal(event.content.slice(p.span_start,p.span_end),p.content);
    await captureMemory(f.h,event); assert.equal(memoryView(f.store,f.id).records.length,2);
    const human={...event,kind:'user',content:'Report: "Keep the budget under $900"'};
    assert.deepEqual(memoryPassages(human),[]);
    assert.deepEqual(parseExtraction('{"records":[{"kind":"claim","passage_id":17}]}',[{passage_id:17}]).records,[{passage_id:17,kind:'claim'}]);
  } finally { f.store.close(); }
});

test('task fallback batches complete passages without renumbering or allowing unsupplied IDs',async () => {
  const f=fixture(() => unsure,ids => [{kind:'claim',passage_id:ids.at(-1)},{kind:'claim',passage_id:999}]);
  try {
    const event=research(f,'A.');
    const passages=[3,8,17].map(passage_id => ({passage_id,content:'😀 '+ 'detail '.repeat(700)}));
    const result=await extractPassages(f.h,event,[],passages);
    assert.ok(f.requested.length>1); assert.deepEqual(f.requested.flat().map(p=>p.passage_id),[3,8,17]);
    assert.ok(result.records.every(r=>[3,8,17].includes(r.passage_id))); assert.equal(result.invalid,f.requested.length);
  } finally { f.store.close(); }
});

test('shareable exports redact nested web HTML and copied payloads without mutating canonical records',() => {
  const key='AIza'+'a'.repeat(35), secret='sk-'+'b'.repeat(30);
  const input={events:[{kind:'web_page_response',content:`<script src="https://maps.example/api?key=${key}"></script>`,metadata:{api_key:secret}}],
    snapshots:[{content:JSON.stringify({access_token:secret})}],model_input:{url:'https://example.com/?X-Amz-Signature=abc123'}};
  const clean=sanitizeExport(input), rendered=JSON.stringify(clean);
  assert.ok(!rendered.includes(key)&&!rendered.includes(secret)&&!rendered.includes('abc123'));
  assert.ok(input.events[0].content.includes(key)); assert.equal(clean.sanitization.canonical,false);
  assert.ok(Object.keys(clean.sanitization.redactions).length>=2);
  assert.equal(sanitizeText(rendered),rendered,'redaction is idempotent');
  assert.equal(sanitizeText('The project has 120 houses and $900 funding.'),'The project has 120 houses and $900 funding.');
  const linked=JSON.stringify({url:'https://docs.example.com',logo:{'@type':'ImageObject',url:'https://docs.example.com/a.png'}});
  assert.equal(sanitizeText(linked),linked,'JSON-LD is not URL userinfo');
});

test('service and HTTP shareable export preserve canonical sources',async () => {
  const store=new Store(undefined,{memory:true}),id=store.create('Safe export'),key='AIza'+'z'.repeat(35);
  try {
    store.append(id,'web_page_response',`key=${key}`,{});
    const service=new ConclaveService(store,{memoryModel:false,embeddingEnabled:false});
    assert.ok(JSON.stringify(service.export(id)).includes(key)); assert.ok(!JSON.stringify(service.shareableExport(id)).includes(key));
    let output; const handler=createContextHandler({shareableExport:conv=>service.shareableExport(conv)});
    await handler({method:'GET',url:`/?action=shareable_export&conversation=${id}`,headers:{}},
      {writeHead(){},end(text){output=JSON.parse(text);}});
    assert.equal(output.sanitization.canonical,false); assert.ok(!JSON.stringify(output).includes(key));
  } finally {store.close();}
});
