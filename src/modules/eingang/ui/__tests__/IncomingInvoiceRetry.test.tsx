import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IncomingInvoiceDialog} from '../IncomingInvoiceDialog';
import type {InvoicePorts,InvoiceView} from '../../invoiceContract';

afterEach(cleanup);
it('BA14 real editor rereads after conflict without losing entered invoice fields',async()=>{
 const initial:InvoiceView={item:{id:'TEST-source',version:1,at:'2026-11-09T01:00:00Z',channel:'datei',sender:null},invoice:null,supplier:{id:'TEST-supplier',name:'TEST Lieferant',iban:null,paymentTermDays:null},originals:[],fileId:'TEST-original',fields:{lieferantId:'TEST-supplier',nummer:'TEST-42',datum:'2026-11-08',faelligAm:'2026-11-22',netto:'100.00',ust:'19.00',brutto:'119.00',iban:'',ibanGeprueft:false},uncertain:0,conflict:null,duplicate:null};
 const read=vi.fn().mockResolvedValue({code:'OK',view:{...initial,item:{...initial.item,version:2}}}),save=vi.fn().mockResolvedValueOnce({code:'CONFLICT',message:'TEST private server detail'}).mockResolvedValueOnce({code:'OK',invoice:{id:'TEST-invoice',version:1},replayed:false});
 const onClose=vi.fn();
 render(<IncomingInvoiceDialog initial={initial} ports={{read,save,searchSuppliers:vi.fn().mockResolvedValue({code:'OK',suppliers:[]})} as unknown as InvoicePorts} onClose={onClose} onMessage={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:/Erfassen · fällig/}));
 await screen.findByRole('button',{name:'Neu laden · Eingaben behalten'});
 expect(screen.queryByText('TEST private server detail')).not.toBeInTheDocument();
 expect(onClose).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Neu laden · Eingaben behalten'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Neu laden · Eingaben behalten'})).not.toBeInTheDocument());
 expect(screen.getByDisplayValue('TEST-42')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/Erfassen · fällig/}));
 await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
 expect(save.mock.calls[1][0]).toMatchObject({version:2,clientKey:save.mock.calls[0][0].clientKey,fields:initial.fields});
 await waitFor(()=>expect(onClose).toHaveBeenCalledOnce());
});
