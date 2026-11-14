// @vitest-environment node
// PL14Nov07:10: real existing handover/TaskWriter Actions/Auth/DB/Storage.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {changeOrderPickupNoticeAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {saveIntakeTaskAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createOrderHandoverTask} from '@/modules/tasks/server-public';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {readManualHandoverSource} from '@/lib/server/orderHandoverSourcePort';
beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});

it('A09-6 a real manual pickup-to-shipping change leaves the released original intact and creates no debt until the existing invoice action is confirmed',async()=>{
 const order=await readyInvoiceOrder('TEST S09 full manual additional invoice','pickup'),actor=await createFixture(['auftraege'],'werkstatt');
 const original=await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`;
 const customer=await sql`SELECT handover_preference FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 const input={command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'};
 expect(await withSession(actor,()=>changeOrderPickupNoticeAction(input))).toMatchObject({code:'OK',receipt:{handoverMode:'shipping'}});
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 expect(await sql`SELECT handover_preference FROM public.customers WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`).toEqual(customer);
 const [current]=await sql`SELECT version FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;
 const confirmation={orderId:order.orderId,expectedVersion:current.version,clientEventId:randomUUID(),shippingCosts:{invoiceId:order.invoice.invoiceId,expectedVersion:1,scope:'order:'+order.orderId,expectedFeeCents:1000}};
 expect(await withSession(actor,()=>issueInvoiceAction(confirmation))).toMatchObject({code:'FORBIDDEN'});
 const extra=await withSession(full,()=>issueInvoiceAction(confirmation));expect(extra).toMatchObject({code:'OK',replayed:false,receipt:{belegart:'versandkosten',ursprungRechnungId:order.invoice.invoiceId,netAmountCents:1000}});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(confirmation))))).toEqual({...extra,replayed:true});
 expect(await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.invoice.invoiceId}::uuid`).toEqual(original);
});

it('A09-5 before release the real shipping-to-pickup return removes the fee from the one actual invoice; an old retry never reverses the newer choice',async()=>{
 const order=await readyOrderForInvoice('TEST S09 manual return before invoice','pickup'),actor=await createFixture(['auftraege'],'werkstatt');
 const shipping={command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'};
 const first=await withSession(actor,()=>changeOrderPickupNoticeAction(shipping));expect(first).toMatchObject({code:'OK'});
 expect(await withSession(actor,()=>changeOrderPickupNoticeAction({...shipping,expectedVersion:order.version+1,clientEventId:randomUUID(),handoverMode:'pickup'}))).toMatchObject({code:'OK',receipt:{handoverMode:'pickup'}});
 expect(await withSession(actor,()=>changeOrderPickupNoticeAction(JSON.parse(JSON.stringify(shipping))))).toEqual({...first,replayed:true});
 expect(await withSession(actor,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{version:order.version+2,handoverMode:'pickup'}}});
 const issued=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:order.version+2,clientEventId:randomUUID()}));expect(issued).toMatchObject({code:'OK'});if(issued.code!=='OK')throw Error('TEST_REVERSED_REAL_INVOICE');
 const [stored]=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(stored.snapshot.lines.filter((line:{type:string})=>line.type==='SHIPPING')).toEqual([]);
});

