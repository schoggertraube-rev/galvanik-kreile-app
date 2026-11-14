// @vitest-environment node
// S09 preflight: actual pre-invoice shipment writer and canonical S0 release.
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {storeItemPhoto} from '../../../e2e/ablauf/photoFixture';
import {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,freezeOrderAction,getExtraWorkMasterDataAction,setExtraWorkHourlyRateAction,getManualShippingAction,saveManualTrackingAction} from '@/app/actions/orders.actions';

it('A09 preflight preserves the existing tracking release guard before any invoice is created',async()=>{
 const url=process.env.DATABASE_URL;if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');
 const customerId=await customerFixture('TEST S09 group preflight'),created=await intakeOrderFixture('TEST S09 group preflight',customerId,'shipping'),orderId=created.receipt.orderId;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name) VALUES(${randomUUID()}::uuid,${KREILE_TENANT_SLUG},'TEST S09 group preflight')`;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_S09_GROUP_HANDOFF');
 await storeItemPhoto(orderId,created.receipt.items[0].id);
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:created.receipt.items[0].id,expectedVersion:moved.receipt.aggregateVersion,finished:true,clientEventId:randomUUID()}));if(finished.code!=='OK')throw Error('TEST_S09_GROUP_FINISH');
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());if(master.code!=='OK')throw Error('TEST_S09_GROUP_RATE');if(!master.data.currentRate)expect(await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const before=await withSession(full,()=>getManualShippingAction({orderId}));if(before.code!=='OK')throw Error('TEST_ACTUAL_MANUAL_SHIPPING_READ_REQUIRED');
 const result=await withSession(full,()=>saveManualTrackingAction({orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'12345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID()}));
 const invoices=await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${orderId}`;
 writeFileSync('.git/kreile-s09-group-preinvoice-actual.json',JSON.stringify({at:new Date().toISOString(),tenant:KREILE_TENANT_SLUG,orderId,releaseAllowed:before.data.releaseAllowed,result,invoiceCount:invoices[0].n},null,2));
 expect(invoices).toEqual([{n:0}]);
 if(before.data.releaseAllowed)expect(result).toMatchObject({code:'OK'});
 else expect(result).toMatchObject({code:'CONFLICT',reason:'SHIPPING_RELEASE_BLOCKED'});
});
