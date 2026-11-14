// @vitest-environment node
// PL14Nov13:40: real existing Actions/Auth/DB/Storage; provider boundary only doubled.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,readyOrderForInvoice,customerFixture} from '../../../e2e/ablauf/orderFixture';
import {saveManualTrackingAction,getLiveOrderCardAction,changeOrderPickupNoticeAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction,cancelInvoiceAction} from '@/app/actions/invoices.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {SHIPPING_FEE_COPY} from '@/ui/situationCatalog';
beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});
const group=(a:string,b:string)=>({orderId:a,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'91345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b,shipmentId:null,expectedUpdatedAt:null}});

it('KORR1 rejects two already charged actual originals without writing a shipment, event or cancellation; retry remains no effect',async()=>{
 const a=await readyInvoiceOrder('TEST KORR1 fee A','shipping'),b=await readyInvoiceOrder('TEST KORR1 fee B','shipping',false,a.customerId);
 const request=group(a.orderId,b.orderId),before=await sql`SELECT id::text,pdf_sha256,status FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${a.customerId} ORDER BY id`;
 const expected={code:'CONFLICT',message:SHIPPING_FEE_COPY.groupAlreadyCharged(a.invoice.invoiceNumber,b.invoice.invoiceNumber)};
 expect(await withSession(full,()=>saveManualTrackingAction(request))).toEqual(expected);
 expect(await withSession(full,()=>saveManualTrackingAction(JSON.parse(JSON.stringify(request))))).toEqual(expected);
 expect(await sql`SELECT id FROM public.shipments WHERE tenant_id=${tenant} AND order_id IN (${a.orderId},${b.orderId})`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${request.clientEventId}::uuid`).toHaveLength(0);
 expect(await sql`SELECT id::text,pdf_sha256,status FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${a.customerId} ORDER BY id`).toEqual(before);
});

it('KORR1/4 permits one original fee, writes an explicit reference and is independent of display copy even at zero cents',async()=>{
 const a=await readyOrderForInvoice('TEST KORR4 zero fee A','shipping'),b=await readyOrderForInvoice('TEST KORR4 zero fee B','shipping',a.customerId);
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('TEST_SETTINGS_REQUIRED');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberHint:settings.settings.numberHint,numberPattern:settings.settings.numberPattern,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,shippingFeeCents:0}))).toMatchObject({code:'OK'});
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:a.orderId,expectedVersion:a.version,clientEventId:randomUUID()}));if(issued.code!=='OK')throw Error('TEST_REAL_ZERO_FEE_INVOICE');
 const linked=await withSession(full,()=>saveManualTrackingAction(group(a.orderId,b.orderId)));expect(linked).toMatchObject({code:'OK'});
 // Isolated catalogue variation; original PDF/snapshot bytes remain untouched.
 const oldLabel=SHIPPING_FEE_COPY.line;
 try{
  (SHIPPING_FEE_COPY as {line:string}).line='TEST anderer Anzeigetext';
  expect(await withSession(full,()=>issueInvoiceAction({orderId:b.orderId,expectedVersion:b.version,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 }finally{(SHIPPING_FEE_COPY as {line:string}).line=oldLabel;}
 const originals=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${tenant} AND order_id IN (${a.orderId},${b.orderId}) ORDER BY invoice_number`;
 expect(originals[0].snapshot.lines.filter((line:{type:string})=>line.type==='SHIPPING')).toEqual([expect.objectContaining({shippingKind:'fee',amountCents:0})]);
 expect(originals[1].snapshot.lines.filter((line:{type:string})=>line.type==='SHIPPING')).toEqual([expect.objectContaining({shippingKind:'reference',amountCents:0,name:SHIPPING_FEE_COPY.inInvoice(issued.receipt.invoiceNumber)})]);
});

it('KORR5 reads the real versioned card while the customer and invoice writer locks are held in another transaction',async()=>{
 const order=await readyInvoiceOrder('TEST KORR5 lock-free card','shipping');
 let release!:()=>void,locked!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;}),ready=new Promise<void>(resolve=>{locked=resolve;});
 const writer=sql.begin(async tx=>{await tx`SELECT private.lock_shipping_customer_v1(${tenant},${order.customerId})`;await tx`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND id=${order.invoice.invoiceId}::uuid FOR UPDATE`;locked();await hold;});
 await ready;
 try{
  const read=withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
  const first=await Promise.race([read,new Promise<null>(resolve=>setTimeout(()=>resolve(null),2000))]);
  expect(first).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK'}}});
 }finally{release();await writer;}
});

it.each(['invoice','handover'] as const)('KORR6 rechecks the selected customer after a real lock wait before any %s effect',async kind=>{
 const order=await readyOrderForInvoice('TEST KORR6 customer race '+kind,'pickup');
 const other=await customerFixture('TEST KORR6 replacement customer');
 let release!:()=>void,locked!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;}),ready=new Promise<void>(resolve=>{locked=resolve;});
 const writer=sql.begin(async tx=>{await tx`SELECT private.lock_shipping_customer_v1(${tenant},${order.customerId})`;locked();await hold;});
 await ready;const key=randomUUID();
 const action=kind==='invoice'?withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version,clientEventId:key})):withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:key,handoverMode:'shipping'}));
 try{
  let waiting=false;
  for(let attempt=0;attempt<100&&!waiting;attempt++){
   const blocked=await sql`SELECT pid FROM pg_stat_activity WHERE wait_event='advisory' AND query LIKE '%SELECT customer_id,private.lock_shipping_customer_v1%'`;
   waiting=blocked.length>0;if(!waiting)await new Promise(resolve=>setTimeout(resolve,30));
  }
  expect(waiting,'the real writer must have selected its customer before waiting').toBe(true);
  // Explicit synthetic concurrent customer-change boundary, inside this TEST tenant.
  await sql`UPDATE public.orders SET customer_id=${other} WHERE tenant_id=${tenant} AND id=${order.orderId}`;
  release();await writer;
  expect(await action).toMatchObject({code:'CONFLICT'});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${key}::uuid`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toHaveLength(0);
 }finally{release();await writer;await action;await sql`UPDATE public.orders SET customer_id=${order.customerId} WHERE tenant_id=${tenant} AND id=${order.orderId}`;}
});

it('KORR2 reuses a real imported MIME handover, actual assignment/effect and the same original-bound reissue command',async()=>{
 const order=await readyInvoiceOrder('TEST KORR2 mail handover','shipping');
 const {installMailProvider}=await import('../../../e2e/ablauf/mailProvider');
 const {importOutlookMailAction}=await import('@/app/actions/communications.actions');
 const {getIntakeAssignmentAction,assignIntakeCustomerAction,getIntakeCaptureAction,selectIntakeConcernAction}=await import('@/app/actions/eingang.actions');
 const [{email}]=await sql`SELECT email FROM public.customers WHERE tenant_id=${tenant} AND id=${order.customerId}`;
 const graphId='TEST-S09-mail-handover-'+randomUUID();installMailProvider(graphId,'Hole ich ab.',email,'TEST Abholung');
 try{
  const imported=await withSession(full,()=>importOutlookMailAction(graphId));if(imported.code!=='OK')throw Error('TEST_REAL_MIME_REQUIRED');
  const assignment=await withSession(full,()=>getIntakeAssignmentAction({itemId:imported.itemId,mode:'normal'}));if(assignment.code!=='OK')throw Error('TEST_ASSIGNMENT_REQUIRED');
  expect(await withSession(full,()=>assignIntakeCustomerAction({itemId:imported.itemId,version:assignment.view.version,clientEventId:randomUUID(),customerId:order.customerId,mode:'manual'}))).toMatchObject({code:'OK'});
  const capture=await withSession(full,()=>getIntakeCaptureAction(imported.itemId));if(capture.code!=='OK')throw Error('TEST_REAL_SOURCE_READ');
  const selected=await withSession(full,()=>selectIntakeConcernAction({itemId:imported.itemId,version:capture.capture.version,clientEventId:randomUUID(),concern:'abholung'}));if(selected.code!=='OK')throw Error('TEST_EXPLICIT_CONCERN_REQUIRED');
  const request={command:'handover_from_mail',sourceItemId:imported.itemId,sourceVersion:selected.capture.version,orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
  const applied=await withSession(full,()=>changeOrderPickupNoticeAction(request));expect(applied,JSON.stringify(applied)).toMatchObject({code:'OK',receipt:{outcome:'changed',handoverMode:'pickup'}});
  expect(await withSession(full,()=>changeOrderPickupNoticeAction(JSON.parse(JSON.stringify(request))))).toMatchObject({code:'OK',replayed:true});
  const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));if(card.code!=='OK'||card.data.handoverConsequences?.code!=='OK')throw Error('TEST_REAL_CONSEQUENCE_REQUIRED');
  const proposal=card.data.handoverConsequences.reissueWithoutShipping;expect(proposal).not.toBeNull();if(!proposal)throw Error('TEST_MAIL_REISSUE_SOURCE_REQUIRED');
  const input={...proposal.befehl.argumente,clientEventId:randomUUID(),reissueWithoutShipping:{...proposal.befehl.argumente.reissueWithoutShipping,replacementClientEventId:randomUUID()}};
  expect(await withSession(full,()=>cancelInvoiceAction(input))).toMatchObject({code:'OK',replacementReceipt:{netAmountCents:10000}});
  expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 }finally{vi.restoreAllMocks();}
});
