// @vitest-environment node
// TEST bridge: actual browser/IDB/HTTP route/Auth/Actions/DB/Storage.
// Explicit lost HTTP responses; no Next layout, cold-start or 24h claim.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'esbuild';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {changeOrderPickupNoticeAction} from '@/app/actions/orders.actions';
import {confirmPaymentAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {getCustomerCreditAction,cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {COOKIE_NAME,signAppSession,getSecretKey} from '@/lib/server/appSession';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {POST} from '@/app/api/offline/replay/route';

it.skipIf(!process.env.KREILE_PLAYWRIGHT_CLI_JS)('A08-11 uses one native queue for actual cancellation and credit application, delay, foreign actor, lost response and reload',async()=>{
 if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||new URL(process.env.DATABASE_URL).hostname!=='127.0.0.1')throw Error('TEST_S08_QUEUE_LOOPBACK_REQUIRED');
 const source=await readyInvoiceOrder('S08 native queue source','pickup',false,undefined,8403);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:source.invoice.invoiceId,amount:4000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const target=await readyInvoiceOrder('S08 native queue target','pickup',false,source.customerId,5042);
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 const cancellationKey=randomUUID(),applicationKey=randomUUID(),deviceCapturedAt='2026-11-01T10:00:00.000Z';
 const cancel={kind:'workshop',command:'invoice.cancel',id:cancellationKey,itemId:source.invoice.invoiceId,deviceCapturedAt,input:{invoiceId:source.invoice.invoiceId,expectedVersion:1,reason:'TEST A08-11 one actual queue',clientEventId:cancellationKey}};
 const apply={kind:'workshop',command:'credit.apply',id:applicationKey,itemId:target.invoice.invoiceId,deviceCapturedAt,input:{invoiceId:target.invoice.invoiceId,amount:4000,expectedVersion:0,expectedOpenAmountCents:6000,expectedCreditVersion:1,clientEventId:applicationKey}};
 // Plain browser bridge externalizes unused Next Action references. Financial
 // execution still goes through the actual HTTP route and its real writers.
 const compiled=await build({stdin:{contents:"export * from './src/lib/offline/pendingStore';export {syncPendingFiles} from './src/lib/offline/syncPendingFiles';export {replayOfflineWorkshopHttp} from './src/lib/offline/replayWorkshopHttp';export {queueFinancialCommand,queueHandoverCommand} from './src/lib/offline/queueFinancialCommand';",resolveDir:process.cwd()},external:['@/app/actions/*','@/modules/eingang/public'],bundle:true,write:false,format:'esm',platform:'browser'});
 const foreign=await createFixture(['geld'],'buero');let actor=full,loseResponse=true,calls=0;
 const receipts=new Map<string,string[]>();
 const server=createServer(async(req,res)=>{
  if(req.url==='/api/offline/replay'){
   try{
    calls++;const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const headers=Object.fromEntries(Object.entries(req.headers).filter((row):row is [string,string|string[]]=>row[1]!==undefined).map(([name,value])=>[name,Array.isArray(value)?value.join(','):value]));
    const response=await withRequest(headers.cookie??'',()=>POST(new Request('http://'+req.headers.host+req.url,{method:'POST',headers,body:Buffer.concat(chunks)})),false,headers);
    const body=await response.text();
    if(response.status===200){const saved=JSON.parse(body);if(saved.code==='OK'){const key=saved.offlineReceipt.clientEventId;receipts.set(key,[...(receipts.get(key)??[]),saved.offlineReceipt.eventId]);}if(loseResponse){loseResponse=false;res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({code:'UNAVAILABLE'}));return;}}
    res.writeHead(response.status,{'content-type':'application/json','cache-control':'no-store'});res.end(body);
   }catch(error){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({code:'UNAVAILABLE'}));console.error('TEST_S08_HTTP',error instanceof Error?error.message:'UnknownError');}return;
  }
  if(req.url==='/queue.mjs'){res.writeHead(200,{'content-type':'text/javascript'});res.end(compiled.outputFiles[0].text);return;}
  const token=signAppSession({userId:actor.actorId,tenantId:KREILE_TENANT_SLUG,role:actor.role,displayName:'TEST S08 actor',issuedAt:actor.actorIssuedAt,expiresAt:Date.now()+5*60_000},getSecretKey());
  res.writeHead(200,{'content-type':'text/html','set-cookie':`${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax`,'cache-control':'no-store'});res.end('<!doctype html><title>TEST S08 queue transport</title>');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('TEST_LOOPBACK');
 const execute=promisify(execFile),session='TEST-s08-queue-'+randomUUID(),url=`http://127.0.0.1:${address.port}/TEST`;
 const cli=async(args:string[])=>{const result=await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,...args],{timeout:90000,maxBuffer:1024*1024});if(result.stdout.includes('### Error'))throw Error('TEST_BROWSER_FAILED:'+result.stdout.slice(0,1800));return result;};
 const setup=`async()=>{window.p=await import('/queue.mjs');window.acks=[];window.addEventListener('kreile-workshop-acknowledged',e=>window.acks.push(e.detail));window.ports={currentScope:()=>'${scope}',workshop:(s,e)=>window.p.replayOfflineWorkshopHttp(s,e,{keepalive:true}),workshopAcknowledged:p=>window.acks.push(p)};return true;}`;
 try{
  await cli(['open',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const original={...${JSON.stringify(cancel)},notBefore:new Date(Date.now()+600000).toISOString()};await p.retainPendingWorkshopOriginal('${scope}',original);const delayed=await p.syncPendingFiles('${scope}',ports);if(delayed.acknowledged!==0||delayed.secured!==0)throw Error('TEST_MONEY_DELAY_BYPASSED');if(!await p.withdrawPendingWorkshop('${scope}',original.id))throw Error('TEST_MONEY_UNDO_FAILED');await p.retainPendingWorkshopOriginal('${scope}',original);const sent=await p.syncPendingFiles('${scope}',ports,{flushDelayed:true});if(sent.acknowledged!==0||(await p.readPendingEntries('${scope}')).length!==1)throw Error('TEST_MONEY_RESPONSE_LOSS_ACKED');return true;}`]);
  expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:4000,version:1}});
  const [sourceState]=await sql`SELECT status,cancelled_at FROM public.invoices WHERE tenant_id=${tenant} AND id=${source.invoice.invoiceId}::uuid`;
  expect(sourceState.status).toBe('cancelled');expect(new Date(sourceState.cancelled_at).getTime()).toBeGreaterThan(Date.parse(deviceCapturedAt));
  await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await p.syncPendingFiles('${scope}',ports);if(result.acknowledged!==1||(await p.readPendingEntries('${scope}')).length)throw Error('TEST_CANCEL_RELOAD_RETRY_FAILED');await p.retainPendingWorkshopOriginal('${scope}',${JSON.stringify(apply)});return true;}`]);
  actor=foreign;await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const before=JSON.stringify(await p.readPendingEntries('${scope}')),result=await p.syncPendingFiles('${scope}',ports);if(result.acknowledged!==0||JSON.stringify(await p.readPendingEntries('${scope}'))!==before)throw Error('TEST_FOREIGN_MONEY_ORIGINAL_CHANGED');return true;}`]);
  expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:4000,version:1}});
  actor=full;loseResponse=true;await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await p.syncPendingFiles('${scope}',ports);if(result.acknowledged!==0||(await p.readPendingEntries('${scope}')).length!==1)throw Error('TEST_APPLY_RESPONSE_LOSS_ACKED');return true;}`]);
  expect(await withSession(full,()=>getOrderPaymentStateAction({orderId:target.orderId}))).toMatchObject({code:'OK',data:{payment:{openAmountCents:2000,paidAmountCents:4000}}});
  await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await p.queueFinancialCommand('${scope}',{command:'credit.apply',input:${JSON.stringify(apply.input)}},()=>'${scope}');if(result.code!=='OK'||!result.replayed||(await p.readPendingEntries('${scope}')).length!==0||acks[0].result.financialCommand!=='credit.apply')throw Error('TEST_APPLY_RELOAD_RETRY_FAILED');return true;}`]);
  expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:0,version:2}});
  expect(calls).toBe(5);
  // S08b reuses this exact browser queue/dispatcher and the same customer ledger.
  const additional=await readyInvoiceOrder('S08b native payout source','pickup',false,source.customerId,8403);
  expect(await withSession(full,()=>confirmPaymentAction({invoiceId:additional.invoice.invoiceId,amount:4000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:additional.invoice.invoiceId,expectedVersion:1,reason:'TEST native payout source',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  const payoutKey=randomUUID(),payout={customerId:source.customerId,clientEventId:payoutKey,amount:4000,expectedCreditVersion:3,method:'bar',reference:null,note:'TEST native payout original'};
  loseResponse=true;
  await cli(['eval',`async()=>{const result=await p.queueFinancialCommand('${scope}',{command:'credit.payout',input:${JSON.stringify(payout)}},()=>'${scope}');if(result.code!=='UNAVAILABLE'||(await p.readPendingEntries('${scope}')).length!==1)throw Error('TEST_PAYOUT_LOST_RESPONSE_FALSE_ACK');return true;}`]);
  expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:0,version:4}});
  await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await p.queueFinancialCommand('${scope}',{command:'credit.payout',input:${JSON.stringify(payout)}},()=>'${scope}');if(result.code!=='OK'||!result.replayed||result.financialCommand!=='credit.payout'||(await p.readPendingEntries('${scope}')).length!==0)throw Error('TEST_PAYOUT_RELOAD_RETRY_FAILED');return true;}`]);
  expect(calls).toBe(7);for(const key of [cancellationKey,applicationKey,payoutKey]){expect(receipts.get(key)).toHaveLength(2);expect(receipts.get(key)![0]).toBe(receipts.get(key)![1]);}
  const stale={...apply.input,clientEventId:randomUUID()};
  await cli(['eval',`async()=>{const result=await p.queueFinancialCommand('${scope}',{command:'credit.apply',input:${JSON.stringify(stale)}},()=>'${scope}');const pending=await p.readPendingEntries('${scope}');if(result.code!=='CONFLICT'||result.currentCreditBalanceCents!==0||!result.message||pending.length!==1||pending[0].id!=='${stale.clientEventId}')throw Error('TEST_STALE_ORIGINAL_FALSE_ACK_OR_HIDDEN_REASON');return true;}`]);
  expect(calls).toBe(8);
  expect(await sql`SELECT count(*)::int AS n FROM public.customer_credit_entries WHERE tenant_id=${tenant} AND customer_id=${source.customerId}`).toEqual([{n:4}]);
  // S09 uses the same native store, producer, HTTP route and actual invoice writer.
  // The previous unresolved credit original must remain while this other order succeeds.
  const shipping=await readyInvoiceOrder('S09 native extra invoice','pickup',false,source.customerId,10000);
  const [mainOriginal]=await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${shipping.invoice.invoiceId}::uuid`;
  const handoverKey=randomUUID(),handover={command:'handover_manual',orderId:shipping.orderId,expectedVersion:shipping.version,handoverMode:'shipping',clientEventId:handoverKey};
  loseResponse=true;
  await cli(['eval',`async()=>{const result=await p.queueHandoverCommand('${scope}',{command:'order.handover',input:${JSON.stringify(handover)}},()=>'${scope}');const pending=await p.readPendingEntries('${scope}');if(result.code!=='UNAVAILABLE'||!pending.some(e=>e.id==='${handoverKey}'))throw Error('TEST_HANDOVER_RESPONSE_LOSS_FALSE_ACK');return true;}`]);
  await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await p.queueHandoverCommand('${scope}',{command:'order.handover',input:${JSON.stringify(handover)}},()=>'${scope}');const pending=await p.readPendingEntries('${scope}');if(result.code!=='OK'||!result.replayed||result.handoverCommand!=='order.handover'||result.receipt.handoverMode!=='shipping'||pending.some(e=>e.id==='${handoverKey}')||!pending.some(e=>e.id==='${stale.clientEventId}'))throw Error('TEST_HANDOVER_REAL_RECEIPT_REQUIRED');return true;}`]);
  expect(receipts.get(handoverKey)).toHaveLength(2);expect(receipts.get(handoverKey)![0]).toBe(receipts.get(handoverKey)![1]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${tenant} AND order_id=${shipping.orderId} AND client_event_id=${handoverKey}::uuid AND event_type='ORDER_HANDOVER_CHANGED_V1'`).toEqual([{n:1}]);
  const [shippingOrder]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${shipping.orderId}`;
  const issueKey=randomUUID(),issue={orderId:shipping.orderId,expectedVersion:shippingOrder.version,clientEventId:issueKey,shippingCosts:{invoiceId:shipping.invoice.invoiceId,expectedVersion:1,scope:'order:'+shipping.orderId,expectedFeeCents:1000}};
  loseResponse=true;
  await cli(['eval',`async()=>{const result=await p.queueFinancialCommand('${scope}',{command:'invoice.issue',input:${JSON.stringify(issue)}},()=>'${scope}');const pending=await p.readPendingEntries('${scope}');if(result.code!=='UNAVAILABLE'||!pending.some(e=>e.id==='${issueKey}')||!pending.some(e=>e.id==='${stale.clientEventId}'))throw Error('TEST_ISSUE_RESPONSE_LOSS_FALSE_ACK');return true;}`]);
  expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${shipping.orderId}`).toEqual([{n:2}]);
  actor=foreign;await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const before=JSON.stringify(await p.readPendingEntries('${scope}'));const result=await p.syncPendingFiles('${scope}',ports);if(result.acknowledged!==0||JSON.stringify(await p.readPendingEntries('${scope}'))!==before)throw Error('TEST_FOREIGN_ISSUE_ORIGINAL_CHANGED');return true;}`]);
  actor=full;await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await p.queueFinancialCommand('${scope}',{command:'invoice.issue',input:${JSON.stringify(issue)}},()=>'${scope}');const pending=await p.readPendingEntries('${scope}');if(result.code!=='OK'||!result.replayed||result.financialCommand!=='invoice.issue'||pending.some(e=>e.id==='${issueKey}')||!pending.some(e=>e.id==='${stale.clientEventId}'))throw Error('TEST_ISSUE_RELOAD_RECEIPT_REQUIRED');return true;}`]);
  expect(receipts.get(issueKey)).toHaveLength(2);expect(receipts.get(issueKey)![0]).toBe(receipts.get(issueKey)![1]);
  expect(await sql`SELECT count(*)::int AS n,sum(net_amount_cents)::int AS total FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${shipping.orderId} AND belegart='versandkosten'`).toEqual([{n:1,total:1000}]);
  expect(await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${shipping.invoice.invoiceId}::uuid`).toEqual([mainOriginal]);
  // The compound cancellation remains one original in this very same store.
  // Its actual replacement, not cancellation alone, is required for final ACK.
  const reissueOrder=await readyInvoiceOrder('S09 native no-shipping replacement','shipping',false,undefined,10000);
  expect(await withSession(full,()=>confirmPaymentAction({invoiceId:reissueOrder.invoice.invoiceId,expectedVersion:0,expectedOpenAmountCents:reissueOrder.invoice.grossAmountCents,amount:reissueOrder.invoice.grossAmountCents,method:'ueberweisung',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
  const reissueManual=await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:reissueOrder.orderId,expectedVersion:reissueOrder.version,handoverMode:'pickup',clientEventId:randomUUID()}));
  if(reissueManual.code!=='OK'||!reissueManual.receipt||typeof reissueManual.receipt!=='object'||!('eventId'in reissueManual.receipt)||typeof reissueManual.receipt.eventId!=='string')throw Error('TEST_NATIVE_REISSUE_SOURCE_REQUIRED');
  const reissueKey=randomUUID(),replaceKey=randomUUID(),compound={invoiceId:reissueOrder.invoice.invoiceId,expectedVersion:1,reason:'Übergabeart Versand → Abholung',clientEventId:reissueKey,reissueWithoutShipping:{handoverEventId:reissueManual.receipt.eventId,replacementClientEventId:replaceKey}};
  loseResponse=true;
  await cli(['eval',`async()=>{const result=await p.queueFinancialCommand('${scope}',{command:'invoice.cancel',input:${JSON.stringify(compound)}},()=>'${scope}');const pending=await p.readPendingEntries('${scope}');if(result.code!=='UNAVAILABLE'||!pending.some(e=>e.id==='${reissueKey}'))throw Error('TEST_COMPOUND_LOST_RESPONSE_FALSE_ACK');return true;}`]);
  expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${reissueOrder.orderId}`).toEqual([{n:2}]);
  await cli(['goto',url]);await cli(['eval',setup]);
  await cli(['eval',`async()=>{const result=await p.queueFinancialCommand('${scope}',{command:'invoice.cancel',input:${JSON.stringify(compound)}},()=>'${scope}');const pending=await p.readPendingEntries('${scope}');if(result.code!=='OK'||!result.replayed||result.replacementReceipt?.clientEventId!=='${replaceKey}'||pending.some(e=>e.id==='${reissueKey}')||!pending.some(e=>e.id==='${stale.clientEventId}'))throw Error('TEST_COMPOUND_REPLACEMENT_ACK_REQUIRED');return true;}`]);
  expect(receipts.get(reissueKey)).toHaveLength(2);expect(receipts.get(reissueKey)![0]).toBe(receipts.get(reissueKey)![1]);
  expect(await sql`SELECT payment_open_amount_cents,payment_paid_amount_cents FROM public.invoices WHERE tenant_id=${tenant} AND client_event_id=${replaceKey}::uuid`).toEqual([{payment_open_amount_cents:11900,payment_paid_amount_cents:0}]);
  expect(await sql`SELECT count(*)::int AS n,sum(amount_cents)::int AS amount FROM public.customer_credit_entries WHERE tenant_id=${tenant} AND invoice_id=${reissueOrder.invoice.invoiceId}::uuid`).toEqual([{n:1,amount:reissueOrder.invoice.grossAmountCents}]);
  // R3: after a definitive stale-version rejection the explicitly refreshed
  // command for this same order still needs an executable path.
  const staleHandoverKey=randomUUID(),freshHandoverKey=randomUUID();
  const staleHandover={...handover,clientEventId:staleHandoverKey,handoverMode:'pickup'};
  await cli(['eval',`async()=>{const result=await p.queueHandoverCommand('${scope}',{command:'order.handover',input:${JSON.stringify(staleHandover)}},()=>'${scope}');if(result.code!=='CONFLICT')throw Error('TEST_ACTUAL_STALE_HANDOVER_REJECTION_REQUIRED');return true;}`]);
  const [currentHandover]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${shipping.orderId}`;
  const freshHandover={...staleHandover,clientEventId:freshHandoverKey,expectedVersion:currentHandover.version};
  const freshOutcome=await cli(['eval',`async()=>{const result=await p.queueHandoverCommand('${scope}',{command:'order.handover',input:${JSON.stringify(freshHandover)}},()=>'${scope}');return 'TEST_HANDOVER_RETRY_OUTCOME '+result.code+' '+JSON.stringify({message:result.message,pending:(await p.readPendingEntries('${scope}')).map(e=>({id:e.id,itemId:e.itemId,kind:e.kind}))});}`]);
  // Diagnostic control: the unchanged real writer accepts these exact freshly
  // read inputs, so its source/permission is not the cause of queue blockage.
  const responseSeen=receipts.has(freshHandoverKey),direct=await withSession(full,()=>changeOrderPickupNoticeAction(freshHandover));
  expect(direct).toMatchObject({code:'OK'});
  writeFileSync('.git/kreile-s09-stale-queue-browser-green-proof.json',JSON.stringify({at:new Date().toISOString(),browserStdout:freshOutcome.stdout,freshResponseSeenBeforeDirectControl:responseSeen,directCode:direct.code,directReplayed:direct.code==='OK'?direct.replayed:null},null,2));
  expect(freshOutcome.stdout).toContain('TEST_HANDOVER_RETRY_OUTCOME OK');
  expect(responseSeen).toBe(true);expect(direct).toMatchObject({code:'OK',replayed:true});
  await cli(['eval',`async()=>{const rows=await p.readPendingEntries('${scope}'),old=rows.find(e=>e.id==='${staleHandoverKey}');if(!old?.rejection||old.rejection.rejection!=='CONFLICT'||old.input.expectedVersion!==${staleHandover.expectedVersion}||rows.some(e=>e.id==='${freshHandoverKey}'))throw Error('TEST_NO_EFFECT_ORIGINAL_OR_NEW_ACK');return true;}`]);
  expect(await sql`SELECT count(*)::int AS n FROM public.events event JOIN public.tasks task ON task.tenant_id=event.tenant_id AND task.erstellt_von=event.user_id WHERE event.tenant_id=${tenant} AND event.event_type='OFFLINE_WORKSHOP_REJECTED_V1' AND event.payload#>>'{original,input,clientEventId}'=${staleHandoverKey} AND task.titel='Konflikt beim Abgleich' AND task.bezug_id=${shipping.orderId}`).toEqual([{n:1}]);
 }finally{await execute(process.execPath,[process.env.KREILE_PLAYWRIGHT_CLI_JS!,`-s=${session}`,'close'],{timeout:30000}).catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));}
},120000);
