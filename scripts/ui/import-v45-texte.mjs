#!/usr/bin/env node
// AP-UI-VORBEREITUNG U1: report only. Never writes a catalogue or V45 source.
// Run: node --import tsx scripts/ui/import-v45-texte.mjs [--selftest]
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import * as catalogue from '../../src/ui/situationCatalog.ts';

const sourceUrl=new URL('../../_review/quellen/endversion_V45/texte.json',import.meta.url);
const schemaUrl=new URL('../../_review/quellen/endversion_V45/schema/texte.schema.json',import.meta.url);

function catalogueEntries(exports){
 const result=new Map();
 function visit(value,path){
  if(typeof value==='string'||typeof value==='function'){result.set(path,value);return;}
  if(value&&typeof value==='object'&&!Array.isArray(value))for(const [key,child]of Object.entries(value))visit(child,path?path+'.'+key:key);
 }
 // tsx's CJS interoperability also exposes the same named exports through a
 // synthetic default object. It is not a second set of catalogue keys.
 const named=Object.fromEntries(Object.entries(exports).filter(([key])=>key!=='default'));
 visit(named,'');return result;
}

function compare(source,product){
 const expected=new Set(Object.keys(source)),actual=catalogueEntries(product);
 const missing=[],extra=[],differentText=[],dynamic=[];
 for(const key of [...expected].sort()){
  if(!actual.has(key)){missing.push(key);continue;}
  const value=actual.get(key);
  // A formatter must be explicitly bound and checked with its real arguments.
  // Never call it with invented values to manufacture a textual match.
  if(typeof value==='function')dynamic.push(key);
  else if(value!==source[key].text)differentText.push(key);
 }
 for(const key of [...actual.keys()].sort())if(!expected.has(key))extra.push(key);
 return {missing,extra,differentText,dynamic};
}

async function main(){
 const schema=JSON.parse(await readFile(schemaUrl,'utf8'));
 // The current text schema uses the shared object/string/boolean subset.
 // AJV6 cannot load the 2020-12 meta-schema. Keep every validation keyword,
 // reject unknown keywords and remove only the meta-schema declaration.
 const {$schema:metaSchema,...contract}=schema;
 if(metaSchema!=='https://json-schema.org/draft/2020-12/schema')throw Error('V45_TEXT_META_SCHEMA_CHANGED');
 const validate=new Ajv({allErrors:true,jsonPointers:true,strictKeywords:true}).compile(contract);
 if(process.argv.includes('--selftest')){
  const valid={'app.name':{text:'TEST title',neu:true,quelle:'TEST isolated'}};
  assert.equal(validate(valid),true);
  assert.equal(validate({'app.name':{text:42,neu:true,quelle:'TEST'}}),false);
  assert.equal(validate({'app.name':{text:'TEST',neu:true}}),false);
  assert.deepEqual(compare(valid,{'app.name':'TEST title','other.key':'TEST extra'}),{missing:[],extra:['other.key'],differentText:[],dynamic:[]});
  assert.deepEqual(compare(valid,{'app.name':'TEST changed'}).differentText,['app.name']);
  assert.deepEqual(compare(valid,{}).missing,['app.name']);
  assert.deepEqual(compare(valid,{'app.name':()=>{throw Error('FORMATTER_MUST_NOT_RUN');}}).dynamic,['app.name']);
  console.log('V45 text report selftest: 7 isolated contracts passed; no source written.');return;
 }
 if(process.argv.slice(2).length)throw Error('Usage: node --import tsx scripts/ui/import-v45-texte.mjs [--selftest]');
 const bytes=await readFile(sourceUrl),source=JSON.parse(bytes.toString('utf8'));
 if(!validate(source))throw Error('V45_TEXT_SCHEMA_INVALID: '+JSON.stringify(validate.errors));
 const comparison=compare(source,catalogue);
 const productBytes=await readFile(new URL('../../src/ui/situationCatalog.ts',import.meta.url));
 console.log(JSON.stringify({mode:'report-only',bindingApproval:'not asserted',source:'_review/quellen/endversion_V45/texte.json',sourceSha256:createHash('sha256').update(bytes).digest('hex'),product:'src/ui/situationCatalog.ts',productSha256:createHash('sha256').update(productBytes).digest('hex'),schema:'valid',expectedKeys:Object.keys(source).length,productKeys:catalogueEntries(catalogue).size,...comparison,note:'Exact catalogue paths only; no inferred aliases, copied texts, generated values or product/V45 writes. Extra paths remain in the existing catalogue; this report does not authorize deletion.'},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'V45_TEXT_REPORT_FAILED');process.exitCode=2;});
