// One preparation path for local/CI U292 and the later S14a caller.
// Playwright server/case budgets and workers remain unchanged.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';

if(process.env.KREILE_OFFLINE_SMOKE!=='1')throw Error('EXPLICIT_OFFLINE_SMOKE_REQUIRED');
const controlId=randomUUID();
const env={...process.env,KREILE_SMOKE_CONTROL_PIPE:process.platform==='win32'?`\\\\.\\pipe\\kreile-smoke-${controlId}`:path.resolve(`.git/kreile-smoke-${controlId}.sock`)};
const server=path.resolve('scripts/testing/offline-smoke-next.mjs');
const child=spawn(process.execPath,[server,'--prepare-worker'],{env,stdio:['ignore','inherit','inherit','ipc']});
const exited=new Promise(resolve=>child.once('exit',resolve));
const started=Date.now();
try{
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('OFFLINE_SMOKE_PREPARATION_EXCEEDED_360_SECONDS')),360_000);
   child.once('error',error=>{clearTimeout(timer);reject(error);});
   child.once('exit',code=>{clearTimeout(timer);reject(Error(`OFFLINE_SMOKE_PREPARATION_EXIT=${code}`));});
   child.on('message',message=>{if(message?.kind==='prepared'){clearTimeout(timer);resolve();}});
  });
 }finally{
  const durationMs=Date.now()-started;
  console.log(`TEST_OFFLINE_PREPARATION_DURATION_MS=${durationMs}`);
  await writeFile('.git/kreile-s06-smoke-preparation-duration.json',JSON.stringify({startedAt:new Date(started).toISOString(),durationMs}));
 }
 await new Promise((resolve,reject)=>{
  const tests=spawn(process.execPath,[path.resolve('node_modules/@playwright/test/cli.js'),'test','e2e/offline-device-smoke.real.spec.ts',...process.argv.slice(2)],{env,stdio:'inherit'});
  tests.once('error',reject);tests.once('exit',code=>code===0?resolve():reject(Error(`OFFLINE_SMOKE_CASE_EXIT=${code}`)));
 });
}finally{
 if(child.connected)child.send('close');
 const timer=setTimeout(()=>child.kill(),20_000);
 await exited;clearTimeout(timer);
 let ownProof=false;
 try{const proof=JSON.parse(await readFile('.git/kreile-s06-smoke-flag-before.json','utf8'));ownProof=proof.tenant===env.KREILE_SMOKE_TENANT&&proof.actor===env.KREILE_SMOKE_ACTOR;}
 catch(error){if(error.code!=='ENOENT')throw error;}
 // Compiler failure before fixture setup must not restore a previous run.
 if(ownProof){const cleanup=spawn(process.execPath,[server,'--restore-flag'],{env,stdio:'inherit'});
  await new Promise((resolve,reject)=>{cleanup.once('error',reject);cleanup.once('exit',code=>code===0?resolve():reject(Error('OFFLINE_SMOKE_RESTORE_FAILED')));});}
}
