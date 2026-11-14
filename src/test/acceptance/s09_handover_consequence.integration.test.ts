// @vitest-environment node
// Real existing Actions/Auth/DB/Storage; no synthetic invoice or proposal source.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyOrderForInvoice,readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {changeOrderPickupNoticeAction,getLiveOrderCardAction,saveManualTrackingAction} from '@/app/actions/orders.actions';
import {issueInvoiceAction} from '@/app/actions/invoices.actions';
import {readShippingSettingsAction,saveShippingSettingsAction} from '@/app/actions/settings.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readInvoiceShippingConsequences} from '@/lib/server/commands/immutableInvoiceCommand';
import {readInvoiceVat} from '@/modules/accounting/server-public';
import {readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
beforeAll(()=>{const u=process.env.DATABASE_URL;if(!u||u!==process.env.H18_EXPECTED_DATABASE_URL||new URL(u).hostname!=='127.0.0.1')throw Error('TEST_S09_LOOPBACK_REQUIRED');});
async function setFee(amount:number|null){
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('TEST_SETTINGS_REQUIRED');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberHint:settings.settings.numberHint,numberPattern:settings.settings.numberPattern,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,shippingFeeCents:amount}))).toMatchObject({code:'OK'});
}

it('A09-1/-5b same card version exposes the real draft fee, explicit zero and missing setting; no money is exposed to an order-only login',async()=>{
 const order=await readyOrderForInvoice('TEST S09 real fee read','shipping');
 const read=()=>withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));
 let card=await read();expect(card).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',orderId:order.orderId,orderVersion:order.version,lines:[{amountCents:1000,name:'Versand'}],additionalInvoices:[]}}});
 const actor=await createFixture(['auftraege'],'werkstatt');
 const hidden=await withSession(actor,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(hidden.code).toBe('OK');if(hidden.code!=='OK')throw Error('TEST_CARD_REQUIRED');
 expect(hidden.data).not.toHaveProperty('handoverConsequences');
 for(const amount of [0,null]){
  const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('TEST_SETTINGS_REQUIRED');
  expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberHint:settings.settings.numberHint,numberPattern:settings.settings.numberPattern,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,shippingFeeCents:amount}))).toMatchObject({code:'OK'});
  card=await read();expect(card).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',feeCents:amount,lines:amount===null?[]:[{amountCents:0,name:'Versand'}],additionalInvoices:[]}}});
 }
});

it('A09-2/-6 multiple actual shipment scopes remain selectable and each exact freshly read proposal issues once',async()=>{
 const a=await readyInvoiceOrder('TEST S09 multi scope A','pickup'),b=await readyInvoiceOrder('TEST S09 multi scope B','pickup',false,a.customerId);
 await setFee(1000);
 for(const order of [a,b])expect(await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'}))).toMatchObject({code:'OK'});
 const groupShipment=randomUUID();
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:groupShipment,expectedUpdatedAt:null,trackingNumber:'99345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'98345678901234',allowFormatMismatch:false,reason:null,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:a.orderId}));if(card.code!=='OK'||card.data.handoverConsequences?.code!=='OK')throw Error('TEST_MULTIPLE_REAL_PROPOSALS_REQUIRED');
 const proposals=card.data.handoverConsequences.additionalInvoices;
 expect(proposals).toHaveLength(2);expect(new Set(proposals.map(value=>value.befehl.argumente.shippingCosts!.scope)).size).toBe(2);
 expect(proposals.map(value=>value.befehl.argumente.shippingCosts!.expectedFeeCents)).toEqual([1000,1000]);
 for(const proposal of proposals){const input={...JSON.parse(JSON.stringify(proposal.befehl.argumente)),clientEventId:randomUUID()};const result=await withSession(full,()=>issueInvoiceAction(input));expect(result).toMatchObject({code:'OK',receipt:{netAmountCents:1000}});expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual({...result,replayed:true});}
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:a.orderId}))).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',additionalInvoices:[]}}});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:b.orderId}))).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',additionalInvoices:[]}}});
});

it('A09-8 a real intervening handover invalidates the old card version; a failed financial source never becomes a zero-fee proposal',async()=>{
 const order=await readyOrderForInvoice('TEST S09 stale source','pickup');
 await setFee(1000);
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'}))).toMatchObject({code:'OK'});
 const stale=await withSession(full,async()=>{const auth=await resolveAuthorization();if(!auth.ok)throw Error('TEST_REAL_AUTH_REQUIRED');return readInvoiceShippingConsequences(auth.data,{orderId:order.orderId,expectedVersion:order.version},readInvoiceVat,readShippingSettingsInTransaction);});
 expect(stale).toEqual({code:'SOURCE_INCOMPLETE',orderId:order.orderId,orderVersion:order.version,datenluecken:['SHIPPING_INVOICE_SOURCE']});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{handoverMode:'shipping'},handoverConsequences:{code:'OK',lines:[{amountCents:1000,name:'Versand'}]}}});
});

it('A09-6/-8 same canonical original and fee reader produce the actual existing issue command; read alone creates no demand and retry creates one',async()=>{
 const order=await readyInvoiceOrder('TEST S09 actual extra proposal','pickup');
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('TEST_SETTINGS_REQUIRED');
 expect(await withSession(full,()=>saveShippingSettingsAction({service:settings.settings.service,numberHint:settings.settings.numberHint,numberPattern:settings.settings.numberPattern,trackingUrl:settings.settings.trackingUrl,expectedUpdatedAt:settings.settings.updatedAt,shippingFeeCents:1000}))).toMatchObject({code:'OK'});
 expect(await withSession(full,()=>changeOrderPickupNoticeAction({command:'handover_manual',orderId:order.orderId,expectedVersion:order.version,clientEventId:randomUUID(),handoverMode:'shipping'}))).toMatchObject({code:'OK'});
 const card=await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}));expect(card.code).toBe('OK');if(card.code!=='OK')throw Error('TEST_CARD_REQUIRED');
 const consequence=card.data.handoverConsequences;expect(consequence).toMatchObject({code:'OK',orderVersion:card.data.card.version,additionalInvoices:[{originalInvoiceNumber:order.invoice.invoiceNumber,befehl:{funktion:'issueInvoiceAction',argumente:{orderId:order.orderId,expectedVersion:card.data.card.version,shippingCosts:{invoiceId:order.invoice.invoiceId,expectedVersion:1,scope:'order:'+order.orderId,expectedFeeCents:1000}}}}]});
 if(consequence?.code!=='OK'||consequence.additionalInvoices.length!==1)throw Error('TEST_REAL_PROPOSAL_REQUIRED');
 expect(await sql`SELECT count(*)::int AS n FROM public.invoices WHERE tenant_id=${tenant} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 const input={...JSON.parse(JSON.stringify(consequence.additionalInvoices[0].befehl.argumente)),clientEventId:randomUUID()};
 const issued=await withSession(full,()=>issueInvoiceAction(input));expect(issued).toMatchObject({code:'OK',receipt:{belegart:'versandkosten',netAmountCents:1000}});
 expect(await withSession(full,()=>issueInvoiceAction(JSON.parse(JSON.stringify(input))))).toEqual({...issued,replayed:true});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{handoverConsequences:{code:'OK',additionalInvoices:[],lines:[{amountCents:0,name:'Versand in Rechnung '+(issued.code==='OK'?issued.receipt.invoiceNumber:'')} ]}}});
});
