import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IncomingInvoiceDialog} from '../IncomingInvoiceDialog';
import type {InvoicePorts,InvoiceView} from '../../invoiceContract';
import {INTAKE_CHANGED_EVENT} from '../../messageContract';
import {InvoiceAnnotationEditor} from '../InvoiceAnnotationEditor';

afterEach(cleanup);
it('BA optional metadata conflict rereads the real editor version and preserves local text and retry key',async()=>{
 const view={item:{id:'TEST-source',version:1},invoice:{id:'TEST-invoice',version:1,zahlstatus:'offen'},annotations:{remark:'TEST vorher',person:null,vehicle:null},annotationChoices:{persons:[],vehicles:[]}} as unknown as InvoiceView;
 const fresh={...view,invoice:{...view.invoice!,version:2}};
 const status=vi.fn().mockResolvedValueOnce({code:'CONFLICT',message:'TEST private detail'}).mockResolvedValueOnce({code:'OK'}),read=vi.fn().mockResolvedValue({code:'OK',view:fresh});
 render(<InvoiceAnnotationEditor view={view} ports={{status,read} as unknown as InvoicePorts} onSaved={vi.fn()}/>);
 fireEvent.change(screen.getByDisplayValue('TEST vorher'),{target:{value:'TEST eigene Bemerkung'}});
 fireEvent.click(screen.getByRole('button',{name:'Zusatzangaben speichern'}));
 await screen.findByRole('button',{name:'Neu laden'});
 expect(screen.queryByText('TEST private detail')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Neu laden'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Neu laden'})).not.toBeInTheDocument());
 expect(screen.getByDisplayValue('TEST eigene Bemerkung')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Zusatzangaben speichern'}));
 await waitFor(()=>expect(status).toHaveBeenCalledTimes(2));
 expect(status.mock.calls[1][0]).toMatchObject({version:2,clientKey:status.mock.calls[0][0].clientKey,annotations:{remark:'TEST eigene Bemerkung'}});
 await screen.findByText('Zusatzangaben gespeichert.');
});
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

it.each([false,true])('BA07 supplier return resumes only safely recognized unchanged fields (edited=%s)',async(edited)=>{
 const fields={lieferantId:'',nummer:'TEST-42',datum:'2026-11-08',faelligAm:'2026-11-22',netto:'100.00',ust:'19.00',brutto:'119.00',iban:'',ibanGeprueft:false};
 const initial:InvoiceView={item:{id:'TEST-source',version:1,at:'2026-11-09T01:00:00Z',channel:'datei',sender:null},invoice:null,supplier:null,originals:[],fileId:'TEST-original',fields,uncertain:0,conflict:null,duplicate:null,automation:{state:'incomplete',missing:['Lieferant fehlt']}};
 const read=vi.fn().mockResolvedValue({code:'OK',view:{...initial,item:{...initial.item,version:2},supplier:{id:'TEST-supplier',name:'TEST Lieferant',iban:null,paymentTermDays:14},fields:{...fields,lieferantId:'TEST-supplier'},automation:{state:'ready',missing:[]}}}),resume=vi.fn();
 render(<IncomingInvoiceDialog initial={initial} ports={{read,searchSuppliers:vi.fn().mockResolvedValue({code:'OK',suppliers:[]})} as unknown as InvoicePorts} onClose={vi.fn()} onMessage={vi.fn()} onAutomaticReady={resume}/>);
 if(edited)fireEvent.change(screen.getByDisplayValue('TEST-42'),{target:{value:'TEST eigene Nummer'}});
 window.dispatchEvent(new CustomEvent(INTAKE_CHANGED_EVENT,{detail:{itemId:'TEST-source',customerId:'TEST-supplier',customerName:'TEST Lieferant'}}));
 await waitFor(()=>expect(screen.getByDisplayValue('TEST Lieferant')).toBeInTheDocument());
 expect(resume).toHaveBeenCalledTimes(edited?0:1);
 if(edited)expect(screen.getByDisplayValue('TEST eigene Nummer')).toBeInTheDocument();
});


