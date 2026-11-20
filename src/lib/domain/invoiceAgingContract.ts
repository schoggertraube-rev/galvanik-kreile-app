/** Existing age buckets from v_aging, fed solely by qualified invoice facts.
 * The due-day difference is a SQL calendar fact, not another overdue rule. */
export function invoiceAgingBucket(invoice:{overdue:boolean;overdueDays:number}):string{
 if(typeof invoice.overdue!=='boolean'||!Number.isSafeInteger(invoice.overdueDays)||invoice.overdueDays<0||(!invoice.overdue&&invoice.overdueDays!==0))throw Error('INVOICE_AGING_SOURCE_INVALID');
 if(!invoice.overdue)return 'nicht_faellig';
 const days=invoice.overdueDays;
 if(!Number.isSafeInteger(days)||days<1)throw Error('INVOICE_AGING_SOURCE_INVALID');
 return days<=14?'1-14':days<=30?'15-30':days<=60?'31-60':days<=90?'61-90':'>90';
}
