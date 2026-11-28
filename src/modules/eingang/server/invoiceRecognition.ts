import 'server-only';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import type {DocumentSuggestion} from '@/lib/server/azureDocumentIntelligence';
import {invoiceCents,invoiceDate,invoiceDecimal} from '../invoiceContract';
import {findeRechnungswiderspruch} from './eingangsRegeln';

type InvoiceSuggestion={field:string;value:unknown;confidence:DocumentSuggestion['confidence'];source:DocumentSuggestion['source']};
function recognizedDate(raw:string){
 const text=raw.trim();if(invoiceDate(text))return text;
 const match=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
 if(!match)return null;const iso=match[3]+'-'+match[2].padStart(2,'0')+'-'+match[1].padStart(2,'0');return invoiceDate(iso)?iso:null;
}
/** Translate the existing Azure response once, retaining its real source and uncertainty. */
export function recognizeInvoiceFields(suggestions:readonly DocumentSuggestion[]):InvoiceSuggestion[]{
 const label=(value:string)=>value.toLocaleLowerCase('de-DE').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const isNumber=(value:string)=>/^(rechnungs ?(nummer|nr)|rechnung nr|invoice (number|no|id))$/.test(value);
 const isDate=(value:string)=>/^(rechnungsdatum|rechnung datum|invoice date)$/.test(value);
 if(!suggestions.some(value=>isNumber(label(value.label))||isDate(label(value.label))))return [];
 const result:InvoiceSuggestion[]=[],amounts:Record<string,string>={},sources:DocumentSuggestion[]=[],seen=new Set<string>();
 for(const suggestion of suggestions){
  const key=label(suggestion.label);let field:string|null=null,value:unknown=null;
  if(isNumber(key)){field='rechnung.nummer';value=suggestion.value.trim();}
  else if(isDate(key)){field='rechnung.datum';value=recognizedDate(suggestion.value);}
  else if(/^(fällig am|faellig am|fälligkeit|faelligkeit|zahlbar bis|due date)$/.test(key)){field='rechnung.faellig';value=recognizedDate(suggestion.value);}
  else if(/^(iban|bankverbindung iban)$/.test(key)){field='rechnung.iban';value=suggestion.value.replace(/\s/g,'');}
  else{
   const amountKey=/^(netto|nettobetrag|gesamt netto|net amount|subtotal)$/.test(key)?'netto':/^(ust|umsatzsteuer|mwst|mehrwertsteuer|steuerbetrag|tax amount|total tax)$/.test(key)?'ust':/^(brutto|bruttobetrag|gesamtbetrag|rechnungsbetrag|zahlbetrag|invoice total|total amount|amount due)$/.test(key)?'brutto':null;
   if(amountKey){const cents=invoiceCents(suggestion.value.replace(/\s*(?:€|EUR)\s*$/iu,''));if(cents!==null&&!Object.hasOwn(amounts,amountKey)){amounts[amountKey]=invoiceDecimal(cents);sources.push(suggestion);}}
  }
  if(field&&value!==null&&value!==''&&!seen.has(field)){result.push({field,value,confidence:suggestion.confidence,source:suggestion.source});seen.add(field);}
 }
 if(sources.length){
  const confidence=sources.reduce<number|null>((minimum,value)=>minimum===null||value.confidence===null?null:Math.min(minimum,value.confidence),1);
  result.push({field:'rechnung.betrag',value:amounts,confidence,source:sources[0].source});
 }
 return result;
}

