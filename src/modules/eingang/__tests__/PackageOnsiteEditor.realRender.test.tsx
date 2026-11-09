import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PackageOnsiteEditor} from '../ui/PackageOnsiteEditor';
import type {GlobalCreatePorts} from '../GlobalCreateFlow';
import type {OnsiteQuoteInput} from '@/lib/onsiteQuoteContract';
import type {IntakeCapture} from '../captureContract';
afterEach(cleanup);
const capture:IntakeCapture={id:'TEST-source',version:1,text:'TEST Auftrag erteilt',customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:['ware'],files:[]};
const request:OnsiteQuoteInput={clientRequestId:'TEST-root',customer:{mode:'NEW',data:{customerType:'privat',firstName:'TEST',lastName:'Kundin',phone:'TEST',country:'DE'}},quote:{dueDate:'2026-12-01',note:'TEST original',positions:[{name:'TEST Teil',quantity:2,material:null,surfaceRequested:'verchromen',unitPriceCents:1000}]},evidence:'TEST Auftrag erteilt',goods:{itemId:capture.id,location:'TEST E1',packagesReceived:1,condition:'unauffaellig',photos:[]},quantities:[{position:1,received:2,note:null}],handoverMode:'pickup',paymentMode:'vorkasse',confirmedOrderDueDate:'2026-12-01'};
it('restores the persisted intent, blocks double-click and retries the exact same root after an uncertain outcome',async()=>{
 let resolve:((value:{code:string;message:string})=>void)|undefined;
 const send=vi.fn().mockImplementationOnce(()=>new Promise(done=>{resolve=done;})).mockResolvedValueOnce({code:'OK',orderReceipt:{orderId:'TEST-real-order',orderNumber:'TEST-A-1'}});
 const discard=vi.fn(async()=>({code:'OK',drafts:[]})),openOrder=vi.fn(),onDone=vi.fn();
 const draft={id:'TEST-root',art:'eingang',version:1,payload:{kind:'package-onsite',version:1,clientKey:'TEST-root',sourceItemId:capture.id,request}};
 const ports={drafts:{readDrafts:vi.fn(async()=>({code:'OK',drafts:[draft]})),saveDraft:vi.fn(),discardDraft:discard},receiveOnsiteQuote:send,listCustomers:vi.fn(),searchIntakeCustomers:vi.fn(async()=>({code:'OK',customers:[]})),recognizeIntakeText:vi.fn(),openOrder} as unknown as GlobalCreatePorts;
 render(<PackageOnsiteEditor capture={capture} ports={ports} onCapture={vi.fn()} onClose={vi.fn()} onDone={onDone}/>);
 const button=await screen.findByRole('button',{name:'Mit gleicher Kennung erneut buchen'});await waitFor(()=>expect(button).toBeEnabled());
 expect(screen.getByDisplayValue('TEST E1')).toBeVisible();expect(screen.getByDisplayValue('TEST Teil')).toBeVisible();
 fireEvent.click(button);fireEvent.click(button);await waitFor(()=>expect(send).toHaveBeenCalledTimes(1));expect(send).toHaveBeenCalledWith(request);
 resolve!({code:'UNAVAILABLE',message:'TEST uncertain'});await screen.findByText(/Der Ausgang ist noch nicht bestätigt/);expect(screen.queryByText('TEST uncertain')).not.toBeInTheDocument();expect(openOrder).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Mit gleicher Kennung erneut buchen'}));await waitFor(()=>expect(openOrder).toHaveBeenCalledWith('TEST-real-order'));
 expect(send).toHaveBeenCalledTimes(2);expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);expect(ports.drafts!.saveDraft).not.toHaveBeenCalled();expect(discard).toHaveBeenCalledOnce();expect(onDone).toHaveBeenCalledWith('Wareneingang gebucht · TEST-A-1');
});
it('never creates a customer or books anything merely by opening a new capture',async()=>{
 const send=vi.fn(),draftSave=vi.fn();const ports={drafts:{readDrafts:vi.fn(async()=>({code:'OK',drafts:[]})),saveDraft:draftSave,discardDraft:vi.fn()},receiveOnsiteQuote:send,recognizeIntakeText:vi.fn(async()=>({code:'OK',data:{fields:[],positions:[]}})),searchIntakeCustomers:vi.fn(async()=>({code:'OK',customers:[]})),createCustomer:vi.fn()} as unknown as GlobalCreatePorts;
 const close=vi.fn();render(<PackageOnsiteEditor capture={capture} ports={ports} onCapture={vi.fn()} onClose={close} onDone={vi.fn()}/>);
 const book=await screen.findByRole('button',{name:'Auftrag anlegen'});await waitFor(()=>expect(book).toBeEnabled());fireEvent.click(book);
 await screen.findByRole('alert');expect(send).not.toHaveBeenCalled();expect(draftSave).not.toHaveBeenCalled();expect(ports.createCustomer).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Zurück zur Erfassung'}));await screen.findByRole('button',{name:'Weiter bearbeiten'});expect(close).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Weiter bearbeiten'}));expect(close).not.toHaveBeenCalled();
});

it('unlocks a validation rejection and offers durable discard with a reason for a blocked draft',async()=>{
 const draft={id:'TEST-root',art:'eingang',version:4,payload:{kind:'package-onsite',version:1,clientKey:'TEST-root',sourceItemId:capture.id,request}};
 const send=vi.fn(async()=>({code:'VALIDATION_ERROR',message:'TEST internal SQL diagnostic'})),discard=vi.fn(async()=>({code:'OK',drafts:[]})),close=vi.fn();
 const ports={drafts:{readDrafts:vi.fn(async()=>({code:'OK',drafts:[draft]})),saveDraft:vi.fn(),discardDraft:discard},receiveOnsiteQuote:send,listCustomers:vi.fn(),recognizeIntakeText:vi.fn(),searchIntakeCustomers:vi.fn(async()=>({code:'OK',customers:[]}))} as unknown as GlobalCreatePorts;
 render(<PackageOnsiteEditor capture={capture} ports={ports} onCapture={vi.fn()} onClose={close} onDone={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Mit gleicher Kennung erneut buchen'}));await screen.findByText(/Du kannst sie weiter bearbeiten/);
 expect(screen.getByDisplayValue('TEST E1')).toBeEnabled();expect(screen.queryByText('TEST internal SQL diagnostic')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Entwurf verwerfen'}));expect(discard).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Grund für das Verwerfen'),{target:{value:'TEST vom Kunden zurückgezogen'}});fireEvent.click(screen.getByRole('button',{name:'Entwurf verwerfen'}));
 await waitFor(()=>expect(discard).toHaveBeenCalledWith(expect.objectContaining({id:'TEST-root',expectedVersion:4,reason:'TEST vom Kunden zurückgezogen'})));await waitFor(()=>expect(close).toHaveBeenCalledOnce());
});
