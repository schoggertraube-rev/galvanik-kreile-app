import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const source='_review/quellen/vorfinal_2026-11-19/app/v10.html';
const legacy='docs/project/endversion/ui/endversion_design.css';
const output='public/styles/vorfinal-v10.css';
const oldOutput='src/ui/generated/legacyStyle.json';
const manifest='src/ui/generated/vorfinalStyle.json';
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
function main(){
 const check=process.argv.includes('--check');
 if(check){
  const binding=JSON.parse(readFileSync(manifest,'utf8'));
  checkStyleArtifact(readFileSync(output),binding.cssSha256);
  checkStyleArtifact(JSON.parse(readFileSync(oldOutput,'utf8')).css,binding.legacySha256);
 }else{
  const raw=readFileSync(source),old=readFileSync(legacy);
  const {blocks,css}=extractVorfinalStyles(raw.toString('utf8'));
  const binding={source,sourceSha256:hash(raw),styleBlocks:blocks.map(hash),cssSha256:hash(css),legacySha256:hash(old)};
  for(const [file,value] of [[output,css],[oldOutput,JSON.stringify({css:old.toString('utf8')})+'\n'],[manifest,JSON.stringify(binding,null,2)+'\n']]){
   mkdirSync(dirname(file),{recursive:true});writeFileSync(file,value);
  }
 }
 console.log('S18_VORFINAL_STYLE '+(check?'PASS':'COPIED_EXACT'));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
