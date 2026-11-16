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
