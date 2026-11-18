import {CUSTOMER_COUNTRIES} from '@/modules/customers/public';
import {invoiceDate} from '@/modules/eingang/public';
import {readInvoiceVat,type InvoiceVatRead} from '@/modules/accounting/public';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {InvoiceElectronicSourceError,invoiceXmlAmount,invoiceXmlWorkHours,invoiceBaseUnitPrice} from '@/lib/domain/invoiceElectronicFields';
import type {ImmutableInvoiceSnapshotV3} from './ImmutableInvoiceDocument';
import {E_INVOICE_COPY,INVOICE_VAT_COPY} from '@/ui/situationCatalog';

// Normative output vocabulary, not an additional customer/country source.
// Same BR-CL-14 whitelist as the pinned KoSIT EN16931-CII validator.
// KoSIT release2026-08-31; validator resource SHA256 0911e927f13f9ae2cdc7f973643f27bf0ad3c5da02483c04a5b8a47eb4822199.
const COUNTRY_CODES=new Set('1A AD AE AF AG AI AL AM AN AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BL BJ BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH EL ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XI YE YT ZA ZM ZW'.split(' '));
type Fields=Pick<ImmutableInvoiceSnapshotV3,'seller'|'customer'|'order'|'lines'|'totals'|'serviceDate'|'paymentTermDays'>;
export type InvoiceXmlInput={snapshot:ImmutableInvoiceSnapshotV3;invoiceNumber:string;dueDate:string;cancellation?:{at:string;reason:string}};

function countryCode(value:string,kind:'settings'|'customer',objectId?:string):string{
 const match=CUSTOMER_COUNTRIES.find(country=>country.value===value||country.label===value);
 const code=match?match.value:value;
 if(!COUNTRY_CODES.has(code))throw new InvoiceElectronicSourceError({kind,objectId,field:'country'});
 return code;
}
function text(value:unknown,kind:'settings'|'customer'|'order',field:string,objectId?:string):asserts value is string{
 if(typeof value!=='string'||!value.trim())throw new InvoiceElectronicSourceError({kind,objectId,field});
}
/** C3/C4/C6/C12: run this on the prepared fields before number allocation.
 * VAT is checked by the one original-VAT reader; no repricing or second tax
 * calculation. A rounded average unit price cannot silently alter a line.
 */
export function assertInvoiceElectronicFields(input:Fields):InvoiceVatRead{
 for(const field of ['companyName','street','zip','city','country','iban'] as const)text(input.seller[field],'settings',field);
 if(!input.seller.vatId&&!input.seller.taxNumber)throw new InvoiceElectronicSourceError({kind:'settings',field:'taxId'});
 for(const field of ['name','street','zip','city','country'] as const)text(input.customer[field],'customer',field);
 countryCode(input.seller.country,'settings');countryCode(input.customer.country,'customer');
 if(!invoiceDate(input.serviceDate))throw new InvoiceElectronicSourceError({kind:'order',objectId:input.order.orderId,field:'serviceDate'});
 if(!Number.isSafeInteger(input.paymentTermDays)||input.paymentTermDays<1||input.paymentTermDays>365)throw new InvoiceElectronicSourceError({kind:'settings',field:'paymentTermDays'});
 for(const line of input.lines){
  if(!line.unit)throw new InvoiceElectronicSourceError({kind:'order',objectId:input.order.orderId,field:'unit:'+(line.type==='EXTRA_WORK'?line.catalogPositionName:line.name)});
  if(line.type==='BASE'&&line.unitSource!==undefined&&(line.unitSource!=='default_piece'||line.unit!=='C62'||typeof line.itemId!=='string'||!line.itemId.trim()||!Number.isSafeInteger(line.quantity)||line.quantity<1))throw new InvoiceElectronicSourceError({kind:'order',objectId:input.order.orderId,field:'unit:'+line.name});
  if(line.type==='BASE')try{invoiceBaseUnitPrice(line.quantity,line.unitNetAmountCents,line.lineNetAmountCents);}catch{throw new InvoiceElectronicSourceError({kind:'order',objectId:input.order.orderId,field:'rounding'});}
 }
 try{return readInvoiceVat({...input,schemaVersion:3});}
 catch(error){
  console.error('INVOICE_ELECTRONIC_ORIGINAL_INVALID',{code:error instanceof Error?error.message:'UNKNOWN'});
  throw new InvoiceElectronicSourceError({kind:'order',objectId:input.order.orderId,field:'rounding'});
 }
}
function escaped(value:string):string{return value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]!));}
function node(name:string,value:string,attributes:Record<string,string>={}):string{return '<'+name+Object.entries(attributes).map(([key,text])=>' '+key+'="'+escaped(text)+'"').join('')+'>'+escaped(value)+'</'+name+'>';}
function date(value:string):string{if(!invoiceDate(value))throw Error('INVOICE_ELECTRONIC_DATE_INVALID');return node('udt:DateTimeString',value.replaceAll('-',''),{format:'102'});}
function day(instant:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(instant)||!Number.isFinite(new Date(instant).getTime())||new Date(instant).toISOString()!==instant)throw Error('INVOICE_ELECTRONIC_TIME_INVALID');
 return berlinCalendarDay(new Date(instant));
}
function address(party:Fields['seller']|Fields['customer'],kind:'settings'|'customer'):string{
 return '<ram:PostalTradeAddress>'+node('ram:PostcodeCode',party.zip)+node('ram:LineOne',party.street)+node('ram:CityName',party.city)+node('ram:CountryID',countryCode(party.country,kind))+'</ram:PostalTradeAddress>';
}
const taxRegistration=(id:string,scheme:'VA'|'FC')=>'<ram:SpecifiedTaxRegistration>'+node('ram:ID',id,{schemeID:scheme})+'</ram:SpecifiedTaxRegistration>';
const reason=node('ram:ExemptionReason',INVOICE_VAT_COPY.reverseCharge);
/** Only the frozen snapshot and existing document/cancellation identity enter
 * the CII. Resend must use the stored PDF, never call this function again.
 */
