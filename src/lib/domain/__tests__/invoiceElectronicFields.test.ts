import {expect,it} from 'vitest';
import {invoiceElectronicUnit,invoiceXmlAmount,invoiceXmlWorkHours} from '../invoiceElectronicFields';

it('S54o unit serialization preserves each existing order unit instead of treating every position as pieces',()=>{
 for(const [source,code] of [['Stück','C62'],['stueck','C62'],['kg','KGM'],['dm²','DMK'],['dm2','DMK'],['Satz','SET'],['stunde','HUR'],['Std.','HUR'],['g','GRM'],['m','MTR'],['m²','MTK'],['pauschal','C62']])expect(invoiceElectronicUnit(source)?.code).toBe(code);
 for(const source of [null,undefined,'',' ','TEST unknown unit',42])expect(invoiceElectronicUnit(source)).toBeNull();
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
