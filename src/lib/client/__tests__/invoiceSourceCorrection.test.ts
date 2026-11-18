import {expect,it} from 'vitest';
import {invoiceSettingsCorrection} from '../invoiceSourceCorrection';
it('uses the actual settings input identity for each tax source and retains the order return path',()=>{
 for(const [field,control] of [['taxNumber','taxNumber'],['vatId','taxId'],['taxId','taxId'],['iban','iban'],['companyName','companyName']]){
  const target=invoiceSettingsCorrection({kind:'settings',field},'TEST-order');expect(target).toBeDefined();
  const url=new URL(target!.href,'http://127.0.0.1');expect(url.pathname).toBe('/settings');expect(url.hash).toBe('#company-'+control);expect(url.searchParams.get('returnTo')).toBe('/orders/TEST-order');
 }
});
it('never invents a company control for an unknown field or redirects an order/customer correction to settings',()=>{
 expect(invoiceSettingsCorrection({kind:'settings',field:'__proto__'},'TEST-order')).toBeUndefined();
 expect(invoiceSettingsCorrection({kind:'settings',field:'https://example.invalid'},'TEST-order')).toBeUndefined();
 expect(invoiceSettingsCorrection({kind:'order',field:'unit:TEST-part'},'TEST-order')).toBeUndefined();
 expect(invoiceSettingsCorrection({kind:'customer',field:'name'},'TEST-order')).toBeUndefined();
});
