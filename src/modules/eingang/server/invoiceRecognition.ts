import 'server-only';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import type {DocumentSuggestion} from '@/lib/server/azureDocumentIntelligence';
import {invoiceCents,invoiceDate,invoiceDecimal} from '../invoiceContract';

type InvoiceSuggestion={field:string;value:unknown;confidence:number;source:DocumentSuggestion['source']};
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
 if(Object.keys(amounts).length)result.push({field:'rechnung.betrag',value:amounts,confidence:Math.min(...sources.map(value=>value.confidence)),source:sources[0].source});
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
function xmlPath(root:unknown,...names:string[]):unknown{return names.reduce<unknown>((value,name)=>xmlChild(value,name),root);}
function xmlText(value:unknown):string|null{
 const text=typeof value==='string'?value:xmlObject(value)&&typeof value['#text']==='string'?value['#text']:null;
 return text?.trim()||null;
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
