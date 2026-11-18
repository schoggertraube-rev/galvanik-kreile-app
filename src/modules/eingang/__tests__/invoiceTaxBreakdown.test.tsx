import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {EMPTY_INVOICE_FIELDS,invoiceTaxBreakdown,type InvoicePorts,type InvoiceView} from '../invoiceContract';
import {IncomingInvoiceDialog} from '../ui/IncomingInvoiceDialog';

afterEach(cleanup);
describe('S54e original VAT breakdown and leading total',()=>{
 const rates=[{satz:'19.00',netto:'100.00',ust:'19.00'},{satz:'7.00',netto:'100.00',ust:'7.00'}];
 it('retains every source rate and allows exactly one cent difference',()=>{
  expect(invoiceTaxBreakdown(rates,'26.00')).toEqual({rates,warning:false});
  expect(invoiceTaxBreakdown(rates,'26.01')).toEqual({rates,warning:false});
 });
 it('retains no rate list when the checked total differs by more than one cent',()=>{
  expect(invoiceTaxBreakdown(rates,'26.02')).toEqual({rates:null,warning:true});
  expect(invoiceTaxBreakdown(rates,'')).toEqual({rates:null,warning:true});
 });
 it('does not manufacture a zero VAT list for absent originals or malformed rows',()=>{
  expect(invoiceTaxBreakdown(undefined,'19.00')).toEqual({rates:null,warning:false});
  expect(invoiceTaxBreakdown(null,'0.00')).toEqual({rates:null,warning:false});
  expect(invoiceTaxBreakdown([{satz:'19',netto:'100',ust:'bad'}],'19.00')).toEqual({rates:null,warning:true});
 });
 it('shows the exact PL warning in the existing dialog without adding editable VAT rows',()=>{
  // Explicit isolated synthetic view/ports; actual original/DB save is covered by E6.
  const initial:InvoiceView={item:{id:'619ce600-ade5-4e8c-9138-60ec3eb9699f',version:1,at:'2026-11-18T08:00:00Z',channel:'datei',sender:null},invoice:null,supplier:null,originals:[],fileId:null,
   fields:{...EMPTY_INVOICE_FIELDS,netto:'100.00',ust:'19.00',brutto:'119.00'},uncertain:0,conflict:null,duplicate:null,taxRateWarning:'Steuersätze passen nicht zur Gesamt-USt · prüf die Rechnung'};
  const ports:InvoicePorts={read:vi.fn(),save:vi.fn(),status:vi.fn(),clarify:vi.fn(),searchSuppliers:vi.fn(),openOriginal:vi.fn(),createSupplier:vi.fn(),prepareFile:vi.fn(),finishFile:vi.fn(),openTask:vi.fn()};
  render(<IncomingInvoiceDialog initial={initial} ports={ports} onClose={vi.fn()} onMessage={vi.fn()}/>);
  expect(screen.getByText('Steuersätze passen nicht zur Gesamt-USt · prüf die Rechnung')).toBeVisible();
  expect(screen.queryByRole('textbox',{name:'Steuersatz'})).not.toBeInTheDocument();
  expect(ports.save).not.toHaveBeenCalled();
 });
});
