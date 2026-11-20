import {expect,it} from 'vitest';
import {invoiceAgingBucket} from '../invoiceAgingContract';
// Synthetic classified facts, not a duplicate due-date classifier.
it.each([[1,'1-14'],[14,'1-14'],[15,'15-30'],[30,'15-30'],[31,'31-60'],[60,'31-60'],[61,'61-90'],[90,'61-90'],[91,'>90']] as const)('projects the existing age bucket for %i qualified overdue days',(overdueDays,expected)=>{
 expect(invoiceAgingBucket({overdue:true,overdueDays})).toBe(expected);
});
it('keeps an explicitly non-overdue invoice separate and rejects damaged facts',()=>{
 expect(invoiceAgingBucket({overdue:false,overdueDays:0})).toBe('nicht_faellig');
 expect(()=>invoiceAgingBucket({overdue:true,overdueDays:0})).toThrow('INVOICE_AGING_SOURCE_INVALID');
 expect(()=>invoiceAgingBucket({overdue:false,overdueDays:3})).toThrow('INVOICE_AGING_SOURCE_INVALID');
});
