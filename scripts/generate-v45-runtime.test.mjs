import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectRuntime,assertProjectionBinding} from './generate-v45-runtime.mjs';

test('approved runtime replacements are reported and descriptive rights never enter the projection',()=>{
 const texts={texte:JSON.stringify({example:{text:'Rolf, Philipp, Phillip und Gregor'}}),bedienung:JSON.stringify({tag_direkt:{rechte:'Philipp sieht keine Geldkachel',karten:'bleibt'}})};
 const before=JSON.stringify(texts),result=projectRuntime(texts);
 assert.equal(JSON.parse(result.projected.texte).example.text,'{zustaendig}, {zustaendig}, {zustaendig} und {zustaendig}');
 assert.deepEqual(result.replacements,[{path:'texte.example.text',count:4}]);
 assert.deepEqual(JSON.parse(result.projected.bedienung),{tag_direkt:{karten:'bleibt'}});
 assert.equal(JSON.stringify(texts),before);
 assert.deepEqual(projectRuntime(result.projected).projected,result.projected);
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
