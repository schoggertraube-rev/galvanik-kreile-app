import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectRuntime,assertProjectionBinding,generatorSourceDigest,projectElementMetadata,projectExpectedStates,projectClickTransitions,readProjectedTransition} from './generate-v45-runtime.mjs';

test('approved runtime replacements are reported and descriptive rights never enter the projection',()=>{
 const texts={texte:JSON.stringify({example:{text:'Rolf, Philipp, Phillip und Gregor'}}),bedienung:JSON.stringify({tag_direkt:{rechte:'Philipp sieht keine Geldkachel',karten:'bleibt'}})};
 const before=JSON.stringify(texts),result=projectRuntime(texts);
 assert.equal(JSON.parse(result.projected.texte).example.text,'{zustaendig}, {zustaendig}, {zustaendig} und {zustaendig}');
 assert.deepEqual(result.replacements,[{path:'texte.example.text',count:4}]);
 assert.deepEqual(JSON.parse(result.projected.bedienung),{tag_direkt:{karten:'bleibt'}});
 assert.equal(JSON.stringify(texts),before);
 assert.deepEqual(projectRuntime(result.projected).projected,result.projected);
});
test('the generator binding survives Git LF and Windows CRLF checkouts',()=>{
 assert.equal(generatorSourceDigest('TEST first\nTEST second\n'),generatorSourceDigest('TEST first\r\nTEST second\r\n'));
});
test('a name in any unapproved location fails instead of silently omitting or encoding it',()=>{
 assert.throws(()=>projectRuntime({texte:JSON.stringify({example:{description:'Rolf'}})}),/V45_NAME_OUTSIDE_APPROVED_RUNTIME_FIELD/);
 assert.throws(()=>projectRuntime({bausteine:JSON.stringify({example:'Gregor'})}),/V45_NAME_OUTSIDE_APPROVED_RUNTIME_FIELD/);
});
test('the actual imported runtime binds all 48 original rules without changing source order',()=>{
 const original=JSON.parse(readFileSync('_review/quellen/endversion_V45/regeln.json','utf8'));
 assert.equal(original.regeln.length,48);
 const projected=projectRuntime({regeln:JSON.stringify(original)}).projected;
 assert.deepEqual(JSON.parse(projected.regeln),original);
});
test('CI rejects a rewritten rule even when the artifact recomputes its own checksum',()=>{
 const saved=readFileSync('src/ui/v45.generated.ts','utf8');
 const projected=JSON.parse(saved.match(/export const V45_PROJECTED_TEXT = ([\s\S]*?) as const;/)[1]);
 const hashes=JSON.parse(saved.match(/export const V45_SOURCE_HASHES = ([\s\S]*?) as const;/)[1]);
 const preview=JSON.parse(saved.match(/export const V45_PREVIEW_SHA = ("[a-f0-9]+")/)[1]);
 assert.doesNotThrow(()=>assertProjectionBinding(projected,hashes,preview));
 const rules=JSON.parse(projected.regeln);rules.regeln[0].dann.hauptaktion='synthetic.changed';projected.regeln=JSON.stringify(rules);
 assert.throws(()=>assertProjectionBinding(projected,hashes,preview),/V45_PROJECTION_SOURCE_MISMATCH/);
 assert.throws(()=>assertProjectionBinding(projected,{...hashes,'regeln.json':'0'.repeat(64)},preview),/V45_SOURCE_BINDING_CHANGED/);
});

