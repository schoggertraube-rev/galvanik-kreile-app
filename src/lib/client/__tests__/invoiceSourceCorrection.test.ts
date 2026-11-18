import {expect,it} from 'vitest';
import {invoiceSettingsCorrection} from '../invoiceSourceCorrection';
import {E_INVOICE_COPY,E_INVOICE_SETTINGS_COPY,E_INVOICE_CORRECTION_COPY} from '@/ui/situationCatalog';
it('K3 labels the original source field and keeps its actual editor control, including unknown field names',()=>{
 expect(invoiceSettingsCorrection({kind:'settings',field:'vatId'},'TEST-order')).toMatchObject({label:'USt-IdNr. (mit Ländercode, z. B. DE123456789) in den Einstellungen eintragen'});
 expect(E_INVOICE_SETTINGS_COPY.action('country')).toBe('Land in der Anschrift in den Einstellungen eintragen');
 expect(E_INVOICE_CORRECTION_COPY.customerAction('vatId')).toBe('USt-IdNr. (mit Ländercode, z. B. DE123456789) beim Kunden eintragen');
 for(const field of ['unknown','__proto__','constructor'])expect(E_INVOICE_COPY.missingSource(field)).toBe('Fehlt für die E-Rechnung: '+field);
});
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
