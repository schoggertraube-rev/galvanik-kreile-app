import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const source=resolve('_review/quellen/endversion_V45');
const output=resolve('src/ui/v45.generated.ts');
const files={regeln:'regeln.json',texte:'texte.json',bausteine:'bausteine.json',bedienung:'bedienung.json',tokens:'tokens.css',elemente:'elemente.json',erwartung:'ERWARTUNG.json',klickfolge:'KLICKFOLGE.jsonl'};
const digest=value=>createHash('sha256').update(value).digest('hex');
/** Check every frozen file, including reference assets, before binding runtime data. */
export function verifySourceManifest(text,readSource){
 const hashes=new Map();
 for(const line of text.split(/\r?\n/).filter(Boolean)){
  const match=line.match(/^([a-f0-9]{64})  (.+)$/);
  if(!match)throw Error('V45_HASH_MANIFEST_INVALID');
  const [,hash,name]=match;
  if(name.startsWith('/')||name.includes('\\')||name.split('/').some(part=>part==='..'||part==='.'||part==='')||hashes.has(name))throw Error('V45_HASH_MANIFEST_PATH_INVALID:'+name);
  if(digest(readSource(name))!==hash)throw Error('V45_SOURCE_HASH_MISMATCH:'+name);
  hashes.set(name,hash);
 }
 if(!hashes.size)throw Error('V45_HASH_MANIFEST_EMPTY');
 return hashes;
}
// Git stores LF while Windows may check out CRLF. Source authority hashes stay raw.
export const generatorSourceDigest=value=>digest(value.toString().replace(/\r\n/g,'\n'));
const generatorSha=generatorSourceDigest(readFileSync(fileURLToPath(import.meta.url)));
const names=/\b(?:Rolf|Philipp|Phillip|Gregor)\b/gu;
// Integrity metadata only: no parallel text/rule copy. Current PL-approved V45 import.
const SOURCE_BINDING={
  "preview": "73be3e04df183ecd4ec0680c761572b1599661f81ff54e49cfd6b2766e03f735",
  "sources": {
    "regeln.json": "f12839d00a9b7a2ff0497048cb8576e3ba9853d1b20420c5e0bc18bfc31026ab",
    "texte.json": "a1b24fbc51af7fc0be907eada4bf4113d89b4c58523cd6a7317f741424ee7316",
    "bausteine.json": "aebad3e3410f1b25f498e3f37300b650198c86784298d2be32e0b78dda183c40",
    "bedienung.json": "cc6cf08c6172e1e939c8bc11b86930192ed648237e9499bee652d763a7aacdd9",
    "tokens.css": "fe9fbcd67c5cf8745311bfb101ae66a754f99ed954ffb5495ff0885814efadd9",
    "elemente.json": "d242d6137448967ef5ad9112fd876a55335a46553177ea88bfc904aa156540ed",
    "ERWARTUNG.json": "db30743aad4d79c4494b99a6a150b2deef4c9794a447402edcad880b22b6ac11",
    "KLICKFOLGE.jsonl": "074de7db0d6040cc5e3fa9811100e57c25c4008715b30b8a5c546314cf57886a"
  },
  "projection": "00b4c240879ca1cd770f6ee5b22c6f10f90aebe213fa8629fcbaec5480123172",
  "manifest": "88c7e1610d1831aa8148798866c27521ad9dd940751888da74c34f798bf5ca4f"
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
  +'export const V45_MANIFEST_SHA = '+JSON.stringify(SOURCE_BINDING.manifest)+';\n'
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
  const manifestBytes=readFileSync(resolve(source,'HASHES.txt'));
  if(digest(manifestBytes)!==SOURCE_BINDING.manifest)throw Error('V45_FROZEN_MANIFEST_CHANGED');
  const manifest=verifySourceManifest(manifestBytes.toString('utf8'),name=>readFileSync(resolve(source,name)));
  console.log('V45_FROZEN_FILES_VERIFIED '+manifest.size);
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
