import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import type {InvoicePorts} from '../../invoiceContract';
vi.mock('@/ui/kr',()=>({Button:()=>null,Dialog:({children}:{children:ReactNode})=><section role="dialog">{children}</section>,Hinweis:({children}:{children:ReactNode})=><p>{children}</p>,KrApp:({children}:{children:ReactNode})=>children,Toast:({text,aktion}:{text:string;aktion?:{text:string;onClick:()=>void}})=><div role="status">{text}{aktion?<button onClick={aktion.onClick}>{aktion.text}</button>:null}</div>,useKrGeraet:()=> 'desktop'}));
vi.mock('../IncomingInvoiceDialog',()=>({IncomingInvoiceDialog:()=> <section role="dialog">TEST manueller Editor</section>}));
import {IncomingInvoiceDialogs} from '../IncomingInvoiceDialogs';
afterEach(cleanup);
it('direct invoice event uses one existing writer for a ready original and reads the stored invoice before success without an editor',async()=>{
 const fields={lieferantId:'TEST-supplier',nummer:'TEST-42',datum:'2026-11-08',faelligAm:'2026-11-22',netto:'100.00',ust:'19.00',brutto:'119.00',iban:'',ibanGeprueft:false};
 const read=vi.fn().mockResolvedValueOnce({code:'OK',view:{item:{id:'TEST-source',version:1},fileId:'TEST-original',invoice:null,fields,automation:{state:'ready',missing:[]}}}).mockResolvedValueOnce({code:'OK',view:{invoice:{id:'TEST-invoice'}}});
 const save=vi.fn().mockResolvedValue({code:'OK',invoice:{id:'TEST-invoice'},replayed:false}),refresh=vi.fn();const ui=render(<IncomingInvoiceDialogs ports={{read,save} as unknown as InvoicePorts} allowed onRefresh={refresh}/>);
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'rechnungein',arg:'TEST-source'}}));
 await waitFor(()=>expect(screen.getByText('Erkannt, abgelegt und verbucht.')).toBeInTheDocument());expect(save).toHaveBeenCalledOnce();expect(save).toHaveBeenCalledWith(expect.objectContaining({automatic:true,itemId:'TEST-source',fileId:'TEST-original',fields,status:'offen'}));expect(read).toHaveBeenLastCalledWith({id:'TEST-invoice'});expect(refresh).toHaveBeenCalledOnce();expect(screen.queryByText('TEST manueller Editor')).not.toBeInTheDocument();ui.rerender(<IncomingInvoiceDialogs ports={{read,save} as unknown as InvoicePorts} allowed onRefresh={vi.fn()}/>);expect(save).toHaveBeenCalledOnce();
});

it('undo from confirmed automatic success invokes one existing status writer and re-reads the reopened invoice',async()=>{
 const fields={lieferantId:'TEST-supplier',nummer:'TEST-42',datum:'2026-11-08',faelligAm:'2026-11-22',netto:'100.00',ust:'19.00',brutto:'119.00',iban:'',ibanGeprueft:false};
 const read=vi.fn().mockResolvedValueOnce({code:'OK',view:{item:{id:'TEST-source',version:1},fileId:'TEST-original',invoice:null,fields,automation:{state:'ready',missing:[]}}}).mockResolvedValueOnce({code:'OK',view:{invoice:{id:'TEST-invoice',version:1}}}).mockResolvedValueOnce({code:'OK',view:{item:{id:'TEST-source',version:3},invoice:{id:'TEST-invoice',version:2,zahlstatus:'ungueltig'},canRebook:true}});
 const save=vi.fn().mockResolvedValue({code:'OK',invoice:{id:'TEST-invoice',version:1},replayed:false}),status=vi.fn().mockResolvedValue({code:'OK',invoice:{id:'TEST-invoice',version:2},replayed:false});render(<IncomingInvoiceDialogs ports={{read,save,status} as unknown as InvoicePorts} allowed onRefresh={vi.fn()}/>);
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'rechnungein',arg:'TEST-source'}}));await screen.findByRole('button',{name:'Rückgängig'});const undo=screen.getByRole('button',{name:'Rückgängig'});fireEvent.click(undo);fireEvent.click(undo);await waitFor(()=>expect(status).toHaveBeenCalledOnce());expect(status).toHaveBeenCalledWith(expect.objectContaining({command:'undo',invoiceId:'TEST-invoice',version:1,result:'ungueltig',fields:null}));await screen.findByText('Ablage zurückgenommen · Original wieder im Eingang.');expect(read).toHaveBeenLastCalledWith({id:'TEST-invoice'});expect(screen.getByText('TEST manueller Editor')).toBeInTheDocument();
});

it('duplicate source attaches through the existing invoice writer without booking again or offering undo for the old invoice',async()=>{
 const fields={lieferantId:'TEST-supplier',nummer:'TEST-42',datum:'2026-11-08',faelligAm:'2026-11-22',netto:'100.00',ust:'19.00',brutto:'119.00',iban:'',ibanGeprueft:false};
 const read=vi.fn().mockResolvedValueOnce({code:'OK',view:{item:{id:'TEST-second-source',version:1},fileId:'TEST-second-original',invoice:null,fields,duplicate:{id:'TEST-existing-invoice'},automation:{state:'duplicate',missing:[]}}}).mockResolvedValueOnce({code:'OK',view:{invoice:{id:'TEST-existing-invoice',version:2}}});
 const save=vi.fn().mockResolvedValue({code:'OK',invoice:{id:'TEST-existing-invoice',version:2,zahlstatus:'offen'},replayed:false});render(<IncomingInvoiceDialogs ports={{read,save} as unknown as InvoicePorts} allowed onRefresh={vi.fn()}/>);
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'rechnungein',arg:'TEST-second-source'}}));await screen.findByText('Liegt schon · Original am vorhandenen Beleg.');expect(save).toHaveBeenCalledOnce();expect(save).toHaveBeenCalledWith(expect.objectContaining({attachOriginal:true,status:'doppelt',duplicateId:'TEST-existing-invoice'}));expect(save.mock.calls[0][0]).not.toHaveProperty('automatic');expect(screen.queryByRole('button',{name:'Rückgängig'})).not.toBeInTheDocument();expect(screen.queryByText('TEST manueller Editor')).not.toBeInTheDocument();
});
