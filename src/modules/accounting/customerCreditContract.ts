export type CustomerCredit={customerId:string;balanceCents:number;version:number};
export type CustomerCreditApplyInput={invoiceId:string;amount:number;expectedVersion:number;expectedOpenAmountCents:number;expectedCreditVersion:number;clientEventId:string};
export type CustomerCreditResult=
 | {code:'OK';credit:CustomerCredit}
 | {code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
