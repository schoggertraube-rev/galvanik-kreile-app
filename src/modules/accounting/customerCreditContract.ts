export type CustomerCredit={customerId:string;balanceCents:number;version:number};
export type CustomerCreditApplyInput={invoiceId:string;amount:number;expectedVersion:number;expectedOpenAmountCents:number;expectedCreditVersion:number;clientEventId:string};
export type CustomerCreditPayoutInput={customerId:string;amount:number;expectedCreditVersion:number;clientEventId:string;method:'bar'|'ueberweisung';reference:{date:string;purpose:string}|null;note:string|null};
export type CustomerCreditPayoutReceipt={eventId:string;creditEntryId:string;customerId:string;clientEventId:string;amountCents:number;balanceCents:number;creditVersion:number;method:'bar'|'ueberweisung';reference:string|null;note:string|null;actorId:string;occurredAt:string;description:string};
export type CustomerCreditPayoutResult=
 | {code:'OK';receipt:CustomerCreditPayoutReceipt;replayed:boolean}
 | {code:'CONFLICT';message:string;currentCreditBalanceCents?:number}
 | {code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
export type CustomerCreditApplicationRead=
 | {code:'OK';credit:CustomerCredit;proposal:{label:string;command:'credit.apply';input:Omit<CustomerCreditApplyInput,'clientEventId'>}|null}
 | {code:'SOURCE_INCOMPLETE'};
export type CustomerCreditResult=
 | {code:'OK';credit:CustomerCredit;payoutHistory?:{code:'OK';entries:CustomerCreditPayoutReceipt[]}|{code:'SOURCE_INCOMPLETE'}}
 | {code:'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR'|'UNAVAILABLE';message:string};
