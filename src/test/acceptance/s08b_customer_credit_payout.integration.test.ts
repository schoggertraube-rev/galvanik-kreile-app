// @vitest-environment node
// PL A08b: real invoice/payment/cancellation/payout Actions/Auth/DB/Storage.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {confirmPaymentAction} from '@/app/actions/payments.actions';
import {getProductionWeekAction} from '@/app/actions/orders.actions';
import {cancelInvoiceAction,getCustomerCreditAction,payoutCustomerCreditAction} from '@/app/actions/invoices.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import type {CustomerCreditPayoutInput} from '@/modules/accounting/public';

beforeAll(()=>{
 const url=process.env.DATABASE_URL;
 if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S08B_LOOPBACK_REQUIRED');
});
async function creditedCustomer(label:string){
 const source=await readyInvoiceOrder('TEST S08b '+label,'pickup',false,undefined,8403);
 expect(await withSession(full,()=>confirmPaymentAction({invoiceId:source.invoice.invoiceId,amount:4000,method:'bar',expectedVersion:0,expectedOpenAmountCents:10000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>cancelInvoiceAction({invoiceId:source.invoice.invoiceId,expectedVersion:1,reason:'TEST S08b actual paid cancellation',clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:4000,version:1}});
 const input:CustomerCreditPayoutInput={customerId:source.customerId,amount:4000,expectedCreditVersion:1,clientEventId:randomUUID(),method:'bar',reference:null,note:null};
 return {source,input};
}

it('A08b-1/-5/-8 pays actual credit once through the existing queue and retains the receipt across reload without invoice/payment/production changes',async()=>{
 const {source,input}=await creditedCustomer('cash queue');
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId});
 const original={id:input.clientEventId,itemId:input.customerId,kind:'workshop' as const,command:'credit.payout' as const,input,deviceCapturedAt:'2026-11-13T10:00:00.000Z'};
 const before=await sql`SELECT event_type,count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN ('PAYMENT_CONFIRMED_V1','ORDER_ITEM_FINISHED_V1','ORDER_FINISHED_V1') GROUP BY event_type ORDER BY event_type`;
 const paymentsBefore=await sql`SELECT id,amount_eur::text,method,status FROM public.payments WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${source.invoice.invoiceId}::uuid ORDER BY id`;
 const weekBefore=await withSession(full,()=>getProductionWeekAction());if(weekBefore.code!=='OK')throw Error('TEST_S08B_WEEK_SOURCE');
 const effects=await Promise.all([withSession(full,()=>replayOfflineWorkshopAction(scope,original)),withSession(full,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))]);
 for(const effect of effects)expect(effect).toMatchObject({code:'OK',financialCommand:'credit.payout',receipt:{amountCents:4000,balanceCents:0,creditVersion:2,method:'bar',actorId:full.actorId},offlineReceipt:{clientEventId:input.clientEventId}});
 expect(effects.filter(row=>row.code==='OK'&&'replayed'in row&&!row.replayed)).toHaveLength(1);
 expect(await withSession(full,()=>payoutCustomerCreditAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await withSession(full,()=>getCustomerCreditAction(source.customerId))).toMatchObject({code:'OK',credit:{balanceCents:0,version:2}});
 const rows=await sql`SELECT event.description,event.user_id::text,entry.amount_cents::text,entry.invoice_id,entry.payment_method FROM public.events event JOIN public.customer_credit_entries entry ON entry.tenant_id=event.tenant_id AND entry.idempotency_key=event.client_event_id::text WHERE event.tenant_id=${KREILE_TENANT_SLUG} AND event.client_event_id=${input.clientEventId}::uuid`;
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({user_id:full.actorId,amount_cents:'-4000',invoice_id:null,payment_method:'bar'});
 const customer=await sql`SELECT name FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.customerId}`;
 expect(rows[0].description).toBe(`40,00 € Guthaben an ${customer[0].name} ausgezahlt (bar)`);
 expect(await withSession(full,()=>getCustomerCreditAction(input.customerId))).toMatchObject({code:'OK',payoutHistory:{code:'OK',entries:[{description:rows[0].description,amountCents:4000,actorId:full.actorId,method:'bar'}]}});
 expect(await sql`SELECT event_type,count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type IN ('PAYMENT_CONFIRMED_V1','ORDER_ITEM_FINISHED_V1','ORDER_FINISHED_V1') GROUP BY event_type ORDER BY event_type`).toEqual(before);
 expect(await sql`SELECT id,amount_eur::text,method,status FROM public.payments WHERE tenant_id=${KREILE_TENANT_SLUG} AND invoice_id=${source.invoice.invoiceId}::uuid ORDER BY id`).toEqual(paymentsBefore);
 const weekAfter=await withSession(full,()=>getProductionWeekAction());if(weekAfter.code!=='OK')throw Error('TEST_S08B_WEEK_READBACK');
 expect(weekAfter.data.netCents).toBe(weekBefore.data.netCents);
 expect(weekAfter.data.currentlyUnpricedItemCount).toBe(weekBefore.data.currentlyUnpricedItemCount);
});

it('A08b-2/-6/-9 validates method and both transfer reference facts, then stores one actual partial payout',async()=>{
 const {input}=await creditedCustomer('transfer');
 expect(await withSession(full,()=>payoutCustomerCreditAction({...input,method:undefined} as unknown as CustomerCreditPayoutInput))).toMatchObject({code:'VALIDATION_ERROR',message:'Wie wurde ausgezahlt? Wähle bar oder Überweisung'});
 expect(await withSession(full,()=>payoutCustomerCreditAction({...input,method:'ueberweisung'}))).toMatchObject({code:'VALIDATION_ERROR',message:'Referenz der Überweisung fehlt – trag Datum und Verwendungszweck ein'});
 const transfer={...input,amount:2500,method:'ueberweisung' as const,reference:{date:'2026-11-13',purpose:'TEST Erstattung R1'}};
 expect(await withSession(full,()=>payoutCustomerCreditAction({...transfer,reference:{...transfer.reference,date:'2026-02-30'}}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>payoutCustomerCreditAction(transfer))).toMatchObject({code:'OK',receipt:{balanceCents:1500,method:'ueberweisung'}});
 expect(await withSession(full,()=>getCustomerCreditAction(input.customerId))).toMatchObject({code:'OK',credit:{balanceCents:1500,version:2}});
 const saved=await sql`SELECT reference FROM public.customer_credit_entries WHERE tenant_id=${KREILE_TENANT_SLUG} AND idempotency_key=${input.clientEventId}`;
 expect(JSON.parse(saved[0].reference)).toEqual(transfer.reference);
 expect(await withSession(full,()=>payoutCustomerCreditAction({...transfer,reference:{...transfer.reference,purpose:'TEST changed'}}))).toMatchObject({code:'CONFLICT'});
});

it('A08b-3/-4 rejects excess and serializes two different original keys against the same actual balance',async()=>{
 const {input}=await creditedCustomer('parallel');
 expect(await withSession(full,()=>payoutCustomerCreditAction({...input,amount:5000}))).toMatchObject({code:'CONFLICT',currentCreditBalanceCents:4000});
 const effects=await Promise.all([withSession(full,()=>payoutCustomerCreditAction(input)),withSession(full,()=>payoutCustomerCreditAction({...input,clientEventId:randomUUID()}))]);
 expect(effects.filter(row=>row.code==='OK')).toHaveLength(1);
 expect(effects.find(row=>row.code!=='OK')).toMatchObject({code:'CONFLICT',currentCreditBalanceCents:0});
 expect(await withSession(full,()=>getCustomerCreditAction(input.customerId))).toMatchObject({code:'OK',credit:{balanceCents:0,version:2}});
});

it('A08b-7 denies a real login without money and another authorized actor cannot claim the first actor original',async()=>{
 const {input}=await creditedCustomer('rights');
 const noMoney=await createFixture(['kunden'],'buero');
 expect(await withSession(noMoney,()=>payoutCustomerCreditAction(input))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(full,()=>getCustomerCreditAction(input.customerId))).toMatchObject({code:'OK',credit:{balanceCents:4000,version:1}});
 expect(await withSession(full,()=>payoutCustomerCreditAction(input))).toMatchObject({code:'OK'});
 const other=await createFixture(['geld'],'buero');
 expect(await withSession(other,()=>payoutCustomerCreditAction(input))).toMatchObject({code:'CONFLICT'});
});

it('A08b a suppressed persisted event rolls payout back and the same original key has a real retry',async()=>{
 const {input}=await creditedCustomer('event rollback');
 const fault='test_s08b_'+randomUUID().replaceAll('-','');
 if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.event_type='CUSTOMER_CREDIT_PAYOUT_V1' AND NEW.client_event_id='${input.clientEventId}'::uuid THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>payoutCustomerCreditAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await withSession(full,()=>getCustomerCreditAction(input.customerId))).toMatchObject({code:'OK',credit:{balanceCents:4000,version:1}});
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 expect(await withSession(full,()=>payoutCustomerCreditAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(full,()=>payoutCustomerCreditAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
});

it('A08b explicitly synthetic malformed historical payout receipt keeps the canonical balance but marks its history unknown',async()=>{
 const {input}=await creditedCustomer('synthetic malformed history');
 const eventId=randomUUID(),entryId=randomUUID(),key=randomUUID();
 // Isolated synthetic historical corruption boundary, not a payout writer proof.
 await sql.begin(async tx=>{
  await tx`SELECT set_config('app.tenant_id',${KREILE_TENANT_SLUG},true)`;
  await tx`INSERT INTO public.events(id,tenant_id,event_type,user_id,client_event_id,description,payload)
   VALUES(${eventId},${KREILE_TENANT_SLUG},'CUSTOMER_CREDIT_PAYOUT_V1',${full.actorId}::uuid,${key}::uuid,'TEST synthetic malformed historical receipt',${tx.json({creditEntryId:entryId,customerId:input.customerId,amountCents:1,method:'bar',reference:null,receipt:{}})}::jsonb)`;
  expect(await tx`SELECT event_type,user_id::text,client_event_id::text,payload->>'creditEntryId' AS entry_id,payload->>'customerId' AS customer_id,payload->>'amountCents' AS amount_cents,payload->>'method' AS method,payload->>'reference' AS reference FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${eventId}`).toEqual([{event_type:'CUSTOMER_CREDIT_PAYOUT_V1',user_id:full.actorId,client_event_id:key,entry_id:entryId,customer_id:input.customerId,amount_cents:'1',method:'bar',reference:null}]);
  await tx`INSERT INTO public.customer_credit_entries(id,tenant_id,customer_id,kind,amount_cents,payment_method,actor_user_id,idempotency_key)
   VALUES(${entryId}::uuid,${KREILE_TENANT_SLUG},${input.customerId},'auszahlung',-1,'bar',${full.actorId}::uuid,${key})`;
 });
 expect(await withSession(full,()=>getCustomerCreditAction(input.customerId))).toMatchObject({code:'OK',credit:{balanceCents:3999,version:2},payoutHistory:{code:'SOURCE_INCOMPLETE'}});
});
