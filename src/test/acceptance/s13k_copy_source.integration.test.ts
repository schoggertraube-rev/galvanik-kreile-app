// @vitest-environment node
// Copy-source fixture contract, not a physical handover proof. Only the final
// historical terminal station is an explicit synthetic given; its freeze is real.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {storeItemPhoto} from '../../../e2e/ablauf/photoFixture';

it('K13K-8 a historical copy given retains a real completion freeze, both positions and the genuinely missing price',async()=>{
 const customerId=await customerFixture('K13K copy given');
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const actions=await import('@/app/actions/orders.actions');
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode:'shipping',paymentMode:'vorkasse',note:'TEST copy source',items:[10000,null].map((price,index)=>({name:'TEST copy part '+index,quantity:1,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',catalogServiceId:null,unitPriceCents:price,vatRateBasisPoints:price===null?null:1900}))}));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('TEST_COPY_INTAKE');
 const orderId=created.receipt.orderId;
 const version=async()=>{const [row]=await sql`SELECT version FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`;return row.version as number;};
 expect(await withSession(full,()=>actions.transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 for(const item of created.receipt.items){
  await storeItemPhoto(orderId,item.id);
  expect(await withSession(full,async()=>actions.setOrderItemFinishedAction({orderId,itemId:item.id,finished:true,expectedVersion:await version(),clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 }
 expect(await withSession(full,()=>actions.setExtraWorkHourlyRateAction({rateId:randomUUID(),hourlyRateCents:12000,expectedVersion:0,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const frozen=await withSession(full,async()=>actions.freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:await version(),clientEventId:randomUUID()}));
 expect(frozen.code).toBe('OK');if(frozen.code!=='OK')throw Error('TEST_COPY_FREEZE');
 // Explicit legacy given only. This is never an assertion of physical output.
 await sql`UPDATE public.orders SET station='abgeholt',current_station='abgeholt',current_station_id='abgeholt',status='abgeholt' WHERE tenant_id=${tenant} AND id=${orderId}`;
 await sql`UPDATE public.items SET current_station_id='abgeholt' WHERE tenant_id=${tenant} AND order_id=${orderId}`;
 const before=await sql`SELECT to_jsonb(orders) AS row FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`;
 const read=()=>withSession(full,()=>actions.getLiveOrderCardAction({orderId}));
 const card=await read();expect(card.code).toBe('OK');if(card.code!=='OK')throw Error('TEST_COPY_CARD');
 expect(card.data.card.items.map(item=>item.unitPriceCents)).toEqual([10000,null]);
 expect(card.data.card.freeze?.freezeId).toBe(frozen.receipt.freezeId);
 const noMoney=await createFixture(['auftraege']);
 const hidden=await withSession(noMoney,()=>actions.getLiveOrderCardAction({orderId}));
 expect(hidden.code).toBe('OK');if(hidden.code!=='OK')throw Error('TEST_COPY_HIDDEN_CARD');
 expect(hidden.data.card.items.map(item=>item.unitPriceCents)).toEqual([null,null]);
 expect((await read()).code).toBe('OK');
 expect(await sql`SELECT to_jsonb(orders) AS row FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`).toEqual(before);
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND order_id=${orderId} AND event_type LIKE 'ORDER_PICKED_UP_%'`).toHaveLength(0);
});
