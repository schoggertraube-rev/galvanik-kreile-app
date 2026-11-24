import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {assertProjectionBinding,projectRuntime,verifySourceManifest} from '../generate-v45-runtime.mjs';

const output=resolve('src/ui/generated/v45Texte.generated.ts');
const source=resolve('_review/quellen/endversion_V45');
const patchSource=resolve('_review/NACHTRAG_PL.json');
const digest=value=>createHash('sha256').update(value).digest('hex');
// PL19.11.13:30: frozen V45 plus the authoritative text amendments, never edit V45.
export const PATCH_SOURCE_SHA='5e61500e8fe2ebc88caaca9866b4c43a5a16bac0b87d531227d585a5f197402b';
const PATCH_PROJECTION_SHA='d913f6c987d05826e45e9980735cad391a0696ee5d529eaa4154afa53cbed3a0';
const keyPattern=/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*$/u;
export function textParameters(text){
 if(typeof text!=='string'||text.normalize('NFC')!==text)throw Error('V45_TEXT_UTF8_NFC_REQUIRED');
 const keys=[...new Set([...text.matchAll(/\{([\p{L}_][\p{L}\p{N}_]*)\}/gu)].map(match=>match[1]))];
 if(/[{}]/u.test(text.replace(/\{([\p{L}_][\p{L}\p{N}_]*)\}/gu,'')))throw Error('V45_TEXT_PLACEHOLDER_INVALID');
 return keys;
}
export function projectTextAmendments(value,original){
 if(!value||!Array.isArray(value.nachtraege)||!Array.isArray(value.arbeitsliste))throw Error('V45_TEXT_AMENDMENTS_INVALID');
 const rows=new Map();
 for(const row of [...value.nachtraege,...value.arbeitsliste]){
  if(typeof row.id!=='string'||!row.dom||typeof row.dom.texte!=='object'||row.dom.texte===null)throw Error('V45_TEXT_AMENDMENT_ROW_INVALID');
  for(const [raw,change] of Object.entries(row.dom.texte)){
   let key=raw.replace(/ \(neu\)$/u,''),text=change?.neu;
   if(!keyPattern.test(key)){
    // N-5 is a reference to order.photo, not another text key or a new sentence.
    const ref=typeof text==='string'?text.match(/^(.*) \(Text von ([a-zA-Z][a-zA-Z0-9_.]*)\)$/u):null;
    if(!ref||original?.[ref[2]]?.text!==ref[1])throw Error('V45_TEXT_AMENDMENT_REFERENCE_INVALID:'+raw);
    key=ref[2];text=ref[1];
   }
   if(!change||!Object.hasOwn(change,'neu')||(text!==null&&typeof text!=='string'))throw Error('V45_TEXT_AMENDMENT_KEY_INVALID:'+raw);
   if(text!==null)textParameters(text);
   if(rows.has(key)&&rows.get(key).text!==text)throw Error('V45_TEXT_AMENDMENT_CONFLICT:'+key);
   rows.set(key,{key,text,source:row.id});
  }
 }
 return [...rows.values()].sort((a,b)=>a.key.localeCompare(b.key,'en'));
}
export function compileTextContract(original,amendments){
 if(!original||typeof original!=='object'||Array.isArray(original)||!Object.keys(original).length)throw Error('V45_TEXT_SCHEMA_INVALID');
 const texts=new Map();
 for(const [key,row] of Object.entries(original)){
  if(!keyPattern.test(key)||!row||typeof row.text!=='string')throw Error('V45_TEXT_SCHEMA_INVALID:'+key);
  textParameters(row.text);texts.set(key,row.text);
 }
 for(const row of amendments){if(row.text===null)texts.delete(row.key);else texts.set(row.key,row.text);}
 const identifiers=new Map();
 return [...texts.entries()].sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,text])=>{
  // '$' is a legal identifier character and absent from source keys: dots and
  // existing underscores remain distinguishable (out.ready.shipping / ready_shipping).
  const identifier=key.replaceAll('.','$');
  if(identifiers.has(identifier))throw Error('V45_TEXT_IDENTIFIER_COLLISION:'+key+':'+identifiers.get(identifier));
  identifiers.set(identifier,key);
  return {key,identifier,text,parameters:textParameters(text)};
 });
}
export function renderTextCatalog(original,amendments){
 const rows=compileTextContract(original,amendments),quote=JSON.stringify;
 return '// erzeugt – nicht von Hand ändern; scripts/ui/import-v45-texte.mjs\n'
  +'// V45_HASHES + PL19.11.13:30 NACHTRAG; existing runtime name projection unchanged.\n'
  +'// Text-only output: components do not import the multi-megabyte rule/click projection.\n'
  +'export const V45_TEXT_EFFECTIVE_SHA = '+quote(digest(JSON.stringify(rows)))+';\n'
  +'export const V45_TEXT_PATCH_SOURCE_SHA = '+quote(PATCH_SOURCE_SHA)+';\n'
  +'export const V45_TEXT_AMENDMENTS = '+JSON.stringify(amendments,null,2)+' as const;\n'
  +'export const V45_TEXT_KEYS = '+JSON.stringify(rows.map(row=>row.key),null,2)+' as const;\n'
  +'export type V45TextKey = typeof V45_TEXT_KEYS[number];\n'
  +'export const V45_TEXT_TEMPLATES:Readonly<Record<V45TextKey,string>> = /* @__PURE__ */ Object.freeze('+JSON.stringify(Object.fromEntries(rows.map(row=>[row.key,row.text])),null,2)+');\n'
  +'type ExactArguments<E,A extends E> = A & Record<Exclude<keyof A,keyof E>,never>;\n'
  +'function render(key:V45TextKey,values:Readonly<Record<string,string>>,expected:readonly string[]):string{\n'
  +" if(Object.keys(values).length!==expected.length||expected.some(name=>!Object.hasOwn(values,name)||typeof values[name]!=='string'))throw Error('V45_TEXT_ARGUMENTS_INVALID:'+key);\n"
  +' return V45_TEXT_TEMPLATES[key].replace(/\\{([\\p{L}_][\\p{L}\\p{N}_]*)\\}/gu,(_match,name:string)=>values[name]);\n}\n'
  +'export const V45_TEXT = /* @__PURE__ */ Object.freeze({\n'
  +rows.map(row=>{
   if(!row.parameters.length)return ' '+row.identifier+':V45_TEXT_TEMPLATES['+quote(row.key)+'],';
   const shape='{'+row.parameters.map(name=>'readonly '+quote(name)+':string').join(';')+'}';
   return ' '+row.identifier+':<A extends '+shape+'>(values:ExactArguments<'+shape+',A>)=>render('+quote(row.key)+',values,'+quote(row.parameters)+'),';
  }).join('\n')+'\n});\n';
}

