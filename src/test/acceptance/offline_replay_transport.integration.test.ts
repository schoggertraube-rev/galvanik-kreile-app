// @vitest-environment node
// Actual route composition + Next request/Auth/Replay DB. TEST tenant fixture,
// no mocked business writer, response, session verifier or persistence.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {full,withRequest,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction,transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {POST} from '@/app/api/offline/replay/route';
const origin='http://127.0.0.1:3201';
it('U291 keeps the existing actor and one effect through same-origin JSON transport',async()=>{
 const customerId=await customerFixture('TEST replay transport'),created=await intakeOrderFixture('TEST replay transport',customerId),orderId=created.receipt.orderId;
 const before=await withSession(full,()=>getLiveOrderCardAction({orderId}));if(before.code!=='OK')throw Error('TEST_CARD_SOURCE');
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:before.data.card.version,clientEventId:randomUUID()}));if(moved.code!=='OK')throw Error('TEST_REAL_GALVANIK');
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),key=randomUUID();
 const original={id:key,itemId:orderId,kind:'workshop',command:'item.finished',deviceCapturedAt:new Date().toISOString(),input:{orderId,itemId:created.receipt.items[0].id,expectedVersion:moved.receipt.aggregateVersion,clientEventId:key,finished:true}};
 const payload=JSON.stringify({scope,original});
 const request=(body=payload,site='same-origin',from=origin)=>new Request(origin+'/api/offline/replay',{method:'POST',headers:{origin:from,'sec-fetch-site':site,'content-type':'application/json'},body});
 expect((await withRequest('',()=>POST(request()))).status).toBe(401);
 expect((await withSession(full,()=>POST(request(payload,'cross-site','https://TEST-attacker.invalid')))).status).toBe(403);
 expect((await withSession(full,()=>POST(request(payload,'cross-site')))).status).toBe(403);
 const large=JSON.stringify({scope,original,padding:'€'.repeat(22_000)});expect(large.length).toBeLessThan(64*1024);expect(new TextEncoder().encode(large).byteLength).toBeGreaterThan(64*1024);
 expect((await withSession(full,()=>POST(request(large)))).status).toBe(413);
 const first=await withSession(full,()=>POST(request()));expect(first.status).toBe(200);expect(first.headers.get('cache-control')).toBe('no-store');
 const receipt=await first.json();expect(receipt).toMatchObject({code:'OK',offlineReceipt:{scope,clientEventId:key,actorId:full.actorId}});
 const firstCard=await withSession(full,()=>getLiveOrderCardAction({orderId}));expect(firstCard).toMatchObject({code:'OK',data:{card:{version:moved.receipt.aggregateVersion+1,items:[expect.objectContaining({id:original.input.itemId,finished:true})]}}});
 const second=await withSession(full,()=>POST(request()));expect(second.status).toBe(200);expect(await second.json()).toMatchObject({code:'OK',offlineReceipt:receipt.offlineReceipt});
 const retryCard=await withSession(full,()=>getLiveOrderCardAction({orderId}));if(firstCard.code!=='OK'||retryCard.code!=='OK')throw Error('TEST_FRESH_CARD_REQUIRED');expect(retryCard.data.card).toEqual(firstCard.data.card);
});
