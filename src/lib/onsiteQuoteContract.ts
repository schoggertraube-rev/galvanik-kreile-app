import type {CreateQuoteInput} from "@/modules/quotes/public";
export type OnsiteQuoteInput={
 clientRequestId:string;
 customer:{mode:'EXISTING';customerId:string}|{mode:'NEW';data:Omit<import('@/modules/customers/public').CreateCustomerInput,'clientEventId'>};
 quote:Omit<CreateQuoteInput,'clientEventId'|'customerId'|'source'>;
 evidence:string;
 goods:Record<string,unknown>;
 quantities:Array<{position:number;received:number;note:string|null}>;
 handoverMode:'pickup'|'shipping';paymentMode:'abholung'|'vorkasse'|'rechnung';confirmedOrderDueDate:string;
};
