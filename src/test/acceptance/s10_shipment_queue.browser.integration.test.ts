// @vitest-environment node
// Actual native browser/IDB/HTTP/Auth/Actions/DB. The HTML is only a transport
// bridge, not an application cold-start/24h/device-permission claim.
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'esbuild';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
import {getManualShippingAction} from '@/app/actions/orders.actions';
import {COOKIE_NAME,signAppSession,getSecretKey} from '@/lib/server/appSession';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {POST} from '@/app/api/offline/replay/route';
it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('S10 actual shipment original survives response loss, foreign login and reload until its own group proof is acknowledged',async()=>{
 const order=await readyInvoiceOrder('TEST S10 native queue','shipping');await manualTrackingFixture(order.orderId);
 const read=await withSession(full,()=>getManualShippingAction({orderId:order.orderId}));if(read.code!=='OK')throw Error('TEST_S10_NATIVE_GROUP');
 const group=read.data.shipmentGroups[0],input={orderId:order.orderId,groupId:group.id,expectedGroupVersion:group.version,clientEventId:randomUUID(),members:[{orderId:order.orderId,expectedVersion:order.version}]};
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 const compiled=await build({stdin:{contents:"export * from './src/lib/offline/pendingStore';export {syncOriginals} from './src/lib/offline/syncOriginals';export {queueShipmentGroupCommand} from './src/lib/offline/queueFinancialCommand';",resolveDir:process.cwd()},external:['@/app/actions/*','@/modules/eingang/public'],bundle:true,write:false,format:'esm',platform:'browser'});
 const other=await createFixture(['auftraege'],'werkstatt');let actor=full,lose=true;
 const effects:string[]=[];
 const server=createServer(async(req,res)=>{
  if(req.url==='/queue.mjs'){res.writeHead(200,{'content-type':'text/javascript'});res.end(compiled.outputFiles[0].text);return;}
  if(req.url==='/api/offline/replay'){
   try{
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const headers=Object.fromEntries(Object.entries(req.headers).filter((row):row is [string,string|string[]]=>row[1]!==undefined).map(([key,value])=>[key,Array.isArray(value)?value.join(','):value]));
    const reply=await withRequest(headers.cookie??'',()=>POST(new Request('http://'+req.headers.host+req.url,{method:'POST',headers,body:Buffer.concat(chunks)})),false,headers);
    const body=await reply.text(),parsed=JSON.parse(body);
    if(parsed.code==='OK'){effects.push(parsed.receipt.eventId);if(lose){lose=false;res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({code:'UNAVAILABLE'}));return;}}
    res.writeHead(reply.status,{'content-type':'application/json','cache-control':'no-store'});res.end(body);
   }catch(error){console.error('TEST_S10_NATIVE_HTTP',error instanceof Error?error.message:'UnknownError');res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({code:'UNAVAILABLE'}));}return;
  }
  const cookie=signAppSession({userId:actor.actorId,tenantId:KREILE_TENANT_SLUG,role:actor.role,displayName:'TEST S10 actor',issuedAt:actor.actorIssuedAt,expiresAt:Date.now()+300000},getSecretKey());
  res.writeHead(200,{'content-type':'text/html','cache-control':'no-store','set-cookie':`${COOKIE_NAME}=${cookie}; HttpOnly; Path=/; SameSite=Lax`});res.end('<!doctype html><title>TEST S10 queue transport</title>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_S10_NATIVE_LOOPBACK');
 const execute=promisify(execFile),session='TEST-s10-group-'+randomUUID(),url=`http://127.0.0.1:${address.port}/TEST`;
 const cli=async(args:string[])=>{const result=await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90000,maxBuffer:1048576});if(result.stdout.includes('### Error'))throw Error('TEST_S10_NATIVE_BROWSER:'+result.stdout.slice(0,2200));return result;};
 const setup=`async()=>{window.p=await import('/queue.mjs');window.acks=[];window.addEventListener('kreile-workshop-acknowledged',event=>acks.push(event.detail));return true;}`;
 try{
  await cli(['open',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await p.queueShipmentGroupCommand('${scope}',{command:'shipment.handover',input:${JSON.stringify(input)}},()=>'${scope}');const pending=await p.readPendingEntries('${scope}');if(result.code!=='UNAVAILABLE'||pending.length!==1||acks.length)throw Error('TEST_RESPONSE_LOSS_WAS_ACKNOWLEDGED');if(p.isPendingWorkshopAcknowledgement('${scope}',pending[0],{code:'OK'}))throw Error('TEST_GENERIC_OK_WAS_PROOF');return true;}`]);
  expect(effects).toHaveLength(1);
  expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'abgeholt'}]);
  actor=other;await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{await p.syncOriginals('${scope}',()=>'${scope}');if((await p.readPendingEntries('${scope}')).length!==1||acks.length)throw Error('TEST_FOREIGN_LOGIN_CONSUMED_ORIGINAL');return true;}`]);
  actor=full;await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const pending=await p.readPendingEntries('${scope}');if(pending.length!==1)throw Error('TEST_RELOAD_LOST_ORIGINAL');const original=pending[0];await p.syncOriginals('${scope}',()=>'${scope}');if((await p.readPendingEntries('${scope}')).length||acks.length!==1||!p.isPendingWorkshopAcknowledgement('${scope}',original,acks[0].result)||acks[0].result.receipt.offlineOriginal.deviceCapturedAt!==original.deviceCapturedAt)throw Error('TEST_REAL_GROUP_ACK_MISSING');return true;}`]);
  expect(effects).toHaveLength(2);expect(new Set(effects).size).toBe(1);
  const [time]=await sql`SELECT event.payload->'receipt'->'offlineOriginal'->>'actorId' AS actor, event.payload->'receipt'->'offlineOriginal'->>'deviceCapturedAt' AS original_time,
   shipment.shipped_at=(event.payload->'receipt'->'offlineOriginal'->>'deviceCapturedAt')::timestamptz AS same_time
   FROM public.events event JOIN public.shipments shipment ON shipment.tenant_id=event.tenant_id AND shipment.order_id=event.order_id
   WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.client_event_id=${input.clientEventId}::uuid`;
  expect(time).toMatchObject({actor:full.actorId,same_time:true});expect(Number.isFinite(Date.parse(time.original_time))).toBe(true);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid AND event_type='SHIPMENT_GROUP_HANDED_OVER_V1'`).toEqual([{n:1}]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId} AND event_type LIKE 'ORDER_PICKED_UP_V%'`).toEqual([{n:1}]);
 }finally{try{await cli(['close']);}finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}}
});
