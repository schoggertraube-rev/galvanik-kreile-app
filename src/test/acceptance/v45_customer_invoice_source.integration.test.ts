// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture,nativeFetch} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readCustomerSummary} from '@/lib/server/customerSummaryRead';
import {cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {sendCustomerMailAction} from '@/app/actions/communications.actions';
import {getCustomerSummaryAction} from '@/app/actions/customers.actions';

it('reads current unsent invoice originals from the customer port and never discloses the financial count without geld',async()=>{
 const customerId=await customerFixture('V45 offene Originale'),auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_AUTH');
 expect(await readCustomerSummary(auth.data,{customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
 const order=await readyInvoiceOrder('V45 Rechnung', 'pickup',false,customerId);
 const read=await readCustomerSummary(auth.data,{customerId});expect(read,JSON.stringify(read.code==='OK'?read.data.nextActionRule:read)).toMatchObject({code:'OK',data:{invoiceUnsentCount:1,nextActionRule:{code:'OK',ruleId:'kunde.rechnung',source:{kind:'customer',id:customerId}}}});
 expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:1,nextActionRule:{code:'OK',ruleId:'kunde.rechnung',source:{kind:'customer',id:customerId}}}});
 // The metrics port legitimately advances asOf on every read. The persisted
 // invoice evidence/count, not that read timestamp, must stay the same.
 expect(await readCustomerSummary(auth.data,{customerId})).toMatchObject({code:'OK',data:{id:customerId,invoiceUnsentCount:1}});
 const actionRead=await withSession(full,()=>getCustomerSummaryAction({customerId}));
 expect(actionRead).toMatchObject({code:'OK',data:{invoiceUnsentOriginals:[{id:order.invoice.invoiceId}],nextActionRule:{code:'OK',hauptaktion:{elementId:'customer.invoice',befehl:{funktion:'sendCustomerMailAction',argumente:{targetType:'CUSTOMER',targetId:customerId,expectedInvoiceIds:[order.invoice.invoiceId]}}}}}});
 if(actionRead.code!=='OK'||actionRead.data.nextActionRule?.code!=='OK'||!actionRead.data.nextActionRule.hauptaktion)throw Error('TEST_CUSTOMER_PRIMARY');
 expect(actionRead.data.nextActionRule.hauptaktion.werte.number).toBe(actionRead.data.invoiceUnsentOriginals?.[0]?.number);
 expect(actionRead.data.nextActionRule.erstblick).toHaveLength(5);
 expect(actionRead.data.nextActionRule.weitere).toEqual([]);
 expect(actionRead.data.nextActionRule.quelle.erwartungSha256).toMatch(/^[a-f0-9]{64}$/);
 expect(actionRead.data.nextActionRule.erstblick.map(row=>row.key)).toContain('kunde.kachel.debt');
 expect(actionRead.data.nextActionRule.erstblick.map(row=>row.key)).not.toContain('kunde.kachel.messages');
 expect(actionRead.data.nextActionRule.weitereInformationen).toMatchObject([{key:'kunde.kachel.messages',werte:{offeneNachrichten:0}}]);
 expect(actionRead.data.nextActionRule.erstblick.find(row=>row.key==='kunde.kachel.orders')).toMatchObject({werte:{offeneAuftraege:1,offeneKv:0}});
 const moneyOnly=await createFixture(['kunden','geld']);
 const noMail=await withSession(moneyOnly,()=>getCustomerSummaryAction({customerId}));
 expect(noMail).toMatchObject({code:'OK',data:{nextActionRule:{code:'OK',weitereInformationen:[]}}});
 if(noMail.code!=='OK'||noMail.data.nextActionRule?.code!=='OK'||!noMail.data.nextActionRule.hauptaktion)throw Error('TEST_MONEY_ONLY_FIRST_LOOK');
 expect(noMail.data.nextActionRule.erstblick).toHaveLength(5);
 expect(JSON.stringify(noMail.data.nextActionRule)).not.toContain('offeneNachrichten');


 const otherId=await customerFixture('V45 anderer Kunde');expect(await readCustomerSummary(auth.data,{customerId:otherId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
 const restricted=await createFixture(['kunden'],'werkstatt'),noMoney=await withSession(restricted,()=>resolveAuthorization());if(!noMoney.ok)throw Error('TEST_NO_MONEY_AUTH');
 const hidden=await readCustomerSummary(noMoney.data,{customerId});expect(hidden.code).toBe('OK');if(hidden.code!=='OK')throw Error('TEST_CUSTOMER_READ');expect(hidden.data).not.toHaveProperty('invoiceUnsentCount');expect(hidden.data).not.toHaveProperty('invoiceUnsentOriginals');expect(hidden.data.nextActionRule).toMatchObject({code:'OK',source:{kind:'customer',id:customerId}});
 const publicHidden=await withSession(restricted,()=>getCustomerSummaryAction({customerId}));expect(publicHidden.code).toBe('OK');if(publicHidden.code!=='OK')throw Error('TEST_CUSTOMER_ACTION_READ');expect(publicHidden.data).not.toHaveProperty('invoiceUnsentCount');
 const cancel={invoiceId:order.invoice.invoiceId,expectedVersion:1,clientEventId:randomUUID(),reason:'TEST nicht mehr zu versenden'};
 expect(await withSession(full,()=>cancelInvoiceAction(cancel))).toMatchObject({code:'OK'});
 expect(await readCustomerSummary(auth.data,{customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(cancel))))).toMatchObject({code:'OK',replayed:true});
 expect(await readCustomerSummary(auth.data,{customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
},60000);

it('uses the actual document dispatch proof after sending, including a fresh retry',async()=>{
 const order=await readyInvoiceOrder('V45 Versandbeleg'),auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_AUTH');
 expect(await readCustomerSummary(auth.data,{customerId:order.customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:1,nextActionRule:{code:'OK',ruleId:'kunde.rechnung',source:{kind:'customer',id:order.customerId}}}});
 let sends=0;
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-V45-dispatch-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;return new Response(null,{status:202});}
  return nativeFetch(request,init);
 });
 try{
  const input={targetType:'ORDER' as const,targetId:order.orderId,subject:'TEST V45 Rechnung',body:'TEST Rechnung im Original',clientRequestId:randomUUID(),attachment:{kind:'INVOICE' as const,documentId:order.invoice.invoiceId},expectedInvoiceIds:[order.invoice.invoiceId]};
  expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK'});
  expect(await readCustomerSummary(auth.data,{customerId:order.customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(await readCustomerSummary(auth.data,{customerId:order.customerId})).toMatchObject({code:'OK',data:{invoiceUnsentCount:0}});expect(sends).toBe(1);
  const reread=await readCustomerSummary(auth.data,{customerId:order.customerId});expect(reread).toMatchObject({code:'OK',data:{nextActionRule:{code:'OK'}}});
 }finally{provider.mockRestore();}
},60000);

it('CB21:00 sends two current originals through the existing main action in one physical mail',async()=>{
 const customerId=await customerFixture('TEST U2 mehrere Originale');
 const first=await readyInvoiceOrder('TEST U2 Original A','pickup',false,customerId);
 const second=await readyInvoiceOrder('TEST U2 Original B','pickup',false,customerId);
 const read=await withSession(full,()=>getCustomerSummaryAction({customerId}));
 expect(read).toMatchObject({code:'OK',data:{invoiceUnsentCount:2,invoiceUnsentOriginals:[{id:first.invoice.invoiceId},{id:second.invoice.invoiceId}],nextActionRule:{code:'OK',hauptaktion:{elementId:'customer.invoice',befehl:{argumente:{attachment:{kind:'INVOICE',documentId:first.invoice.invoiceId},expectedInvoiceIds:[first.invoice.invoiceId,second.invoice.invoiceId]}}}}}});
 if(read.code!=='OK'||read.data.nextActionRule?.code!=='OK'||!read.data.nextActionRule.hauptaktion)throw Error('TEST_MULTIPLE_PRIMARY');
 expect(read.data.nextActionRule.hauptaktion.werte.number).toBe(read.data.invoiceUnsentOriginals!.map(row=>row.number).join(', '));
 let sends=0,attachmentCount=0;
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(request,init)=>{
  const url=new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-U2-bundle-token'.repeat(4),expires_in:3600});
  if(url.hostname==='graph.microsoft.com'&&url.pathname.endsWith('/sendMail')){sends++;attachmentCount=JSON.parse(String(init?.body)).message.attachments.length;return new Response(null,{status:202});}
  return nativeFetch(request,init);
 });
 try{
  const input={...read.data.nextActionRule.hauptaktion.befehl.argumente,subject:'TEST beide Rechnungen',body:'TEST gespeicherte Originale',clientRequestId:randomUUID()} as Parameters<typeof sendCustomerMailAction>[0];
  expect(await withSession(full,()=>sendCustomerMailAction(input))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>sendCustomerMailAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',data:{replayed:true}});
  expect(sends).toBe(1);expect(attachmentCount).toBe(2);
  expect(await withSession(full,()=>getCustomerSummaryAction({customerId}))).toMatchObject({code:'OK',data:{invoiceUnsentCount:0,invoiceUnsentOriginals:[]}});
 }finally{provider.mockRestore();}
});

it('retains the same customer first look when the higher-priority action source is still incomplete',async()=>{
 const customerId=await customerFixture('TEST U2 unvollstaendige Handlungsquelle');
 const read=await withSession(full,()=>getCustomerSummaryAction({customerId}));if(read.code!=='OK')throw Error('TEST_CUSTOMER_INCOMPLETE');
 expect(read.data.nextActionRule).toMatchObject({code:'OK',hauptaktion:null,source:{kind:'customer',id:customerId}});
 const next=read.data.nextActionRule;if(!next||!('erstblick'in next)||!Array.isArray(next.erstblick))throw Error('TEST_CUSTOMER_FIRST_LOOK_LOST');
 expect(next.erstblick).toHaveLength(5);expect(next.erstblick.find(row=>row.key==='kunde.kachel.orders')?.werte).toEqual({offeneAuftraege:0,offeneKv:0});
 const actor=await createFixture(['kunden'],'werkstatt');
 const hidden=await withSession(actor,()=>getCustomerSummaryAction({customerId}));if(hidden.code!=='OK')throw Error('TEST_CUSTOMER_NO_MONEY');
 expect(hidden.data.nextActionRule).toMatchObject({code:'OK',hauptaktion:null,source:{id:customerId}});
 const operational=hidden.data.nextActionRule;if(!operational||!('erstblick'in operational)||!Array.isArray(operational.erstblick))throw Error('TEST_CUSTOMER_OPERATIONAL_FIRST_LOOK');
 expect(operational.erstblick.length).toBeLessThanOrEqual(5);
 expect(JSON.stringify(operational)).not.toMatch(/Cents|offeneForderungen|netto|umsatz/);
 const reread=await withSession(full,()=>getCustomerSummaryAction({customerId}));if(reread.code!=='OK')throw Error('TEST_CUSTOMER_REPEAT');
 expect(reread.data.nextActionRule).toMatchObject({code:'OK',hauptaktion:null,erstblick:next.erstblick});
});
