import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import type {InvoicePorts} from '../../invoiceContract';
vi.mock('@/ui/kr',()=>({Button:()=>null,Dialog:({children}:{children:ReactNode})=><section role="dialog">{children}</section>,Hinweis:({children}:{children:ReactNode})=><p>{children}</p>,KrApp:({children}:{children:ReactNode})=>children,Toast:({text}:{text:string})=><p role="status">{text}</p>,useKrGeraet:()=> 'desktop'}));
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
