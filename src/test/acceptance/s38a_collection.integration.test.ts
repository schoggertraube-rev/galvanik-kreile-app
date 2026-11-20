// @vitest-environment node
// S38a A5/A6: real handover/agreement/invoice commands and DB, isolated TEST tenant.
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {saveCustomerAgreementAction} from '@/app/actions/customers.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {issueInvoiceAction,addOrderToCollectionAction} from '@/app/actions/invoices.actions';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {withRestoredTestSource} from '@/test/fixtures/restoredTestSource';
import {E_INVOICE_COPY} from '@/ui/situationCatalog';

beforeAll(()=>{
 const url=process.env.DATABASE_URL;
 if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/postgres')throw Error('TEST_S38_COLLECTION_LOOPBACK_REQUIRED');
});

it('S38 canonical customer terms preserve the concrete E-invoice name correction before any number or write, then the same original request succeeds',async()=>{
 const customerId=await customerFixture('TEST S38 terms field validation');
 const order=await readyOrderForInvoice('TEST S38 name correction','pickup',customerId);
 const input={orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID()};
 const read=async()=>{const rows=await sql`SELECT row_to_json(customer)::jsonb AS original FROM public.customers customer WHERE tenant_id=${tenant} AND id=${customerId}`;if(rows.length!==1)throw Error('TEST_CUSTOMER_ORIGINAL_REQUIRED');return rows[0].original;};
 const columns=await sql`SELECT attname AS name FROM pg_attribute WHERE attrelid='public.customers'::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='' AND attidentity='' ORDER BY attnum`;
 if(!columns.length||columns.some(column=>typeof column.name!=='string'||!/^[a-z_][a-z0-9_]*$/.test(column.name)))throw Error('TEST_CUSTOMER_COLUMN_CONTRACT_REQUIRED');
 const names=columns.map(column=>'"'+column.name+'"').join(',');
 mkdirSync('.git/kreile-r24-customer-validation-originals',{recursive:true});writeFileSync('.git/kreile-r24-customer-validation-originals/'+customerId+'.json',JSON.stringify(await read()));
 await withRestoredTestSource({label:'TEST S38 customer name before canonical terms',read,restore:async original=>{
  await sql.unsafe(`UPDATE public.customers SET (${names})=(SELECT ${names} FROM jsonb_populate_record(NULL::public.customers,$1::text::jsonb)) WHERE tenant_id=$2 AND id=$3`,[JSON.stringify(original),tenant,customerId]);
 }},async()=>{
  await sql`UPDATE public.customers SET name='' WHERE tenant_id=${tenant} AND id=${customerId}`;
  expect(await withSession(full,()=>issueInvoiceAction(input))).toMatchObject({code:'VALIDATION_ERROR',message:E_INVOICE_COPY.missingSource('name'),source:{kind:'customer',objectId:customerId,field:'name'}});
  expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND event_type='INVOICE_CREATED_V1' AND client_event_id=${input.clientEventId}::uuid`).toHaveLength(0);
 });
 const created=await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))));
 expect(created).toMatchObject({code:'OK'});if(created.code!=='OK')throw Error('TEST_CUSTOMER_CORRECTION_ORIGINAL_REQUIRED');
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{invoiceId:created.receipt.invoiceId}});
});

it('A38a A5/A6 joins two actual handovers to one open monthly collection and rejects a single invoice before numbering',async()=>{
 const customerId=await customerFixture('TEST S38a monthly handovers');
 const orders=[await readyOrderForInvoice('TEST S38a collection A','pickup',customerId),await readyOrderForInvoice('TEST S38a collection B','pickup',customerId)];
 const saved=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:null,clientKey:randomUUID(),type:'sammelrechnung',targetDays:30,reason:'TEST S38a monthly original'}));
 if(saved.code!=='OK')throw Error('TEST_S38A_COLLECTION_AGREEMENT:'+saved.code);
 const agreement={id:saved.agreement.id,version:saved.agreement.version,type:'sammelrechnung' as const};
 const [ready]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${orders[0].orderId}`;
 const other=await createFixture(['preise']),denied=await createFixture(['auftraege']);
 const deniedCard=await withSession(denied,()=>getLiveOrderCardAction({orderId:orders[0].orderId}));
 expect(deniedCard,JSON.stringify(deniedCard)).toMatchObject({code:'OK',data:{customerInformed:{code:'OK',collectionState:{collectionPlanned:true,collectionPrepared:false}},nextActionRule:{hauptaktion:null}}});
 if(deniedCard.code!=='OK')throw Error('TEST_COLLECTION_READ_RIGHT_REQUIRED');
 expect(deniedCard.data.nextActionRule?.gesperrt).toContainEqual({elementId:'order.collect',grundKey:'error.permission'});
 if(deniedCard.data.customerInformed?.code==='OK')expect(deniedCard.data.customerInformed.collectionState).not.toHaveProperty('targetDays');
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:orders[0].orderId}));
 expect(card,JSON.stringify(card)).toMatchObject({code:'OK',data:{customerInformed:{code:'OK',collectionState:{collectionPlanned:true,collectionPrepared:false}}}});
 if(card.code!=='OK')throw Error('TEST_COLLECTION_PLAN_CARD_REQUIRED');
 const primary=card.data.nextActionRule?.hauptaktion;
 expect(primary,JSON.stringify(card.data.nextActionRule)).toMatchObject({befehl:{funktion:'addOrderToCollectionAction',argumente:{orderId:orders[0].orderId,expectedVersion:ready.version}}});
 if(!primary)throw Error('TEST_COLLECTION_PLAN_COMMAND_REQUIRED');
 const bound=JSON.parse(JSON.stringify(primary.befehl.argumente)) as Pick<Parameters<typeof addOrderToCollectionAction>[0],'orderId'|'expectedVersion'>;
 const planInput={...bound,clientEventId:randomUUID()};
 const planned=await Promise.all([withSession(full,()=>addOrderToCollectionAction(planInput)),withSession(full,()=>addOrderToCollectionAction(JSON.parse(JSON.stringify(planInput))))]);
 expect(planned.filter(row=>row.code==='OK'&&!row.replayed)).toHaveLength(1);
 expect(planned.filter(row=>row.code==='OK'&&row.replayed)).toHaveLength(1);
 const plan=planned.find(row=>row.code==='OK'&&!row.replayed);
 if(!plan||plan.code!=='OK')throw Error('TEST_COLLECTION_PLAN_REQUIRED:'+JSON.stringify(planned));
 expect(plan.receipt).toMatchObject({orderId:orders[0].orderId,orderVersion:ready.version,customerId,agreementId:agreement.id,agreementVersion:agreement.version,actorId:full.actorId,collectionPlanned:true});
 expect(plan.receipt).not.toHaveProperty('month');expect(plan.receipt).not.toHaveProperty('collectionId');
 expect(await withSession(full,()=>addOrderToCollectionAction(JSON.parse(JSON.stringify(planInput))))).toEqual({...plan,replayed:true});
 expect(await withSession(full,()=>addOrderToCollectionAction({...planInput,clientEventId:randomUUID()}))).toEqual({...plan,replayed:true});
 expect(await withSession(full,()=>addOrderToCollectionAction({...planInput,expectedVersion:ready.version+1,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(other,()=>addOrderToCollectionAction(planInput))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(denied,()=>addOrderToCollectionAction(planInput))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.invoice_collections WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toHaveLength(0);
 expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toHaveLength(0);
 const [originalPlan]=await sql`SELECT row_to_json(e)::jsonb AS original FROM public.events e WHERE tenant_id=${tenant} AND id=${plan.receipt.eventId}`;
 expect(originalPlan.original.payload.receipt).toEqual(plan.receipt);
 mkdirSync('.git/kreile-r24-collection-plan-originals',{recursive:true});
 writeFileSync('.git/kreile-r24-collection-plan-originals/'+plan.receipt.eventId+'.json',JSON.stringify(originalPlan.original));
 // Even if the guard regressed, the forced abort prevents a changed immutable source.
 await expect(sql.begin(async tx=>{
  await tx`UPDATE public.events SET description='TEST forbidden plan mutation' WHERE tenant_id=${tenant} AND id=${plan.receipt.eventId}`;
  throw Error('TEST_ABORT_UNEXPECTED_PLAN_MUTATION');
 })).rejects.toThrow('GoBD: Audit-Log ist append-only');
 expect(await sql`SELECT row_to_json(e)::jsonb AS original FROM public.events e WHERE tenant_id=${tenant} AND id=${plan.receipt.eventId}`).toEqual([originalPlan]);
 const afterPlan=await withSession(full,()=>getLiveOrderCardAction({orderId:orders[0].orderId}));
 expect(afterPlan,JSON.stringify(afterPlan)).toMatchObject({code:'OK',data:{customerInformed:{code:'OK',collectionState:{collectionPlanned:true,collectionPrepared:true,preparationEventId:plan.receipt.eventId,collectionId:null}}}});
 if(afterPlan.code!=='OK')throw Error('TEST_COLLECTION_PREPARED_READ_REQUIRED');
 expect(afterPlan.data.nextActionRule?.hauptaktion?.elementId).not.toBe('order.collect');
 for(const order of orders){
  const [source]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;
  const input={orderId:order.orderId,mode:'abholung' as const,expectedVersion:source.version,clientEventId:randomUUID(),agreement};
  expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 }
 const collections=await sql`SELECT collection.id::text,collection.status,collection.monat::text,array_agg(member.order_id ORDER BY member.order_id) AS members
  FROM public.invoice_collections collection JOIN public.invoice_collection_orders member ON member.tenant_id=collection.tenant_id AND member.collection_id=collection.id
  WHERE collection.tenant_id=${tenant} AND collection.customer_id=${customerId} GROUP BY collection.id`;
 expect(collections).toHaveLength(1);
 expect(collections[0]).toMatchObject({status:'offen',members:orders.map(row=>row.orderId).sort()});
 const before=await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant}`;
 const counters=await sql`SELECT invoice_year,last_number,updated_at FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`;
 const [source]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${orders[0].orderId}`;
 const rejected=await withSession(full,()=>issueInvoiceAction({orderId:orders[0].orderId,expectedVersion:source.version,clientEventId:randomUUID()}));
 const [customer]=await sql`SELECT name FROM public.customers WHERE tenant_id=${tenant} AND id=${customerId}`;
 const month=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(collections[0].monat+'T12:00:00Z'));
 expect(rejected,JSON.stringify(rejected)).toMatchObject({code:'ORDER_IN_COLLECTION',message:'Gehört zur Sammelrechnung '+month+' für '+customer.name+' – wird dort abgerechnet.'});
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant}`).toEqual(before);
 expect(await sql`SELECT invoice_year,last_number,updated_at FROM private.invoice_number_sequences WHERE tenant_id=${tenant} ORDER BY invoice_year`).toEqual(counters);
});