it('A09-5 only auftraege changes handover through the existing command; live source, original actor, fresh retry and actual invoice agree',async()=>{
 const order=await readyOrderForInvoice('TEST S09 manual handover','pickup'),actor=await createFixture(['auftraege'],'werkstatt');
 const input={command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'};
 const changed=await withSession(actor,()=>changeOrderPickupNoticeAction(input));expect(changed).toMatchObject({code:'OK',replayed:false,receipt:{orderId:order.orderId,handoverMode:'shipping',outcome:'changed'}});
 expect(await withSession(actor,()=>changeOrderPickupNoticeAction(JSON.parse(JSON.stringify(input))))).toEqual({...changed,replayed:true});
 const [row]=await sql`SELECT version,handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`;expect(row).toEqual({version:order.version+1,handover_mode:'shipping'});
 expect(await withSession(actor,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{version:row.version,handoverMode:'shipping'}}});
 expect(await sql`SELECT user_id::text,event_type FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:actor.actorId,event_type:'ORDER_HANDOVER_CHANGED_V1'}]);
 const other=await createFixture(['auftraege'],'werkstatt');expect(await withSession(other,()=>changeOrderPickupNoticeAction(input))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_from_mail',sourceItemId:randomUUID(),sourceVersion:1,clientEventId:input.clientEventId}))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(actor,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:row.version,clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 const invoice=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:row.version,clientEventId:randomUUID()}));expect(invoice).toMatchObject({code:'OK'});
 if(invoice.code!=='OK')throw Error('TEST_MANUAL_REAL_INVOICE');
 const [original]=await sql`SELECT snapshot FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${invoice.receipt.invoiceId}::uuid`;
 expect(original.snapshot.lines.filter((line:{type:string})=>line.type==='SHIPPING')).toEqual([expect.objectContaining({amountCents:1000})]);
});

it.each(['event','history'] as const)('A09-5 missing actual %s rolls back the login source, task and history; the same original request then retries once',async kind=>{
 const order=await readyInvoiceOrder('TEST S09 manual rollback '+kind,'pickup');
 const passed=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,expectedVersion:order.version,mode:'abholung',clientEventId:randomUUID()}));if(passed.code!=='OK')throw Error('TEST_REAL_OUTPUT_FOR_ROLLBACK');
 const actor=await createFixture(['auftraege'],'werkstatt'),input={command:'handover_manual',orderId:order.orderId,expectedVersion:passed.receipt.orderVersion,clientEventId:randomUUID(),handoverMode:'shipping'};
 const before=await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND vorgang_id=${order.orderId} ORDER BY id`;
 const fault='test_s09_handover_'+randomUUID().replaceAll('-','');if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG)||!/^[A-Za-z0-9-]+$/.test(order.orderId))throw Error('TEST_LITERAL_INVALID');
 const table=kind==='event'?'events':'intake_event',condition=kind==='event'?`NEW.client_event_id='${input.clientEventId}'::uuid AND NEW.event_type='ORDER_HANDOVER_CHANGED_V1'`:`NEW.nachher->>'action'='aufgabe.angelegt' AND NEW.nachher->>'bezugId'='${order.orderId}'`;
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND ${condition} THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(actor,()=>changeOrderPickupNoticeAction(input))).toMatchObject({code:'UNAVAILABLE'});
  expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([]);
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`).toEqual([]);
  expect(await sql`SELECT id FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND vorgang_id=${order.orderId} ORDER BY id`).toEqual(before);
  expect(await sql`SELECT version,handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{version:passed.receipt.orderVersion,handover_mode:'pickup'}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.${table}`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const retry=await withSession(actor,()=>changeOrderPickupNoticeAction(JSON.parse(JSON.stringify(input))));expect(retry).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(actor,()=>changeOrderPickupNoticeAction(JSON.parse(JSON.stringify(input))))).toEqual({...retry,replayed:true});
 const [event]=await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`;
 await expect(sql.begin(tx=>tx`UPDATE public.events SET description='TEST forbidden mutation' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${event.id}`)).rejects.toThrow();
 await expect(sql.begin(tx=>tx`DELETE FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${event.id}`)).rejects.toThrow();
});

