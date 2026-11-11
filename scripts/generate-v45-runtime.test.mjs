import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectRuntime} from './generate-v45-runtime.mjs';

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
