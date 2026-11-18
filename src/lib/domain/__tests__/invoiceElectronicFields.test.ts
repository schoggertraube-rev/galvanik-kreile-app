import {expect,it} from 'vitest';
import {invoiceElectronicUnit,invoiceXmlAmount,invoiceXmlWorkHours,invoiceBaseUnitPrice,isInvoiceVatId} from '../invoiceElectronicFields';

it('K1 VAT format removes whitespace and requires the approved country-prefix and bounded identifier',()=>{
 for(const value of ['DE123456789','ATU12345678','DE 123 456 789','FRab12'])expect(isInvoiceVatId(value)).toBe(true);
 for(const value of ['123/456/789','123456789','DE-H18-INVOICE','de123456789','D123456789','DE1','DE1234567890123'])expect(isInvoiceVatId(value)).toBe(false);
});

it('S54o unit serialization preserves each existing order unit instead of treating every position as pieces',()=>{
 for(const [source,code] of [['Stück','C62'],['stueck','C62'],['kg','KGM'],['dm²','DMK'],['dm2','DMK'],['Satz','SET'],['stunde','HUR'],['Std.','HUR'],['g','GRM'],['m','MTR'],['m²','MTK'],['pauschal','C62']])expect(invoiceElectronicUnit(source)?.code).toBe(code);
 for(const source of [null,undefined,'',' ','TEST unknown unit',42])expect(invoiceElectronicUnit(source)).toBeNull();
});

it('PL19:22 formats the original per-part allocation with exact bounded precision and keeps incoherent sources refused',()=>{
 expect(invoiceBaseUnitPrice(3,2500,7501)).toBe('25.0033');
 expect(invoiceBaseUnitPrice(2,2501,5001)).toBe('25.005');
 expect(invoiceBaseUnitPrice(2,1250,2499)).toBe('12.495');
 expect(invoiceBaseUnitPrice(2,1875,3750)).toBe('18.75');
 expect(()=>invoiceBaseUnitPrice(3,2501,7501)).toThrow('INVOICE_ELECTRONIC_UNIT_PRICE_SOURCE_INVALID');
 expect(()=>invoiceBaseUnitPrice(99999,1,100000)).toThrow('INVOICE_ELECTRONIC_UNIT_PRICE_ROUNDING_INVALID');
});

it('S54o XML formatting keeps exact stored cents and the specified four-place hour quantity',()=>{
 expect(invoiceXmlAmount(123456789)).toBe('1234567.89');
 expect(invoiceXmlAmount(-11900)).toBe('-119.00');
 expect(invoiceXmlAmount(0)).toBe('0.00');
 expect(invoiceXmlWorkHours(1)).toBe('0.0167');
 expect(invoiceXmlWorkHours(20)).toBe('0.3333');
 expect(invoiceXmlWorkHours(90)).toBe('1.5000');
 expect(()=>invoiceXmlAmount(1.1)).toThrow('INVOICE_ELECTRONIC_AMOUNT_INVALID');
 expect(()=>invoiceXmlWorkHours(0)).toThrow('INVOICE_ELECTRONIC_MINUTES_INVALID');
});
