import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import {recognizeInvoiceXml} from '../server/invoiceRecognition';

const fixture=(name:string)=>readFileSync(resolve('e2e/fixtures/e-rechnung',name));
function fields(bytes:Uint8Array){
 const result=recognizeInvoiceXml(bytes);expect(result.code).toBe('OK');
 if(result.code!=='OK')throw new Error('TEST_INVOICE_NOT_RECOGNIZED');
 return Object.fromEntries(result.suggestions.map(value=>[value.field,value.value]));
}
describe('S54e the existing structured invoice recognizer',()=>{
 it.each(['TEST_xrechnung_ubl.xml','TEST_xrechnung_cii.xml'])('reads the licensed original %s supplier and complete tax group without changing its total',name=>{
  const result=fields(fixture(name));
  expect(result['rechnung.absender']).toEqual({name:'[Seller name]',ustId:'DE 123456789'});
  expect(result['rechnung.steuersaetze']).toEqual([{satz:'7.00',netto:'314.86',ust:'22.04'}]);
  expect(result['rechnung.betrag']).toEqual({netto:'314.86',ust:'22.04',brutto:'336.90'});
 });
 it('reads all header tax groups and FC registration in an explicitly synthetic CII variation',()=>{
  const original=fixture('TEST_xrechnung_cii.xml').toString('utf8');
  const synthetic=original.replace('</ram:SellerTradeParty>','<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">TEST-FC-123</ram:ID></ram:SpecifiedTaxRegistration></ram:SellerTradeParty>')
   .replace('<ram:SpecifiedTradeSettlementHeaderMonetarySummation>','<ram:ApplicableTradeTax><ram:CalculatedAmount>19.00</ram:CalculatedAmount><ram:BasisAmount>100.00</ram:BasisAmount><ram:RateApplicablePercent>19</ram:RateApplicablePercent></ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementHeaderMonetarySummation>');
  const result=fields(new TextEncoder().encode(synthetic));
  expect(result['rechnung.absender']).toEqual({name:'[Seller name]',ustId:'DE 123456789',steuernummer:'TEST-FC-123'});
  expect(result['rechnung.steuersaetze']).toEqual([{satz:'7.00',netto:'314.86',ust:'22.04'},{satz:'19.00',netto:'100.00',ust:'19.00'}]);
  // The original total stays authoritative even in deliberately inconsistent TEST data.
  expect(result['rechnung.betrag']).toMatchObject({ust:'22.04'});
 });
 it('keeps absent seller parts and absent tax groups absent in a synthetic minimal source',()=>{
  const original=fixture('TEST_xrechnung_ubl.xml').toString('utf8');
  const synthetic=original.replace(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/u,'')
   .replace(/<cac:TaxSubtotal>[\s\S]*?<\/cac:TaxSubtotal>/gu,'');
  const result=fields(new TextEncoder().encode(synthetic));
  expect(result).not.toHaveProperty('rechnung.absender');
  expect(result).not.toHaveProperty('rechnung.steuersaetze');
  expect(result['rechnung.betrag']).toMatchObject({ust:'22.04'});
 });
 it('preserves the XML entity and malformed-source guards',()=>{
  expect(recognizeInvoiceXml(new TextEncoder().encode('<!DOCTYPE Invoice [<!ENTITY x SYSTEM "file:///TEST">]><Invoice>&x;</Invoice>')).code).toBe('UNSUPPORTED');
  expect(recognizeInvoiceXml(new TextEncoder().encode('<Invoice>')).code).toBe('UNSUPPORTED');
 });
});
