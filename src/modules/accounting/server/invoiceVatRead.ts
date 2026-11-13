import 'server-only';
import type {InvoiceVatGroup,InvoiceVatRead} from '../invoiceVatContract';

const EU_OUTSIDE_DE=new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function cents(value:unknown):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('INVOICE_VAT_CENTS_INVALID');return value;}
function persistedCents(value:unknown):number{return cents(typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)?Number(value):value);}
function rounded(net:number,rate:number){return Number((BigInt(net)*BigInt(rate)+BigInt(5000))/BigInt(10000));}
function total(groups:InvoiceVatGroup[],field:'netCents'|'vatCents'|'grossCents'){return cents(groups.reduce((sum,row)=>sum+row[field],0));}
/** PL13.11.00:14: the only original-VAT reader. Schema 1 is never rewritten. */
export function readInvoiceVat(beleg:unknown):InvoiceVatRead{
 if(!object(beleg))throw Error('INVOICE_VAT_ORIGINAL_REQUIRED');
 const stored=beleg;
 // PL13.11.08:01 KORR-S05K-5: old persisted cents are the historical truth.
 // Never apply current rates or group-rounding rules to an old invoice.
 if(Object.prototype.hasOwnProperty.call(stored,'snapshot')&&stored.snapshot===null){
  const net=persistedCents(stored.net_amount_cents),vat=persistedCents(stored.vat_amount_cents),gross=persistedCents(stored.gross_amount_cents),rate=persistedCents(stored.vat_rate_basis_points);
  if(gross!==net+vat)throw Error('INVOICE_VAT_LEGACY_INVALID');
  return {groups:[{rateBp:rate,netCents:net,vatCents:vat,grossCents:gross}],netAmountCents:net,vatAmountCents:vat,grossAmountCents:gross,headRate:rate,reverseCharge:false};
 }
 if(Object.prototype.hasOwnProperty.call(stored,'snapshot')){
  if(!object(stored.snapshot))throw Error('INVOICE_VAT_ORIGINAL_REQUIRED');
  beleg=stored.snapshot;
 }
 if(!object(beleg)||!object(beleg.totals))throw Error('INVOICE_VAT_ORIGINAL_REQUIRED');
 const totals=beleg.totals,net=cents(totals.netAmountCents),vat=cents(totals.vatAmountCents),gross=cents(totals.grossAmountCents);
 let groups:InvoiceVatGroup[],headRate:number|null;
 if(beleg.schemaVersion===1){
  const rate=persistedCents(totals.vatRateBasisPoints);
  if(gross!==net+vat)throw Error('INVOICE_VAT_LEGACY_INVALID');
  groups=[{rateBp:rate,netCents:net,vatCents:vat,grossCents:gross}];headRate=rate;
 }else if(beleg.schemaVersion===2){
  if(totals.vatRateBasisPoints!==null||!Array.isArray(totals.vatBreakdown)||!totals.vatBreakdown.length||!Array.isArray(beleg.lines)||!beleg.lines.length)throw Error('INVOICE_VAT_GROUPS_REQUIRED');
  const lineGroups=new Map<number,number>();
  for(const line of beleg.lines){
   if(!object(line)||(line.type!=='BASE'&&line.type!=='EXTRA_WORK'))throw Error('INVOICE_VAT_LINE_INVALID');
   const rate=line.vat_rate_basis_points;
   if(rate!==0&&rate!==700&&rate!==1900)throw Error('INVOICE_VAT_LINE_RATE_INVALID');
   const amount=cents(line.type==='BASE'?line.lineNetAmountCents:line.amountCents);
   lineGroups.set(rate,cents((lineGroups.get(rate)??0)+amount));
  }
  const seen=new Set<number>();
  groups=totals.vatBreakdown.map((row:unknown)=>{
   if(!object(row)||Object.keys(row).sort().join(',')!=='grossCents,netCents,rateBp,vatCents')throw Error('INVOICE_VAT_GROUP_SHAPE_INVALID');
   const rate=row.rateBp;
   if(rate!==0&&rate!==700&&rate!==1900||seen.has(rate))throw Error('INVOICE_VAT_GROUP_RATE_INVALID');
   const group:InvoiceVatGroup={rateBp:rate,netCents:cents(row.netCents),vatCents:cents(row.vatCents),grossCents:cents(row.grossCents)};
   if(lineGroups.get(rate)!==group.netCents||group.vatCents!==rounded(group.netCents,rate)||group.grossCents!==group.netCents+group.vatCents)throw Error('INVOICE_VAT_GROUP_INTEGRITY_INVALID');
   seen.add(rate);return group;
  });
  if(seen.size!==lineGroups.size||total(groups,'netCents')!==net||total(groups,'vatCents')!==vat||total(groups,'grossCents')!==gross)throw Error('INVOICE_VAT_TOTALS_INVALID');
  if(seen.has(0)){
   if(seen.size!==1||!object(beleg.customer)||!object(beleg.seller)||typeof beleg.customer.country!=='string'||!EU_OUTSIDE_DE.has(beleg.customer.country)||typeof beleg.customer.vatId!=='string'||!beleg.customer.vatId.trim()||typeof beleg.seller.taxId!=='string'||!beleg.seller.taxId.trim())throw Error('INVOICE_REVERSE_CHARGE_SOURCE_INVALID');
  }
  headRate=null;
 }else throw Error('INVOICE_VAT_SCHEMA_INVALID');
 if(Object.prototype.hasOwnProperty.call(stored,'snapshot')){
  if(persistedCents(stored.net_amount_cents)!==net
    ||persistedCents(stored.vat_amount_cents)!==vat
    ||persistedCents(stored.gross_amount_cents)!==gross
    ||(headRate===null?stored.vat_rate_basis_points!==null:persistedCents(stored.vat_rate_basis_points)!==headRate))throw Error('INVOICE_VAT_PERSISTED_TOTALS_INVALID');
 }
 return {groups,netAmountCents:net,vatAmountCents:vat,grossAmountCents:gross,headRate,reverseCharge:beleg.schemaVersion===2&&groups.every(row=>row.rateBp===0)};
}