export function createInvoiceXml(input:InvoiceXmlInput):Uint8Array{
 const {snapshot,invoiceNumber,dueDate,cancellation}=input;
 const vat=assertInvoiceElectronicFields(snapshot);
 if(!/^R-\d{4}-\d{4,}$/.test(invoiceNumber)||!invoiceDate(dueDate))throw Error('INVOICE_ELECTRONIC_DOCUMENT_ID_INVALID');
 const direction=cancellation?-1:1;
 const invoiceDay=day(cancellation?cancellation.at:snapshot.issuedAt);
 const noteTexts=snapshot.lines.flatMap(line=>line.type==='SHIPPING'&&line.shippingKind==='reference'?[line.name]:[]);
 if(cancellation)noteTexts.push(cancellation.reason);
 const notes=noteTexts.map(value=>'<ram:IncludedNote>'+node('ram:Content',value)+'</ram:IncludedNote>').join('');
 const lines=snapshot.lines.filter(line=>!(line.type==='SHIPPING'&&line.shippingKind==='reference')).map((line,index)=>{
  const name=line.type==='EXTRA_WORK'?line.catalogPositionName:line.name;
  const quantity=line.type==='BASE'?String(line.quantity):line.type==='EXTRA_WORK'?invoiceXmlWorkHours(line.minutes):'1';
  const price=line.type==='BASE'?invoiceBaseUnitPrice(line.quantity,line.unitNetAmountCents,line.lineNetAmountCents):invoiceXmlAmount(line.type==='EXTRA_WORK'?line.hourlyRateCents:line.amountCents);
  const amount=line.type==='BASE'?line.lineNetAmountCents:line.amountCents;
  if(!line.unit||!line.taxCategory||line.vat_rate_basis_points===undefined)throw Error('INVOICE_ELECTRONIC_LINE_SOURCE_REQUIRED');
  return '<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument>'+node('ram:LineID',String(index+1))+'</ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct>'+node('ram:Name',name)+'</ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice>'+node('ram:ChargeAmount',price)+'</ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery>'+node('ram:BilledQuantity',(direction===-1?'-':'')+quantity,{unitCode:line.unit})+'</ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:ApplicableTradeTax>'+node('ram:TypeCode','VAT')+node('ram:CategoryCode',line.taxCategory)+node('ram:RateApplicablePercent',(line.vat_rate_basis_points/100).toFixed(2))+'</ram:ApplicableTradeTax><ram:SpecifiedTradeSettlementLineMonetarySummation>'+node('ram:LineTotalAmount',invoiceXmlAmount(direction*amount))+'</ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>';
 }).join('');
 // PL18.11.14:36: BT-32 alone does not satisfy BR-CO-26. Reuse the
 // frozen domestic tax number as BT-29 only when BT-31 is absent.
 const seller='<ram:SellerTradeParty>'+(!snapshot.seller.vatId&&snapshot.seller.taxNumber?node('ram:ID',snapshot.seller.taxNumber):'')+node('ram:Name',snapshot.seller.companyName)+address(snapshot.seller,'settings')+(snapshot.seller.vatId?taxRegistration(snapshot.seller.vatId,'VA'):'')+(snapshot.seller.taxNumber?taxRegistration(snapshot.seller.taxNumber,'FC'):'')+'</ram:SellerTradeParty>';
 const buyer='<ram:BuyerTradeParty>'+node('ram:Name',snapshot.customer.companyName||snapshot.customer.name)+address(snapshot.customer,'customer')+(snapshot.customer.vatId?taxRegistration(snapshot.customer.vatId,'VA'):'')+'</ram:BuyerTradeParty>';
 const taxes=vat.groups.map(group=>'<ram:ApplicableTradeTax>'+node('ram:CalculatedAmount',invoiceXmlAmount(direction*group.vatCents))+node('ram:TypeCode','VAT')+(vat.reverseCharge?reason:'')+node('ram:BasisAmount',invoiceXmlAmount(direction*group.netCents))+node('ram:CategoryCode',vat.reverseCharge?'AE':'S')+(vat.reverseCharge?node('ram:ExemptionReasonCode','VATEX-EU-AE'):'')+node('ram:RateApplicablePercent',(group.rateBp/100).toFixed(2))+'</ram:ApplicableTradeTax>').join('');
 const parent=cancellation?'<ram:InvoiceReferencedDocument>'+node('ram:IssuerAssignedID',invoiceNumber)+'<ram:FormattedIssueDateTime>'+node('qdt:DateTimeString',day(snapshot.issuedAt).replaceAll('-',''),{format:'102'})+'</ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>':'';
 const amounts='<ram:SpecifiedTradeSettlementHeaderMonetarySummation>'+node('ram:LineTotalAmount',invoiceXmlAmount(direction*vat.netAmountCents))+node('ram:TaxBasisTotalAmount',invoiceXmlAmount(direction*vat.netAmountCents))+node('ram:TaxTotalAmount',invoiceXmlAmount(direction*vat.vatAmountCents),{currencyID:'EUR'})+node('ram:GrandTotalAmount',invoiceXmlAmount(direction*vat.grossAmountCents))+node('ram:TotalPrepaidAmount','0.00')+node('ram:DuePayableAmount',invoiceXmlAmount(direction*vat.grossAmountCents))+'</ram:SpecifiedTradeSettlementHeaderMonetarySummation>';
 const dueLabel=dueDate.slice(8,10)+'.'+dueDate.slice(5,7)+'.'+dueDate.slice(0,4);
 const xml='<?xml version="1.0" encoding="UTF-8"?>'+
 '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">'+
 '<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter>'+node('ram:ID','urn:cen.eu:en16931:2017')+'</ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>'+
 '<rsm:ExchangedDocument>'+node('ram:ID',invoiceNumber)+node('ram:TypeCode',cancellation?'384':'380')+'<ram:IssueDateTime>'+date(invoiceDay)+'</ram:IssueDateTime>'+notes+'</rsm:ExchangedDocument>'+
 '<rsm:SupplyChainTradeTransaction>'+lines+'<ram:ApplicableHeaderTradeAgreement>'+seller+buyer+'</ram:ApplicableHeaderTradeAgreement><ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime>'+date(snapshot.serviceDate)+'</ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery><ram:ApplicableHeaderTradeSettlement>'+
 node('ram:InvoiceCurrencyCode','EUR')+'<ram:SpecifiedTradeSettlementPaymentMeans>'+node('ram:TypeCode','58')+'<ram:PayeePartyCreditorFinancialAccount>'+node('ram:IBANID',snapshot.seller.iban)+'</ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>'+taxes+
 '<ram:SpecifiedTradePaymentTerms>'+node('ram:Description',E_INVOICE_COPY.paymentTerms(snapshot.paymentTermDays,dueLabel))+'<ram:DueDateDateTime>'+date(dueDate)+'</ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>'+amounts+parent+'</ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>';
 return new TextEncoder().encode(xml);
}
