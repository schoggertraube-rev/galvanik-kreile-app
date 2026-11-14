// @vitest-environment node
// Real manual writer/TaskWriter/Auth/DB source through the existing queue dispatcher.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {recordGoodsOutAction} from '@/app/actions/goodsOut.actions';
import {getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {getIntakeTaskAction} from '@/app/actions/eingang.actions';
import {replayOfflineWorkshopAction} from '@/app/actions/offlineWorkshop.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {isPendingWorkshopAcknowledgement,type PendingWorkshopOriginal} from '@/lib/offline/pendingStore';
beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});

it('U-252 an actual output keeps its mode; the manual queue original is final only with its real callback task, original actor, fresh retry and reread',async()=>{
 const order=await readyInvoiceOrder('TEST S09 queued late handover','pickup');
 const output=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,expectedVersion:order.version,mode:'abholung',clientEventId:randomUUID()}));
 if(output.code!=='OK')throw Error('TEST_ACTUAL_OUTPUT_REQUIRED');
 const actor=await createFixture(['auftraege'],'werkstatt'),foreign=await createFixture(['auftraege'],'werkstatt');
 const key=randomUUID(),scope=offlinePartition({tenantId:tenant,userId:actor.actorId});
 const original:PendingWorkshopOriginal={kind:'workshop',command:'order.handover',id:key,itemId:order.orderId,deviceCapturedAt:new Date().toISOString(),input:{command:'handover_manual',orderId:order.orderId,expectedVersion:output.receipt.orderVersion,clientEventId:key,handoverMode:'shipping'}};
 expect(await withSession(foreign,()=>replayOfflineWorkshopAction(scope,original))).toMatchObject({code:'FORBIDDEN'});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${key}::uuid`).toEqual([]);
 const result=await withSession(actor,()=>replayOfflineWorkshopAction(scope,original));
 expect(result).toMatchObject({code:'OK',handoverCommand:'order.handover',receipt:{outcome:'call_customer',passed:true,handoverMode:'pickup',orderVersion:output.receipt.orderVersion,taskId:expect.any(String),actor:{id:actor.actorId}}});
 expect(isPendingWorkshopAcknowledgement(scope,original,result)).toBe(true);
 if(result.code!=='OK'||!('handoverCommand'in result))throw Error('TEST_QUALIFIED_HANDOVER_RECEIPT_REQUIRED');
 expect(result.receipt.taskId).toBe(result.receipt.eventId);
 expect(await withSession(actor,()=>getIntakeTaskAction({taskId:result.receipt.taskId!}))).toMatchObject({code:'OK',task:{art:'rueckruf',bezug_id:order.orderId}});
 expect(await withSession(actor,()=>replayOfflineWorkshopAction(scope,JSON.parse(JSON.stringify(original))))).toEqual({...result,replayed:true});
 expect(await withSession(actor,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'abgeholt',version:output.receipt.orderVersion,handoverMode:'pickup',handoverNotice:{manualEventId:result.receipt.eventId,taskId:result.receipt.taskId}}}});
 expect(await sql`SELECT count(*)::int AS n FROM public.tasks WHERE tenant_id=${tenant} AND client_key=${key}::uuid`).toEqual([{n:1}]);
});
