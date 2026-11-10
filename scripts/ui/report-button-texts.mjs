#!/usr/bin/env node
// AP-UI-VORBEREITUNG U1: non-blocking report for newly added components.
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../..',import.meta.url));
const german=/[äöüÄÖÜß]|\b(speichern|abbrechen|weiter|zurück|laden|suchen|öffnen|schließen|bestätigen|erledigt|erledigen|anlegen|ändern|übernehmen|auswählen|prüfen|drucken|senden|löschen|erneut|hinzufügen|entfernen|abmelden|anmelden|fertig|zuordnen|verwerfen|fortsetzen)\b/iu;
function findings(source,name){
 const file=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),result=[];
 const add=(node,text,slot)=>{if(german.test(text)){const location=file.getLineAndCharacterOfPosition(node.getStart(file));result.push({file:name,line:location.line+1,slot,text:text.trim()});}};
 const literal=node=>ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)?node.text:null;
 function visit(node){
  if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
   const opening=ts.isJsxElement(node)?node.openingElement:node,tag=opening.tagName.getText(file);
   if(tag==='button'||/(?:^|\.)[A-Za-z]*Button$/.test(tag)){
    for(const property of opening.attributes.properties){
     if(!ts.isJsxAttribute(property)||!['text','label','title','aria-label'].includes(property.name.getText(file))||!property.initializer)continue;
     const initializer=property.initializer,value=ts.isJsxExpression(initializer)?initializer.expression:initializer;
     if(value){const text=literal(value);if(text!==null)add(value,text,property.name.getText(file));}
    }
    if(ts.isJsxElement(node))for(const child of node.children){
     if(ts.isJsxText(child))add(child,child.text,'children');
     else if(ts.isJsxExpression(child)&&child.expression){const text=literal(child.expression);if(text!==null)add(child.expression,text,'children');}
    }
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(file);return result;
}

if(process.argv.includes('--selftest')){
 assert.equal(findings('const C=()=> <Button text="Speichern"/>;','TEST.tsx').length,1);
 assert.equal(findings('const C=()=> <button>{"Erneut"}</button>;','TEST.tsx').length,1);
 assert.equal(findings('const C=()=> <KrButton text={SITUATION_COPY.retry}/>;','TEST.tsx').length,0);
 assert.equal(findings('const C=()=> <button>→</button>;','TEST.tsx').length,0);
 assert.equal(findings('const C=()=> <Panel title="Speichern"/>;','TEST.tsx').length,0);
 console.log('Button text report selftest: 5 isolated contracts passed; no source written.');
}else{
 if(process.argv.slice(2).length)throw Error('Usage: node scripts/ui/report-button-texts.mjs [--selftest]');
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const base=git(['rev-parse','--verify','origin/main^{commit}']),head=git(['rev-parse','HEAD']);
 const files=git(['diff','--diff-filter=A','--no-renames','--name-only',base+'...'+head,'--','src']).split('\n').filter(name=>name.endsWith('.tsx')&&!/(^|\/)(__tests__|test|tests)\//.test(name)&&! /\.(test|spec)\.tsx$/.test(name));
 const warnings=[];
 for(const name of files){
  const path=resolve(root,name);if(relative(root,path).startsWith('..'))throw Error('REPORT_PATH_OUTSIDE_REPOSITORY');
  warnings.push(...findings(readFileSync(path,'utf8'),name));
 }
 console.log(JSON.stringify({mode:'report-only',base,head,filesChecked:files.length,warnings,note:'Heuristic German literals in added button components only. No CI gate, no text replacement, no deletion. Absence of warnings is not full catalogue/V45 compliance; dynamic expressions and changed existing components require their own review.'},null,2));
}
