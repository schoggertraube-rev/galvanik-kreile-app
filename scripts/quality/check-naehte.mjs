import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import ts from 'typescript';

const root=resolve('.');
const read=path=>readFileSync(resolve(root,path),'utf8');
const parse=(path,source)=>ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const ownExport=statement=>statement.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword)??false;
const declarationNames=statement=>{
 if(ts.isVariableStatement(statement))return statement.declarationList.declarations.map(declaration=>declaration.name.getText());
 if(statement.name)return [statement.name.getText()];
 return [];
};
const diagnostics=[];
const fail=(rule,message)=>diagnostics.push(`${rule}: ${message}`);
function checkP1(source){
 const file=parse('src/ui/situationCatalog.ts',source);
 if(file.statements.some(statement=>!ts.isExportDeclaration(statement)||!statement.moduleSpecifier))fail('P1','situationCatalog enthält eine Anweisung ohne Export mit from');
}
function copyFiles(){return readdirSync(resolve(root,'src/ui')).filter(name=>name.endsWith('Copy.ts')).sort();}
function checkP2(contents){
 const graph=new Map();
 for(const [name,source] of contents){
  const file=parse(name,source),edges=[];
  for(const statement of file.statements){
   if(!ts.isImportDeclaration(statement))continue;
   const target=statement.moduleSpecifier.text;
   if(!/^\.\/[A-Za-z][A-Za-z0-9]*Copy$/.test(target))fail('P2',`${name}: fremder Import ${target}`);
   if(name==='allgemeinCopy.ts')fail('P2','allgemeinCopy importiert eine Textdatei');
   edges.push(target.slice(2)+'.ts');
  }
  graph.set(name,edges);
 }
 const visited=new Set(),active=new Set();
 function visit(name){
  if(active.has(name)){fail('P2',`Importkreis bei ${name}`);return;}
  if(visited.has(name))return;
  visited.add(name);active.add(name);
  for(const next of graph.get(name)||[])if(graph.has(next))visit(next);
  active.delete(name);
 }
 for(const name of graph.keys())visit(name);
}
function localExportNames(source,name,contents,visited=new Set()){
 if(visited.has(name)){fail('P3',`Exportkreis bei ${name}`);return [];}
 visited.add(name);
 const file=parse(name,source),names=[];
 for(const statement of file.statements){
  if(ts.isExportDeclaration(statement)){
   if(statement.exportClause&&ts.isNamedExports(statement.exportClause))for(const specifier of statement.exportClause.elements)names.push(specifier.name.text);
   else if(statement.moduleSpecifier){
    const target=statement.moduleSpecifier.text;
    const next=target.startsWith('./')?target.slice(2)+'.ts':null;
    if(!next||!contents.has(next))fail('P3',`${name}: Exportquelle ${target} nicht prüfbar`);
    else names.push(...localExportNames(contents.get(next),next,contents,new Set(visited)));
   }
  }else if(ownExport(statement))names.push(...declarationNames(statement));
 }
 return names;
}
function checkP3(contents){
 const seen=new Map();
 for(const [name,source] of contents)for(const exported of localExportNames(source,name,contents)){
  if(seen.has(exported))fail('P3',`${exported} in ${seen.get(exported)} und ${name}`);
  seen.set(exported,name);
 }
}
function moduleNames(config){
 const names=new Set();
 for(const pattern of [...config.nur_haupt,...config['codex-b']]){
  const match=pattern.match(/^src\/modules\/([^/]+)\/\*\*$/);
  if(match)names.add(match[1]);
 }
 return names;
}
function checkP4(copyNames,navigationNames,config){
 const modules=moduleNames(config);
 for(const name of copyNames){
  if(['financialAccessCopy.ts','packageSwitchCopy.ts'].includes(name))continue;
  const match=name.match(/^([a-z]+)(?:[A-Z][A-Za-z0-9]*)?Copy\.ts$/);
  if(!match||(!modules.has(match[1])&&!['allgemein','offline'].includes(match[1])))fail('P4',`Textdatei ${name} hat keinen Modulnamen`);
 }
 for(const name of navigationNames){
  const match=name.match(/^([a-z]+)\.ts$/);
  if(!match||(match[1]!=='register'&&!modules.has(match[1])))fail('P4',`Navigation ${name} hat keinen Modulnamen`);
 }
}
function checkP5(source){
 if(source===null)return;
 const file=parse('register.ts',source);
 for(const statement of file.statements){
  if(ts.isImportDeclaration(statement)||ts.isTypeAliasDeclaration(statement)||ts.isInterfaceDeclaration(statement))continue;
  const visit=node=>{
   if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))fail('P5','Navigationsregister enthält einen Zeichenkettenwert');
   ts.forEachChild(node,visit);
  };
  visit(statement);
 }
}
function checkP6(source){
 if(source===null)return;
 const file=parse('server-public.ts',source),[first,...rest]=file.statements;
 if(!first||!ts.isImportDeclaration(first)||first.moduleSpecifier.text!=='server-only'||first.importClause)fail('P6','server-public beginnt nicht mit import server-only');
 if(rest.some(statement=>!ts.isExportDeclaration(statement)||!statement.moduleSpecifier))fail('P6','server-public enthält weitere Anweisungen ohne Export mit from');
}
function namesFor(path,loader,seen=new Set()){
 if(seen.has(path))throw Error(`Exportkreis: ${path}`);
 seen.add(path);
 const file=parse(path,loader(path)),result=new Set();
 for(const statement of file.statements){
  if(ts.isExportDeclaration(statement)){
   if(statement.exportClause&&ts.isNamedExports(statement.exportClause))for(const item of statement.exportClause.elements)result.add(item.name.text);
   else if(statement.moduleSpecifier){
    const target=statement.moduleSpecifier.text;
    if(target.startsWith('.')){
     const base=path.slice(0,path.lastIndexOf('/')+1)+target.slice(2)+'.ts';
     for(const name of namesFor(base,loader,new Set(seen)))result.add(name);
    }
   }
  }else if(ownExport(statement))for(const name of declarationNames(statement))result.add(name);
 }
 return result;
}
function compareExports(base){
 const previous=path=>execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8'});
 const current=path=>read(path);
 for(const path of ['src/ui/situationCatalog.ts','src/modules/fundament/server-public.ts']){
  const before=namesFor(path,previous),after=namesFor(path,current);
  const missing=[...before].filter(name=>!after.has(name)).sort(),added=[...after].filter(name=>!before.has(name)).sort();
  console.log(`${path}: vorher ${before.size}, nachher ${after.size}, fehlend ${JSON.stringify(missing)}, neu ${JSON.stringify(added)}`);
  if(missing.length||added.length)fail('A12',`${path}: Exportnamen verschieden`);
 }
}
function selftest(){
 const config=JSON.parse(read('besitz.json'));
 const probes=[
  ()=>checkP1('export const X=1;'),
  ()=>checkP2(new Map([['allgemeinCopy.ts',"import {X} from './ordersCopy';"],['ordersCopy.ts','export const X=1;']])),
  ()=>checkP3(new Map([['ordersCopy.ts',"export * from './quotesCopy';"],['quotesCopy.ts','export const X=1;']])),
  ()=>checkP4(['wrongCopy.ts'],[],config),
  ()=>checkP5("export const routes=['/orders'];"),
  ()=>checkP6("import 'server-only'; export const X=1;"),
 ];
 for(let i=0;i<probes.length;i++){
  diagnostics.length=0;probes[i]();
  const hit=diagnostics.some(line=>line.startsWith(`P${i+1}:`));
  console.log(`P${i+1} Negativprobe: ${hit?'rot wie erwartet':'FEHLER'}`);
  if(!hit)process.exitCode=1;
 }
}
if(process.argv.includes('--selftest'))selftest();
else{
 const copies=copyFiles(),contents=new Map(copies.map(name=>[name,read('src/ui/'+name)]));
 const navigationDir=resolve(root,'src/ui/navigation');
 const navigation=existsSync(navigationDir)?readdirSync(navigationDir).filter(name=>name.endsWith('.ts')&&!name.endsWith('.test.ts')):[];
 const config=JSON.parse(read('besitz.json'));
 checkP1(read('src/ui/situationCatalog.ts'));checkP2(contents);checkP3(contents);checkP4(copies,navigation,config);
 checkP5(existsSync(resolve(navigationDir,'register.ts'))?read('src/ui/navigation/register.ts'):null);
 checkP6(existsSync(resolve(root,'src/modules/fundament/server-public.ts'))?read('src/modules/fundament/server-public.ts'):null);
 const index=process.argv.indexOf('--exporte');if(index>=0)compareExports(process.argv[index+1]);
 if(diagnostics.length){for(const line of diagnostics)console.error(line);process.exitCode=1;}
 else console.log(`Nähte P1–P6 grün; ${copies.length} Textdateien, ${navigation.length} Navigationsdateien`);
}
