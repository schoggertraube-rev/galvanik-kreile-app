import 'server-only';
import {isDeepStrictEqual} from 'node:util';
import {readInvoiceVat} from '@/modules/accounting/public';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {InvoiceElectronicSourceError,invoiceXmlAmount} from '@/lib/domain/invoiceElectronicFields';
import {createInvoiceXml,type InvoiceXmlInput} from '@/lib/pdf/invoiceXml';
import {attachInvoiceXml} from '@/lib/pdf/invoiceHybridPdf';
import {E_INVOICE_COPY} from '@/ui/situationCatalog';
export type InvoiceOriginalReader=(bytes:Uint8Array)=>Promise<{code:string;suggestions?:readonly {field:string;value:unknown}[]}>;

/** Same incoming reader verifies the final single container, before its hash
 * or original receipt exists. Nothing here reads live prices or party data.
 */
export async function createInvoiceElectronicOriginal(pdf:Uint8Array,input:InvoiceXmlInput,readOriginal:InvoiceOriginalReader|undefined):Promise<Buffer>{
 const xml=createInvoiceXml(input),{snapshot,cancellation}=input;
 const date=cancellation?cancellation.at:snapshot.issuedAt;
 const title=cancellation?E_INVOICE_COPY.cancellationTitle(cancellation.number,input.invoiceNumber):input.invoiceNumber;
 const bytes=await attachInvoiceXml({pdf,xml,issuedAt:date,title});
 if(!readOriginal)throw Error('INVOICE_ELECTRONIC_READER_PORT_MISSING');
 const parsed=await readOriginal(bytes);
 if(parsed.code!=='OK'||!parsed.suggestions)throw Error('INVOICE_ELECTRONIC_CONTAINER_UNREADABLE');
 const fields=new Map(parsed.suggestions.map(value=>[value.field,value.value]));
 if(fields.size!==parsed.suggestions.length)throw Error('INVOICE_ELECTRONIC_READER_AMBIGUOUS');
 const direction=cancellation?-1:1,vat=readInvoiceVat(snapshot);
 const expectedSender={name:snapshot.seller.companyName,...(snapshot.seller.vatId?{ustId:snapshot.seller.vatId.replace(/\s/g,'')}:{}),...(snapshot.seller.taxNumber?{steuernummer:snapshot.seller.taxNumber}:{})};
 const expectedAmounts={netto:invoiceXmlAmount(direction*vat.netAmountCents),ust:invoiceXmlAmount(direction*vat.vatAmountCents),brutto:invoiceXmlAmount(direction*vat.grossAmountCents)};
 const expectedRates=vat.groups.map(group=>({satz:invoiceXmlAmount(group.rateBp),netto:invoiceXmlAmount(direction*group.netCents),ust:invoiceXmlAmount(direction*group.vatCents)}));
 if(fields.get('rechnung.nummer')!==(cancellation?cancellation.number:input.invoiceNumber)||fields.get('rechnung.datum')!==berlinCalendarDay(new Date(date))
  ||fields.get('rechnung.faellig')!==input.dueDate||fields.get('rechnung.iban')!==snapshot.seller.iban
  ||!isDeepStrictEqual(fields.get('rechnung.absender'),expectedSender)
  ||!isDeepStrictEqual(fields.get('rechnung.betrag'),expectedAmounts)
  ||!isDeepStrictEqual(fields.get('rechnung.steuersaetze'),expectedRates)){
  throw new InvoiceElectronicSourceError({kind:'order',objectId:snapshot.order.orderId,field:'rounding'});
 }
 return Buffer.from(bytes);
}
