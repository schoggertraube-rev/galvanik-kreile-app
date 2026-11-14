export type CustomerCredit={customerId:string;balanceCents:number;version:number};
export type CustomerCreditApplyInput={invoiceId:string;amount:number;expectedVersion:number;expectedOpenAmountCents:number;expectedCreditVersion:number;clientEventId:string};
export type CustomerCreditApplicationRead=
 | {code:'OK';credit:CustomerCredit;proposal:{label:string;command:'credit.apply';input:Omit<CustomerCreditApplyInput,'clientEventId'>}|null}
 | {code:'SOURCE_INCOMPLETE'};
export type CustomerCreditResult=
 | {code:'OK';credit:CustomerCredit}
 | {code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
