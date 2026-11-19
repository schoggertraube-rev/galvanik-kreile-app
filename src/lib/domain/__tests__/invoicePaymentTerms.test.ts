import {describe,it,expect} from 'vitest';
import {resolveInvoicePaymentTerms,parseInvoicePaymentTerms} from '../invoicePaymentTerms';

describe('S38a approved A1–A3 invoice term precedence (synthetic pure inputs)',()=>{
 const customer={enabled:true,targetDays:30,discountPercent:'2.00',discountDays:8};
 it('A1 uses company terms and no discount when customer terms are not enabled',()=>{
  expect(resolveInvoicePaymentTerms(14,{...customer,enabled:false},null)).toEqual({quelle:'firma',ziel_tage:14,skonto_prozent:null,skonto_tage:null});
 });
 it('A2 uses the enabled customer target and discount',()=>{
  expect(resolveInvoicePaymentTerms(14,customer,null)).toEqual({quelle:'kunde',ziel_tage:30,skonto_prozent:2,skonto_tage:8});
 });
 it.each(['zahlungsziel','sammelrechnung'])('A3 %s overrides the target while discount remains customer sourced',type=>{
  expect(resolveInvoicePaymentTerms(14,customer,{type,targetDays:45})).toEqual({quelle:'absprache',ziel_tage:45,skonto_prozent:2,skonto_tage:8});
 });
 it('an unreadable target or incomplete discount never turns into a default',()=>{
  expect(()=>resolveInvoicePaymentTerms(14,{...customer,targetDays:null},null)).toThrow('INVOICE_PAYMENT_TERM_INVALID');
  expect(()=>resolveInvoicePaymentTerms(14,{...customer,discountDays:null},null)).toThrow('INVOICE_CASH_DISCOUNT_INVALID');
 });
 it('reads an exact frozen record and rejects changed targets or a partial discount',()=>{
  const original={quelle:'kunde',ziel_tage:30,skonto_prozent:2,skonto_tage:8};
  expect(parseInvoicePaymentTerms(original,30)).toEqual(original);
  expect(()=>parseInvoicePaymentTerms(original,45)).toThrow('INVOICE_PAYMENT_TERMS_SNAPSHOT_INVALID');
  expect(()=>parseInvoicePaymentTerms({...original,skonto_tage:null},30)).toThrow('INVOICE_PAYMENT_TERMS_SNAPSHOT_INVALID');
  expect(()=>parseInvoicePaymentTerms({...original,unexpected:true},30)).toThrow('INVOICE_PAYMENT_TERMS_SNAPSHOT_INVALID');
 });
});