test('PL07:01 element metadata preserves only the approved fields and never defaults missing facts',()=>{
 const raw={elemente:[{id:'synthetic.action',text:'example.text',recht:'geld',tiefe:1,stufe:'pilot',reihenfolge:[],ziel:{status:'neu'},status:'in_arbeit',zustaende:['invented'],folge:['invented'],sperrt:['invented']}]};
 const projected=projectElementMetadata(raw).elemente[0];
 assert.deepEqual(Object.keys(projected),['id','text','recht','tiefe','stufe','reihenfolge']);
 assert.equal(Object.hasOwn(projected,'zaehlt_als_info'),false);
 assert.throws(()=>projectElementMetadata({elemente:[{text:'missing id'}]}),/V45_ELEMENT_ID_MISSING/);
});
test('actual element metadata keeps its source identity without importing unfinished effects or targets',()=>{
 const original=JSON.parse(readFileSync('_review/quellen/endversion_V45/elemente.json','utf8'));
 const projected=projectElementMetadata(original).elemente;
 assert.equal(projected.length,399);assert.equal(new Set(projected.map(row=>row.id)).size,399);
 for(let i=0;i<projected.length;i++)for(const [key,value] of Object.entries(projected[i]))assert.deepEqual(value,original.elemente[i][key]);
 assert.ok(projected.every(row=>!Object.hasOwn(row,'ziel')&&!Object.hasOwn(row,'status')&&!Object.hasOwn(row,'folge')&&!Object.hasOwn(row,'sperrt')));
});

test('PL07:01 reference states omit example content and retain missing versus explicit null',()=>{
 const value=projectExpectedStates({faelle:[{fall:'TEST-case',rolle:'TEST-role',geraet:'tablet',zustand:'waiting',hauptaktion:null,gesperrt:[],kunde:'TEST not runtime customer',sichtbar:[{id:'TEST',text:'TEST example price'}]}]});
 assert.deepEqual(value,{faelle:[{fall:'TEST-case',rolle:'TEST-role',geraet:'tablet',zustand:'waiting',hauptaktion:null,gesperrt:[]}]});
 assert.equal(Object.hasOwn(value.faelle[0],'erster_blick'),false);
});
test('transition interning is lossless for structured source facts and keeps missing distinct from null',()=>{
 const rows=[{fall:'TEST',rolle:'TEST-role',geraet:'tablet',ergebnis:'geklickt',knopf:{id:'order.finish',text:'TEST example content'},vorher:{zustand:'work',auftrag:'TEST example ID',sichtbar:['order.finish']},nachher:null,folge:null,sperrt:[]},{fall:'TEST',rolle:'TEST-role',geraet:'tablet',ergebnis:'keine_wirkung',knopf:{id:'order.finish'},vorher:{zustand:'work',sichtbar:['order.finish']},nachher:null}];
 const projected=projectClickTransitions({wege:rows});
 assert.deepEqual(readProjectedTransition(projected,1),{sourceLine:1,fall:'TEST',rolle:'TEST-role',geraet:'tablet',ergebnis:'geklickt',knopf:{id:'order.finish'},vorher:{zustand:'work',sichtbar:['order.finish']},nachher:null,folge:null,sperrt:[]});
 assert.equal(Object.hasOwn(readProjectedTransition(projected,2),'folge'),false);
 assert.deepEqual(projectClickTransitions({wege:rows.map((_,i)=>readProjectedTransition(projected,i+1))}),projected);
 assert.throws(()=>readProjectedTransition(projected,0),/V45_TRANSITION_REFERENCE_INVALID/);
 const corrupt=structuredClone(projected);corrupt.rows[0][0]=corrupt.values.length;assert.throws(()=>readProjectedTransition(corrupt,1),/V45_TRANSITION_REFERENCE_INVALID/);
});
test('all actual state and transition source rows remain addressable without the 71MB example documents',()=>{
 const cases=JSON.parse(readFileSync('_review/quellen/endversion_V45/ERWARTUNG.json','utf8'));
 assert.equal(projectExpectedStates(cases).faelle.length,495);
 const rows=readFileSync('_review/quellen/endversion_V45/KLICKFOLGE.jsonl','utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
 const projected=projectClickTransitions({wege:rows});assert.equal(projected.rows.length,35166);
 for(let i=0;i<rows.length;i++){
  const actual=readProjectedTransition(projected,i+1);assert.equal(actual.fall,rows[i].fall);assert.deepEqual(actual.sperrt,rows[i].sperrt);assert.equal(actual.nachher?.zustand,rows[i].nachher?.zustand);
 }
 assert.ok(JSON.stringify(projected).length<4_000_000);
});
