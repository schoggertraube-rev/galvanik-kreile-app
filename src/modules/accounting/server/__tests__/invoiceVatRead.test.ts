import {it,expect} from 'vitest';
import {readInvoiceVat} from '../../server-public';
// Explicit synthetic immutable-original boundaries, not writer evidence.
const mixed=()=>({schemaVersion:2,lines:[{type:'BASE',lineNetAmountCents:10000,vat_rate_basis_points:1900},{type:'EXTRA_WORK',amountCents:10000,vat_rate_basis_points:700}],totals:{netAmountCents:20000,vatRateBasisPoints:null,vatAmountCents:2600,grossAmountCents:22600,vatBreakdown:[{rateBp:1900,netCents:10000,vatCents:1900,grossCents:11900},{rateBp:700,netCents:10000,vatCents:700,grossCents:10700}]}});
it('reads schema1 as one unchanged group',()=>{
 const original={schemaVersion:1,totals:{netAmountCents:10000,vatRateBasisPoints:700,vatAmountCents:700,grossAmountCents:10700}},before=structuredClone(original);
 expect(readInvoiceVat(original)).toMatchObject({headRate:700,groups:[{rateBp:700,netCents:10000,vatCents:700,grossCents:10700}],reverseCharge:false});
 expect(original).toEqual(before);
});
it('reads two declared groups without a manufactured head rate',()=>{
 expect(readInvoiceVat(mixed())).toMatchObject({headRate:null,netAmountCents:20000,vatAmountCents:2600,grossAmountCents:22600,groups:[{rateBp:1900},{rateBp:700}]});
});
it('rounds at the group boundary, not each cent line',()=>{
 const original={schemaVersion:2,lines:Array.from({length:3},()=>({type:'BASE',lineNetAmountCents:1,vat_rate_basis_points:1900})),totals:{netAmountCents:3,vatRateBasisPoints:null,vatAmountCents:1,grossAmountCents:4,vatBreakdown:[{rateBp:1900,netCents:3,vatCents:1,grossCents:4}]}};
 expect(readInvoiceVat(original).vatAmountCents).toBe(1);
});
it('refuses missing original rates, duplicate groups and corrupted totals',()=>{
 const missing=mixed();delete (missing.lines[0] as {vat_rate_basis_points?:number}).vat_rate_basis_points;expect(()=>readInvoiceVat(missing)).toThrow();
 const duplicate=mixed();duplicate.totals.vatBreakdown.push(duplicate.totals.vatBreakdown[0]);expect(()=>readInvoiceVat(duplicate)).toThrow();
 const corrupt=mixed();corrupt.totals.vatBreakdown[0].vatCents=1800;expect(()=>readInvoiceVat(corrupt)).toThrow();
});
it('refuses missing amounts instead of zero',()=>{
 const original=mixed();(original.totals as unknown as {vatAmountCents:null}).vatAmountCents=null;expect(()=>readInvoiceVat(original)).toThrow();
});
it('qualifies whole EU reverse charge with both identities only',()=>{
 const original={schemaVersion:2,customer:{country:'AT',vatId:'ATU12345678'},seller:{taxId:'DE123456789'},lines:[{type:'BASE',lineNetAmountCents:10000,vat_rate_basis_points:0}],totals:{netAmountCents:10000,vatRateBasisPoints:null,vatAmountCents:0,grossAmountCents:10000,vatBreakdown:[{rateBp:0,netCents:10000,vatCents:0,grossCents:10000}]}};
 expect(readInvoiceVat(original)).toMatchObject({reverseCharge:true,headRate:null});
 original.customer.vatId='';expect(()=>readInvoiceVat(original)).toThrow();
 original.customer.vatId='ATU12345678';original.customer.country='DE';expect(()=>readInvoiceVat(original)).toThrow();
});
