// @vitest-environment node
// PL13Nov22:20: existing shipment writer, actual preparation/Auth/DB/Storage.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice} from '../../../e2e/ablauf/orderFixture';
import {getManualShippingAction,saveManualTrackingAction} from '@/app/actions/orders.actions';
beforeAll(()=>{const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});
const input=(orderId:string,trackingNumber:string)=>({orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber,allowFormatMismatch:false,reason:null,clientEventId:randomUUID()});
async function read(orderId:string){const result=await withSession(full,()=>getManualShippingAction({orderId}));if(result.code!=='OK')throw Error('TEST_ACTUAL_SHIPMENT_READ');return result.data;}

it('A09 groups two actual orders before invoice, shares a number only inside that group and preserves source actor/retry',async()=>{
 const a=await readyOrderForInvoice('TEST S09 group A','shipping'),b=await readyOrderForInvoice('TEST S09 group B','shipping',a.customerId);
 const first={...input(a.orderId,'12345678901234'),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}};
 const saved=await withSession(full,()=>saveManualTrackingAction(first));expect(saved).toMatchObject({code:'OK',replayed:false,receipt:{actorId:full.actorId}});if(saved.code!=='OK'||!saved.receipt.sendungId)throw Error('TEST_REAL_GROUP_REQUIRED');
 expect(await withSession(full,()=>saveManualTrackingAction(JSON.parse(JSON.stringify(first))))).toEqual({...saved,replayed:true});
 expect(await withSession(full,()=>saveManualTrackingAction({...first,withOrder:{expectedUpdatedAt:null,shipmentId:null,orderId:b.orderId}}))).toEqual({...saved,replayed:true});
 const target=(await read(b.orderId)).shipments;expect(target).toHaveLength(1);expect(target[0]).toMatchObject({sendungId:saved.receipt.sendungId,status:'pending',trackingNumber:null});
 const second={...input(b.orderId,first.trackingNumber),shipmentId:target[0].id,expectedUpdatedAt:target[0].updatedAt};
 expect(await withSession(full,()=>saveManualTrackingAction(second))).toMatchObject({code:'OK',receipt:{sendungId:saved.receipt.sendungId}});
 expect((await read(a.orderId)).shipments).toHaveLength(1);expect((await read(b.orderId)).shipments).toHaveLength(1);
 const c=await readyOrderForInvoice('TEST S09 outside group','shipping',a.customerId);
 expect(await withSession(full,()=>saveManualTrackingAction(input(c.orderId,first.trackingNumber)))).toMatchObject({code:'CONFLICT',reason:'TRACKING_ALREADY_ASSIGNED'});
 expect((await read(c.orderId)).shipments).toHaveLength(0);
 const foreign=await readyOrderForInvoice('TEST S09 other customer','shipping');
 const foreignTarget=(await read(a.orderId)).shipments[0];
 expect(await withSession(full,()=>saveManualTrackingAction({...input(foreign.orderId,'22345678901234'),withOrder:{orderId:a.orderId,shipmentId:foreignTarget.id,expectedUpdatedAt:foreignTarget.updatedAt}}))).toMatchObject({code:'CONFLICT',reason:'SHIPMENT_CHANGED'});
 expect((await read(foreign.orderId)).shipments).toHaveLength(0);
 const other=await createFixture(['auftraege'],'buero');expect(await withSession(other,()=>saveManualTrackingAction(first))).toMatchObject({code:'CONFLICT',reason:'TRACKING_KEY_CONFLICT'});
});

