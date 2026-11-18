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
