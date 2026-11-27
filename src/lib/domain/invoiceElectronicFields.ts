import {normaliseOrderPositionUnit,orderPositionUnitLabel} from '@/lib/orderPositionContract';

/** S54o d: only original-bound S/AE sources, never a rate/country guess. */
export type InvoiceElectronicTaxCategory='S'|'AE';
const materialUnits = {
  paar: { code: 'PR', label: 'Paar' },
  ml: { code: 'MLT', label: 'ml' },
  l: { code: 'LTR', label: 'l' },
  mm: { code: 'MMT', label: 'mm' },
  cm: { code: 'CMT', label: 'cm' },
} as const;

type MaterialOnlyUnitCode = (typeof materialUnits)[keyof typeof materialUnits]['code'];
type ExistingInvoiceUnitCode = 'C62'|'KGM'|'GRM'|'MTR'|'MTK'|'HUR'|'DMK'|'SET';
export type InvoiceElectronicUnitCode = ExistingInvoiceUnitCode | MaterialOnlyUnitCode;
export type InvoiceMaterialUnitCode = 'C62' | 'KGM' | 'GRM' | 'MTR' | MaterialOnlyUnitCode;

export function isInvoiceMaterialUnitCode(value: unknown): value is InvoiceMaterialUnitCode {
  return value === 'C62' || value === 'KGM' || value === 'GRM' || value === 'MTR'
    || Object.values(materialUnits).some(({ code }) => code === value);
}

export function invoiceMaterialLineNetCents(unitNetAmount: unknown, quantity: unknown): number | null {
  if (typeof unitNetAmount !== 'string' || typeof quantity !== 'string') return null;
  const price = /^(0|[1-9][0-9]*)\.([0-9]{4})$/.exec(unitNetAmount);
  const amount = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,3}))?$/.exec(quantity);
  if (!price || price[0] !== unitNetAmount || !amount || amount[0] !== quantity) return null;

  const thousandths = BigInt(amount[1] + (amount[2] ?? '').padEnd(3, '0'));
  if (thousandths === BigInt(0)) return null;
  const tenThousandths = BigInt(price[1] + price[2]);
  const cents = (tenThousandths * thousandths + BigInt(50000)) / BigInt(100000);
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

export function invoiceElectronicUnitLabel(code:InvoiceElectronicUnitCode,source?:'default_piece'):string{
 if(source!==undefined){if(source!=='default_piece'||code!=='C62')throw Error('INVOICE_ELECTRONIC_UNIT_SOURCE_INVALID');return 'Stk';}
 const material = Object.values(materialUnits).find(unit => unit.code === code);
 if (material) return material.label;
 const labels:Readonly<Partial<Record<InvoiceElectronicUnitCode,string>>>={C62:'Stk.',KGM:'kg',GRM:'g',MTR:'m',MTK:'m²',HUR:'Std.',DMK:'dm²',SET:'Satz'};
 const label = Object.hasOwn(labels, code) ? labels[code] : undefined;
 if(!label)throw Error('INVOICE_ELECTRONIC_UNIT_INVALID');
 return label;
}
export type InvoiceElectronicSourceLocation={kind:'settings'|'customer'|'order';field:string;objectId?:string;itemId?:string;orderVersion?:number;codePoint?:number};
export class InvoiceElectronicSourceError extends Error{
 constructor(readonly location:InvoiceElectronicSourceLocation){super('INVOICE_ELECTRONIC_SOURCE_REQUIRED');this.name='InvoiceElectronicSourceError';}
}

export class InvoiceMaterialUnitError extends Error {
  constructor(readonly unit: string) {
    super('MATERIAL_EINHEIT_OHNE_CODE');
    this.name = 'InvoiceMaterialUnitError';
  }
}

/** A serialization code for the existing unit, without converting quantities.
 * The five existing order-unit identities use the one order normalizer. The
 * additional spellings are the packet C8 units. DMK/SET preserve dm²/Satz;
 * UNECE Rec20 Annexes I/II, not a conversion to m² or individual pieces:
 * https://unece.org/sites/default/files/2023-10/rec20_rev3_Annex1e.pdf
 * https://unece.org/sites/default/files/2023-10/rec20_rev3_Annex2e.pdf
 */
