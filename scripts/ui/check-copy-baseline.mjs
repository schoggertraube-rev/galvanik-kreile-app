import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectInlineCopy,isTextBaselineFile} from '../quality/eslint-ui-copy-plugin.mjs';
import {assertSafeDrizzleAny} from '../quality/drizzle-any-binding.mjs';

const path='scripts/quality/ui-copy-baseline.json';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']});
export function baselineFromTree(base){
 const files={};
 for(const name of git('ls-tree','-r','--name-only',base,'src').split(/\r?\n/u).filter(isTextBaselineFile)){
  const rows=collectInlineCopy(git('show',base+':'+name),name);
  if(rows.length){files[name]={};for(const row of rows)files[name][row.text]=(files[name][row.text]??0)+1;}
 }
 return {files};
}
export function assertBaselineShrinks(current,previous){
 if(!current||typeof current.files!=='object'||Array.isArray(current.files))throw Error('S15_BASELINE_INVALID');
 for(const [file,rows] of Object.entries(current.files)){
  if(!previous.files[file]||!isTextBaselineFile(file)||!rows||typeof rows!=='object'||!Object.keys(rows).length)throw Error('S15_BASELINE_FILE_ADDED:'+file);
  for(const [text,count] of Object.entries(rows))if(!Number.isSafeInteger(count)||count<1||count>(previous.files[file][text]??0))throw Error('S15_BASELINE_TEXT_ADDED:'+file);
 }
}
function main(){
 const index=process.argv.indexOf('--base');if(index<0||!process.argv[index+1])throw Error('S15_BASE_REQUIRED');
 const base=process.argv[index+1];git('rev-parse','--verify',base+'^{commit}');
 // The existing language/ratchet step also rejects unsafe Drizzle array binds.
 // Inspect every tracked source, including unchanged callers; no baseline escape.
 const sources=git('ls-files','-z','--','src','scripts','e2e').split('\0').filter(name=>/\.[cm]?[jt]sx?$/u.test(name));
 for(const name of sources)assertSafeDrizzleAny(readFileSync(name,'utf8'),name);
 let previous;
 if(git('ls-tree','--name-only',base,path).trim())previous=JSON.parse(git('show',base+':'+path));
 else previous=baselineFromTree(base);
 const current=JSON.parse(readFileSync(path,'utf8'));assertBaselineShrinks(current,previous);
 console.log('S15_BASELINE=PASS files='+Object.keys(current.files).length+' (shrink only)');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
