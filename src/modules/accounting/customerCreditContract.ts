export type CustomerCredit={customerId:string;balanceCents:number;version:number};
export type CustomerCreditResult=
 | {code:'OK';credit:CustomerCredit}
 | {code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
