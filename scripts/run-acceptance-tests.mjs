import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// PL04:01: immutable worker/tenant per bounded group, unchanged scenarios and timeouts.
const cli=resolve('node_modules/vitest/vitest.mjs');
const isolated=['src/test/acceptance/storage_letter.integration.test.ts','src/test/acceptance/dispatch_call.integration.test.ts'];
const flags=['--maxWorkers=1','--no-file-parallelism'];
const started=Date.now();
let failed=false;
function execute(args,capture=false){
 const result=spawnSync(process.execPath,[cli,...args],{stdio:capture?['ignore','pipe','pipe']:'inherit',encoding:'utf8',maxBuffer:16*1024*1024});
 if(result.error)throw result.error;
 if(result.status!==0){if(capture)process.stderr.write(result.stderr??'');throw Error('ACCEPTANCE_CHILD_FAILED:'+result.status);}
 return result.stdout;
}
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
if(!process.argv.includes('--isolated-only')){
 try{execute(['run','src/test/acceptance/',...isolated.flatMap(file=>['--exclude',file]),...flags]);}catch(error){failed=true;console.error(error.message);}
}
for(const file of isolated){
 const rows=JSON.parse(execute(['list',file,'--json'],true));
 if(!Array.isArray(rows)||!rows.length||rows.some(row=>typeof row.name!=='string'||resolve(row.file)!==resolve(file)))throw Error('ACCEPTANCE_CASE_INVENTORY_INVALID');
 const names=rows.map(row=>row.name);
 if(new Set(names).size!==names.length)throw Error('ACCEPTANCE_CASE_NAMES_AMBIGUOUS');
 for(let offset=0;offset<names.length;offset+=6){
  const selected=names.slice(offset,offset+6);
  const pattern='^(?:'+selected.map(escape).join('|')+')$';
  if(names.filter(name=>new RegExp(pattern).test(name)).length!==selected.length)throw Error('ACCEPTANCE_CASE_PARTITION_INVALID');
  console.log(`ACCEPTANCE_GROUP ${file} ${offset+1}-${offset+selected.length}/${names.length}`);
  try{execute(['run',file,'--testNamePattern',pattern,...flags]);}catch(error){failed=true;console.error(error.message);}
 }
}
console.log(`ACCEPTANCE_TOTAL_SECONDS=${((Date.now()-started)/1000).toFixed(2)}`);
process.exitCode=failed?1:0;
