import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// PL04:01: immutable worker/tenant per bounded group, unchanged scenarios and timeouts.
const cli=resolve('node_modules/vitest/vitest.mjs');
const isolated=['src/test/acceptance/storage_letter.integration.test.ts','src/test/acceptance/dispatch_call.integration.test.ts',
 'src/test/acceptance/order_notification.integration.test.ts',
 'src/test/acceptance/s08b_customer_credit_payout.integration.test.ts',
 'src/test/acceptance/s08_pl2305_quote_followup.integration.test.ts'];
const flags=['--maxWorkers=1','--no-file-parallelism'];
const started=Date.now();
let failed=false;
if(process.argv.includes('--bulk-only')&&process.argv.includes('--isolated-only'))throw Error('ACCEPTANCE_PARTITION_FLAGS_CONFLICT');
function execute(args,capture=false){
 const result=spawnSync(process.execPath,[cli,...args],{stdio:capture?['ignore','pipe','pipe']:'inherit',encoding:'utf8',maxBuffer:16*1024*1024});
 if(result.error)throw result.error;
 if(result.status!==0){if(capture){process.stderr.write(result.stderr??'');process.stderr.write(result.stdout??'');}throw Error('ACCEPTANCE_CHILD_FAILED:'+result.status);}
 return result.stdout;
}
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
if(!process.argv.includes('--isolated-only')){
 try{execute(['run','src/test/acceptance/','src/modules/takt/server/__tests__/laeufe.integration.test.ts',...isolated.flatMap(file=>['--exclude',file]),...flags]);}catch(error){failed=true;console.error(error.message);}
}
if(!process.argv.includes('--bulk-only'))for(const file of isolated){
 const rows=JSON.parse(execute(['list',file,'--json'],true));
 if(!Array.isArray(rows)||!rows.length||rows.some(row=>typeof row.name!=='string'||resolve(row.file)!==resolve(file)))throw Error('ACCEPTANCE_CASE_INVENTORY_INVALID');
 const names=rows.map(row=>row.name);
 if(new Set(names).size!==names.length)throw Error('ACCEPTANCE_CASE_NAMES_AMBIGUOUS');
 // Deliberately damaged call evidence must not burden a later case in the
 // same tenant. Each call case owns a fixed worker/tenant; limits stay intact.
 // R24: newly inserted immutable malformed originals cannot be restored by
 // deleting them. Their cases each retain their own fixed worker/TEST tenant.
 const groupSize=file.endsWith('storage_letter.integration.test.ts')?6:1;
 for(let offset=0;offset<names.length;offset+=groupSize){
  const selected=names.slice(offset,offset+groupSize);
  // Vitest list uses " > " for suite boundaries; its name filter joins suites
  // with spaces. Verify the actual filtered inventory before running the group.
  const pattern='^(?:'+selected.map(name=>escape(name.replaceAll(' > ',' '))).join('|')+')$';
  const matched=JSON.parse(execute(['list',file,'--json','--testNamePattern',pattern],true));
  if(!Array.isArray(matched)||matched.length!==selected.length||matched.some(row=>resolve(row.file)!==resolve(file)||!selected.includes(row.name))||new Set(matched.map(row=>row.name)).size!==selected.length)throw Error('ACCEPTANCE_CASE_PARTITION_INVALID');
  console.log(`ACCEPTANCE_GROUP ${file} ${offset+1}-${offset+selected.length}/${names.length}`);
  try{
   const report=JSON.parse(execute(['run',file,'--testNamePattern',pattern,...flags,'--reporter=json'],true));
   if(report.numPassedTests!==selected.length||report.numFailedTests!==0)throw Error('ACCEPTANCE_CASE_EXECUTION_INCOMPLETE');
   console.log(`ACCEPTANCE_EXECUTED ${report.numPassedTests}/${selected.length}`);
  }catch(error){failed=true;console.error(error.message);}
 }
}
console.log(`ACCEPTANCE_TOTAL_SECONDS=${((Date.now()-started)/1000).toFixed(2)}`);
process.exitCode=failed?1:0;
