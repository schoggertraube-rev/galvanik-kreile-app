/** S38a E1: immutable invoice terms; values come from the existing customer,
 * agreement and company sources inside the issuing transaction. */
export type InvoicePaymentTerms={
 quelle:'absprache'|'kunde'|'firma';
 ziel_tage:number;
 skonto_prozent:number|null;
 skonto_tage:number|null;
};

/** Read the already frozen terms. Historical absence is handled by the caller;
 * a present but damaged record never falls back to today's customer settings. */
export function parseInvoicePaymentTerms(value:unknown,paymentTermDays:number):InvoicePaymentTerms{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVOICE_PAYMENT_TERMS_SNAPSHOT_INVALID');
 const row=value as Record<string,unknown>;
 if(Object.keys(row).sort().join(',')!=='quelle,skonto_prozent,skonto_tage,ziel_tage'
   ||(row.quelle!=='absprache'&&row.quelle!=='kunde'&&row.quelle!=='firma')
   ||row.ziel_tage!==paymentTermDays||!Number.isSafeInteger(paymentTermDays)||paymentTermDays<1||paymentTermDays>365)throw Error('INVOICE_PAYMENT_TERMS_SNAPSHOT_INVALID');
 const percent=row.skonto_prozent,days=row.skonto_tage;
 if(percent===null&&days===null)return {quelle:row.quelle,ziel_tage:paymentTermDays,skonto_prozent:null,skonto_tage:null};
 if(typeof percent!=='number'||!Number.isFinite(percent)||percent<=0||percent>100||!/^\d{1,3}(?:\.\d{1,2})?$/.test(String(percent))
   ||typeof days!=='number'||!Number.isSafeInteger(days)||days<0||days>365)throw Error('INVOICE_PAYMENT_TERMS_SNAPSHOT_INVALID');
 return {quelle:row.quelle,ziel_tage:paymentTermDays,skonto_prozent:percent,skonto_tage:days};
}

export function resolveInvoicePaymentTerms(
 companyDays:number|null,
 customer:{enabled:boolean;targetDays:number|null;discountPercent:string|number|null;discountDays:number|null},
 agreement:{type:string;targetDays:number|null}|null,
):InvoicePaymentTerms{
 if(typeof customer.enabled!=='boolean')throw Error('INVOICE_CUSTOMER_TERMS_INVALID');
 const agreementApplies=agreement!==null&&(agreement.type==='zahlungsziel'||agreement.type==='sammelrechnung');
 const days=agreementApplies?agreement.targetDays:customer.enabled?customer.targetDays:companyDays;
 if(days===null||!Number.isSafeInteger(days)||days<1||days>365)throw Error('INVOICE_PAYMENT_TERM_INVALID');
 const terms:InvoicePaymentTerms={quelle:agreementApplies?'absprache':customer.enabled?'kunde':'firma',ziel_tage:days,skonto_prozent:null,skonto_tage:null};
 if(!customer.enabled)return terms;
 if(customer.discountPercent===null&&customer.discountDays===null)return terms;
 const raw=String(customer.discountPercent);
 if(!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw))throw Error('INVOICE_CASH_DISCOUNT_INVALID');
 const [whole,fraction='']=raw.split('.');
 const percentBasisPoints=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(percentBasisPoints>10000||customer.discountDays===null||!Number.isSafeInteger(customer.discountDays)
   ||customer.discountDays<0||customer.targetDays===null||customer.discountDays>customer.targetDays)throw Error('INVOICE_CASH_DISCOUNT_INVALID');
 if(percentBasisPoints===0)return terms;
 return {...terms,skonto_prozent:percentBasisPoints/100,skonto_tage:customer.discountDays};
}