it('PL07:10 the real TaskWriter refuses another order, actor, key, tenant, edit purpose and stale manual source, never adopts a normal task',async()=>{
 const order=await readyOrderForInvoice('TEST S09 task source scope','pickup'),otherOrder=await readyOrderForInvoice('TEST S09 other task scope','pickup');
 // Explicit synthetic provider label is only this negative test's starting fact,
 // matching the existing AF19 label fixture. No label-writer/provider proof claimed.
 await sql`INSERT INTO public.shipments(tenant_id,order_id,carrier,label_url,status) VALUES(${KREILE_TENANT_SLUG},${order.orderId},'TEST external label fact','https://fixture.invalid/TEST-s09-label','pending')`;
 const actor=await createFixture(['auftraege'],'werkstatt'),other=await createFixture(['auftraege'],'werkstatt');
 const input={command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'};
 const applied=await withSession(actor,()=>changeOrderPickupNoticeAction(input));expect(applied).toMatchObject({code:'OK'});
 const [source]=await sql`SELECT id,payload FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`;
 const task={orderId:order.orderId,clientKey:input.clientEventId,title:source.payload.receipt.taskTitle,note:source.payload.receipt.message};
 async function attempt(fixture:typeof actor,request:typeof task&{version?:number},foreignTenant=false){
  return withSession(fixture,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_REAL_TASK_AUTH');
   return withPrivilegedTenantTransaction(auth.data,async tx=>{
    if(foreignTenant)return readManualHandoverSource(tx,'TEST-foreign-'+randomUUID(),source.id);
    return createOrderHandoverTask(tx,auth.data,request,{effect:(writeTx,login,effect)=>recordIntakeTaskEffect(writeTx,login,effect,readCustomerProfile)},undefined,source.id);
   });});
 }
 await expect(attempt(actor,{...task,orderId:otherOrder.orderId})).rejects.toThrow();
 await expect(attempt(other,task)).rejects.toThrow();
 await expect(attempt(actor,{...task,clientKey:randomUUID()})).rejects.toThrow();
 await expect(attempt(actor,{...task,version:0})).rejects.toThrow();
 await expect(attempt(actor,task,true)).rejects.toThrow();
 expect(await withSession(actor,()=>changeOrderPickupNoticeAction({...input,clientEventId:randomUUID(),expectedVersion:order.version+1}))).toMatchObject({code:'OK'});
 await expect(attempt(actor,task)).rejects.toThrow();
 expect(await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${input.clientEventId}::uuid`).toEqual([{id:source.id}]);
 const collisionKey=randomUUID(),[clock]=await sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`;
 const normal=await withSession(actor,()=>saveIntakeTaskAction({clientKey:collisionKey,version:0,kind:'rueckruf',title:task.title,note:task.note,dueDate:clock.today,time:null,forLogin:null,forArea:'auftraege',reference:{type:'auftrag',id:order.orderId}}));expect(normal).toMatchObject({code:'OK'});
 if(normal.code!=='OK')throw Error('TEST_REAL_NORMAL_TASK');
 const [normalBefore]=await sql`SELECT to_jsonb(task) AS original FROM public.tasks task WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${normal.task.id}::uuid`;
 expect(await withSession(actor,()=>changeOrderPickupNoticeAction({...input,clientEventId:collisionKey,expectedVersion:order.version+2}))).toMatchObject({code:'UNAVAILABLE'});
 expect(await sql`SELECT to_jsonb(task) AS original FROM public.tasks task WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${normal.task.id}::uuid`).toEqual([normalBefore]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='ORDER_HANDOVER_CHANGED_V1' AND client_event_id=${collisionKey}::uuid`).toEqual([]);
});

it('A09-5 without auftraege leaves order, invoice and events unchanged; stale requests never apply a second mode',async()=>{
 const order=await readyOrderForInvoice('TEST S09 manual rights','pickup'),denied=await createFixture(['eingang'],'werkstatt');
 const request={command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'};
 expect(await withSession(denied,()=>changeOrderPickupNoticeAction(request))).toMatchObject({code:'FORBIDDEN',message:'error.permission'});
 expect(await sql`SELECT version,handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{version:order.version,handover_mode:'pickup'}]);
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({...request,expectedVersion:order.version-1}))).toMatchObject({code:'CONFLICT'});
});

it('U-252 an actual physical handover stays unchanged and receives one normal callback task from the immutable login source',async()=>{
 const order=await readyInvoiceOrder('TEST S09 manual after real output','pickup'),output={orderId:order.orderId,expectedVersion:order.version,mode:'abholung' as const,clientEventId:randomUUID()};
 const passed=await withSession(full,()=>recordGoodsOutAction(output));expect(passed).toMatchObject({code:'OK'});if(passed.code!=='OK')throw Error('TEST_ACTUAL_PHYSICAL_HANDOVER');
 const actor=await createFixture(['auftraege'],'werkstatt'),request={command:'handover_manual',orderId:order.orderId,expectedVersion:passed.receipt.orderVersion,clientEventId:randomUUID(),handoverMode:'shipping'};
 const result=await withSession(actor,()=>changeOrderPickupNoticeAction(request));expect(result).toMatchObject({code:'OK',replayed:false,receipt:{outcome:'call_customer',handoverMode:'pickup',taskId:expect.any(String)}});
 expect(await sql`SELECT station,version,handover_mode FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.orderId}`).toEqual([{station:'abgeholt',version:passed.receipt.orderVersion,handover_mode:'pickup'}]);
 expect(await sql`SELECT art,bezug_typ,bezug_id,erstellt_von::text FROM public.tasks WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_key=${request.clientEventId}::uuid`).toEqual([{art:'rueckruf',bezug_typ:'auftrag',bezug_id:order.orderId,erstellt_von:actor.actorId}]);
 expect(await withSession(actor,()=>changeOrderPickupNoticeAction(JSON.parse(JSON.stringify(request))))).toEqual({...result,replayed:true});
 expect(await withSession(actor,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{handoverMode:'pickup',handoverNotice:{taskId:expect.any(String)}}}});
});
