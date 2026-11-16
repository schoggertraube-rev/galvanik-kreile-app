// S14a uses the existing native fixture factory and the single S06 Next
// preparation path. Credentials stay in process memory, never in artifacts.
import {spawn,execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

const started=Date.now();
process.once('exit',code=>console.log(`S14A_DOM_DURATION_MS=${Date.now()-started} RESULT=${code}`));
const database=process.env.DATABASE_URL;
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/postgres')throw Error('S14A_OWN_LOOPBACK_REQUIRED');
const local=JSON.parse(execFileSync(process.execPath,[path.resolve('node_modules/supabase/dist/supabase.js'),'status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20_000}));
if(!local.API_URL||new URL(local.API_URL).hostname!=='127.0.0.1'||!local.ANON_KEY||!local.SERVICE_ROLE_KEY)throw Error('S14A_LOCAL_STORAGE_REQUIRED');
const env={...process.env,KREILE_S14A_DOM:'1',KREILE_OFFLINE_SMOKE:'1',KREILE_SMOKE_TENANT:'TEST-ablauf-s14a-'+randomUUID().slice(0,12),APP_SESSION_SECRET:randomUUID()+randomUUID(),NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:local.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY};
async function run(script,args){
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.resolve(script),...args],{env,stdio:'inherit'});
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('S14A_CHILD_EXIT:'+code)));
 });
}
await run('node_modules/vitest/vitest.mjs',['run','--config','e2e/ablauf/dom.fixture.config.ts','--maxWorkers=1','--no-file-parallelism']);
const fixture=JSON.parse(await readFile('.git/kreile-s14a-dom-fixture.json','utf8'));
if(fixture.tenant!==env.KREILE_SMOKE_TENANT||!fixture.actors?.meister?.actorId)throw Error('S14A_FIXTURE_PROVENANCE');
env.KREILE_SMOKE_ACTOR=fixture.actors.meister.actorId;
await run('scripts/testing/run-offline-smoke.mjs',process.argv.slice(2));