export function invoiceElectronicUnit(value:unknown, lineType?: 'MATERIAL'):{source:string;code:InvoiceElectronicUnitCode;label:string}|null{
 if(typeof value!=='string'||!value.trim())return null;
 const source = value.trim();
 const unit = normaliseOrderPositionUnit(lineType === 'MATERIAL' && source === 'stk' ? 'stueck' : source);
 if (lineType === 'MATERIAL' && Object.hasOwn(materialUnits, source)) {
  return { source, ...materialUnits[source as keyof typeof materialUnits] };
 }
 if (lineType === 'MATERIAL' && !['stk', 'kg', 'g', 'm'].includes(source)) return null;
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
export function isInvoiceVatId(value:string):boolean{return /^[A-Z]{2}[A-Za-z0-9]{2,12}$/.test(value.replace(/\s/g,''));}
export function invoiceXmlAmount(cents:number):string{
 if(!Number.isSafeInteger(cents))throw Error('INVOICE_ELECTRONIC_AMOUNT_INVALID');
 const magnitude=BigInt(cents<0?-cents:cents);
 return `${cents<0?'-':''}${magnitude/BigInt(100)}.${String(magnitude%BigInt(100)).padStart(2,'0')}`;
}
/** The BASE unit price is an exact allocation of the stored line total. */
export function invoiceBaseUnitAmounts(quantity: number, lineNetCents: number, unit?: InvoiceElectronicUnitCode) {
  if (!Number.isSafeInteger(lineNetCents) || lineNetCents < 0 || typeof quantity !== 'number' || quantity <= 0) {
    throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_INVALID');
  }
  let count: bigint;
  let scale = BigInt(1);
  if (Number.isSafeInteger(quantity)) {
    count = BigInt(quantity);
  } else {
    const decimal = /^([0-9]+)\.([0-9]{1,3})$/.exec(String(quantity));
    if (!decimal || quantity > 99_999 || (unit !== 'KGM' && unit !== 'DMK' && unit !== 'SET')) {
      throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_INVALID');
    }
    count = BigInt(decimal[1] + decimal[2]);
    scale = BigInt(10) ** BigInt(decimal[2].length);
  }
  const lineCents = BigInt(lineNetCents);
  const rounded = (lineCents * scale + count / BigInt(2)) / count;
  const precise = (lineCents * scale * BigInt(100) + count / BigInt(2)) / count;
  const centDivisor = scale * BigInt(100);
  if ((precise * count + centDivisor / BigInt(2)) / centDivisor !== lineCents) {
    throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_ROUNDING_INVALID');
  }
  const unitNetAmountCents = Number(rounded);
  if (!Number.isSafeInteger(unitNetAmountCents)) throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_INVALID');
  const fraction = String(precise % BigInt(10000)).padStart(4, '0').replace(/0+$/, '').padEnd(2, '0');
  return { unitNetAmountCents, unitNetAmount: `${precise / BigInt(10000)}.${fraction}` };
}

export function invoiceBaseUnitPrice(quantity: number, roundedUnitCents: number, lineNetCents: number, unit?: InvoiceElectronicUnitCode): string {
  if (!Number.isSafeInteger(roundedUnitCents) || roundedUnitCents < 0) throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_INVALID');
  const allocation = invoiceBaseUnitAmounts(quantity, lineNetCents, unit);
  if (allocation.unitNetAmountCents !== roundedUnitCents) throw Error('INVOICE_ELECTRONIC_UNIT_PRICE_SOURCE_INVALID');
  return allocation.unitNetAmount;
}
export function invoiceExtraWorkCents(minutes: number, hourlyRateCents: number) {
  if (!Number.isSafeInteger(minutes) || minutes < 0 || !Number.isSafeInteger(hourlyRateCents) || hourlyRateCents < 1) {
    throw Error('INVOICE_EXTRA_WORK_AMOUNT_INVALID');
  }
  const dividend = BigInt(minutes) * BigInt(hourlyRateCents);
  const fullCents = Number((dividend + BigInt(30)) / BigInt(60));
  if (!Number.isSafeInteger(fullCents)) throw Error('INVOICE_EXTRA_WORK_AMOUNT_INVALID');
  return { fullCents, cappedCents: Number(dividend / BigInt(60)) };
}

export function invoiceXmlWorkHours(minutes:number, precise=false):string{
 if(!Number.isSafeInteger(minutes)||minutes<1)throw Error('INVOICE_ELECTRONIC_MINUTES_INVALID');
 const digits = precise ? 10 : 4;
 const scale = BigInt(10) ** BigInt(digits);
 const scaled = (BigInt(minutes) * scale + BigInt(precise ? 59 : 30)) / BigInt(60);
 return `${scaled / scale}.${String(scaled % scale).padStart(digits, '0')}`;
}
