import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const source=resolve('_review/quellen/endversion_V45');
const output=resolve('src/ui/v45.generated.ts');
const files={regeln:'regeln.json',texte:'texte.json',bausteine:'bausteine.json',bedienung:'bedienung.json',tokens:'tokens.css',elemente:'elemente.json',erwartung:'ERWARTUNG.json',klickfolge:'KLICKFOLGE.jsonl'};
const digest=value=>createHash('sha256').update(value).digest('hex');
// Git stores LF while Windows may check out CRLF. Source authority hashes stay raw.
export const generatorSourceDigest=value=>digest(value.toString().replace(/\r\n/g,'\n'));
const generatorSha=generatorSourceDigest(readFileSync(fileURLToPath(import.meta.url)));
const names=/\b(?:Rolf|Philipp|Phillip|Gregor)\b/gu;
// Integrity metadata only: no parallel text/rule copy. Current PL-approved V45 import.
const SOURCE_BINDING={
  "preview": "2f15957a77ce7998d4ea7f16a67cf5e2435f8f1d24b6d4ec786e51fe4d1a352d",
  "sources": {
    "regeln.json": "ca7bd55a3b1ed8decfbef7e3b6760340a68e21a9f66b1a5a6ee856dbf289d053",
    "texte.json": "a103a730cc5fae2fbb95c8ff415edd48eeea95ad500d8aa2a1745f7ba2dc7d41",
    "bausteine.json": "aebad3e3410f1b25f498e3f37300b650198c86784298d2be32e0b78dda183c40",
    "bedienung.json": "cc6cf08c6172e1e939c8bc11b86930192ed648237e9499bee652d763a7aacdd9",
    "tokens.css": "fe9fbcd67c5cf8745311bfb101ae66a754f99ed954ffb5495ff0885814efadd9",
    "elemente.json": "9477cc234feb9a0a32563e5fb58216018e2067d7ed9e42c9c9822121fcd4c80e",
    "ERWARTUNG.json": "50b8509f04878e24f1ec100bad476b0c50ae1374d0b6e7b3d119d3ea3c99fba1",
    "KLICKFOLGE.jsonl": "11854931f2874facb571b087f91c6df4cb95ec953dd93c20868beac316adeb5d"
  },
  "projection": "1f2525eab0d7373877b9ec6d2ddb2695073cade8b091dfdc9655a9c065daa842"
};
export function assertProjectionBinding(projected,hashes,previewSha){
 if(previewSha!==SOURCE_BINDING.preview||Object.keys(SOURCE_BINDING.sources).some(name=>hashes[name]!==SOURCE_BINDING.sources[name])||Object.keys(hashes).length!==Object.keys(SOURCE_BINDING.sources).length)throw Error('V45_SOURCE_BINDING_CHANGED');
 if(digest(JSON.stringify(projected))!==SOURCE_BINDING.projection)throw Error('V45_PROJECTION_SOURCE_MISMATCH');
}


