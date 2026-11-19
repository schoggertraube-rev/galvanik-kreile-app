import {expect,it} from 'vitest';
import {parseInvoiceCollectionOriginal,invoiceOriginalMembers,invoiceOriginalLineMember,invoiceOriginalLineMembers} from '../invoiceCollectionContract';
// Explicit synthetic parser boundaries, not collection issuance or DB evidence.
const member={orderId:'TEST-order-A',orderVersion:4,orderNumber:'TEST-A',title:'TEST part',freezeId:'11111111-1111-4111-8111-111111111111',serviceDate:'2026-10-31'};
const original={collectionId:'22222222-2222-4222-8222-222222222222',version:2,month:'2026-11-01',members:[member]};
it('retains every frozen member without choosing a representative order or replacing service dates by the collection month',()=>{
 const next={...member,orderId:'TEST-order-B',orderNumber:'TEST-B',freezeId:'33333333-3333-4333-8333-333333333333',serviceDate:'2026-11-04'};
 const result=parseInvoiceCollectionOriginal({...original,members:[member,next]});
 expect(result).toEqual({...original,members:[member,next]});
 expect(result).not.toBe(original);expect(result.members[0]).not.toBe(member);
});
it.each([
 {...original,members:[]},{...original,unexpected:true},{...original,month:'2026-11-02'},
 {...original,members:[member,member]},
 {...original,members:[{...member,serviceDate:'2026-02-30'}]},
 {...original,members:[{...member,orderVersion:0}]},
 {...original,members:[member,{...member,orderId:'TEST-order-B'}]},
])('rejects a damaged or duplicate member source without live-data fallback: %j',value=>{
 expect(()=>parseInvoiceCollectionOriginal(value)).toThrow(/INVOICE_COLLECTION_/);
});

it('keeps single-order originals on their real order and requires explicit per-line collection origin even for one member',()=>{
 const {serviceDate,...order}=member;
 const single={order,serviceDate};
 expect(invoiceOriginalMembers(single)).toEqual([member]);
 expect(invoiceOriginalLineMember(single,{})).toEqual(member);
 const collection={order:null,serviceDate:null,collection:original};
 expect(invoiceOriginalMembers(collection)).toEqual([member]);
 expect(invoiceOriginalLineMember(collection,{sourceOrderId:member.orderId})).toEqual(member);
 expect(()=>invoiceOriginalLineMember(collection,{})).toThrow('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
 expect(()=>invoiceOriginalMembers({...collection,order})).toThrow('INVOICE_ORIGINAL_SOURCE_AMBIGUOUS');
 expect(()=>invoiceOriginalLineMember(single,{sourceOrderId:'TEST-foreign-order'})).toThrow('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
});

it('retains every actual order reference on a single shared-shipment line and rejects foreign or duplicate references',()=>{
 const second={...member,orderId:'TEST-order-B',freezeId:'33333333-3333-4333-8333-333333333333'};
 const source={order:null,serviceDate:null,collection:{...original,members:[member,second]}};
 expect(invoiceOriginalLineMembers(source,{type:'SHIPPING',sourceOrderIds:[member.orderId,second.orderId]})).toEqual([member,second]);
 for(const ids of [[],[member.orderId,member.orderId],['TEST-foreign']])expect(()=>invoiceOriginalLineMembers(source,{type:'SHIPPING',sourceOrderIds:ids})).toThrow('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
 expect(()=>invoiceOriginalLineMembers(source,{type:'BASE',sourceOrderIds:[member.orderId]})).toThrow('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
});
