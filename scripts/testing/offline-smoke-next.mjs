// Isolated U292 TEST server. The real Next app and its auth/rights/DB readers
// run unchanged; only the single compiled tenant constant is a TEST fixture.
import {AsyncLocalStorage} from 'node:async_hooks';
import postgres from 'postgres';
import {build} from 'esbuild';
import {createServer,get,request as httpRequest} from 'node:http';
import {writeFile,readFile,unlink,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {createServer as createControlServer} from 'node:net';

const root=process.cwd(),tenant=process.env.KREILE_SMOKE_TENANT,actor=process.env.KREILE_SMOKE_ACTOR;
globalThis.AsyncLocalStorage=AsyncLocalStorage;
const database=process.env.DATABASE_URL,secret=process.env.APP_SESSION_SECRET;
if(process.env.KREILE_OFFLINE_SMOKE!=='1'||!tenant?.startsWith('TEST-ablauf-')||!actor||! /^[a-f0-9-]{36}$/i.test(actor)||!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/postgres'||!secret)throw Error('OFFLINE_SMOKE_OWN_TEST_ONLY');
if(!process.argv.includes('--restore-flag')){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname!=='127.0.0.1')throw Error('OFFLINE_SMOKE_OWN_STORAGE_ONLY');
 const nativeFetch=globalThis.fetch;globalThis.fetch=(input,init)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!['127.0.0.1','localhost'].includes(url.hostname))return Promise.reject(Error('TEST_EXTERNAL_PROVIDER_NOT_EXPECTED'));return nativeFetch(input,init);};
}
const sql=postgres(database,{max:2,prepare:false});
if(!process.argv.includes('--restore-flag'))console.error('TEST_OFFLINE_STAGE_START');
const hash=value=>createHash('sha256').update(value).digest('hex');
async function restore(proof){
 if(proof.tenant!==tenant||proof.actor!==actor)throw Error('OFFLINE_SMOKE_FLAG_PROVENANCE');
 await sql`UPDATE public.feature_flags SET enabled=${proof.flag.enabled},roles_allowed=${proof.flag.roles_allowed}::text[] WHERE id='offline_24h'`;
 if(proof.configHash){
  let generated;try{generated=await readFile(path.join(root,'next.config.mjs'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(generated){if(hash(generated)!==proof.configHash)throw Error('OFFLINE_SMOKE_GENERATED_CONFIG_CHANGED');await unlink(path.join(root,'next.config.mjs'));}
  if(hash(await readFile(path.join(root,'next.config.ts')))!==proof.canonicalConfigHash)throw Error('OFFLINE_SMOKE_CANONICAL_CONFIG_CHANGED');
 }
}
if(process.argv.includes('--restore-flag')){
 const proof=JSON.parse(await readFile(path.join(root,'.git/kreile-s06-smoke-flag-before.json'),'utf8'));
 try{await restore(proof);}finally{await sql.end({timeout:5});}
 process.exit(0);
}
const tenantFile=path.join(root,'.git/kreile-s06-smoke-tenant.ts');
await writeFile(tenantFile,`export const KREILE_TENANT_SLUG: string = ${JSON.stringify(tenant)};export type TenantSlug=string;\n`);
await writeFile(path.join(root,'.git/kreile-s06-smoke-tsconfig.json'),JSON.stringify({extends:'../tsconfig.json',include:['../next-env.d.ts','../src/**/*.ts','../src/**/*.tsx','../.next/s06-smoke/types/**/*.ts']},null,2));
await build({stdin:{contents:"export {signAppSession,COOKIE_NAME,cacheScopeFromCredential} from './src/lib/server/appSession';export {CACHE_SCOPE_COOKIE} from './src/lib/offline/cacheScopeMarker';export {offlinePartition} from './src/lib/server/offlinePartition';",resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:path.join(root,'.git/kreile-s06-smoke-session.cjs'),alias:{'@/lib/tenant':tenantFile},plugins:[{name:'TEST-server-only-pure-helper',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'TEST-pure-helper'}));b.onLoad({filter:/.*/,namespace:'TEST-pure-helper'},()=>({contents:'',loader:'js'}));}}]});
console.error('TEST_OFFLINE_STAGE_SESSION_BUNDLE');
const probe=await build({stdin:{contents:"export {readDeviceStandResponse,readDevicePortResponse} from './src/lib/offline/devicePortRead';export {searchDeviceStand} from './src/lib/offline/searchDeviceStand';export {capturePendingItemFinished,readPendingEntries} from './src/lib/offline/pendingStore';",resolveDir:root},bundle:true,platform:'browser',format:'esm',write:false,loader:{'.css':'empty','.module.css':'empty'}});
console.error('TEST_OFFLINE_STAGE_BROWSER_BUNDLE');
const require=createRequire(import.meta.url),{signAppSession,COOKIE_NAME}=require(path.join(root,'.git/kreile-s06-smoke-session.cjs'));
console.error('TEST_OFFLINE_STAGE_ARTIFACTS');
const [before]=await sql`SELECT enabled,roles_allowed FROM public.feature_flags WHERE id='offline_24h'`;
if(!before)throw Error('OFFLINE_SMOKE_EXISTING_FLAG_REQUIRED');
if(before.enabled!==false)throw Error('OFFLINE_SMOKE_FLAG_MUST_START_OFF');
const proof={tenant,actor,flag:before};
await writeFile(path.join(root,'.git/kreile-s06-smoke-flag-before.json'),JSON.stringify(proof));
let app,server,control,closing=false,ready=false,outage=false,dropped=new Set();
async function close(){if(closing)return;closing=true;try{if(control)await new Promise(resolve=>control.close(resolve));if(server?.listening)await new Promise(resolve=>server.close(resolve));if(app)await app.close();}finally{await restore(proof);await sql.end({timeout:5});}}
process.once('SIGINT',()=>{void close().finally(()=>process.exit());});process.once('SIGTERM',()=>{void close().finally(()=>process.exit());});
try{
 await sql.begin(async tx=>{
  await tx`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,created_at,updated_at) VALUES(${actor}::uuid,${tenant},${'TEST-offline-'+actor+'@local.invalid'},'TEST Offline Smoke','meister',true,now()-interval '10 seconds',now()-interval '10 seconds')`;
  await tx`INSERT INTO public.app_user_rights(tenant_id,user_id,bereich,granted_by) SELECT ${tenant},${actor}::uuid,area,${actor}::uuid FROM unnest(ARRAY['auftraege','kunden']::text[]) area`;
  await tx`UPDATE public.feature_flags SET enabled=true,roles_allowed=ARRAY['meister']::text[] WHERE id='offline_24h'`;
 });
 console.error('TEST_OFFLINE_STAGE_FIXTURE');
 const configBuild=await build({entryPoints:[path.join(root,'next.config.ts')],bundle:false,platform:'node',format:'cjs',write:false});
 await writeFile(path.join(root,'.git/kreile-s06-smoke-next-config.cjs'),configBuild.outputFiles[0].text);
 for(const name of ['next.config.js','next.config.mjs']){let exists=true;try{await access(path.join(root,name));}catch{exists=false;}if(exists)throw Error('OFFLINE_SMOKE_FOREIGN_CONFIG_EXISTS');}
 const canonical=await readFile(path.join(root,'next.config.ts'));
 // Next16 custom-server prepare ignores options.conf. Use a generated public
 // config overlay for this TEST process only; canonical config is never edited.
 const generated=`import compiled from './.git/kreile-s06-smoke-next-config.cjs';const base=compiled.default;export default {...base,distDir:'.next/s06-smoke',typescript:{...base.typescript,tsconfigPath:'.git/kreile-s06-smoke-tsconfig.json'},webpack(config,context){const cfg=base.webpack?base.webpack(config,context):config;cfg.resolve.alias['@/lib/tenant']=${JSON.stringify(tenantFile)};cfg.resolve.alias[${JSON.stringify(path.join(root,'src/lib/tenant.ts'))}]=${JSON.stringify(tenantFile)};return cfg;}};\n`;
 proof.configHash=hash(generated);proof.canonicalConfigHash=hash(canonical);
 await writeFile(path.join(root,'.git/kreile-s06-smoke-flag-before.json'),JSON.stringify(proof));
 await writeFile(path.join(root,'next.config.mjs'),generated,{flag:'wx'});
 const {default:next}=await import('next');
 app=next({dev:true,dir:root,hostname:'127.0.0.1',port:3001,webpack:true});
 console.error('TEST_OFFLINE_STAGE_PREPARE');await app.prepare();console.error('TEST_OFFLINE_STAGE_PREPARED');const handle=app.getRequestHandler();
 server=createServer((req,res)=>{if(outage){dropped.add(req.method+' '+req.url);req.socket.destroy();return;}if(req.url==='/__TEST/ready'){res.writeHead(ready?200:503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ready}));return;}if(req.url==='/__TEST/offline-probe.mjs'){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(probe.outputFiles[0].text);return;}void handle(req,res);});
 await new Promise(resolve=>server.listen(3001,'127.0.0.1',resolve));
 console.error('TEST_OFFLINE_STAGE_LISTEN');
 const token=signAppSession({userId:actor,tenantId:tenant,role:'meister',displayName:'TEST Offline Smoke',issuedAt:Date.now(),expiresAt:Date.now()+30*60_000},secret);
 // Warm the actual authenticated page, never fixture HTML. No token is saved.
 console.error('TEST_OFFLINE_STAGE_WARM');
 // Control-plane request must not use the global fetch patched by Next while
 // rendering this same app. Native HTTP stays strictly on the literal loopback.
 const warm=await new Promise((resolve,reject)=>{const request=get('http://localhost:3001/customers',{headers:{cookie:`${COOKIE_NAME}=${token}`}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(Buffer.from(chunk)));response.on('end',()=>resolve({status:response.statusCode,html:Buffer.concat(chunks).toString('utf8')}));response.on('error',reject);});request.on('error',reject);});
 if(warm.status!==200||!warm.html.includes('TEST Offline Smoke'))throw Error('OFFLINE_SMOKE_REAL_PAGE_WARM_FAILED');
 // Compile the actual required API routes inside the same 6-minute budget.
 // Invalid input is deliberate: this warm-up must never execute a command.
 const replayWarm=await new Promise((resolve,reject)=>{const request=httpRequest('http://localhost:3001/api/offline/replay',{method:'POST',headers:{cookie:`${COOKIE_NAME}=${token}`,origin:'http://localhost:3001','sec-fetch-site':'same-origin','content-type':'application/json'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));response.on('error',reject);});request.on('error',reject);request.end('{}');});
 if(replayWarm!==400)throw Error('OFFLINE_SMOKE_REAL_REPLAY_WARM_FAILED');
 const heartbeatWarm=await new Promise((resolve,reject)=>{const request=get('http://localhost:3001/api/offline/heartbeat',{headers:{cookie:`${COOKIE_NAME}=${token}`}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));response.on('error',reject);});request.on('error',reject);});
 if(heartbeatWarm!==204)throw Error('OFFLINE_SMOKE_REAL_HEARTBEAT_WARM_FAILED');
 ready=true;
 console.log('TEST_OFFLINE_NEXT_READY');
 if(process.argv.includes('--prepare-worker')){
  if(!process.send||!process.env.KREILE_SMOKE_CONTROL_PIPE)throw Error('OFFLINE_SMOKE_PREPARATION_OWNER_REQUIRED');
  // Next16 dev close does not await a durable compiler cache flush. Keep the
  // prepared compiler, but stop the listener before the guarded server start.
  ready=false;
  await new Promise(resolve=>server.close(resolve));
  control=createControlServer(socket=>{
   socket.setEncoding('utf8');
   socket.once('data',command=>{void(async()=>{
    // Real server connection loss also covers worker-owned WebKit fetches
    // that the browser automation's route interception does not receive.
    if(command==='offline'){outage=true;dropped.clear();socket.end('offline');return;}
    if(command==='online'){outage=false;dropped.clear();socket.end('online');return;}
    if(command==='failures'){socket.end(String(dropped.size));return;}
    if(command==='paths'){socket.end(JSON.stringify([...dropped]));return;}
    if(command!=='start'||server.listening)throw Error('OFFLINE_SMOKE_SINGLE_START_REQUIRED');
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3001,'127.0.0.1',resolve);});
    ready=true;socket.end('started');
   })().catch(error=>{console.error(error);socket.destroy();});});
  });
  await new Promise((resolve,reject)=>{control.once('error',reject);control.listen(process.env.KREILE_SMOKE_CONTROL_PIPE,resolve);});
  process.on('message',message=>{if(message==='close')void close().finally(()=>process.exit(0));});
  process.once('disconnect',()=>{void close().finally(()=>process.exit(0));});
  process.send({kind:'prepared'});
 }
}catch(error){try{await close();}finally{console.error(error);process.exit(1);}}
