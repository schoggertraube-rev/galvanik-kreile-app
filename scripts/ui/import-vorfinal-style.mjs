import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const source='_review/quellen/vorfinal_2026-11-19/app/v10.html';
const legacy='docs/project/endversion/ui/endversion_design.css';
const output='src/ui/generated/vorfinalCss.json';
const oldOutput='src/ui/generated/legacyStyle.json';
const manifest='src/ui/generated/vorfinalStyle.json';
const iconOutput='src/ui/generated/vorfinalIcons.json';
const hash=value=>createHash('sha256').update(value).digest('hex');

/** Copy style bodies in document order; no reformatting, palette change or script. */
export function extractVorfinalStyles(html){
 const blocks=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/giu)].map(match=>match[1]);
 if(blocks.length!==4)throw Error('VORFINAL_STYLE_SOURCE_INCOMPLETE');
 return {blocks,css:blocks.join('\n')};
}
export function checkStyleArtifact(css,expectedHash){
 if(hash(css)!==expectedHash)throw Error('VORFINAL_STYLE_ARTIFACT_CHANGED');
}
/** Read the static P literals; never execute the source's demo application. */
export function extractVorfinalIcons(script){
 const tree=ts.createSourceFile('v10.js',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),icons={};
 const put=(key,node)=>{
  if(!ts.isStringLiteral(node)||Object.hasOwn(icons,key))throw Error('VORFINAL_ICON_LITERAL_REQUIRED');
  icons[key]=node.text;
 };
 const visit=node=>{
  if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='P'){
   if(!node.initializer||!ts.isObjectLiteralExpression(node.initializer))throw Error('VORFINAL_ICON_LITERAL_REQUIRED');
   for(const prop of node.initializer.properties){
    if(!ts.isPropertyAssignment(prop))throw Error('VORFINAL_ICON_LITERAL_REQUIRED');
    put(prop.name.getText(tree).replace(/^['"]|['"]$/gu,''),prop.initializer);
   }
  }
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken
   &&ts.isPropertyAccessExpression(node.left)&&node.left.expression.getText(tree)==='P')put(node.left.name.text,node.right);
  ts.forEachChild(node,visit);
 };
 visit(tree);return icons;
}
function main(){
 const check=process.argv.includes('--check');
 if(check){
  const binding=JSON.parse(readFileSync(manifest,'utf8'));
  checkStyleArtifact(JSON.parse(readFileSync(output,'utf8')).css,binding.cssSha256);
  checkStyleArtifact(JSON.parse(readFileSync(oldOutput,'utf8')).css,binding.legacySha256);
  checkStyleArtifact(readFileSync(iconOutput),binding.iconsSha256);
 }else{
  const raw=readFileSync(source),old=readFileSync(legacy);
  const {blocks,css}=extractVorfinalStyles(raw.toString('utf8'));
  const script=/<script>([\s\S]*?)<\/script>/iu.exec(raw.toString('utf8'))?.[1];
  if(!script)throw Error('VORFINAL_SCRIPT_SOURCE_MISSING');
  const icons=extractVorfinalIcons(script);
  if(!icons.arrow||!icons.plus||!icons.send||!icons.lager)throw Error('VORFINAL_ICON_SOURCE_INCOMPLETE');
  const iconArtifact=JSON.stringify(icons,null,2)+'\n';
  const binding={source,sourceSha256:hash(raw),styleBlocks:blocks.map(hash),cssSha256:hash(css),legacySha256:hash(old),iconsSha256:hash(iconArtifact)};
  for(const [file,value] of [[output,JSON.stringify({css})+'\n'],[oldOutput,JSON.stringify({css:old.toString('utf8')})+'\n'],[iconOutput,iconArtifact],[manifest,JSON.stringify(binding,null,2)+'\n']]){
   mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value);
  }
 }
 console.log('S18_VORFINAL_STYLE '+(check?'PASS':'COPIED_EXACT'));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
