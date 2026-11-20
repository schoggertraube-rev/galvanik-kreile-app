// @vitest-environment node
// PL19.11.22:55 B27: actual SQL fault, physical receipt, normal task, same writer repair.
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,readyOrderForInvoice,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
import {saveCustomerAgreementAction} from '@/app/actions/customers.actions';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {getIntakeTaskAction,completeIntakeTaskAction,saveIntakeTaskAction} from '@/app/actions/eingang.actions';
import {getManualShippingAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';

it('B27 real division-by-zero preserves handover, one original-bound task and same-month repair by another decider',async()=>{
 const customerId=await customerFixture('TEST S38 R2 collection source');
 const order=await readyOrderForInvoice('TEST S38 R2 physical release','pickup',customerId);
 const resolver=await createFixture(['entscheiden'],'buero');
 const saved=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:null,clientKey:randomUUID(),type:'sammelrechnung',targetDays:30,reason:'TEST real collection SQL error'}));
 if(saved.code!=='OK')throw Error('TEST_R2_COLLECTION_AGREEMENT_REQUIRED');
 const [before]=await sql`SELECT row_to_json(o)::jsonb AS original FROM public.orders o WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 mkdirSync('.git/kreile-r24-collection-followup-originals',{recursive:true});
 writeFileSync('.git/kreile-r24-collection-followup-originals/'+order.orderId+'.json',JSON.stringify(before.original));
 if(!/^TEST-ablauf-[a-f0-9-]+$/.test(tenant))throw Error('TEST_R2_ISOLATED_TENANT_REQUIRED');
 const probe='test_s38_collection_sql_'+randomUUID().replaceAll('-','');
 await sql.unsafe(`CREATE FUNCTION public.${probe}() RETURNS trigger LANGUAGE plpgsql AS $probe$ BEGIN IF NEW.tenant_id='${tenant}' THEN PERFORM 1/0; END IF; RETURN NEW; END; $probe$; CREATE TRIGGER ${probe} BEFORE INSERT ON public.invoice_collections FOR EACH ROW EXECUTE FUNCTION public.${probe}();`);
 const input={orderId:order.orderId,expectedVersion:before.original.version,mode:'abholung' as const,clientEventId:randomUUID(),agreement:{id:saved.agreement.id,version:saved.agreement.version,type:'sammelrechnung' as const}};
 let task:{taskId:string;version:number}|undefined,physicalId:string|undefined;
 try{
  const result=await withSession(full,()=>recordGoodsOutAction(input));
  expect(result).toMatchObject({code:'OK'});if(result.code!=='OK')throw Error('TEST_B27_PHYSICAL_ACK_REQUIRED');
  physicalId=result.receipt.eventId;
  expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`).toEqual([{station:'abgeholt',version:before.original.version+1}]);
  expect(await sql`SELECT order_id FROM public.invoice_collection_orders WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toHaveLength(0);
  expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toHaveLength(0);
  const prematureInvoice=await withSession(full,()=>issueInvoiceAction({orderId:order.orderId,expectedVersion:input.expectedVersion+1,clientEventId:randomUUID()}));
  expect(prematureInvoice.code).not.toBe('OK');
  expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${customerId}`).toHaveLength(0);
  const markers=await sql`SELECT id,payload,user_id::text FROM public.events WHERE tenant_id=${tenant} AND event_type='ORDER_COLLECTION_ATTACH_PENDING_V1' AND order_id=${order.orderId}`;
  expect(markers).toHaveLength(1);expect(markers[0]).toMatchObject({user_id:full.actorId,payload:{receipt:{goodsOutEventId:physicalId,clientEventId:input.clientEventId,expectedVersion:input.expectedVersion,orderVersion:input.expectedVersion+1}}});
  const tasks=await sql`SELECT id::text,version,erstellt_von::text,bezug_typ,bezug_id,status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${markers[0].id}::uuid`;
  expect(tasks).toHaveLength(1);expect(tasks[0]).toMatchObject({erstellt_von:full.actorId,bezug_typ:'auftrag',bezug_id:order.orderId,status:'offen'});task={taskId:tasks[0].id,version:tasks[0].version};
  expect(await withSession(full,()=>getIntakeTaskAction({taskId:task!.taskId}))).toMatchObject({code:'OK',collectionSource:'KNOWN',canEdit:false,canComplete:true,completeLabel:'Sammelzuordnung nachholen'});
  const [due]=await sql`SELECT faellig_am::text AS day FROM public.tasks WHERE tenant_id=${tenant} AND id=${task.taskId}::uuid`;
  expect(await withSession(full,()=>saveIntakeTaskAction({taskId:task!.taskId,clientKey:markers[0].id,version:task!.version,kind:'aufgabe',title:'TEST manual replacement rejected',dueDate:due.day,time:null,forLogin:null,forArea:'entscheiden',reference:{type:'auftrag',id:order.orderId},note:null}))).toMatchObject({code:'FORBIDDEN'});
  expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:physicalId}});
  expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${markers[0].id}::uuid`).toHaveLength(1);
  const stranger=await createFixture(['auftraege','entscheiden'],'buero');
  expect(await withSession(stranger,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'CONFLICT'});
 }
 finally{await sql.unsafe(`DROP TRIGGER ${probe} ON public.invoice_collections; DROP FUNCTION public.${probe}();`);}
 const [physical]=await sql`SELECT station,version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 expect(physical).toEqual({station:'abgeholt',version:before.original.version+1});
 if(!task||!physicalId)throw Error('TEST_B27_REAL_TASK_REQUIRED');
 const complete={...task,note:null};
 expect(await withSession(resolver,()=>completeIntakeTaskAction(complete))).toMatchObject({code:'OK',task:{status:'erledigt',erledigt_von:resolver.actorId}});
 expect(await withSession(resolver,()=>completeIntakeTaskAction(JSON.parse(JSON.stringify(complete))))).toMatchObject({code:'OK',task:{status:'erledigt'}});
 const [proof]=await sql`SELECT pending.payload#>>'{receipt,month}' AS original_month,collection.monat::text AS repaired_month,collection.created_by::text AS original_actor,repair.user_id::text AS repaired_by
  FROM public.events pending JOIN public.events repair ON repair.tenant_id=pending.tenant_id AND repair.event_type='ORDER_COLLECTION_ATTACH_REPAIRED_V1' AND repair.payload->>'markerId'=pending.id
  JOIN public.invoice_collection_orders member ON member.tenant_id=pending.tenant_id AND member.order_id=pending.order_id JOIN public.invoice_collections collection ON collection.tenant_id=member.tenant_id AND collection.id=member.collection_id
  WHERE pending.tenant_id=${tenant} AND pending.event_type='ORDER_COLLECTION_ATTACH_PENDING_V1' AND pending.order_id=${order.orderId}`;
 expect(proof).toMatchObject({original_actor:full.actorId,repaired_by:resolver.actorId});expect(proof.repaired_month).toBe(proof.original_month);
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:physicalId}});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId} AND event_type='ORDER_PICKED_UP_V3'`).toHaveLength(1);
});

it('B27 actual shipment-group original stays shipped without task ACK and repairs its one collection through the same fresh group request',async()=>{
 const customerId=await customerFixture('TEST B27 shipping group');
 const order=await readyOrderForInvoice('TEST B27 shipping physical','shipping',customerId);
 const parcel=await manualTrackingFixture(order.orderId);
 const saved=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:null,clientKey:randomUUID(),type:'sammelrechnung',targetDays:30,reason:'TEST B27 real shipment group'}));
 if(saved.code!=='OK')throw Error('TEST_B27_SHIPPING_AGREEMENT_REQUIRED');
 const read=await withSession(full,()=>getManualShippingAction({orderId:order.orderId}));
 if(read.code!=='OK'||read.data.shipmentGroups.length!==1)throw Error('TEST_B27_REAL_GROUP_REQUIRED');
 const group=read.data.shipmentGroups[0],input={orderId:order.orderId,groupId:group.id,expectedGroupVersion:group.version,clientEventId:randomUUID(),members:[{orderId:order.orderId,expectedVersion:order.version,agreement:{id:saved.agreement.id,version:saved.agreement.version,type:'sammelrechnung' as const}}]};
 const token=randomUUID().replaceAll('-',''),attach='test_b27_group_attach_'+token,taskFault='test_b27_group_task_'+token;
 if(!/^TEST-ablauf-[a-f0-9-]+$/.test(tenant)||!/^[a-f0-9-]{36}$/.test(order.orderId))throw Error('TEST_B27_GROUP_SCOPE_REQUIRED');
 await sql.unsafe(`CREATE FUNCTION public.${attach}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.customer_id='${customerId}' THEN PERFORM 1/0; END IF; RETURN NEW; END $$; CREATE TRIGGER ${attach} BEFORE INSERT ON public.invoice_collections FOR EACH ROW EXECUTE FUNCTION public.${attach}();`);
 let markerId:string|undefined;
 try{
  await sql.unsafe(`CREATE FUNCTION public.${taskFault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.bezug_id='${order.orderId}' THEN RETURN NULL; END IF; RETURN NEW; END $$; CREATE TRIGGER ${taskFault} BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.${taskFault}();`);
  try{
   expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'UNAVAILABLE'});
   expect(await sql`SELECT station FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`).toEqual([{station:'abgeholt'}]);
   expect(await sql`SELECT status,shipped_at IS NOT NULL AS handed FROM public.shipments WHERE tenant_id=${tenant} AND id=${parcel.shipmentId}::uuid`).toEqual([{status:'shipped',handed:true}]);
   const markers=await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId} AND event_type='ORDER_COLLECTION_ATTACH_PENDING_V1'`;
   expect(markers).toHaveLength(1);markerId=markers[0].id;
   expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${markerId!}::uuid`).toHaveLength(0);
  }finally{await sql.unsafe(`DROP TRIGGER ${taskFault} ON public.tasks; DROP FUNCTION public.${taskFault}();`);}
  expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${markerId!}::uuid`).toEqual([{status:'offen'}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${attach} ON public.invoice_collections; DROP FUNCTION public.${attach}();`);}
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${markerId!}::uuid`).toEqual([{status:'erledigt'}]);
 expect(await sql`SELECT order_id FROM public.invoice_collection_orders WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toHaveLength(1);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND event_type='SHIPMENT_GROUP_HANDED_OVER_V1' AND client_event_id=${input.clientEventId}::uuid`).toHaveLength(1);
});