/** PL05:02 import contract. Sources remain untouched. Unknown locations fail. */
/** PL07:01 allowlist: absent values stay absent, never a synthesized false. */
export function projectElementMetadata(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.elemente))throw Error('V45_ELEMENT_METADATA_INVALID');
 const allowed=['id','text','recht','tiefe','stufe','zaehlt_als_info','reihenfolge'];
 return {elemente:value.elemente.map(row=>{
  if(!row||typeof row!=='object'||typeof row.id!=='string')throw Error('V45_ELEMENT_ID_MISSING');
  return Object.fromEntries(allowed.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]));
 })};
}
const pick=(row,keys)=>{
 if(!row||typeof row!=='object'||Array.isArray(row))throw Error('V45_REFERENCE_OBJECT_REQUIRED');
 return Object.fromEntries(keys.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]));
};
const actionIdentity=row=>row===null?null:pick(row,['id']);
/** Reference structure only, never example amounts, names, IDs or rendered text. */
export function projectExpectedStates(value){
 if(!value||!Array.isArray(value.faelle))throw Error('V45_EXPECTED_CASES_REQUIRED');
 return {faelle:value.faelle.map(row=>{
  const projected=pick(row,['fall','rolle','geraet','zustand','erster_blick']);
  if(Object.hasOwn(row,'hauptaktion'))projected.hauptaktion=actionIdentity(row.hauptaktion);
  for(const key of ['weitere_objektaktionen','gesperrt'])if(Object.hasOwn(row,key)){
   if(!Array.isArray(row[key]))throw Error('V45_EXPECTED_ACTION_LIST_REQUIRED');
   projected[key]=row[key].map(actionIdentity);
  }
  return projected;
 })};
}
const transitionState=row=>row===null?null:pick(row,['ansicht','ebene','dialog','reiter','zustand','sichtbar']);
export function projectClickTransitions(value){
 if(!value||!Array.isArray(value.wege))throw Error('V45_CLICK_ROWS_REQUIRED');
 const projectedRows=value.wege.map((row,index)=>{
  const projected={sourceLine:Object.hasOwn(row,'sourceLine')?row.sourceLine:index+1,...pick(row,['fall','rolle','geraet','ergebnis'])};
  if(Object.hasOwn(row,'knopf'))projected.knopf=actionIdentity(row.knopf);
  for(const key of ['vorher','nachher'])if(Object.hasOwn(row,key))projected[key]=transitionState(row[key]);
  if(Object.hasOwn(row,'folge'))projected.folge=row.folge===null?null:pick(row.folge,['zustand','ansicht','dialog','elemente']);
  if(Object.hasOwn(row,'sperrt'))projected.sperrt=row.sperrt;
  return projected;
 });
 const fields=['fall','rolle','geraet','ergebnis','knopf','vorher','nachher','folge','sperrt'];
 const values=[],indices=new Map();
 const intern=value=>{const key=JSON.stringify(value);if(indices.has(key))return indices.get(key);const index=values.length;values.push(value);indices.set(key,index);return index;};
 return {format:'indexed-v1',fields,values,rows:projectedRows.map(row=>fields.map(key=>Object.hasOwn(row,key)?intern(row[key]):-1))};
}
export function readProjectedTransition(value,line){
 if(value?.format!=='indexed-v1'||!Number.isSafeInteger(line)||line<1||!Array.isArray(value.rows)||!value.rows[line-1]||!Array.isArray(value.fields)||!Array.isArray(value.values))throw Error('V45_TRANSITION_REFERENCE_INVALID');
 const row=value.rows[line-1];if(row.length!==value.fields.length)throw Error('V45_TRANSITION_REFERENCE_INVALID');
 const result={sourceLine:line};
 for(let i=0;i<row.length;i++){const index=row[i];if(index===-1)continue;if(!Number.isSafeInteger(index)||index<0||index>=value.values.length)throw Error('V45_TRANSITION_REFERENCE_INVALID');result[value.fields[i]]=value.values[index];}
 return result;
}
function decodeRuntimeSource(key,text){
 if(key==='klickfolge'){
  try{const value=JSON.parse(text);if(value?.format==='indexed-v1')return projectClickTransitions({wege:value.rows.map((_,index)=>readProjectedTransition(value,index+1))});if(value&&Array.isArray(value.wege))return projectClickTransitions(value);}catch{}
  return projectClickTransitions({wege:text.split(/\r?\n/).filter(line=>line.trim()).map(line=>JSON.parse(line))});
 }
 const value=JSON.parse(text);
 return key==='elemente'?projectElementMetadata(value):key==='erwartung'?projectExpectedStates(value):value;
}
export function projectRuntime(texts){
 const replacements=[];
 const visit=(value,path)=>{
  if(typeof value==='string'){
   const matches=[...value.matchAll(names)];
   if(!matches.length)return value;
   if(!path.startsWith('texte.')||!path.endsWith('.text'))throw Error('V45_NAME_OUTSIDE_APPROVED_RUNTIME_FIELD:'+path);
   replacements.push({path,count:matches.length});
   return value.replace(names,'{zustaendig}');
  }
  if(Array.isArray(value))return value.map((entry,index)=>visit(entry,path+'.'+index));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>path+'.'+key!=='bedienung.tag_direkt.rechte').map(([key,entry])=>[key,visit(entry,path+'.'+key)]));
  return value;
 };
 const projected=Object.fromEntries(Object.entries(texts).map(([key,value])=>[key,key==='tokens'?value:JSON.stringify(visit(decodeRuntimeSource(key,value),key))]));
 for(const value of Object.values(projected))if(names.test(value))throw Error('V45_UNRESOLVED_NAME');
 return {projected,replacements};
}

