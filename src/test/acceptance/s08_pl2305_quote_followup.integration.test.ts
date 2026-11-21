// @vitest-environment node
// Real Actions/Auth/DB/Storage and native query/provider cancellation; only initial TEST data/provider boundary doubles.
import {customerFixture,intakeOrderFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {runQuoteQuantityCase} from '../../../e2e/ablauf/quoteQuantityCase';
import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {withRestoredTestSource} from '../fixtures/restoredTestSource';
import {getComplaints} from '@/app/actions/complaints.actions';
import {getLiveOrderCardAction,readPageReadSettingsAction,transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';
import {getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {readSettingsAction,saveCompanySettingsAction} from '@/app/actions/settings.actions';
import {db} from '@/db';
import {DEFAULT_PAGE_READ_SETTINGS,logPageReadPhase,PageReadTimeout,pageReadFetchPort,withPageReadBudget,withPageReadQueryLimits,withAuthorizationReadBudget} from '@/db/readBudget';
import {resolveAuthorization} from '@/lib/server/authorization';

import {readMicrosoftGraphSentDocumentEvidence,readMicrosoftGraphSentMailByRequest,readMicrosoftGraphSentMailReference} from '@/lib/server/microsoftGraph';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {getOperationalOrders} from '@/lib/server/operationalOrders';

import {readTodayDashboard} from '@/lib/server/todayDashboard';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {SALES_STAGE_FEATURES,pageReadSettingsFromCompany} from '@/modules/fundament/public';
import {readPageReadSettings} from '@/modules/fundament/server-public';
import {sql as drizzleSql} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/postgres-js';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import postgres from 'postgres';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {INVOICE_MAIL_COMPOSER_COPY} from '@/ui/situationCatalog';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {requestMailStep} from '../../../e2e/ablauf/requestMailStep';
// The shared application DB follows the existing worker/app lifetime.
// This suite closes only its explicitly created native TEST client below.
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

it('A09 request-phase diagnostics retain PG identifiers but never error bodies, SQL values or arbitrary labels',()=>{
 const output=vi.spyOn(console,'info').mockImplementation(()=>undefined);
 try{
  const cause=Object.assign(new Error('ORDER_POSITION_SURFACE_KEY_UNKNOWN'),{name:'PostgresError',code:'22023'});
  logPageReadPhase('home.total',Date.now()-5,{rows:2,body:'TEST_PRIVATE_MAIL_BODY' as unknown as number},new Error('TEST_PRIVATE_PASSWORD',{cause}));
  logPageReadPhase('TEST_PRIVATE_LABEL',Date.now(),{rows:1});
  expect(output).toHaveBeenCalledTimes(1);
  const record=JSON.parse(String(output.mock.calls[0][1]));
  expect(record).toMatchObject({phase:'home.total',counts:{rows:2},codes:['22023'],reasons:['ORDER_POSITION_SURFACE_KEY_UNKNOWN']});
  expect(record.durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(output.mock.calls)).not.toContain('TEST_PRIVATE_PASSWORD');
  expect(JSON.stringify(output.mock.calls)).not.toContain('TEST_PRIVATE_MAIL_BODY');
  expect(JSON.stringify(output.mock.calls)).not.toContain('TEST_PRIVATE_LABEL');
 }finally{output.mockRestore();}
});

it('CB23:05 stored damaged goods keep one physical receipt and the catalog exit on fresh retry',async()=>{
 await runQuoteQuantityCase({name:'CB23:05 blocked goods',quantity:10,received:10,total:4000,expected:4000,hours:'0.5000',operational:true,fixed:0,blocked:true});
});

it('CB23:05 actual commercial-quote SQL failure preserves the operational card without money',async()=>{
 await runQuoteQuantityCase({name:'CB23:05 quote source unavailable',quantity:10,received:10,total:4000,expected:4000,hours:'0.5000',operational:true,fixed:0,inspect:async({orderId,quoteId,actor})=>{
  // Deliberately corrupt only this isolated TEST source, never a product fixture or guard.
  await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,created_at)
   VALUES(${randomUUID()},${KREILE_TENANT_SLUG},${orderId},'QUOTE_VAT_FROM_COMPANY_V1','TEST synthetic unreadable optional VAT source',${full.actorId}::uuid,${sql.json({quoteId,edition:2,vatRateBasisPoints:'TEST-invalid-number'})},'success',${randomUUID()}::uuid,1,statement_timestamp())`;
  const log=vi.spyOn(console,'error');
  try{
   const result=await withSession(actor,()=>getLiveOrderCardAction({orderId}));
   expect(result).toMatchObject({code:'OK',data:{card:{id:orderId,operationalFacts:{rework:false,pricesMissing:null},items:[{unitPriceCents:null,vatRateBasisPoints:null}]}}});
   if(result.code!=='OK')throw Error('TEST_CB2305_CARD_LOST');
   expect(result.data.card.commercialQuote).toBeUndefined();
   expect(log).toHaveBeenCalledWith('[ORDER_CARD_COMMERCIAL_QUOTE_FAILED]',expect.objectContaining({orderId}));
   expect(await withSession(actor,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId,version:result.data.card.version}}});
   const today=(login:typeof full)=>withSession(login,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_LIVE_SOURCE_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
   const visible=await today(full),notice=visible.items.find(item=>item.key==='source-quote:'+orderId);
   expect(notice).toMatchObject({orderId,orderVersion:result.data.card.version,field:'action',title:'Preisbeleg zu Auftrag '+result.data.card.orderNumber+' ist nicht lesbar.',primaryActionLabel:'Auftrag öffnen'});
   expect((await today(actor)).items.some(item=>item.key==='source-quote:'+orderId)).toBe(false);
   const started=Date.now();const home=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_LIVE_SOURCE_AUTH');return loadOfficeHome(auth.data);});
   expect(Date.now()-started).toBeLessThan(3000);expect(home.kind).toBe('data');
  }finally{log.mockRestore();}
 }});
});

describe('L1 shared page-read sources',()=>{
const DATABASE_URL=process.env.DATABASE_URL,EXPECTED_DATABASE_URL=process.env.H18_EXPECTED_DATABASE_URL;
if(!DATABASE_URL||DATABASE_URL!==EXPECTED_DATABASE_URL||new URL(DATABASE_URL).hostname!=='127.0.0.1')throw Error('TEST_L1_LOOPBACK_REPLAY_REQUIRED');

beforeAll(async()=>{
 // Explicit initial TEST tenant configuration uses the existing canonical defaults.
 for(const feature of SALES_STAGE_FEATURES)await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES(${tenant},${feature.id},${feature.defaultEnabled})`;
});

const companyInput={companyName:'TEST L1 Firma',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'Deutschland',taxId:'DE123456789',iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank',paymentTermDays:14,logoUrl:'https://example.invalid/TEST.png',pageReads:{queryTimeoutMs:2000,invoiceMailBatchLimit:3}};

it('persists the configured query/batch limits through the existing command, receipt, rights and fresh read',async()=>{
 const input=companyInput;
 expect(await withSession(full,()=>saveCompanySettingsAction(input))).toMatchObject({code:'OK'});
 expect(await readPageReadSettings({tenantId:tenant})).toEqual(input.pageReads);
 expect(await withSession(full,()=>readPageReadSettingsAction())).toEqual({code:'OK',settings:input.pageReads});
 expect(await withSession(full,()=>readSettingsAction())).toMatchObject({code:'OK',snapshot:{company:{pageReads:input.pageReads}}});
 expect(await withSession(full,()=>saveCompanySettingsAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK'});
 const denied=await createFixture(['auftraege'],'werkstatt');
 expect(await withSession(denied,()=>saveCompanySettingsAction({...input,pageReads:{queryTimeoutMs:1,invoiceMailBatchLimit:1}}))).toMatchObject({code:'FORBIDDEN'});
 expect(await readPageReadSettings({tenantId:tenant})).toEqual(input.pageReads);
 expect(await withSession(full,()=>saveCompanySettingsAction({...input,pageReads:{queryTimeoutMs:0,invoiceMailBatchLimit:3}}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT payload->'pageReads' AS limits,payload->>'actorId' AS actor FROM public.ui_events WHERE tenant_id=${tenant} AND event_type='company_settings_updated' ORDER BY created_at,id`).toEqual(expect.arrayContaining([expect.objectContaining({limits:input.pageReads,actor:full.actorId})]));
});

it('applies the actual configured card-read deadline and rereads the same real card after restoring the setting',async()=>{
 const customerId=await customerFixture('TEST L1 Kartenfrist');
 const order=await intakeOrderFixture('TEST L1 Kartenquellen',customerId);
 const input={orderId:order.receipt.orderId};
 const before=await withSession(full,()=>getLiveOrderCardAction(input));
 expect(before.code).toBe('OK');
 const logger=vi.spyOn(console,'error');
 try{
  expect(await withSession(full,()=>saveCompanySettingsAction({...companyInput,pageReads:{...companyInput.pageReads,queryTimeoutMs:1}}))).toMatchObject({code:'OK'});
  const started=Date.now();
  expect(await withSession(full,()=>getLiveOrderCardAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'UNAVAILABLE'});
  expect(Date.now()-started).toBeLessThan(1000);
 }finally{
  logger.mockRestore();
  // A genuine second settings command restores this isolated TEST scenario;
  // no shared product row or immutable evidence is modified directly.
  expect(await withSession(full,()=>saveCompanySettingsAction(companyInput))).toMatchObject({code:'OK'});
 }
 expect(await withSession(full,()=>getLiveOrderCardAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{card:{id:order.receipt.orderId,version:order.receipt.orderVersion}}});
});

it('uses one full-list SQL source for the actual home and Today while preserving source-bound actions on reread',async()=>{
 const customerId=await customerFixture('TEST L1 gemeinsame Quelle');
 const order=await intakeOrderFixture('TEST L1 ein Lesestand',customerId);
 const options=db.$client.options;
 const previous=options.debug;
 let listReads=0;
 options.debug=(_connection,statement)=>{if(statement.includes('AS due_date_text')&&statement.includes('FROM private.v_operational_station_queue_v1 queue'))listReads++;};
 try{
  const read=()=>withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_L1_AUTH');return loadOfficeHome(auth.data);});
  const first=await read();
  expect(first.kind).toBe('data');
  if(first.kind!=='data')throw Error('TEST_L1_HOME');
  expect(listReads).toBe(1);
  expect(first.projection.orders).toEqual(expect.arrayContaining([expect.objectContaining({id:order.receipt.orderId})]));
  expect(first.dashboard.orderActions?.rows).toEqual(expect.arrayContaining([expect.objectContaining({orderId:order.receipt.orderId,version:order.receipt.orderVersion})]));
  listReads=0;
  const again=await read();expect(again.kind).toBe('data');expect(listReads).toBe(1);
 }finally{options.debug=previous;}
});

it('projects the same canonical Today fields without claiming an unread release flag',async()=>{
 const sources=await withSession(full,async()=>{
  const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_L1_AUTH');
  return Promise.all([getOperationalOrders(auth.data),getOperationalOrders(auth.data,{purpose:'today'})]);
 });
 const display=(row:typeof sources[0][number])=>{const {ausgabeFrei,serverChangedAt,...fields}=row;void ausgabeFrei;void serverChangedAt;return fields;};
 expect(sources[1].map(display)).toEqual(sources[0].map(display));
 expect(sources[1].every(row=>!Object.hasOwn(row,'ausgabeFrei'))).toBe(true);
 expect(sources[0].every(row=>typeof row.ausgabeFrei==='boolean')).toBe(true);
});

it('retains known Today sources when an unreadable TEST order makes the full operational list unavailable',async()=>{
 const customerId=await customerFixture('TEST L1 Teilquelle');
 const order=await intakeOrderFixture('TEST L1 vorhandener Auftrag',customerId),id=order.receipt.orderId;
 const readRow=async()=>{const [row]=await sql`SELECT to_jsonb(orders) AS original FROM public.orders orders WHERE tenant_id=${tenant} AND id=${id}`;return row.original as Record<string,unknown>;};
 await withRestoredTestSource({label:'TEST L1 complete unreadable order row',read:readRow,restore:async original=>{
  const columns=Object.keys(original);if(columns.some(column=>!/^[a-z_][a-z0-9_]*$/.test(column)))throw Error('TEST_L1_COLUMNS');
  const names=sql.unsafe(columns.map(column=>'"'+column+'"').join(','));
  await sql`UPDATE public.orders SET (${names})=(SELECT ${names} FROM jsonb_populate_record(NULL::public.orders,${sql.json(original as never)}::jsonb)) WHERE tenant_id=${tenant} AND id=${id}`;
 }},async()=>{
  await sql`UPDATE public.orders SET title='' WHERE tenant_id=${tenant} AND id=${id}`;
  const result=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_L1_AUTH');return loadOfficeHome(auth.data);});
  expect(result.kind).toBe('partial');
  if(result.kind!=='partial')throw Error('TEST_L1_PARTIAL');
  expect(result.projection).toBeNull();
  expect(result.dashboard.datenluecken).toContain('ORDER_SOURCE');
  expect(result.dashboard.moneySources?.invoices).toMatchObject({code:'OK'});
 });
});


it('qualifies real company JSON before and after the additive schema, rejecting partial or invalid settings',async()=>{
 expect(await withSession(full,()=>saveCompanySettingsAction(companyInput))).toMatchObject({code:'OK'});
 const [row]=await sql`SELECT to_jsonb(company) AS source FROM public.company_settings company WHERE tenant_id=${tenant}`;
 expect(row?.source).toBeDefined();
 const defaults=await sql`SELECT attribute.attname,pg_get_expr(def.adbin,def.adrelid) AS value FROM pg_attribute attribute JOIN pg_attrdef def ON def.adrelid=attribute.attrelid AND def.adnum=attribute.attnum WHERE attribute.attrelid='public.company_settings'::regclass AND attribute.attname IN('seiten_abfrage_ms','rechnung_mail_grenze')`;
 expect(Object.fromEntries(defaults.map(value=>[value.attname,Number(value.value)]))).toEqual({seiten_abfrage_ms:DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs,rechnung_mail_grenze:DEFAULT_PAGE_READ_SETTINGS.invoiceMailBatchLimit});
 const source=row.source as Record<string,unknown>;
 const project=(value:Record<string,unknown>)=>pageReadSettingsFromCompany({hasQueryTimeout:Object.hasOwn(value,'seiten_abfrage_ms'),hasInvoiceBatchLimit:Object.hasOwn(value,'rechnung_mail_grenze'),queryTimeoutMs:value.seiten_abfrage_ms,invoiceMailBatchLimit:value.rechnung_mail_grenze},DEFAULT_PAGE_READ_SETTINGS);
 expect(project(source)).toEqual({settings:companyInput.pageReads,schemaReady:true});
 // Only an explicitly labelled synthetic old-schema projection omits both
 // new keys; no live column, row, migration or evidence is changed.
 const oldSchemaProjection={...source};delete oldSchemaProjection.seiten_abfrage_ms;delete oldSchemaProjection.rechnung_mail_grenze;
 expect(project(oldSchemaProjection)).toEqual({settings:{queryTimeoutMs:DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs,invoiceMailBatchLimit:DEFAULT_PAGE_READ_SETTINGS.invoiceMailBatchLimit},schemaReady:false});
 expect(project({...oldSchemaProjection,seiten_abfrage_ms:2000})).toBeNull();
 expect(project({...source,seiten_abfrage_ms:null})).toBeNull();
 expect(project({...source,rechnung_mail_grenze:0})).toBeNull();
 expect(await withSession(full,()=>readSettingsAction())).toMatchObject({code:'OK',snapshot:{company:{pageReadsSchemaReady:true,pageReads:companyInput.pageReads}}});
});




it('PL15:43 sends the customer subject from the actual invoice/company source and retains original bytes on retry',async()=>{
 expect(await withSession(full,()=>saveCompanySettingsAction(companyInput))).toMatchObject({code:'OK'});
 const customerId=await customerFixture('TEST L1 friendly subject');
 const issued=await readyInvoiceOrder('TEST L1 actual invoice mail','pickup',false,customerId);
 const authorization=await withSession(full,()=>resolveAuthorization());if(!authorization.ok)throw Error('TEST_L1_SUBJECT_AUTH');
 const today=await withSession(full,()=>readTodayDashboard(authorization.data,getComplaints,getQuoteFollowupsForTodayAction));
 const row=today.items.find(item=>item.invoiceMail?.documentId===issued.invoice.invoiceId)?.invoiceMail;
 expect(row).toBeDefined();if(!row)throw Error('TEST_L1_SUBJECT_ORIGINAL');
 const [customer]=await sql`SELECT name FROM public.customers WHERE tenant_id=${tenant} AND id=${customerId}`;
 expect(row.customerName).toBe(customer.name);expect(row.number).toBe(issued.invoice.invoiceNumber);
 expect(row.companyName).toBe(companyInput.companyName);
 const subject=INVOICE_MAIL_COMPOSER_COPY.subject(row.number,row.companyName!);
 expect(subject).toBe('Rechnung '+issued.invoice.invoiceNumber+' · '+companyInput.companyName);
 await requestMailStep('L1-subject');
 const input={targetType:'CUSTOMER' as const,targetId:customerId,subject,body:INVOICE_MAIL_COMPOSER_COPY.body,clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:row.documentId},expectedInvoiceIds:row.expectedInvoiceIds,singleInvoice:true as const};
 expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK'});
 const posts=()=>vi.mocked(globalThis.fetch).mock.calls.filter(([url,init])=>String(url).endsWith('/sendMail')&&init?.method==='POST');
 expect(posts()).toHaveLength(1);
 const message=JSON.parse(String(posts()[0][1]?.body)).message;
 expect(message.subject).toBe(subject);expect(message.subject).not.toContain(' senden');
 const [original]=await sql`SELECT pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${row.documentId}::uuid`;
 expect(createHash('sha256').update(Buffer.from(message.attachments[0].contentBytes,'base64')).digest('hex')).toBe(original.pdf_sha256);
 expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
 expect(posts()).toHaveLength(1);
});

describe('L1 native deadlines',()=>{
const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_LOOPBACK_REPLAY_REQUIRED');
const native=postgres(url,{prepare:false,max:1});
const client=withPageReadQueryLimits(native);
const budgetDb=drizzle(client);
afterAll(()=>native.end({timeout:5}));

it('keeps the real canonical authorization read available while every ordinary data connection is occupied',async()=>{
 const slots=db.$client.options.max;
 let release:()=>void=()=>undefined;const gate=new Promise<void>(resolve=>{release=resolve;});
 const entered:Array<()=>void>=[];const ready=Array.from({length:slots},()=>new Promise<void>(resolve=>entered.push(resolve)));
 const held=Array.from({length:slots},(_,index)=>db.transaction(async tx=>{await tx.execute(drizzleSql`SELECT 1`);entered[index]();await gate;}));
 try{
  await Promise.all(ready);
  const start=Date.now();const auth=await withSession(full,()=>resolveAuthorization());
  expect(auth).toMatchObject({ok:true,data:{userId:full.actorId,tenantId:tenant}});
  expect(Date.now()-start).toBeLessThan(500);
 }finally{release();await Promise.all(held);}
});
it('enforces an actual read-only, one-second authorization connection and remains usable after its SQL deadline',async()=>{
 const [read]=await withAuthorizationReadBudget(()=>db.execute<{read_only:string}>(drizzleSql`SELECT current_setting('transaction_read_only') AS read_only`));
 expect(read.read_only).toBe('on');
 await expect(withAuthorizationReadBudget(()=>db.execute(drizzleSql`UPDATE public.app_users SET full_name=full_name WHERE tenant_id=${tenant} AND false`))).rejects.toMatchObject({cause:{code:'25006'}});
 const start=Date.now();
 const error=await withAuthorizationReadBudget(()=>db.execute(drizzleSql`SELECT pg_sleep(2)`)).then(()=>null,error=>error);
 expect(error instanceof PageReadTimeout||error?.cause instanceof PageReadTimeout||error?.cause?.code==='57014').toBe(true);
 expect(Date.now()-start).toBeLessThan(1500);
 expect(await withSession(full,()=>resolveAuthorization())).toMatchObject({ok:true,data:{userId:full.actorId}});
});


it('sets the actual PostgreSQL transaction timeout and restores the existing connection setting afterward',async()=>{
 const [before]=await budgetDb.execute<{milliseconds:number}>(drizzleSql`SELECT setting::integer AS milliseconds FROM pg_settings WHERE name='statement_timeout'`);
 const [inside]=await withPageReadBudget(()=>budgetDb.transaction(tx=>tx.execute<{milliseconds:number}>(drizzleSql`SELECT setting::integer AS milliseconds FROM pg_settings WHERE name='statement_timeout'`)),2000);
 expect(inside.milliseconds).toBeGreaterThan(0);expect(inside.milliseconds).toBeLessThanOrEqual(2000);
 const [after]=await budgetDb.execute<{milliseconds:number}>(drizzleSql`SELECT setting::integer AS milliseconds FROM pg_settings WHERE name='statement_timeout'`);
 expect(after).toEqual(before);
});

it('cancels a real active query and frees the existing connection for the next read',async()=>{
  await budgetDb.execute(drizzleSql`SELECT 1`);
  const started=Date.now();
  await expect(withPageReadBudget(()=>budgetDb.execute(drizzleSql`SELECT pg_sleep(1)`),100)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(Date.now()-started).toBeLessThan(800);
  expect(await withPageReadBudget(()=>budgetDb.execute<{ok:number}>(drizzleSql`SELECT 1 AS ok`),1000)).toMatchObject([{ok:1}]);
});

it('cancels a queued read without cancelling a different request or altering unscoped commands',async()=>{
  const outside=budgetDb.execute<{ok:number}>(drizzleSql`SELECT 2 AS ok, pg_sleep(0.3)`);
  const active=Promise.resolve(outside);
  // Queue order is deterministic: the unscoped query reserves the sole connection first.
  await new Promise(resolve=>setTimeout(resolve,25));
  await expect(withPageReadBudget(()=>budgetDb.execute(drizzleSql`SELECT 3`),50)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(await active).toMatchObject([{ok:2}]);
  expect(await budgetDb.execute<{ok:number}>(drizzleSql`SELECT 4 AS ok`)).toMatchObject([{ok:4}]);
});

it('bounds native nested transactions, rolls back timed-out reads and retains a usable pool',async()=>{
  await expect(withPageReadBudget(()=>budgetDb.transaction(tx=>tx.transaction(nested=>nested.execute(drizzleSql`SELECT pg_sleep(1)`))),100)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
  expect(await withPageReadBudget(()=>budgetDb.transaction(tx=>tx.execute<{ok:number}>(drizzleSql`SELECT 5 AS ok`)),1000)).toMatchObject([{ok:5}]);
});

it('rejects an already expired read without executing it or leaving an unobserved cancellation',async()=>{
 await expect(withPageReadBudget(async()=>{
  await new Promise(resolve=>setTimeout(resolve,30));
  return budgetDb.execute(drizzleSql`SELECT pg_sleep(1)`);
 },10)).rejects.toMatchObject({cause:expect.any(PageReadTimeout)});
 expect(await budgetDb.execute<{ok:number}>(drizzleSql`SELECT 6 AS ok`)).toMatchObject([{ok:6}]);
});

it('aborts actual provider HTTP before headers and during a slow body, retaining unrelated unscoped reads',async()=>{
 // Only the external provider boundary is doubled by this local TEST server.
 // No app route, server action, Auth, DB, or successful send is simulated.
 let aborted=0;
 let bothAborted:(()=>void)|undefined;
 const closed=new Promise<void>(resolve=>{bothAborted=resolve;});
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const server=createServer((request,response)=>{
  if(request.url==='/TEST-fast'){response.end('TEST boundary OK');return;}
  if(request.url==='/TEST-body'){response.writeHead(200,{'content-type':'text/plain'});response.flushHeaders();response.write('TEST original prefix');}
  const timer=setTimeout(()=>response.end('TEST delayed boundary'),500);timers.add(timer);
  response.on('close',()=>{if(!response.writableEnded)aborted++;if(aborted===2)bothAborted?.();clearTimeout(timer);timers.delete(timer);});
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('TEST_L1_HTTP_ADDRESS');
 const base='http://127.0.0.1:'+address.port,read=pageReadFetchPort(fetch);
 try{
  const connected=await read(base+'/TEST-fast');expect(await connected.text()).toBe('TEST boundary OK');
  const started=Date.now();
  const headerError=await withPageReadBudget(()=>read(base+'/TEST-headers'),50).then(()=>{throw Error('TEST_EXPECTED_DEADLINE');},error=>error);
  expect(headerError instanceof PageReadTimeout||headerError?.name==='TimeoutError').toBe(true);
  await expect(withPageReadBudget(async()=>{const response=await read(base+'/TEST-body');return response.text();},50)).rejects.toMatchObject({name:'TimeoutError'});
  await closed;
  expect(Date.now()-started).toBeLessThan(1000);
  const unchanged=await read(base+'/TEST-fast');expect(await unchanged.text()).toBe('TEST boundary OK');
  expect(aborted).toBe(2);
 }finally{
  for(const timer of timers)clearTimeout(timer);
  server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});


it.each(['request','reference','document'] as const)('keeps the same actual deadline through the existing Graph %s reader and its response body',async(kind)=>{
 // Explicitly synthetic external provider only; actual reader, token path,
 // fetch implementation, native HTTP socket and cancellation remain real.
 const environment={MS_GRAPH_TENANT_ID:'TEST-tenant',MS_GRAPH_CLIENT_ID:'TEST-client',MS_GRAPH_CLIENT_SECRET:'TEST-no-real-secret',MS_GRAPH_MAILBOX:'TEST@example.invalid'};
 let aborted=0;
 const timers=new Set<ReturnType<typeof setTimeout>>();
 const server=createServer((request,response)=>{
  if(request.url==='/TEST-token'){response.setHeader('content-type','application/json');response.end(JSON.stringify({access_token:'TEST-provider-boundary-token'}));return;}
  response.writeHead(200,{'content-type':'application/json'});response.flushHeaders();response.write('{"value":[');
  const timer=setTimeout(()=>response.end(']}'),750);timers.add(timer);
  response.on('close',()=>{if(!response.writableEnded)aborted++;clearTimeout(timer);timers.delete(timer);});
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();if(!address||typeof address==='string')throw Error('TEST_L1_GRAPH_HTTP_ADDRESS');
 const base='http://127.0.0.1:'+address.port;
 const transport:typeof fetch=(input,init)=>fetch(base+(String(input).includes('login.microsoftonline.com')?'/TEST-token':'/TEST-sent'),init);
 const logger=vi.spyOn(console,'error').mockImplementation(()=>undefined);
 try{
  const warm=await transport('https://login.microsoftonline.com/TEST');expect(await warm.json()).toHaveProperty('access_token');
  const started=Date.now();
  const result=await withPageReadBudget<{code:string}>(()=>kind==='request'
   ?readMicrosoftGraphSentMailByRequest({clientRequestId:'11111111-1111-4111-8111-111111111111',recipient:'TEST-recipient@example.invalid',preparedAt:new Date().toISOString()},environment,transport)
   :kind==='reference'?readMicrosoftGraphSentMailReference('<TEST@example.invalid>','TEST-recipient@example.invalid',environment,transport)
   :readMicrosoftGraphSentDocumentEvidence('<TEST@example.invalid>','TEST-recipient@example.invalid',environment,transport),80);
  expect(result.code).toBe('UNAVAILABLE');
  expect(Date.now()-started).toBeLessThan(400);
  // Native close is delivered asynchronously after fetch rejects.
  for(let attempt=0;attempt<20&&aborted===0;attempt++)await new Promise(resolve=>setTimeout(resolve,5));
  expect(aborted).toBe(1);
  const outside=await transport('https://login.microsoftonline.com/TEST');expect(await outside.json()).toHaveProperty('access_token');
 }finally{
  logger.mockRestore();for(const timer of timers)clearTimeout(timer);
  server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});

});
describe('L1 shipping-source notices',()=>{
it('PL13:42 proves an actual unfinished Intake order is not applicable without an error, warning or invented zero',async()=>{
 // Explicit synthetic initial company settings in this isolated TEST tenant,
 // matching Dev's existing setting; the order itself comes from its real Action.
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days,versand_pauschale_netto_cents)
 SELECT ${randomUUID()},${tenant},'TEST Live Quellenfirma','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14,1000 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
 const customerId=await customerFixture('TEST Live Quellenhinweis');
 const created=await intakeOrderFixture('TEST Live vor Rechnungsfreigabe',customerId);
 const orderId=created.receipt.orderId;
 const errors=vi.spyOn(console,'error');
 try{
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(card.code).toBe('OK');if(card.code!=='OK')throw Error('TEST_LIVE_CARD');
 expect(card.data.handoverConsequences).toEqual({code:'NOT_APPLICABLE',orderId,orderVersion:card.data.card.version});
 const read=(actor:typeof full)=>withSession(actor,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_LIVE_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const first=await read(full),notice=first.items.find(item=>item.key==='source-shipping:'+orderId);
 expect(notice).toBeUndefined();
 expect(card.data.handoverConsequences).not.toHaveProperty('feeCents');
 expect(card.data.handoverConsequences).not.toHaveProperty('shippingCostMissing');
 expect(first.orderActions?.rows.some(row=>row.orderId===orderId)).toBe(true);
 expect((await read(full)).items.find(item=>item.key==='source-shipping:'+orderId)).toEqual(notice);
 const orderOnly=await createFixture(['auftraege'],'werkstatt');
 expect((await read(orderOnly)).items.some(item=>item.key==='source-shipping:'+orderId)).toBe(false);
 expect(await withSession(orderOnly,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{card:{id:orderId}}});
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:card.data.card.version,clientEventId:randomUUID()}));
 expect(moved.code).toBe('OK');if(moved.code!=='OK')throw Error('TEST_LIVE_STATION');
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId}))).toMatchObject({code:'OK',data:{handoverConsequences:{code:'NOT_APPLICABLE',orderId,orderVersion:moved.receipt.aggregateVersion}}});
 expect(errors).not.toHaveBeenCalledWith('[INVOICE_SHIPPING_PROPOSAL_FAILED]',expect.anything());
 }finally{errors.mockRestore();}
});

it('retains every known order exit when the actual final version read reaches its expired request budget',async()=>{
 const customer=await customerFixture('TEST L1 late version budget');
 const first=await intakeOrderFixture('TEST L1 late version first',customer),second=await intakeOrderFixture('TEST L1 late version second',customer);
 const ids=[first.receipt.orderId,second.receipt.orderId];
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_LATE_VERSION_AUTH');
 const {getTodayOrderReadAction}=await import('@/app/actions/orders.actions');
 const before=await withSession(full,()=>getTodayOrderReadAction({orderIds:ids}));expect(before.code).toBe('OK');if(before.code!=='OK')throw Error('TEST_LATE_VERSION_BATCH');
 expect(before.data.rows.every(row=>row.result.code==='OK')).toBe(true);
 // Controlled external clock only: actual source ports, native SQL, Auth and
 // final timeout guard are unchanged. Advance after the real batch has read.
 const realNow=Date.now.bind(Date);let offset=0,sawBatch=false,sawExpiredVersion=false;
 const clock=vi.spyOn(Date,'now').mockImplementation(()=>realNow()+offset);
 const logger=vi.spyOn(console,'info').mockImplementation((...args:unknown[])=>{
  if(args[0]!=='[PAGE_READ_PHASE]'||typeof args[1]!=='string')return;
  const phase=JSON.parse(args[1]) as {phase:string;counts:{failed?:number;ok?:number};reasons:string[]};
  if(phase.phase==='today.batch'&&phase.counts.ok===1){sawBatch=true;offset=DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs+1;}
  if(phase.phase==='today.versions'&&phase.counts.failed===1&&phase.reasons.includes('PAGE_READ_TIMEOUT'))sawExpiredVersion=true;
 });
 try{
  const today=await withSession(full,()=>withPageReadBudget(()=>readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction),DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs));
  expect(sawBatch).toBe(true);expect(sawExpiredVersion).toBe(true);
  for(const orderId of ids){
   expect(today.orderActions?.missingOrderIds).toContain(orderId);
   expect(today.orderActions?.rows.some(row=>row.orderId===orderId)).toBe(false);
   const notices=today.items.filter(item=>item.key==='source-order:'+orderId);
   expect(notices).toHaveLength(1);expect(notices[0]).toMatchObject({orderId,primaryActionLabel:'Auftrag öffnen',urgency:'warning'});
  }
 }finally{logger.mockRestore();clock.mockRestore();}
});

it('batches the actual shipping header once without changing zero, one, several, stale or denied proposal results',async()=>{
 const {readInvoiceShippingConsequences,readInvoiceShippingConsequencesBatch}=await import('@/lib/server/commands/immutableInvoiceCommand');
 const {readInvoiceVat}=await import('@/modules/accounting/server-public');
 const {readShippingSettingsInTransaction}=await import('@/modules/fundament/server-public');
 const customer=await customerFixture('TEST L1 shipping batch');
 const intake=await intakeOrderFixture('TEST L1 shipping batch intake',customer);
 const ready=await readyInvoiceOrder('TEST L1 shipping batch issued','pickup',false,customer);
 const secondReady=await readyInvoiceOrder('TEST L1 shipping batch second issued','pickup',false,customer);
 const inputs=[{orderId:intake.receipt.orderId,expectedVersion:intake.receipt.orderVersion},{orderId:ready.orderId,expectedVersion:ready.version},{orderId:secondReady.orderId,expectedVersion:secondReady.version}];
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_SHIPPING_BATCH_AUTH');
 const expected=await Promise.all(inputs.map(input=>readInvoiceShippingConsequences(auth.data,input,readInvoiceVat,readShippingSettingsInTransaction)));
 const options=db.$client.options,previous=options.debug;let headers=0,issueSources=0,settingsReads=0,receiptQueries=0;
 const countedSettings:typeof readShippingSettingsInTransaction=async(...args)=>{settingsReads++;return readShippingSettingsInTransaction(...args);};
 options.debug=(_connection,statement)=>{if(statement.includes('private.read_invoice_shipping_headers_v1'))headers++;if(statement.includes('FROM private.v_invoice_issue_source_v2 source'))issueSources++;if(statement.includes('FROM private.v_invoice_receipt_v1')&&statement.includes("event.payload->'shippingCosts'"))receiptQueries++;};
 try{
  expect(await readInvoiceShippingConsequencesBatch(auth.data,[],readInvoiceVat,countedSettings)).toEqual(new Map());expect(headers).toBe(0);expect(issueSources).toBe(0);expect(settingsReads).toBe(0);expect(receiptQueries).toBe(0);
  const one=await readInvoiceShippingConsequencesBatch(auth.data,inputs.slice(0,1),readInvoiceVat,countedSettings);expect(headers).toBe(1);expect(one.get(inputs[0].orderId)).toEqual(expected[0]);expect(issueSources).toBe(0);
  headers=0;settingsReads=0;receiptQueries=0;const many=await readInvoiceShippingConsequencesBatch(auth.data,inputs,readInvoiceVat,countedSettings);expect(headers).toBe(1);expect(issueSources).toBe(1);expect(settingsReads).toBe(1);expect(receiptQueries).toBe(1);
  for(const [index,input] of inputs.entries())expect(many.get(input.orderId)).toEqual(expected[index]);
  expect(many.get(inputs[0].orderId)).toMatchObject({code:'NOT_APPLICABLE'});expect(many.get(ready.orderId)).toMatchObject({code:'OK'});
  const stale=await readInvoiceShippingConsequencesBatch(auth.data,[inputs[0],{...inputs[1],expectedVersion:inputs[1].expectedVersion+1}],readInvoiceVat,countedSettings);
  expect(stale.get(inputs[0].orderId)).toEqual(expected[0]);expect(stale.get(ready.orderId)).toMatchObject({code:'SOURCE_INCOMPLETE'});
  const deniedActor=await createFixture(['auftraege'],'werkstatt'),denied=await withSession(deniedActor,()=>resolveAuthorization());if(!denied.ok)throw Error('TEST_SHIPPING_BATCH_DENIED_AUTH');
  headers=0;settingsReads=0;receiptQueries=0;const hidden=await readInvoiceShippingConsequencesBatch(denied.data,inputs,readInvoiceVat,countedSettings);expect(headers).toBe(0);expect(settingsReads).toBe(0);expect(receiptQueries).toBe(0);expect([...hidden.values()]).toEqual(inputs.map(()=>undefined));
  const retry=await readInvoiceShippingConsequencesBatch(auth.data,JSON.parse(JSON.stringify(inputs)),readInvoiceVat,countedSettings);expect(retry).toEqual(many);
  const sourceBefore=await sql`SELECT id,version,station FROM public.orders WHERE tenant_id=${tenant} AND id IN (${ready.orderId},${secondReady.orderId}) ORDER BY id`;
  const fault:typeof readShippingSettingsInTransaction=async(tx,tenantId)=>{
   const source=await readShippingSettingsInTransaction(tx,tenantId);
   // Explicit synthetic native SQL fault after the real settings reader; no successful source is doubled.
   await tx.execute(drizzleSql`SELECT 1 / 0 AS test_m7_settings_failure`);return source;
  };
  const partial=await readInvoiceShippingConsequencesBatch(auth.data,inputs,readInvoiceVat,fault);
  expect(partial.get(inputs[0].orderId)).toEqual(expected[0]);
  for(const order of [ready,secondReady])expect(partial.get(order.orderId)).toMatchObject({code:'SOURCE_INCOMPLETE'});
  expect(await sql`SELECT id,version,station FROM public.orders WHERE tenant_id=${tenant} AND id IN (${ready.orderId},${secondReady.orderId}) ORDER BY id`).toEqual(sourceBefore);
  expect(await readInvoiceShippingConsequencesBatch(auth.data,JSON.parse(JSON.stringify(inputs)),readInvoiceVat,readShippingSettingsInTransaction)).toEqual(many);
 }finally{options.debug=previous;}
});

it('retains a concrete warning for an explicitly synthetic orphan freeze receipt on a real TEST order',async()=>{
 const customerId=await customerFixture('TEST Live beschädigter Fertigbeleg');
 const created=await intakeOrderFixture('TEST Live beschädigter Fertigbeleg',customerId),orderId=created.receipt.orderId;
 // Explicit invalid historical fixture in the isolated TEST tenant. No guard
 // is disabled; no healthy product receipt or Dev row is modified.
 await sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,aggregate_version,correlation_id,from_station,station,created_at)
 VALUES(${randomUUID()},${tenant},${orderId},'ORDER_FROZEN_V1','TEST synthetic orphan historical freeze',${full.actorId}::uuid,${sql.json({freezeId:randomUUID(),rateId:randomUUID(),hourlyRateCents:14000,totalAmountCents:10000,lineCount:1})},'success',${randomUUID()}::uuid,1,${created.receipt.orderVersion},${randomUUID()}::uuid,'galvanik','fertig',statement_timestamp())`;
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
 expect(card).toMatchObject({code:'OK',data:{handoverConsequences:{code:'SOURCE_INCOMPLETE',orderId}}});
 const today=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_LIVE_AUTH');return readTodayDashboard(auth.data,getComplaints,getQuoteFollowupsForTodayAction);});
 const notice=today.items.find(item=>item.key==='source-shipping:'+orderId);
 expect(notice).toMatchObject({orderId,orderVersion:created.receipt.orderVersion,field:'action',urgency:'warning',primaryActionLabel:'Auftrag öffnen'});
 expect(notice?.title).toContain('Quelle nicht lesbar.');
 expect(notice?.title.length).toBeLessThanOrEqual(90);
 expect((await withSession(full,()=>getLiveOrderCardAction({orderId}))).code).toBe('OK');
});

});

// The deliberately unreadable append-only initial TEST original is last so it
// cannot pollute earlier independent scenarios; no guard/receipt is removed.

});
