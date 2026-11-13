export type InvoiceVatGroup={rateBp:number;netCents:number;vatCents:number;grossCents:number};
export type InvoiceVatRead={groups:InvoiceVatGroup[];netAmountCents:number;vatAmountCents:number;grossAmountCents:number;headRate:number|null;reverseCharge:boolean};
export type InvoiceVatReader=(beleg:unknown)=>InvoiceVatRead;
