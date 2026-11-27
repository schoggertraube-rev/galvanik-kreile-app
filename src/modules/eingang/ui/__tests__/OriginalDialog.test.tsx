// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {OriginalDialog,type OriginalPorts} from '../OriginalDialog';
import {IntakeObjectDialogs,type IntakeObjectPorts} from '../IntakeObjectDialogs';
import {IncomingInvoiceDialog} from '../IncomingInvoiceDialog';
import {EMPTY_INVOICE_FIELDS,type InvoicePorts,type InvoiceView} from '../../invoiceContract';
import {Dialog} from '@/ui/kr';
import {createDeferredDialogEvents,withDeferredDialogReady} from '@/lib/client/deferredDialogEvents';

afterEach(cleanup);

describe('Original: O07 metadata without Mails',()=>{
 it('opens and confirms the original using the selected invoice instead of the common mail',async()=>{
  const fileId='11111111-1111-4111-8111-111111111111';
  const itemId='22222222-2222-4222-8222-222222222222';
  const invoiceId='33333333-3333-4333-8333-333333333333';
  const file={id:fileId,name:'TEST Beleg.pdf',mime:'application/pdf',sha256:'a'.repeat(64)};
  const view:InvoiceView={
   item:{id:itemId,version:1,at:'2026-11-18T08:00:00Z',channel:'mail',sender:null},
   originals:[file],fileId,supplier:null,fields:{...EMPTY_INVOICE_FIELDS},uncertain:0,conflict:null,duplicate:null,
   invoice:{...{seite_von:2,seite_bis:2},id:invoiceId,item_id:itemId,file_id:fileId,nummer_intern:'TEST-2',lieferant_id:null,nummer:null,datum:null,
    netto:null,ust:null,brutto:null,ust_saetze:null,faellig_am:null,iban:null,iban_geprueft:false,zahlstatus:'bezahlt',
    bezahlt_am:null,nachweis_file_id:null,verweis_id:null,dublette_grund:null,unklar_grund:null,aufgabe_id:null,
    ungueltig_grund:null,erfasst_von:invoiceId,erfasst_am:'2026-11-18T08:00:00Z',version:1},
  };
  const original:OriginalPorts={
   open:vi.fn().mockResolvedValue({code:'OK',original:{...file,itemId,bytes:90,restricted:false,previewable:true,url:null,
    invoiceId,invoiceSuggestions:[{id:'TEST-suggestion',field:'rechnung.nummer',value:'TEST-2',confidence:'unsicher',status:'offen'}]}}),
   confirm:vi.fn().mockResolvedValue({code:'OK',count:1,replayed:false}),capture:vi.fn(),retry:vi.fn(),
  };
  const invoice:InvoicePorts={read:vi.fn().mockResolvedValue({code:'OK',view}),save:vi.fn(),status:vi.fn(),clarify:vi.fn(),
   searchSuppliers:vi.fn(),createSupplier:vi.fn(),prepareFile:vi.fn(),finishFile:vi.fn(),openTask:vi.fn(),
   openOriginal:vi.fn((item,file,scope)=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{
    detail:{ziel:'original',arg:[item,file,scope].join('#')},cancelable:true,
   }))),
  };
  render(<><IncomingInvoiceDialog initial={view} ports={invoice} onClose={vi.fn()} onMessage={vi.fn()}/>
   <IntakeObjectDialogs allowed ports={{original,goods:{} as IntakeObjectPorts['goods'],quoteGoods:{} as IntakeObjectPorts['quoteGoods']}}
    onRefresh={vi.fn()} onOpenCustomer={vi.fn()} onOpenOrder={vi.fn()} onOpenQuote={vi.fn()}/></>);
  fireEvent.click(screen.getByRole('button',{name:/TEST Beleg.pdf/}));
  expect(invoice.openOriginal).toHaveBeenCalledWith(itemId,fileId,invoiceId);
  fireEvent.click(await screen.findByRole('button',{name:'Am Original geprüft'}));
  expect(original.open).toHaveBeenCalledWith({fileId,invoiceId,clientEventId:expect.any(String)});
  expect(original.confirm).toHaveBeenCalledWith({fileId,invoiceId,clientEventId:expect.any(String)});
  await waitFor(()=>expect(invoice.read).toHaveBeenCalledWith({id:invoiceId}));
  expect(original.capture).not.toHaveBeenCalled();
 });
 it('keeps early Escape for the requested original and leaves the conversation underneath open',async()=>{
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  const closeConversation=vi.fn(),bridge=createDeferredDialogEvents(vi.fn()),stop=bridge.attach();
  const original:OriginalPorts={open:vi.fn().mockResolvedValue({code:'OK',original:{id:'11111111-1111-4111-8111-111111111111',itemId:'22222222-2222-4222-8222-222222222222',name:'SYNTHETISCH original.eml',mime:'message/rfc822',bytes:90,sha256:'a'.repeat(64),customerId:null,orderId:null,previewable:false,url:null,downloadUrl:null,restricted:true}}),capture:vi.fn(),confirm:vi.fn(),retry:vi.fn()};
  const Ready=withDeferredDialogReady(IntakeObjectDialogs,'object');
  const conversation=<Dialog titel="SYNTHETISCH Nachrichten" onSchliessen={closeConversation}><p>SYNTHETISCH unverändertes Gespräch</p></Dialog>;
  const view=render(conversation);
  try{
   window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'original',arg:'11111111-1111-4111-8111-111111111111'},cancelable:true}));
   fireEvent.keyDown(window,{key:'Escape'});
   view.rerender(<>{conversation}<Ready allowed ports={{original,goods:{} as IntakeObjectPorts['goods'],quoteGoods:{} as IntakeObjectPorts['quoteGoods']}} onReceiverReady={bridge.ready} onRefresh={vi.fn()} onOpenCustomer={vi.fn()} onOpenOrder={vi.fn()} onOpenQuote={vi.fn()}/></>);
   await waitFor(()=>expect(original.open).toHaveBeenCalledOnce());
   await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Original'})).toBeNull());
   expect(closeConversation).not.toHaveBeenCalled();
   expect(screen.getByText('SYNTHETISCH unverändertes Gespräch')).toBeVisible();
  }finally{stop();vi.unstubAllGlobals();}
 });
 it('keeps the original denial and forwards Escape normally when the receiver opens no dialog',async()=>{
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  const closeConversation=vi.fn(),bridge=createDeferredDialogEvents(vi.fn()),stop=bridge.attach();
  const original:OriginalPorts={open:vi.fn(),capture:vi.fn(),confirm:vi.fn(),retry:vi.fn()};
  const Ready=withDeferredDialogReady(IntakeObjectDialogs,'object');
  const conversation=<Dialog titel="SYNTHETISCH Nachrichten" onSchliessen={closeConversation}><p>SYNTHETISCH Gespräch</p></Dialog>;
  const view=render(conversation);
  try{
   window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'original',arg:'11111111-1111-4111-8111-111111111111'},cancelable:true}));
   fireEvent.keyDown(window,{key:'Escape'});
   view.rerender(<>{conversation}<Ready allowed={false} originalAllowed={false} ports={{original,goods:{} as IntakeObjectPorts['goods'],quoteGoods:{} as IntakeObjectPorts['quoteGoods']}} onReceiverReady={bridge.ready} onRefresh={vi.fn()} onOpenCustomer={vi.fn()} onOpenOrder={vi.fn()} onOpenQuote={vi.fn()}/></>);
   await waitFor(()=>expect(closeConversation).toHaveBeenCalledOnce());
   expect(original.open).not.toHaveBeenCalled();expect(screen.queryByRole('dialog',{name:'Original'})).toBeNull();
  }finally{stop();vi.unstubAllGlobals();}
 });
 it('shows the restricted original without asking the forbidden content reader or exposing download actions',async()=>{
  const capture=vi.fn<OriginalPorts['capture']>().mockResolvedValue({code:'FORBIDDEN',message:'Mails nicht freigegeben.'});
  const ports:OriginalPorts={open:vi.fn().mockResolvedValue({code:'OK',original:{id:'11111111-1111-4111-8111-111111111111',itemId:'22222222-2222-4222-8222-222222222222',name:'synthetic.eml',mime:'message/rfc822',bytes:90,sha256:'a'.repeat(64),customerId:null,orderId:null,previewable:false,url:null,downloadUrl:null,restricted:true}}),capture,confirm:vi.fn(),retry:vi.fn()};
  render(<OriginalDialog fileId="11111111-1111-4111-8111-111111111111" ports={ports} onClose={vi.fn()} onAssign={vi.fn()} onMessage={vi.fn()}/>);
  await waitFor(()=>expect(screen.getByText('synthetic.eml',{selector:'strong'})).toBeTruthy());
  expect(screen.getAllByText('Mail · Inhalt nur fürs Büro').length).toBeGreaterThan(0);
  expect(screen.getByText('SHA-256 '+'a'.repeat(64))).toBeTruthy();
  expect(capture).not.toHaveBeenCalled();
  expect(screen.queryByRole('link',{name:'Herunterladen'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Am Original geprüft'})).toBeNull();
  expect(screen.queryByText(/Original nicht ladbar/)).toBeNull();
 });
});
