// @vitest-environment node
// Real Auth/DB/Actions/read ports; no message provider is used for the phone channel.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {getLiveOrderCardAction,markOrderInformedByPhoneAction} from '@/app/actions/orders.actions';
import {v45OrderReleaseFacts} from '@/lib/server/v45OrderRead';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname)||new URL(process.env.DATABASE_URL).pathname!=='/postgres'||!tenant.startsWith('TEST-'))throw Error('OWN_LOOPBACK_REQUIRED');
it('reuses the real informed source after phone/retry and rejects a different or stale card binding',async()=>{
 const ready=await readyInvoiceOrder('V45 echte Informiertquelle');
 const read=async()=>{const result=await withSession(full,()=>getLiveOrderCardAction({orderId:ready.orderId}));if(result.code!=='OK'||!result.data.customerInformed)throw Error('TEST_CARD_READ');return result.data;};
 const before=await read();
 expect(v45OrderReleaseFacts(before.card,{orderId:ready.orderId,value:before.customerInformed!})).toEqual({invoiceIssued:true,paymentReady:true,noticeSent:false,complaint:false});
 const input={orderId:ready.orderId,expectedVersion:before.card.version,clientEventId:randomUUID()};
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(input))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const after=await read(),source={orderId:ready.orderId,value:after.customerInformed!};
 expect(v45OrderReleaseFacts(after.card,source)).toEqual({invoiceIssued:true,paymentReady:true,noticeSent:true,complaint:false});
 expect(v45OrderReleaseFacts({...after.card,id:randomUUID()},source)).toEqual({});
 expect(v45OrderReleaseFacts({...after.card,version:after.card.version+1},source)).toEqual({});
 expect(v45OrderReleaseFacts(after.card,{orderId:ready.orderId,value:{code:'UNAVAILABLE'}})).toEqual({});
 const worker=await createFixture(['auftraege'],'werkstatt');
 const restricted=await withSession(worker,()=>getLiveOrderCardAction({orderId:ready.orderId}));
 expect(restricted.code).toBe('OK');if(restricted.code!=='OK')throw Error('TEST_RESTRICTED_CARD');
 expect(JSON.stringify(restricted.data.nextActionRule)).not.toMatch(/netCents|net_cents|unitPrice|overdueInvoiceIds/);
});