it.each(['prepare','finish','network'])('BA14 proof %s rejection stays inside the dialog, keeps fields and retries the same original',async stage=>{
 const {webcrypto}=await import('node:crypto');vi.stubGlobal('crypto',webcrypto);
 try{
 const initial:InvoiceView={item:{id:'TEST-source',version:1,at:'2026-11-09T01:00:00Z',channel:'datei',sender:null},invoice:null,supplier:{id:'TEST-supplier',name:'TEST Lieferant',iban:null,paymentTermDays:null},originals:[],fileId:'TEST-original',fields:{lieferantId:'TEST-supplier',nummer:'TEST-42',datum:'2026-11-08',faelligAm:'2026-11-22',netto:'100.00',ust:'19.00',brutto:'119.00',iban:'',ibanGeprueft:false},uncertain:0,conflict:null,duplicate:null};
 const prepare=vi.fn().mockResolvedValue({code:'OK',fileId:'TEST-proof',upload:null}),finish=vi.fn().mockResolvedValue({code:'OK',capture:{version:2}});
 if(stage==='prepare')prepare.mockResolvedValueOnce({code:'CONFLICT',message:'TEST SQL private upload detail'});else if(stage==='finish')finish.mockResolvedValueOnce({code:'CONFLICT',message:'TEST SQL private upload detail'});else prepare.mockRejectedValueOnce(new Error('TEST SQL private upload detail'));
 const ports={prepareFile:prepare,finishFile:finish,searchSuppliers:vi.fn().mockResolvedValue({code:'OK',suppliers:[]})} as unknown as InvoicePorts;
 const {container}=render(<IncomingInvoiceDialog initial={initial} ports={ports} onClose={vi.fn()} onMessage={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Ist schon bezahlt'}));
 const file=new File([new Uint8Array([1,2,3])],'TEST-Nachweis.pdf',{type:'application/pdf'});Object.defineProperty(file,'arrayBuffer',{value:async()=>new Uint8Array([1,2,3]).buffer});
 fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[file]}});
 if(stage==='network')await screen.findByText('Du versuchst es erneut. Dein Original und deine Eingaben bleiben erhalten.');
 const retry=await screen.findByRole('button',{name:'Nachweis erneut sichern'});expect(screen.queryByText('TEST SQL private upload detail')).toBeNull();expect(screen.getByDisplayValue('TEST-42')).toBeInTheDocument();
 fireEvent.click(retry);await screen.findByText('TEST-Nachweis.pdf · gesichert');expect(prepare).toHaveBeenCalledTimes(2);expect(prepare.mock.calls[1][0]).toEqual(prepare.mock.calls[0][0]);
 }finally{vi.unstubAllGlobals();}
});


it('BA08 paid confirmation does not force a fictional deadline in the real editor',async()=>{
 const initial:InvoiceView={item:{id:'TEST-source',version:1,at:'2026-11-09T01:00:00Z',channel:'datei',sender:null},invoice:null,supplier:{id:'TEST-supplier',name:'TEST Lieferant',iban:null,paymentTermDays:null},originals:[],fileId:'TEST-original',fields:{lieferantId:'TEST-supplier',nummer:'TEST-PAID-42',datum:'2026-11-08',faelligAm:'',netto:'100.00',ust:'19.00',brutto:'119.00',iban:'',ibanGeprueft:false},uncertain:0,conflict:null,duplicate:null};
 const save=vi.fn().mockResolvedValue({code:'OK',invoice:{id:'TEST-invoice',version:1,zahlstatus:'bezahlt'},replayed:false});render(<IncomingInvoiceDialog initial={initial} ports={{save,searchSuppliers:vi.fn().mockResolvedValue({code:'OK',suppliers:[]})} as unknown as InvoicePorts} onClose={vi.fn()} onMessage={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Ist schon bezahlt'}));fireEvent.click(screen.getByRole('button',{name:'Erfassen · bezahlt'}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());expect(save.mock.calls[0][0]).toMatchObject({status:'bezahlt',fields:{faelligAm:''},paidDate:expect.any(String)});
});
