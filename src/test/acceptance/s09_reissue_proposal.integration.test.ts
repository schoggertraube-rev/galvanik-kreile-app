// @vitest-environment node
// A09-7/-8: real existing Actions/Auth/DB/Storage and actual invoice originals.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {changeOrderPickupNoticeAction,getLiveOrderCardAction} from '@/app/actions/orders.actions';
import {cancelInvoiceAction} from '@/app/actions/invoices.actions';
beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});

it('A09-7/-8 the same versioned card binds the actual pickup proof and immutable invoice to an explicit cancellation command, never issuing on read',async()=>{
 const order=await readyInvoiceOrder('TEST S09 original-bound cancellation proposal','shipping',false,undefined,10000);
 const manual=await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'pickup'}));
 expect(manual.code).toBe('OK');
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 if(card.code!=='OK'||card.data.handoverConsequences?.code!=='OK')throw Error('TEST_CARD_PROPOSAL_REQUIRED');
 const proposal=card.data.handoverConsequences.reissueWithoutShipping;
 expect(proposal).toMatchObject({originalInvoiceNumber:order.invoice.invoiceNumber,befehl:{datei:'src/app/actions/invoices.actions.ts',funktion:'cancelInvoiceAction',argumente:{invoiceId:order.invoice.invoiceId,expectedVersion:1,reason:'Übergabeart Versand → Abholung',reissueWithoutShipping:{handoverEventId:card.data.card.handoverNotice?.manualEventId}}}});
 if(!proposal)throw Error('TEST_REAL_REISSUE_PROPOSAL_REQUIRED');
 expect(proposal.befehl.argumente).not.toHaveProperty('clientEventId');
 expect(proposal.befehl.argumente.reissueWithoutShipping).not.toHaveProperty('replacementClientEventId');
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{status:'issued'}]);
 const actor=await createFixture(['auftraege'],'werkstatt');
 const hidden=await withSession(actor,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(hidden.code).toBe('OK');if(hidden.code==='OK')expect(hidden.data).not.toHaveProperty('handoverConsequences');
 const input={...JSON.parse(JSON.stringify(proposal.befehl.argumente)),clientEventId:randomUUID(),reissueWithoutShipping:{...proposal.befehl.argumente.reissueWithoutShipping,replacementClientEventId:randomUUID()}};
 const result=await withSession(full,()=>cancelInvoiceAction(input));
 expect(result).toMatchObject({code:'OK',replacementReceipt:{netAmountCents:10000,grossAmountCents:11900}});
 expect(await withSession(full,()=>cancelInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual({...result,replayed:true});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',reissueWithoutShipping:null}}});
});

it('A09-8 an intervening real order edit invalidates the proposal without hiding the known fee or original; fresh manual confirmation restores the source',async()=>{
 const order=await readyInvoiceOrder('TEST S09 stale cancellation proposal','shipping',false,undefined,10000);
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'pickup'}))).toMatchObject({code:'OK'});
 const first=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 if(first.code!=='OK'||first.data.handoverConsequences?.code!=='OK'||!first.data.handoverConsequences.reissueWithoutShipping)throw Error('TEST_PROPOSAL_REQUIRED');
 const stale=first.data.handoverConsequences.reissueWithoutShipping;
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({orderId:order.orderId,expectedVersion:first.data.card.version,clientEventId:randomUUID(),name:'TEST real pickup person',note:null,source:'persoenlich'}))).toMatchObject({code:'OK'});
 const changed=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(changed).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',feeCents:1000,reissueWithoutShipping:null,datenluecken:['MANUAL_HANDOVER_SOURCE']}}});
 expect(await withSession(full,()=>cancelInvoiceAction({...stale.befehl.argumente,clientEventId:randomUUID(),reissueWithoutShipping:{...stale.befehl.argumente.reissueWithoutShipping,replacementClientEventId:randomUUID()}}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT status FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{status:'issued'}]);
 if(changed.code!=='OK')throw Error('TEST_FRESH_CARD_REQUIRED');
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,expectedVersion:changed.data.card.version,clientEventId:randomUUID(),handoverMode:'pickup'}))).toMatchObject({code:'OK'});
 const refreshed=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 if(refreshed.code!=='OK'||refreshed.data.handoverConsequences?.code!=='OK')throw Error('TEST_FRESH_SOURCE_REQUIRED');
 expect(refreshed.data.handoverConsequences.reissueWithoutShipping?.befehl.argumente.reissueWithoutShipping.handoverEventId).not.toBe(stale.befehl.argumente.reissueWithoutShipping.handoverEventId);
 expect(refreshed.data.handoverConsequences.reissueWithoutShipping).not.toBeNull();
});
