// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {V45_TEXT,V45_TEXT_TEMPLATES} from '@/ui/situationCatalog';
import {V45_TEXT_KEYS,V45_TEXT_AMENDMENTS} from '@/ui/generated/v45Texte.generated';
import {V45_RUNTIME} from '@/ui/v45.generated';
import {assertGeneratedCatalog,assertTextKeys,compileTextContract,projectTextAmendments,renderTextCatalog,textParameters} from '../../scripts/ui/import-v45-texte.mjs';

describe('S15 frozen text catalog and typed placeholders',()=>{
 it('binds every frozen key plus explicit amendments, without a handwritten text copy',()=>{
  const rows=compileTextContract(V45_RUNTIME.texte,V45_TEXT_AMENDMENTS);
  assertTextKeys([...V45_TEXT_KEYS],rows.map((row:{key:string})=>row.key));
  expect(Object.keys(V45_RUNTIME.texte)).toHaveLength(1838);
  for(const row of rows)expect(V45_TEXT_TEMPLATES[row.key as keyof typeof V45_TEXT_TEMPLATES]).toBe(row.text);
  expect(Object.keys(V45_TEXT)).toHaveLength(rows.length);
  expect(Object.hasOwn(V45_TEXT_TEMPLATES,'capture.local_limit')).toBe(false);
  expect(Object.hasOwn(V45_TEXT_TEMPLATES,'error.object')).toBe(false);
 });
 it('uses N13 and N19 exactly; removed hints never become product copy',()=>{
  expect(V45_TEXT.form$required({feld:'Termin'})).toBe('Termin fehlt');
  expect(V45_TEXT.part$photo_title({teil:'TEST Teil'})).toBe('Foto zu TEST Teil');
  expect(V45_TEXT.mail$test_sent({empfaenger:'TEST Empfänger'})).toBe('An TEST Empfänger gesendet. Die gesendete Fassung ist hinterlegt.');
  expect(V45_TEXT.file$too_large({max_mb:'7'})).toBe('Die Datei ist größer als 7 MB. Wähle eine kleinere Datei.');
  expect(V45_TEXT.mail$test_not_sent).toBe('Nicht gesendet. Sende die Nachricht erneut.');
 });
 it('only interpolates supplied display strings, including dollar signs and repeated placeholders',()=>{
  expect(V45_TEXT.app$week({amount:'1.234,56 €'})).toBe('1.234,56 € diese Woche');
  expect(V45_TEXT.app$week({amount:'$&'})).toBe('$& diese Woche');
  expect(()=>V45_TEXT.app$week({amount:42} as never)).toThrow('V45_TEXT_ARGUMENTS_INVALID');
  expect(()=>V45_TEXT.app$week({} as never)).toThrow('V45_TEXT_ARGUMENTS_INVALID');
  expect(()=>V45_TEXT.app$week({amount:'TEST',extra:'TEST'} as never)).toThrow('V45_TEXT_ARGUMENTS_INVALID');
 });
 it('distinguishes dots and underscores instead of colliding source identities',()=>{
  const rows=compileTextContract({'test.one.two':{text:'TEST A'},'test.one_two':{text:'TEST B'}},[]);
  expect(rows.map((row:{identifier:string})=>row.identifier)).toEqual(['test$one_two','test$one$two']);
  expect(new Set(rows.map((row:{identifier:string})=>row.identifier)).size).toBe(2);
 });
 it('preserves Unicode bytes and rejects non-NFC, malformed braces, missing text or an empty schema',()=>{
  const text='„TEST“ – {name}\u00a0€';
  expect(compileTextContract({'test.text':{text}},[])[0].text).toBe(text);
  expect(textParameters(text)).toEqual(['name']);
  expect(()=>textParameters('TEST e\u0301')).toThrow('UTF8_NFC');
  expect(()=>textParameters('TEST {unfinished')).toThrow('PLACEHOLDER');
  expect(()=>compileTextContract({'test.empty':{}},[])).toThrow('SCHEMA');
  expect(()=>compileTextContract({},[])).toThrow('SCHEMA');
 });
 it('rejects missing and extra keys rather than silently generating a partial catalog',()=>{
  expect(()=>assertTextKeys(['test.one'],['test.one','test.two'])).toThrow('KEYS_MISMATCH');
  expect(()=>assertTextKeys(['test.one','test.extra'],['test.one'])).toThrow('KEYS_MISMATCH');
  expect(()=>assertTextKeys(['test.one','test.one'],['test.one','test.two'])).toThrow('KEYS_MISMATCH');
 });
 it('resolves N5 only when the explicit reference matches the canonical source text',()=>{
  const patch={nachtraege:[{id:'N-TEST',dom:{texte:{'TEST annotation':{neu:'TEST {part} (Text von order.photo)'}}}}],arbeitsliste:[]};
  expect(projectTextAmendments(patch,{'order.photo':{text:'TEST {part}'}})).toEqual([{key:'order.photo',text:'TEST {part}',source:'N-TEST'}]);
  expect(()=>projectTextAmendments(patch,{'order.photo':{text:'TEST differs'}})).toThrow('REFERENCE_INVALID');
  expect(()=>projectTextAmendments({nachtraege:[...patch.nachtraege,{id:'N-OTHER',dom:{texte:{'order.photo':{neu:'TEST differs'}}}}],arbeitsliste:[]},{'order.photo':{text:'TEST {part}'}})).toThrow('CONFLICT');
 });
 it('regenerates the exact checked artifact; changing one source heading changes its binding',()=>{
  const generated=readFileSync('src/ui/generated/v45Texte.generated.ts','utf8').replaceAll('\r\n','\n');
  expect(renderTextCatalog(V45_RUNTIME.texte,V45_TEXT_AMENDMENTS)).toBe(generated);
  const changed={...V45_RUNTIME.texte,'app.search':{text:'TEST changed heading'}};
  expect(renderTextCatalog(changed,V45_TEXT_AMENDMENTS)).not.toBe(generated);
 });
 it('checks the complete artifact and mechanical report without needing private review files in CI',()=>{
  expect(execFileSync(process.execPath,['scripts/ui/import-v45-texte.mjs','--check-generated'],{encoding:'utf8'})).toContain('PASS');
 });
 it('the actual CI checker rejects a missing key, extra key and a wrong required placeholder',()=>{
  const generated=readFileSync('src/ui/generated/v45Texte.generated.ts','utf8').replaceAll('\r\n','\n');
  const changeKeys=(keys:readonly string[])=>generated.replace(/export const V45_TEXT_KEYS = ([\s\S]*?) as const;\n/,'export const V45_TEXT_KEYS = '+JSON.stringify(keys)+' as const;\n');
  expect(()=>assertGeneratedCatalog(changeKeys(V45_TEXT_KEYS.slice(1)),generated,[...V45_TEXT_KEYS])).toThrow('KEYS_MISMATCH');
  expect(()=>assertGeneratedCatalog(changeKeys([...V45_TEXT_KEYS,'test.extra']),generated,[...V45_TEXT_KEYS])).toThrow('KEYS_MISMATCH');
  const wrong=generated.replace('app$week:<A extends {readonly "amount":string}>','app$week:<A extends {readonly "wrong":string}>');
  expect(wrong).not.toBe(generated);
  expect(()=>assertGeneratedCatalog(wrong,generated,[...V45_TEXT_KEYS])).toThrow('GENERATED_DIFF');
 });
});

// Compiled by the normal project tsc: missing/foreign placeholders must stay errors,
// including non-literal argument variables. Never executed as a product action.
function compileOnly(){
 V45_TEXT.app$week({amount:'1,00 €'});
 // @ts-expect-error missing required placeholder
 V45_TEXT.app$week({});
 // @ts-expect-error foreign placeholder
 V45_TEXT.app$week({amount:'1,00 €',unexpected:'TEST'});
 const extra={amount:'TEST',unexpected:'TEST'};
 // @ts-expect-error variables cannot smuggle unknown placeholders either
 V45_TEXT.app$week(extra);
 // @ts-expect-error formatting belongs to the existing formatters
 V45_TEXT.app$week({amount:1});
 // @ts-expect-error static text is a string, not a formatter
 V45_TEXT.nav$tag({});
}
void compileOnly;