it('B27 missing actual task history receipt leaves ACK open and physical handover durable until the original request repairs both receipts',async()=>{
 const customerId=await customerFixture('TEST B27 missing task receipt');
 const order=await readyOrderForInvoice('TEST B27 durable physical','pickup',customerId);
 const saved=await withSession(full,()=>saveCustomerAgreementAction({customerId,orderId:null,clientKey:randomUUID(),type:'sammelrechnung',targetDays:30,reason:'TEST B27 missing task receipt'}));
 if(saved.code!=='OK')throw Error('TEST_B27_AGREEMENT_REQUIRED');
 const [before]=await sql`SELECT row_to_json(o)::jsonb AS original FROM public.orders o WHERE tenant_id=${tenant} AND id=${order.orderId}`;
 mkdirSync('.git/kreile-r24-collection-followup-originals',{recursive:true});writeFileSync('.git/kreile-r24-collection-followup-originals/'+order.orderId+'.json',JSON.stringify(before.original));
 const token=randomUUID().replaceAll('-',''),attach='test_b27_attach_'+token,taskFault='test_b27_task_'+token;
 if(!/^TEST-ablauf-[a-f0-9-]+$/.test(tenant)||!/^[a-f0-9-]{36}$/.test(order.orderId))throw Error('TEST_B27_FAULT_SCOPE_REQUIRED');
 await sql.unsafe(`CREATE FUNCTION public.${attach}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.customer_id='${customerId}' THEN PERFORM 1/0; END IF; RETURN NEW; END $$; CREATE TRIGGER ${attach} BEFORE INSERT ON public.invoice_collections FOR EACH ROW EXECUTE FUNCTION public.${attach}();`);
 const input={orderId:order.orderId,expectedVersion:before.original.version,mode:'abholung' as const,clientEventId:randomUUID(),agreement:{id:saved.agreement.id,version:saved.agreement.version,type:'sammelrechnung' as const}};
 let markerId:string|undefined;
 try{
  await sql.unsafe(`CREATE FUNCTION public.${taskFault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${tenant}' AND NEW.art='einsatz' AND NEW.nachher->>'bezugId'='${order.orderId}' AND NEW.nachher->>'action'='aufgabe.angelegt' THEN RETURN NULL; END IF; RETURN NEW; END $$; CREATE TRIGGER ${taskFault} BEFORE INSERT ON public.intake_event FOR EACH ROW EXECUTE FUNCTION public.${taskFault}();`);
  try{
   expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'UNAVAILABLE'});
   expect(await sql`SELECT station,version FROM public.orders WHERE tenant_id=${tenant} AND id=${order.orderId}`).toEqual([{station:'abgeholt',version:before.original.version+1}]);
   const markers=await sql`SELECT id,row_to_json(e)::jsonb AS original FROM public.events e WHERE tenant_id=${tenant} AND order_id=${order.orderId} AND event_type='ORDER_COLLECTION_ATTACH_PENDING_V1'`;
   expect(markers).toHaveLength(1);markerId=markers[0].id;writeFileSync('.git/kreile-r24-collection-followup-originals/'+markerId+'.json',JSON.stringify(markers[0].original));
   expect(await sql`SELECT id FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${markerId!}::uuid`).toHaveLength(0);
   // Guard probe is always rolled back, including if the immutable guard regresses.
   await expect(sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${tenant},true)`;await tx`UPDATE public.events SET description='TEST forbidden edit' WHERE tenant_id=${tenant} AND id=${markerId!}`;throw Error('TEST_GUARD_FAILED_FORCED_ROLLBACK');})).rejects.toThrow('append-only');
  }finally{await sql.unsafe(`DROP TRIGGER ${taskFault} ON public.intake_event; DROP FUNCTION public.${taskFault}();`);}
  expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
  expect(await sql`SELECT id,status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${markerId!}::uuid`).toMatchObject([{status:'offen'}]);
 }finally{await sql.unsafe(`DROP TRIGGER ${attach} ON public.invoice_collections; DROP FUNCTION public.${attach}();`);}
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT status FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${markerId!}::uuid`).toEqual([{status:'erledigt'}]);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND order_id=${order.orderId} AND event_type='ORDER_PICKED_UP_V3'`).toHaveLength(1);
 expect(await sql`SELECT order_id FROM public.invoice_collection_orders WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toHaveLength(1);
});
