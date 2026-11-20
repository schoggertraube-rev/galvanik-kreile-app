import {expect,it} from 'vitest';
import {isIssueCollectionInvoiceInput} from '../invoiceIntentContract';
// Synthetic input boundaries, not invoice issuance evidence.
const input={collectionId:'11111111-1111-4111-8111-111111111111',expectedVersion:1,clientEventId:'22222222-2222-4222-8222-222222222222'};
it('accepts only the real collection/version and existing N5 key, with no representative order or client financial values',()=>{
 expect(isIssueCollectionInvoiceInput(input)).toBe(true);
 expect(isIssueCollectionInvoiceInput(JSON.parse(JSON.stringify(input)))).toBe(true);
});
it.each([{...input,orderId:'TEST-representative'},{...input,customerId:'TEST-client'},{...input,amount:11900},{...input,expectedVersion:0},{...input,expectedVersion:2147483648},{...input,collectionId:'not-an-id'},{...input,clientEventId:null},null])('rejects an invalid or expanded collection intent: %j',value=>{
 expect(isIssueCollectionInvoiceInput(value)).toBe(false);
});