function readBoundProjection(){
 const saved=readFileSync('src/ui/v45.generated.ts','utf8');
 const read=pattern=>{const match=saved.match(pattern);if(!match)throw Error('V45_TEXT_PROJECTION_MISSING');return JSON.parse(match[1]);};
 const projected=read(/export const V45_PROJECTED_TEXT = ([\s\S]*?) as const;\n/);
 const hashes=read(/export const V45_SOURCE_HASHES = ([\s\S]*?) as const;\n/);
 const preview=read(/export const V45_PREVIEW_SHA = ("[a-f0-9]+")/);
 assertProjectionBinding(projected,hashes,preview);
 return {original:JSON.parse(projected.texte),hashes};
}
export function assertTextKeys(actual,expected){
 if(actual.length!==expected.length||new Set(actual).size!==actual.length||actual.some((key,index)=>key!==expected[index]))throw Error('V45_TEXT_KEYS_MISMATCH');
}
export function assertGeneratedCatalog(saved,expected,keys){
 const match=saved.match(/export const V45_TEXT_KEYS = ([\s\S]*?) as const;\n/);
 if(!match)throw Error('V45_TEXT_KEYS_MISSING');
 assertTextKeys(JSON.parse(match[1]),keys);
 if(saved!==expected)throw Error('V45_TEXT_GENERATED_DIFF');
}
export function renderLegacyComparison(catalog,rows){
 const tree=ts.createSourceFile('situationCatalog.ts',catalog,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const entries=[];
 const walk=(node,path)=>{
  if(ts.isPropertyAssignment(node))return walk(node.initializer,path+'.'+node.name.getText(tree).replace(/^['"]|['"]$/gu,''));
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){entries.push({path,text:node.text});return;}
  ts.forEachChild(node,child=>walk(child,path));
 };
 for(const stmt of tree.statements)if(ts.isVariableStatement(stmt)&&stmt.modifiers?.some(mod=>mod.kind===ts.SyntaxKind.ExportKeyword))for(const decl of stmt.declarationList.declarations)if(ts.isIdentifier(decl.name)&&decl.initializer)walk(decl.initializer,decl.name.text);
 const groups={same:[],similar:[],only:[]};
 const normalize=text=>text.normalize('NFC').toLocaleLowerCase('de').replace(/\{[^}]+\}/gu,'{}').replace(/[^\p{L}\p{N}{}]+/gu,' ').trim();
 const exactIndex=new Map(),similarIndex=new Map();
 for(const row of rows)for(const [index,key] of [[exactIndex,row.text],[similarIndex,normalize(row.text)]]){
  const matches=index.get(key)??[];matches.push(row.key);index.set(key,matches);
 }
 for(const entry of entries){
  const exact=exactIndex.get(entry.text)??[];
  if(exact.length){groups.same.push({...entry,matches:exact});continue;}
  const similar=similarIndex.get(normalize(entry.text))??[];
  groups[similar.length?'similar':'only'].push({...entry,matches:similar});
 }
 return '# S15 mechanischer Textabgleich\n\nErzeugt; keine semantische Zuordnung. Funktionsliterale sind einzelne Fragmente.\n'
  +'Ähnlich = NFC/Kleinschreibung/Interpunktion/Platzhalternamen mechanisch normalisiert. Bestand bleibt unverändert.\n\n'
  +Object.entries(groups).map(([kind,items])=>'## '+({same:'Gleicher Wortlaut',similar:'Ähnlicher Wortlaut',only:'Nur im Bestand'}[kind])+' ('+items.length+')\n\n'+items.map(item=>'- `'+item.path+'`: '+JSON.stringify(item.text)+(item.matches.length?' → '+item.matches.map(key=>'`'+key+'`').join(', '):'')).join('\n')+'\n').join('\n');
}
function main(){
 const ci=process.argv.includes('--check-generated'),check=ci||process.argv.includes('--check');
 const {original,hashes}=readBoundProjection();let amendments;
 if(ci){
  const saved=readFileSync(output,'utf8'),match=saved.match(/export const V45_TEXT_AMENDMENTS = ([\s\S]*?) as const;\n/);
  if(!match)throw Error('V45_TEXT_AMENDMENT_ENVELOPE_INVALID');amendments=JSON.parse(match[1]);
 }else{
  const manifest=verifySourceManifest(readFileSync(resolve(source,'HASHES.txt'),'utf8'),name=>readFileSync(resolve(source,name)));
  const raw=readFileSync(resolve(source,'texte.json'));
  if(digest(raw)!==manifest.get('texte.json')||digest(raw)!==hashes['texte.json'])throw Error('V45_TEXT_FROZEN_HASH_MISMATCH');
  if(JSON.stringify(JSON.parse(projectRuntime({texte:raw.toString('utf8')}).projected.texte))!==JSON.stringify(original))throw Error('V45_TEXT_RUNTIME_PROJECTION_MISMATCH');
  const patch=readFileSync(patchSource);if(digest(patch)!==PATCH_SOURCE_SHA)throw Error('V45_TEXT_PATCH_SOURCE_CHANGED');
  amendments=projectTextAmendments(JSON.parse(patch.toString('utf8')),original);
 }
 if(digest(JSON.stringify(amendments))!==PATCH_PROJECTION_SHA)throw Error('V45_TEXT_PATCH_PROJECTION_MISMATCH');
 const expected=renderTextCatalog(original,amendments);
 if(check){
  assertGeneratedCatalog(readFileSync(output,'utf8').replaceAll('\r\n','\n'),expected,compileTextContract(original,amendments).map(row=>row.key));
 }else{for(const [file,value] of [[output,expected]]){mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value);}}
 console.log('S15_TEXTS='+compileTextContract(original,amendments).length+' AMENDMENTS='+amendments.length+' '+(check?'PASS':'GENERATED'));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