function render(projected,hashes,previewSha){
 assertProjectionBinding(projected,hashes,previewSha);
 if(Object.keys(projected).sort().join()!==Object.keys(files).sort().join()||Object.values(projected).some(value=>typeof value!=='string'))throw Error('V45_RUNTIME_SOURCES_INVALID');
 const rules=JSON.parse(projected.regeln);
 if(!Array.isArray(rules.regeln)||!rules.regeln.length||new Set(rules.regeln.map(rule=>rule.id)).size!==rules.regeln.length)throw Error('V45_RUNTIME_RULES_INVALID');
 if(!/^[a-f0-9]{64}$/.test(previewSha)||Object.keys(hashes).sort().join()!==Object.values(files).sort().join()||Object.values(hashes).some(hash=>!/^[a-f0-9]{64}$/.test(hash)))throw Error('V45_RUNTIME_HASH_INVALID');
 return '// erzeugt â€“ nie von Hand Ã¤ndern; Quelle V45, Quell-SHA-256 siehe V45_SOURCE_HASHES.\n'
  +'// Generator-SHA-256: '+generatorSha+'\n'
  +'export const V45_PREVIEW_SHA = '+JSON.stringify(previewSha)+';\n'
  +'export const V45_SOURCE_HASHES = '+JSON.stringify(hashes,null,2)+' as const;\n'
  +'export const V45_PROJECTION_SHA = '+JSON.stringify(digest(JSON.stringify(projected)))+';\n'
  +'export const V45_PROJECTED_TEXT = '+JSON.stringify(projected,null,2)+' as const;\n'
  +'export type V45Rule = {id:string;bereich:string;wenn:Record<string,string|boolean|number>;dann:{zustand:string;hauptaktion:string|null;farbe:string;aktionsfarbe:string|null};quelle:string};\n'
  +'export const V45_RULES = (JSON.parse(V45_PROJECTED_TEXT.regeln) as {regeln:V45Rule[]}).regeln;\n'
  +'export type V45ElementMetadata = {id:string;text?:string|null;recht?:string|null;tiefe?:number|null;stufe?:string|null;zaehlt_als_info?:boolean|null;reihenfolge?:unknown};\n'
  +'export const V45_ELEMENTS = (JSON.parse(V45_PROJECTED_TEXT.elemente) as {elemente:V45ElementMetadata[]}).elemente;\n'
  +'export const V45_REFERENCE_STATES = JSON.parse(V45_PROJECTED_TEXT.erwartung) as unknown;\n'
  +'export const V45_REFERENCE_TRANSITIONS = JSON.parse(V45_PROJECTED_TEXT.klickfolge) as unknown;\n'
  +'export const V45_RUNTIME = {elemente:V45_ELEMENTS,regeln:V45_RULES,texte:JSON.parse(V45_PROJECTED_TEXT.texte) as Record<string,{text:string}>,bausteine:JSON.parse(V45_PROJECTED_TEXT.bausteine) as unknown,bedienung:JSON.parse(V45_PROJECTED_TEXT.bedienung) as unknown,tokens:V45_PROJECTED_TEXT.tokens};\n';
}

function main(){
 const generatedOnly=process.argv.includes('--check-generated');
 let projected,hashes,previewSha;
 if(generatedOnly){
  const saved=readFileSync(output,'utf8');
  const payload=saved.match(/export const V45_PROJECTED_TEXT = ([\s\S]*?) as const;\n/);
  const sourceHashes=saved.match(/export const V45_SOURCE_HASHES = ([\s\S]*?) as const;\n/);
  const preview=saved.match(/export const V45_PREVIEW_SHA = "([a-f0-9]{64})";/);
  if(!payload||!sourceHashes||!preview)throw Error('V45_RUNTIME_ENVELOPE_INVALID');
  projected=JSON.parse(payload[1]);hashes=JSON.parse(sourceHashes[1]);previewSha=preview[1];
  // Normalization must be idempotent; no unapproved raw name enters runtime.
  if(JSON.stringify(projectRuntime(projected).projected)!==JSON.stringify(projected))throw Error('V45_RUNTIME_IMPORT_CONTRACT_INVALID');
 }else{
  const manifest=new Map(readFileSync(resolve(source,'HASHES.txt'),'utf8').split(/\r?\n/).filter(Boolean).map(line=>{const match=line.match(/^([a-f0-9]{64})  (.+)$/);if(!match)throw Error('V45_HASH_MANIFEST_INVALID');return [match[2],match[1]];}));
  const read=name=>{const bytes=readFileSync(resolve(source,name));if(digest(bytes)!==manifest.get(name))throw Error('V45_SOURCE_HASH_MISMATCH:'+name);return bytes.toString('utf8');};
  const texts=Object.fromEntries(Object.entries(files).map(([key,name])=>[key,read(name)]));
  const result=projectRuntime(texts);projected=result.projected;
  for(const replacement of result.replacements)console.log('V45_REPLACEMENT '+JSON.stringify(replacement));
  hashes=Object.fromEntries(Object.entries(texts).map(([key,value])=>[files[key],digest(value)]));
  previewSha=digest(read('vorschau.html'));
 }
 const expected=render(projected,hashes,previewSha);
 if(generatedOnly||process.argv.includes('--check')){
  if(readFileSync(output,'utf8')!==expected)throw Error('V45_RUNTIME_GENERATED_DIFF');
  console.log('V45_RUNTIME=PASS '+(generatedOnly?'CI projection/generator check':'local HASHES/source check'));
 }else{writeFileSync(output,expected);console.log('V45_RUNTIME=GENERATED '+output);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
