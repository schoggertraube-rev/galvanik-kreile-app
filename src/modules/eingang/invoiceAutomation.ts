import {invoiceCents,invoiceFieldErrors,type InvoiceFields} from './invoiceContract';
export type InvoiceAutomaticReadiness={state:'ready'|'incomplete'|'duplicate'|'stored';missing:string[]};
type Suggestion={feld:string;wert:unknown;sicherheit:string;verified:boolean};
/** Read-only eligibility. This is not a booking receipt and performs no write. */
export function invoiceAutomaticReadiness(input:{fields:InvoiceFields;originalSecured:boolean;supplierConfirmed:boolean;stored:boolean;duplicate:boolean;suggestions:Suggestion[]}):InvoiceAutomaticReadiness{
 if(input.stored)return {state:'stored',missing:[]};
 if(input.duplicate)return {state:'duplicate',missing:[]};
 const missing=new Set<string>(Object.values(invoiceFieldErrors(input.fields)));
 if(!input.originalSecured)missing.add('Gesichertes Original fehlt');
 if(!input.supplierConfirmed)missing.add('Aussteller ist nicht eindeutig bestätigt');
 const amount=(value:unknown)=>typeof value==='string'||typeof value==='number'?invoiceCents(String(value)):null;
 const canonical=(field:string,value:unknown)=>{
  if(field==='rechnung.betrag'){
   if(!value||typeof value!=='object'||Array.isArray(value))return null;
   const row=value as Record<string,unknown>,values=['netto','ust','brutto'].map(key=>amount(row[key]));
   return values.some(v=>v===null)?null:JSON.stringify(values);
  }
  return typeof value==='string'&&value.trim()?value.trim():null;
 };
 const required=[['rechnung.nummer',input.fields.nummer,'Nummer'],['rechnung.datum',input.fields.datum,'Datum'],['rechnung.betrag',{netto:input.fields.netto,ust:input.fields.ust,brutto:input.fields.brutto},'Beträge']] as const;
 for(const [field,value,label]of required){
  const rows=input.suggestions.filter(row=>row.feld===field),expected=canonical(field,value);
  if(!expected||!rows.length||!rows.some(row=>(row.verified||row.sicherheit==='sicher')&&canonical(field,row.wert)===expected))missing.add(label+' nicht sicher erkannt');
  if(rows.some(row=>canonical(field,row.wert)!==expected))missing.add(label+' widersprüchlich erkannt');
 }
 const net=invoiceCents(input.fields.netto),tax=invoiceCents(input.fields.ust),gross=invoiceCents(input.fields.brutto);
 if(net!==null&&tax!==null&&gross!==null&&net+tax!==gross)missing.add('Netto + MwSt entspricht nicht Brutto');
 return {state:missing.size?'incomplete':'ready',missing:[...missing]};
}
