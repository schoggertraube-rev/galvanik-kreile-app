// Synthetic validation-boundary inputs only. Genuine writer/number/retry
// evidence lives in e2e/fixtures/e-rechnung; these are not writer proofs.
import {describe,expect,it} from 'vitest';
import {assertInvoiceElectronicFields,createInvoiceXml} from '../invoiceXml';
import {InvoiceElectronicSourceError} from '@/lib/domain/invoiceElectronicFields';
import type {ImmutableInvoiceSnapshotV3} from '../ImmutableInvoiceDocument';

function source():ImmutableInvoiceSnapshotV3{return {
 schemaVersion:3,
 seller:{companyName:'TEST synthetic seller',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'DE',vatId:'DE123456789',taxNumber:null,iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank'},
 customer:{name:'TEST synthetic buyer',companyName:null,contactPerson:null,street:'TEST Weg 2',zip:'70176',city:'Stuttgart',country:'DE',vatId:null},
 order:{orderId:'TEST-order',orderVersion:1,orderNumber:'A-2026-0001',title:'TEST synthetic order',freezeId:'TEST-freeze'},
 lines:[{type:'BASE',itemId:'TEST-item',name:'TEST synthetic part',quantity:1,unitNetAmountCents:10000,lineNetAmountCents:10000,unit:'C62',taxCategory:'S',vat_rate_basis_points:1900}],
 totals:{netAmountCents:10000,vatRateBasisPoints:null,vatBreakdown:[{rateBp:1900,netCents:10000,vatCents:1900,grossCents:11900}],vatAmountCents:1900,grossAmountCents:11900},
 serviceDate:'2026-11-18',issuedAt:'2026-11-18T12:00:00.000Z',paymentTermDays:14,
};}

function refusal(snapshot:ImmutableInvoiceSnapshotV3){
 try{assertInvoiceElectronicFields(snapshot);}catch(error){expect(error).toBeInstanceOf(InvoiceElectronicSourceError);return error as InvoiceElectronicSourceError;}
 throw Error('SYNTHETIC_INVALID_SOURCE_ACCEPTED');
}

it('B3-a schreibt Materialmenge, vierstelligen VK und Positionscent aus dem TEST-Original', () => {
 const snapshot = source();
 const material = {
  type: 'MATERIAL' as const, sourceOrderId: snapshot.order!.orderId, articleId: 'TEST-Material', name: 'Material: TEST-Material',
  quantity: '250.125', unit: 'MLT' as const, unitNetAmount: '0.0040', lineNetAmountCents: 100,
  vat_rate_basis_points: 1900 as const, taxCategory: 'S' as const, eventIds: ['22222222-2222-4222-8222-222222222222'],
 };
 snapshot.lines.push(material);
 snapshot.totals = { netAmountCents: 10100, vatRateBasisPoints: null, vatAmountCents: 1919, grossAmountCents: 12019,
  vatBreakdown: [{ rateBp: 1900, netCents: 10100, vatCents: 1919, grossCents: 12019 }] };

 const input = { snapshot, invoiceNumber: 'R-2026-0001', dueDate: '2026-12-02' };
 const xml = new TextDecoder().decode(createInvoiceXml(input));
 expect(xml).toContain('<ram:ChargeAmount>0.0040</ram:ChargeAmount>');
 expect(xml).toContain('<ram:BilledQuantity unitCode="MLT">250.125</ram:BilledQuantity>');
 expect(xml).toContain('<ram:LineTotalAmount>1.00</ram:LineTotalAmount>');
 const stornierteXml = new TextDecoder().decode(createInvoiceXml({ ...input,
  cancellation: { number: 'R-2026-0002', at: '2026-11-19T12:00:00.000Z', reason: 'TEST Storno' },
 }));
 expect(stornierteXml).toContain('<ram:BilledQuantity unitCode="MLT">-250.125</ram:BilledQuantity>');
 expect(stornierteXml).toContain('<ram:LineTotalAmount>-1.00</ram:LineTotalAmount>');

 snapshot.lines.push(material);
 expect(() => createInvoiceXml(input)).toThrow('INVOICE_MATERIAL_SOURCE_INVALID');
 snapshot.lines.pop();
 material.lineNetAmountCents = 101;
 expect(refusal(snapshot).location.field).toBe('rounding');
 material.lineNetAmountCents = 100;
 material.unitNetAmount = '0.004';
 expect(refusal(snapshot).location.field).toBe('rounding');
});

it('S38a A2b writes the frozen discount as structured BT-20 without changing invoice cents',()=>{
 const snapshot=source();snapshot.terms={quelle:'kunde',ziel_tage:14,skonto_prozent:2,skonto_tage:8};
 const before=structuredClone(snapshot);
 const xml=new TextDecoder().decode(createInvoiceXml({snapshot,invoiceNumber:'R-2026-0001',dueDate:'2026-12-02'}));
 expect(xml).toContain('#SKONTO#TAGE=8#PROZENT=2.00#\n</ram:Description>');
 expect(snapshot).toEqual(before);
});

it('KORR-S54o K5 binds BT29 only to tax-only seller and distinct cancellation identity to the untouched original',()=>{
 const snapshot=source(),original=structuredClone(snapshot);
 const input={snapshot,invoiceNumber:'R-2026-0001',dueDate:'2026-12-02'};
 const ordinary=new TextDecoder().decode(createInvoiceXml(input));
 expect(ordinary).not.toMatch(/<ram:SellerTradeParty><ram:ID>/);
 snapshot.seller.vatId=null;snapshot.seller.taxNumber='123/456/789';
 expect(new TextDecoder().decode(createInvoiceXml(input))).toContain('<ram:SellerTradeParty><ram:ID>123/456/789</ram:ID>');
 const xml=new TextDecoder().decode(createInvoiceXml({...input,cancellation:{number:'R-2026-0002',at:'2026-11-19T12:00:00.000Z',reason:'TEST cancellation'}}));
 expect(xml).toContain('<rsm:ExchangedDocument><ram:ID>R-2026-0002</ram:ID><ram:TypeCode>384</ram:TypeCode>');
 expect(xml).toContain('<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>R-2026-0001</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString format="102">20261118</qdt:DateTimeString>');
 for(const match of xml.matchAll(/<ram:BilledQuantity[^>]*>([^<]+)</g))expect(Number(match[1])).toBeLessThan(0);
 for(const match of xml.matchAll(/<ram:ChargeAmount>([^<]+)</g))expect(Number(match[1])).toBeGreaterThan(0);
 expect(snapshot).toEqual({...original,seller:{...original.seller,vatId:null,taxNumber:'123/456/789'}});
});

describe('S54o C6/A14 source consistency before existing number allocation',()=>{
 it('refuses a one-cent tax discrepancy without repairing the frozen financial values',()=>{
  const snapshot=source();snapshot.totals.vatAmountCents++;snapshot.totals.grossAmountCents++;
  const original=structuredClone(snapshot);
  expect(refusal(snapshot).location).toEqual({kind:'order',objectId:'TEST-order',field:'rounding'});
  expect(snapshot).toEqual(original);
 });
 it('PL19:22 preserves a rounded-average source by presenting the precise frozen ratio without changing cents',()=>{
  const snapshot=source();const line=snapshot.lines[0];if(line.type!=='BASE')throw Error('SYNTHETIC_BASE_REQUIRED');
  line.quantity=3;line.unitNetAmountCents=3333;const original=structuredClone(snapshot);
  expect(assertInvoiceElectronicFields(snapshot)).toMatchObject({netAmountCents:10000,vatAmountCents:1900,grossAmountCents:11900});
  expect(snapshot).toEqual(original);
 });
 it('still refuses an original allocation that four-place precision cannot represent to the exact line cent',()=>{
  const snapshot=source();const line=snapshot.lines[0];if(line.type!=='BASE')throw Error('SYNTHETIC_BASE_REQUIRED');
  line.quantity=99999;line.unitNetAmountCents=1;line.lineNetAmountCents=100000;
  snapshot.totals={netAmountCents:100000,vatRateBasisPoints:null,vatBreakdown:[{rateBp:1900,netCents:100000,vatCents:19000,grossCents:119000}],vatAmountCents:19000,grossAmountCents:119000};
  const original=structuredClone(snapshot);
  expect(refusal(snapshot).location).toEqual({kind:'order',objectId:'TEST-order',field:'rounding'});
  expect(snapshot).toEqual(original);
 });
 it('does not replace an absent original unit with pieces',()=>{
  const snapshot=source();delete snapshot.lines[0].unit;
  expect(refusal(snapshot).location).toEqual({kind:'order',objectId:'TEST-order',field:'unit:TEST synthetic part'});
  expect(snapshot.lines[0]).not.toHaveProperty('unit');
 });
});

it('S38a synthetic collection XML keeps all service dates and a per-rate sum without a representative order',()=>{
 const ordinary=source();
 const members=[0,1,2].map(index=>({orderId:'TEST-collection-'+index,orderVersion:2,orderNumber:'TEST-A-'+index,title:'TEST synthetic member '+index,freezeId:['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'][index],serviceDate:['2026-10-30','2026-11-02','2026-11-18'][index]}));
 const collection:ImmutableInvoiceSnapshotV3={...ordinary,order:null,serviceDate:null,collection:{collectionId:'44444444-4444-4444-8444-444444444444',version:4,month:'2026-11-01',members},
  lines:members.map((member,index)=>({type:'BASE' as const,sourceOrderId:member.orderId,itemId:'TEST-item-'+index,name:'TEST part '+index,quantity:1,unitNetAmountCents:index===2?3334:3333,lineNetAmountCents:index===2?3334:3333,unit:'C62' as const,taxCategory:'S' as const,vat_rate_basis_points:1900 as const}))};
 const unchanged=structuredClone(collection);
 const xml=new TextDecoder().decode(createInvoiceXml({snapshot:collection,invoiceNumber:'R-2026-0001',dueDate:'2026-12-02'}));
 expect(xml).not.toContain('ActualDeliverySupplyChainEvent');
 for(const member of members){expect(xml).toContain(member.orderNumber+' / '+member.serviceDate);expect(xml).toContain(member.serviceDate.replaceAll('-',''));}
 expect(xml).toContain('<ram:CalculatedAmount>19.00</ram:CalculatedAmount>');
 expect(xml).toContain('<ram:GrandTotalAmount>119.00</ram:GrandTotalAmount>');
 expect(xml.match(/<ram:BillingSpecifiedPeriod>/g)).toHaveLength(4);
 expect(collection).toEqual(unchanged);
 const damaged=structuredClone(collection),damagedLine=damaged.lines[0];if(damagedLine.type!=='BASE')throw Error('SYNTHETIC_BASE_REQUIRED');delete damagedLine.sourceOrderId;
 expect(()=>createInvoiceXml({snapshot:damaged,invoiceNumber:'R-2026-0001',dueDate:'2026-12-02'})).toThrow('INVOICE_COLLECTION_LINE_SOURCE_INVALID');
});
