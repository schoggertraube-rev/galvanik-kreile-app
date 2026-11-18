import type {InvoiceElectronicSourceLocation} from '@/lib/domain/invoiceElectronicFields';
import {E_INVOICE_SETTINGS_COPY} from '@/ui/situationCatalog';

/** Navigation only. Permission remains the canonical client projection and
 * the existing settings action/page gate. No new writer or field is created. */
export function invoiceSettingsCorrection(source:InvoiceElectronicSourceLocation|undefined,orderId:string):{label:string;href:string}|undefined{
 if(source?.kind!=='settings')return undefined;
 const field=source.field==='vatId'?'taxId':source.field;
 if(!Object.hasOwn(E_INVOICE_SETTINGS_COPY.fieldLabels,field))return undefined;
 return {label:E_INVOICE_SETTINGS_COPY.action(source.field),href:'/settings?returnTo='+encodeURIComponent('/orders/'+encodeURIComponent(orderId))+'#company-'+field};
}
