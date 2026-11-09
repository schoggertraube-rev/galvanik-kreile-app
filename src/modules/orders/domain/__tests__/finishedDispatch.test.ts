import {expect,it} from 'vitest';
import {deriveFinishedDispatch,sortFinishedDispatch,type FinishedDispatchFacts} from '../finishedDispatch';
const base={card:{id:'TEST-order',version:1,orderNumber:'TEST-A1',customerId:'TEST-customer',customerName:'TEST Kunde',customerNumber:'TEST-K1',handoverMode:'pickup',station:'fertig',items:[{finished:true}],dueAt:'2026-11-20T00:00:00Z'},payment:{orderId:'TEST-order',orderVersion:1,invoiceState:'issued',goodsOutAllowed:true,goodsOut:null,mode:'rechnung'},invoices:[{invoiceId:'TEST-invoice',orderId:'TEST-order',status:'issued',paymentStatus:'offen',openAmountCents:11900,dueDate:'2026-11-20'}],today:'2026-11-09',now:'2026-11-09T00:00:00Z',customerEmail:'TEST@example.invalid',invoiceSentAt:'2026-11-09T00:00:00Z',packed:false,labelReady:false,delivered:false} as unknown as FinishedDispatchFacts;
it('derives stages from actual facts and never lets a label imply handover or an absent send imply customer information',()=>{
 expect(deriveFinishedDispatch({...base,invoices:[]})).toMatchObject({stage:'S0',action:'releaseInvoice'});
 expect(deriveFinishedDispatch({...base,invoiceSentAt:null})).toMatchObject({stage:'S1',action:'sendInvoice'});
 expect(deriveFinishedDispatch({...base,invoiceSentAt:null,customerEmail:null})).toMatchObject({stage:'S1',color:'red',action:'callCustomer'});
 expect(deriveFinishedDispatch({...base,payment:{...base.payment,goodsOutAllowed:false}})).toMatchObject({stage:'S2',color:'yellow'});
 expect(deriveFinishedDispatch(base)).toMatchObject({stage:'S4',group:'ready',color:'green'});
 expect(deriveFinishedDispatch({...base,card:{...base.card,handoverMode:'shipping'},labelReady:true})).toMatchObject({stage:'S3',action:'prepareParcel'});
 expect(deriveFinishedDispatch({...base,card:{...base.card,handoverMode:'shipping'},labelReady:true,packed:true})).toMatchObject({stage:'S4',group:'ready'});
});
it('keeps actual shipped goods underway until receipt is evidenced; pickup can complete from its actual goods-out receipt',()=>{
 const out={eventId:'TEST-out',mode:'versand'} as unknown as NonNullable<FinishedDispatchFacts['payment']['goodsOut']>;
 expect(deriveFinishedDispatch({...base,payment:{...base.payment,goodsOut:out}})).toMatchObject({stage:'S5',group:'waiting',gaps:expect.arrayContaining(['DELIVERY_NOT_CONFIRMED'])});
 expect(deriveFinishedDispatch({...base,delivered:true,payment:{...base.payment,goodsOut:out}})).toMatchObject({stage:'ended'});
 expect(deriveFinishedDispatch({...base,payment:{...base.payment,goodsOut:{...out,mode:'abholung'}}})).toMatchObject({stage:'ended'});
});
it('blocks issue of goods for actual old debt while keeping customer information allowed; ready goods sort before blocked work',()=>{
 const old={...base.invoices[0],invoiceId:'TEST-old',orderId:'TEST-other',dueDate:'2026-11-01'},blocked=deriveFinishedDispatch({...base,invoices:[...base.invoices,old]});expect(blocked).toMatchObject({stage:'S2',blocked:true,color:'red',group:'action',informationAllowed:true,blockingInvoiceIds:['TEST-old']});
 const missingProof=deriveFinishedDispatch({...base,invoices:[{...base.invoices[0],paymentStatus:null}]});expect(missingProof).toMatchObject({stage:'S2',group:'action',color:'red',gaps:['PAYMENT_PROOF_MISSING']});
 const ready={...deriveFinishedDispatch(base),orderId:'TEST-ready'};expect(sortFinishedDispatch([blocked,ready],{}).map(row=>row.orderId)).toEqual(['TEST-ready','TEST-order']);
 expect(deriveFinishedDispatch({...base,card:{...base.card,station:'galvanik',items:[{...base.card.items[0],finished:true},{...base.card.items[0],finished:false}]},invoices:[]})).toMatchObject({stage:'S0',partial:true,gaps:expect.arrayContaining(['PARTIAL_FINISHED_GOODS'])});
});
