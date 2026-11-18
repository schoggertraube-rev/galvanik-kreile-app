import {normaliseOrderPositionUnit,orderPositionUnitLabel} from '@/lib/orderPositionContract';

/** S54o d: only original-bound S/AE sources, never a rate/country guess. */
export type InvoiceElectronicTaxCategory='S'|'AE';
export type InvoiceElectronicUnitCode='C62'|'KGM'|'GRM'|'MTR'|'MTK'|'HUR'|'DMK'|'SET';
export function invoiceElectronicUnitLabel(code:InvoiceElectronicUnitCode,source?:'default_piece'):string{
 if(source!==undefined){if(source!=='default_piece'||code!=='C62')throw Error('INVOICE_ELECTRONIC_UNIT_SOURCE_INVALID');return 'Stk';}
 const labels:Record<InvoiceElectronicUnitCode,string>={C62:'Stk.',KGM:'kg',GRM:'g',MTR:'m',MTK:'m²',HUR:'Std.',DMK:'dm²',SET:'Satz'};
 if(!Object.hasOwn(labels,code))throw Error('INVOICE_ELECTRONIC_UNIT_INVALID');
 return labels[code];
}
export type InvoiceElectronicSourceLocation={kind:'settings'|'customer'|'order';field:string;objectId?:string;itemId?:string;orderVersion?:number;codePoint?:number};
export class InvoiceElectronicSourceError extends Error{
 constructor(readonly location:InvoiceElectronicSourceLocation){super('INVOICE_ELECTRONIC_SOURCE_REQUIRED');this.name='InvoiceElectronicSourceError';}
}

/** A serialization code for the existing unit, without converting quantities.
 * The five existing order-unit identities use the one order normalizer. The
 * additional spellings are the packet C8 units. DMK/SET preserve dm²/Satz;
 * UNECE Rec20 Annexes I/II, not a conversion to m² or individual pieces:
 * https://unece.org/sites/default/files/2023-10/rec20_rev3_Annex1e.pdf
 * https://unece.org/sites/default/files/2023-10/rec20_rev3_Annex2e.pdf
 */
export function invoiceElectronicUnit(value:unknown):{source:string;code:InvoiceElectronicUnitCode;label:string}|null{
 if(typeof value!=='string'||!value.trim())return null;
 const source=value.trim(),unit=normaliseOrderPositionUnit(source);
 if(unit!==null){
  const codes={stueck:'C62',kg:'KGM',dm2:'DMK',satz:'SET',stunde:'HUR'} as const;
  return {source,code:codes[unit],label:orderPositionUnitLabel(unit)};
 }
 const explicit:Record<string,{code:InvoiceElectronicUnitCode;label:string}>={
  Stk:{code:'C62',label:'Stk.'},'Stk.':{code:'C62',label:'Stk.'},
  g:{code:'GRM',label:'g'},m:{code:'MTR',label:'m'},'m²':{code:'MTK',label:'m²'},
  h:{code:'HUR',label:'h'},pauschal:{code:'C62',label:'pauschal'},
 };
 return Object.hasOwn(explicit,source)?{source,...explicit[source]}:null;
}

/** Formatting only: cents and the original minute quantity are never repriced. */
export function invoiceXmlAmount(cents:number):string{
 if(!Number.isSafeInteger(cents))throw Error('INVOICE_ELECTRONIC_AMOUNT_INVALID');
 const magnitude=BigInt(cents<0?-cents:cents);
 return `${cents<0?'-':''}${magnitude/BigInt(100)}.${String(magnitude%BigInt(100)).padStart(2,'0')}`;
}
/** PL18Nov19:22: exact presentation of the original line allocation only. */
export function invoiceBaseUnitPrice(quantity:number,roundedUnitCents:number,lineNetCents:number):string{
 if(!Number.isSafeInteger(quantity)||quantity<1||!Number.isSafeInteger(roundedUnitCents)||roundedUnitCents<0||!Number.isSafeInteger(lineNetCents)||lineNetCents<0)throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_INVALID');
 const count=BigInt(quantity),total=BigInt(lineNetCents);
 if((total+count/BigInt(2))/count!==BigInt(roundedUnitCents))throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_SOURCE_INVALID');
 const precise=(total*BigInt(100)+count/BigInt(2))/count;
 if((precise*count+BigInt(50))/BigInt(100)!==total)throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_ROUNDING_INVALID');
 const fraction=String(precise%BigInt(10000)).padStart(4,'0').replace(/0+$/,'').padEnd(2,'0');
 return `${precise/BigInt(10000)}.${fraction}`;
}
export function invoiceXmlWorkHours(minutes:number):string{
 if(!Number.isSafeInteger(minutes)||minutes<1)throw Error('INVOICE_ELECTRONIC_MINUTES_INVALID');
 const scaled=(BigInt(minutes)*BigInt(10000)+BigInt(30))/BigInt(60);
 return `${scaled/BigInt(10000)}.${String(scaled%BigInt(10000)).padStart(4,'0')}`;
}
