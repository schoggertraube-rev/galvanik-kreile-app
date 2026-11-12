export type InvoiceVatGroup={rateBp:0|700|1900;netCents:number;vatCents:number;grossCents:number};
export type InvoiceVatRead={groups:InvoiceVatGroup[];netAmountCents:number;vatAmountCents:number;grossAmountCents:number;headRate:number|null;reverseCharge:boolean};
export type InvoiceVatReader=(beleg:unknown)=>InvoiceVatRead;