it('A09 a missing original event rolls both actual shipment rows back; fresh retry writes one group and one event',async()=>{
 const a=await readyOrderForInvoice('TEST S09 rollback A','shipping'),b=await readyOrderForInvoice('TEST S09 rollback B','shipping',a.customerId),request={...input(a.orderId,'32345678901234'),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}};
 const fault='test_s09_group_'+randomUUID().replaceAll('-','');if(!/^[A-Za-z0-9-]+$/.test(KREILE_TENANT_SLUG))throw Error('TEST_TENANT_LITERAL_INVALID');
 await sql.unsafe(`CREATE FUNCTION private.${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tenant_id='${KREILE_TENANT_SLUG}' AND NEW.client_event_id='${request.clientEventId}'::uuid AND NEW.event_type='SHIPMENT_MANUAL_TRACKING_SET_V1' THEN RETURN NULL; END IF; RETURN NEW; END $$`);
 await sql.unsafe(`CREATE TRIGGER ${fault} BEFORE INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION private.${fault}()`);
 try{
  expect(await withSession(full,()=>saveManualTrackingAction(request))).toMatchObject({code:'UNAVAILABLE'});
  expect((await read(a.orderId)).shipments).toHaveLength(0);expect((await read(b.orderId)).shipments).toHaveLength(0);
 }finally{await sql.unsafe(`DROP TRIGGER ${fault} ON public.events`);await sql.unsafe(`DROP FUNCTION private.${fault}()`);}
 const saved=await withSession(full,()=>saveManualTrackingAction(JSON.parse(JSON.stringify(request))));expect(saved).toMatchObject({code:'OK',replayed:false});
 expect(await withSession(full,()=>saveManualTrackingAction(JSON.parse(JSON.stringify(request))))).toEqual({...saved,replayed:true});
 expect(await sql`SELECT count(*)::int AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${request.clientEventId}::uuid`).toEqual([{n:1}]);
 expect((await read(a.orderId)).shipments).toHaveLength(1);expect((await read(b.orderId)).shipments).toHaveLength(1);
});

it('A09 multiple real target shipments return a selection and bind exactly the explicitly chosen source',async()=>{
 const a=await readyOrderForInvoice('TEST S09 selection A','shipping'),b=await readyOrderForInvoice('TEST S09 selection B','shipping',a.customerId);
 for(const number of ['42345678901234','52345678901234'])expect(await withSession(full,()=>saveManualTrackingAction(input(b.orderId,number)))).toMatchObject({code:'OK'});
 const candidates=(await read(b.orderId)).shipments;expect(candidates).toHaveLength(2);
 const request={...input(a.orderId,'42345678901234'),withOrder:{orderId:b.orderId,shipmentId:null as string|null,expectedUpdatedAt:null as string|null}};
 expect(await withSession(full,()=>saveManualTrackingAction(request))).toMatchObject({code:'CONFLICT',reason:'SHIPMENT_CHANGED',candidates:expect.arrayContaining(candidates.map(row=>expect.objectContaining({shipmentId:row.id,updatedAt:row.updatedAt})))});
 expect((await read(a.orderId)).shipments).toHaveLength(0);
 const selected=candidates.find(row=>row.trackingNumber===request.trackingNumber)!;
 const saved=await withSession(full,()=>saveManualTrackingAction({...request,withOrder:{orderId:b.orderId,shipmentId:selected.id,expectedUpdatedAt:selected.updatedAt}}));expect(saved).toMatchObject({code:'OK'});if(saved.code!=='OK')throw Error('TEST_EXPLICIT_SHIPMENT_SELECTION_REQUIRED');
 expect((await read(b.orderId)).shipments.find(row=>row.id===selected.id)).toMatchObject({sendungId:saved.receipt.sendungId});
 expect((await read(b.orderId)).shipments.find(row=>row.id!==selected.id)).toMatchObject({sendungId:null,trackingNumber:'52345678901234'});
});

it('A09 opposite concurrent group requests serialize without duplicate rows or deadlock',async()=>{
 const a=await readyOrderForInvoice('TEST S09 parallel A','shipping'),b=await readyOrderForInvoice('TEST S09 parallel B','shipping',a.customerId);
 const requests=[{...input(a.orderId,'62345678901234'),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}},{...input(b.orderId,'62345678901234'),withOrder:{orderId:a.orderId,shipmentId:null,expectedUpdatedAt:null}}];
 const results=await Promise.all(requests.map(request=>withSession(full,()=>saveManualTrackingAction(request))));
 expect(results.filter(row=>row.code==='OK')).toHaveLength(1);expect(results.find(row=>row.code!=='OK')).toMatchObject({code:'CONFLICT',reason:'SHIPMENT_CHANGED'});
 const rows=await sql`SELECT sendung_id::text FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id IN (${a.orderId},${b.orderId})`;
 expect(rows).toHaveLength(2);expect(new Set(rows.map(row=>row.sendung_id)).size).toBe(1);expect(rows[0].sendung_id).not.toBeNull();
});
