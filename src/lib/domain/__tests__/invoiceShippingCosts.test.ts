import {expect,it} from 'vitest';
import {isCreateInvoiceInput,isInvoiceShippingCostsInput} from '../invoiceIntentContract';
const orderId='TEST-order',shipping={invoiceId:'12345678-1234-4234-8234-123456789abc',expectedVersion:1,scope:'order:'+orderId,expectedFeeCents:0};
it('K4 rejects zero for new commands and retains explicit read-only historical original compatibility',()=>{
 const input={orderId,expectedVersion:1,clientEventId:'22345678-1234-4234-8234-123456789abc',shippingCosts:shipping};
 expect(isInvoiceShippingCostsInput(shipping,orderId)).toBe(false);
 expect(isCreateInvoiceInput(input)).toBe(false);
 expect(isCreateInvoiceInput(input,true)).toBe(true);
 expect(isInvoiceShippingCostsInput(shipping,orderId,true)).toBe(true);
 expect(isCreateInvoiceInput({...input,shippingCosts:{...shipping,expectedFeeCents:1}})).toBe(true);
 for(const value of [-1,0.5,NaN])expect(isInvoiceShippingCostsInput({...shipping,expectedFeeCents:value},orderId,true)).toBe(false);
 expect(isInvoiceShippingCostsInput({...shipping,invoiceId:'not-an-original'},orderId,true)).toBe(false);
});

it('St-4 accepts the issue payment method with either existing invoice option', () => {
  const input = {
    orderId,
    expectedVersion: 1,
    clientEventId: '22345678-1234-4234-8234-123456789abc',
    paymentMethodAtIssue: 'karte',
  };
  const agreement = { id: '32345678-1234-4234-8234-123456789abc', type: 'zahlungsziel', version: 1 };
  const shippingCosts = { ...shipping, expectedFeeCents: 1000 };
  expect(isCreateInvoiceInput({ ...input, agreement })).toBe(true);
  expect(isCreateInvoiceInput({ ...input, shippingCosts })).toBe(true);
  expect(isCreateInvoiceInput({ ...input, shippingCosts: shipping }, true)).toBe(true);
  expect(isCreateInvoiceInput({ ...input, shippingCosts: shipping })).toBe(false);
  expect(isCreateInvoiceInput({ ...input, agreement, shippingCosts })).toBe(false);
  expect(isCreateInvoiceInput({ ...input, agreement, paymentMethodAtIssue: 'invalid' })).toBe(false);
});