type XmlRecord=Record<string,unknown>;
type XmlInvoiceSuggestion={field:string;value:unknown;confidence:number;source:{format:'UBL'|'CII';path:string}};
const xmlObject=(value:unknown):value is XmlRecord=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
function xmlChild(value:unknown,name:string):unknown{
 if(!xmlObject(value))return undefined;
 const matches=Object.entries(value).filter(([key])=>!key.startsWith('@_')&&key.split(':').at(-1)===name);
 if(matches.length!==1)return undefined;
 const found=matches[0][1];return Array.isArray(found)?found.length===1?found[0]:undefined:found;
}
function xmlChildren(value:unknown,name:string):unknown[]{
 if(!xmlObject(value))return [];
 const matches=Object.entries(value).filter(([key])=>!key.startsWith('@_')&&key.split(':').at(-1)===name);
 if(matches.length!==1)return [];
 return Array.isArray(matches[0][1])?matches[0][1]:[matches[0][1]];
}
function xmlPath(root:unknown,...names:string[]):unknown{return names.reduce<unknown>((value,name)=>xmlChild(value,name),root);}
function xmlText(value:unknown):string|null{
 const text=typeof value==='string'?value:xmlObject(value)&&typeof value['#text']==='string'?value['#text']:null;
 // Decode only XML's predefined/character text references, once. DTD/entity
 // expansion remains disabled in the sole parser and declarations stay rejected.
 const decoded=text?.replace(/&(amp|lt|gt|apos|quot|#\d+|#x[0-9a-f]+);/giu,(reference,entity:string)=>{
  const predefined:Record<string,string>={amp:'&',lt:'<',gt:'>',apos:"'",quot:'"'};
  if(Object.hasOwn(predefined,entity))return predefined[entity];
  if(!entity.startsWith('#'))return reference;
  const point=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));
  const valid=point===9||point===10||point===13||point>=0x20&&point<=0xD7FF||point>=0xE000&&point<=0xFFFD||point>=0x10000&&point<=0x10FFFF;
  return valid?String.fromCodePoint(point):reference;
 });
 return decoded?.trim()||null;
}
function xmlDate(value:unknown):string|null{
 const raw=xmlText(value);if(!raw)return null;
 const date=/^\d{8}$/.test(raw)?raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6):raw;
 return invoiceDate(date)?date:null;
}
/** UBL/CII is parsed as structured data; unknown XML is retained without OCR. */
export function recognizeInvoiceXml(bytes:Uint8Array):{code:'OK';suggestions:XmlInvoiceSuggestion[]}|{code:'UNSUPPORTED'}{
 try{
  if(bytes.byteLength>20*1024*1024)return {code:'UNSUPPORTED'};
  const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(xml)||/<\?xml[^>]*encoding\s*=\s*["'](?!utf-?8["'])/iu.test(xml)||XMLValidator.validate(xml)!==true)return {code:'UNSUPPORTED'};
  const parsed:unknown=new XMLParser({ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,processEntities:false}).parse(xml);
  if(!xmlObject(parsed))return {code:'UNSUPPORTED'};
  const roots=Object.entries(parsed).filter(([name])=>!name.startsWith('?'));
  if(roots.length!==1||!xmlObject(roots[0][1]))return {code:'UNSUPPORTED'};
  const [rootName,root]=roots[0];const rootParts=rootName.split(':'),local=rootParts.at(-1);
  const namespace=root['@_xmlns'+(rootParts.length>1?':'+rootParts[0]:'')];
  const format=local==='Invoice'&&namespace==='urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'?'UBL'
   :local==='CrossIndustryInvoice'&&namespace==='urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100'?'CII':null;
  if(!format)return {code:'UNSUPPORTED'};
  const settlement=format==='CII'?xmlPath(root,'SupplyChainTradeTransaction','ApplicableHeaderTradeSettlement'):undefined;
  const totals=format==='UBL'?xmlChild(root,'LegalMonetaryTotal'):xmlChild(settlement,'SpecifiedTradeSettlementHeaderMonetarySummation');
  const currency=xmlText(format==='UBL'?xmlChild(root,'DocumentCurrencyCode'):xmlChild(settlement,'InvoiceCurrencyCode'));
  if(currency!=='EUR')return {code:'UNSUPPORTED'};
  const result:XmlInvoiceSuggestion[]=[];
  const add=(field:string,value:unknown,path:string)=>{if(value!==null&&value!==undefined&&value!=='')result.push({field,value,confidence:1,source:{format,path}});};
  add('rechnung.nummer',xmlText(format==='UBL'?xmlChild(root,'ID'):xmlPath(root,'ExchangedDocument','ID')),'invoice.id');
  add('rechnung.datum',xmlDate(format==='UBL'?xmlChild(root,'IssueDate'):xmlPath(root,'ExchangedDocument','IssueDateTime','DateTimeString')),'invoice.date');
  add('rechnung.faellig',xmlDate(format==='UBL'?xmlChild(root,'DueDate'):xmlPath(settlement,'SpecifiedTradePaymentTerms','DueDateDateTime','DateTimeString')),'payment.due');
  add('rechnung.iban',xmlText(format==='UBL'?xmlPath(root,'PaymentMeans','PayeeFinancialAccount','ID'):xmlPath(settlement,'SpecifiedTradeSettlementPaymentMeans','PayeePartyCreditorFinancialAccount','IBANID')),'payment.iban');
  const seller=format==='UBL'?xmlPath(root,'AccountingSupplierParty','Party'):xmlPath(root,'SupplyChainTradeTransaction','ApplicableHeaderTradeAgreement','SellerTradeParty');
  const sender:Record<string,string>={};
  const name=format==='UBL'?xmlText(xmlPath(seller,'PartyLegalEntity','RegistrationName'))??xmlText(xmlPath(seller,'PartyName','Name')):xmlText(xmlChild(seller,'Name'));
  if(name)sender.name=name;
  const registrations=format==='UBL'?xmlChildren(seller,'PartyTaxScheme').map(value=>({kind:xmlText(xmlPath(value,'TaxScheme','ID')),id:xmlText(xmlChild(value,'CompanyID'))}))
   :xmlChildren(seller,'SpecifiedTaxRegistration').map(value=>{const id=xmlChild(value,'ID');return {kind:xmlObject(id)?id['@_schemeID']:undefined,id:xmlText(id)};});
  for(const [field,scheme] of [['ustId',format==='UBL'?'VAT':'VA'],['steuernummer','FC']] as const){
   const ids=[...new Set(registrations.filter(value=>value.kind===scheme&&value.id).map(value=>value.id!))];
   if(ids.length===1)sender[field]=ids[0];
  }
  if(Object.keys(sender).length)add('rechnung.absender',sender,'invoice.supplier');
  const taxNodes=format==='UBL'?xmlChildren(root,'TaxTotal').flatMap(value=>xmlChildren(value,'TaxSubtotal')):xmlChildren(settlement,'ApplicableTradeTax');
  const rates:Record<string,string>[]=[];
  for(const node of taxNodes){
   const fields={satz:format==='UBL'?xmlPath(node,'TaxCategory','Percent'):xmlChild(node,'RateApplicablePercent'),
    netto:xmlChild(node,format==='UBL'?'TaxableAmount':'BasisAmount'),ust:xmlChild(node,format==='UBL'?'TaxAmount':'CalculatedAmount')};
   const rate:Record<string,string>={};
   for(const [field,value] of Object.entries(fields)){
    const nodeCurrency=xmlObject(value)?value['@_currencyID']:undefined;
    if(nodeCurrency!==undefined&&nodeCurrency!=='EUR')continue;
    const text=xmlText(value),cents=text===null?null:invoiceCents(text);
    if(cents!==null)rate[field]=invoiceDecimal(cents);
   }
   if(Object.keys(rate).length===3)rates.push(rate);
  }
  if(rates.length)add('rechnung.steuersaetze',rates,'invoice.taxSubtotals');
  const amountValues={netto:format==='UBL'?xmlChild(totals,'TaxExclusiveAmount'):xmlChild(totals,'TaxBasisTotalAmount'),
   ust:format==='UBL'?xmlPath(root,'TaxTotal','TaxAmount'):xmlChild(totals,'TaxTotalAmount'),brutto:format==='UBL'?xmlChild(totals,'TaxInclusiveAmount'):xmlChild(totals,'GrandTotalAmount')};
  const amounts:Record<string,string>={};
  for(const [key,node] of Object.entries(amountValues)){
   const nodeCurrency=xmlObject(node)?node['@_currencyID']:undefined;if(nodeCurrency!==undefined&&nodeCurrency!=='EUR')continue;
   const text=xmlText(node),cents=text===null?null:invoiceCents(text);if(cents!==null)amounts[key]=invoiceDecimal(cents);
  }
  if(Object.keys(amounts).length)add('rechnung.betrag',amounts,'invoice.totals');
  if(!result.some(value=>value.field==='rechnung.nummer')||!result.some(value=>value.field==='rechnung.datum'))return {code:'UNSUPPORTED'};
  return {code:'OK',suggestions:result};
 }catch(error){console.error('[INVOICE_XML_PARSE_FAILED]',{errorName:error instanceof Error?error.name:'UnknownError'});return {code:'UNSUPPORTED'};}
}

type XmlRead=Extract<ReturnType<typeof recognizeInvoiceXml>,{code:'OK'}>;
type PdfDruckwert={field:'rechnung.nummer'|'rechnung.betrag';value:unknown;page:number};
type PdfRead=(XmlRead & {widerspruch?:NonNullable<ReturnType<typeof findeRechnungswiderspruch>> & {page:number}})
 | {code:'UNSUPPORTED';druckwerte?:readonly PdfDruckwert[]};

/** Read the embedded invoice and compare it with labelled values in the PDF text layer. */
export async function recognizeInvoicePdf(bytes:Uint8Array):Promise<PdfRead>{
 if(bytes.byteLength>20*1024*1024)return {code:'UNSUPPORTED'};
 try{
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:new Uint8Array(bytes),verbosity:0});
  try{
   const document=await task.promise,attachments=await document.getAttachments();
   const allowed=attachments?[...attachments].filter(([,attachment])=>['factur-x.xml','zugferd-invoice.xml','xrechnung.xml'].includes(attachment.filename.toLowerCase())):[];
   const valid:Array<{bytes:Uint8Array;result:Extract<ReturnType<typeof recognizeInvoiceXml>,{code:'OK'}>}>=[];
   for(const [id] of allowed){
    const embedded=await document.getAttachmentContent(id);if(!embedded)continue;
    if(valid.some(value=>Buffer.from(value.bytes).equals(embedded)))continue;
    const result=recognizeInvoiceXml(embedded);if(result.code==='OK')valid.push({bytes:embedded,result});
    // PL09:21: different valid originals must never be selected arbitrarily.
    if(valid.length>1)return {code:'UNSUPPORTED'};
   }
   const xml=valid[0]?.result;
   try{
    const sichtbareWerte:PdfDruckwert[]=[];
    for(let page=1;page<=document.numPages;page++){
     const original=await document.getPage(page);
     const {items}=await original.getTextContent();
     const text=items.map(item=>'str'in item?item.str+(item.hasEOL?'\n':' '):'').join('');
     for(const zeile of text.split(/\r?\n/)){
      const nummer=/^\s*(?:Rechnungs(?:nummer|nr\.?)|Rechnung\s+Nr\.?|Invoice\s+(?:number|no\.?|id))\s*:?\s+([^\s:]{1,100})\s*$/iu.exec(zeile)?.[1];
      if(nummer)sichtbareWerte.push({field:'rechnung.nummer',value:nummer,page});
      const brutto=/^\s*(?:Brutto|Gesamtbetrag|Rechnungsbetrag|Invoice\s+total|Total\s+amount)\s*:?\s+([\d.,+\- ]{1,40})(?:\s*(?:EUR|€))?\s*$/iu.exec(zeile)?.[1]?.trim();
      if(brutto&&invoiceCents(brutto)!==null)sichtbareWerte.push({field:'rechnung.betrag',value:{brutto},page});
     }
    }
    if(!xml)return sichtbareWerte.length?{code:'UNSUPPORTED',druckwerte:sichtbareWerte}:{code:'UNSUPPORTED'};
    const widerspruch=findeRechnungswiderspruch(xml.suggestions,sichtbareWerte);
    if(!widerspruch)return xml;
    const feld=widerspruch.xml.nummer!==null&&widerspruch.pdf.nummer!==null&&widerspruch.xml.nummer!==widerspruch.pdf.nummer
     ?'rechnung.nummer':'rechnung.betrag';
    const page=sichtbareWerte.find(wert=>wert.field===feld)?.page;
    return page===undefined?xml:{...xml,widerspruch:{...widerspruch,page}};
   }catch(error){
    console.error('[INVOICE_PDF_TEXT_READ_FAILED]',{errorName:error instanceof Error?error.name:'UnknownError'});
    return xml??{code:'UNSUPPORTED'};
   }
  }finally{await task.destroy();}
 }catch(error){console.error('[INVOICE_PDF_XML_READ_FAILED]',{errorName:error instanceof Error?error.name:'UnknownError'});return {code:'UNSUPPORTED'};}
}
