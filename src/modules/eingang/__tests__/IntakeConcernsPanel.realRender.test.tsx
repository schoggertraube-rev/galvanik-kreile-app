import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IntakeMessages} from '../ui/IntakeMessages';
import type {IntakeMessagesPorts} from '../messageContract';
import {IntakeConcernsPanel} from '../ui/IntakeConcernsPanel';
import type {IntakeMessage} from '../messageContract';

afterEach(cleanup);
function row(id:string,changes:Partial<IntakeMessage>={}):IntakeMessage{return {id,version:1,channel:'mail',direction:'rein',assignment:'hand',usage:'offen',senderName:'TEST Schmidt',senderAddress:'test@example.invalid',groupAddress:'test@example.invalid',subject:'TEST KV-Anfrage',text:'TEST Originalnachricht',at:'2026-11-08T10:00:00Z',customerId:'TEST-customer',customerName:'TEST Schmidt',customerType:'firma',orderId:null,orderKind:null,orderNumber:null,orderStation:null,goods:null,concerns:['kv_anfrage'],openConcerns:['kv_anfrage'],discardReason:null,createdBy:'TEST-actor',fileIds:[],...changes};}

it('uses the actual bound quote ID and keeps the original message accessible',()=>{
 const onQuote=vi.fn(),onMessage=vi.fn();const message=row('TEST-source',{orderKind:'kv',orderId:'TEST-existing-quote'});
 render(<IntakeConcernsPanel messages={[message]} canCreateQuote onQuote={onQuote} onMessage={onMessage} onPrepareQuote={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'KV öffnen'}));expect(onQuote).toHaveBeenCalledWith('TEST-existing-quote');
 fireEvent.click(screen.getByRole('button',{name:'Nachricht öffnen'}));expect(onMessage).toHaveBeenCalledWith(message);
 expect(screen.getByText('TEST Originalnachricht')).toBeInTheDocument();
});

it('does not turn an unbound quote request into an order when quote creation is not granted',()=>{
 const onPrepareQuote=vi.fn();render(<IntakeConcernsPanel messages={[row('TEST-no-grant')]} canCreateQuote={false} onQuote={vi.fn()} onMessage={vi.fn()} onPrepareQuote={onPrepareQuote}/>);
 expect(screen.queryByRole('button',{name:'KV aus Nachricht öffnen'})).toBeNull();expect(onPrepareQuote).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Nachricht öffnen'})).toBeEnabled();
});

it('AF19 selects the mail concern, never guesses between orders and retries the same real writer key',async()=>{
 const message=row('TEST-handover',{concerns:['abholung'],openConcerns:['abholung'],text:'Hole ich ab.'});
 const handover=vi.fn().mockResolvedValueOnce({code:'VALIDATION_ERROR',message:'TEST choose',choices:[{id:'TEST-order-a',number:'TEST A',version:7},{id:'TEST-order-b',number:'TEST B',version:9}]}).mockResolvedValueOnce({code:'OK',receipt:{orderId:'TEST-order-b',message:'TEST saved'},replayed:false});
 const ports:IntakeMessagesPorts={list:vi.fn<IntakeMessagesPorts['list']>(async()=>({code:'OK',messages:[message],areas:['mails','auftraege'],currentLogin:'TEST-actor'})),select:vi.fn<IntakeMessagesPorts['select']>(async()=>({code:'OK',capture:{id:message.id,version:2,text:message.text,customerId:message.customerId,orderId:null,assignment:'hand',usage:'offen',concerns:['abholung'],files:[]}})),handover,finish:vi.fn(),reopen:vi.fn(),assignment:{read:vi.fn(),assign:vi.fn()}};
 const opened=vi.fn((event:Event)=>event.preventDefault());window.addEventListener('kreile:oeffne',opened);
 try{render(<IntakeMessages ports={ports}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Übergabe eintragen'}));
 await screen.findByRole('dialog',{name:'Wähle den Auftrag zu dieser Mail'});
 expect(handover).toHaveBeenCalledTimes(1);const first=handover.mock.calls[0][0];expect(first).toMatchObject({sourceItemId:message.id,sourceVersion:2});expect(first.orderId).toBeUndefined();
 fireEvent.click(screen.getByRole('button',{name:'Übergabe für TEST B übernehmen'}));
 await waitFor(()=>expect(handover).toHaveBeenCalledTimes(2));expect(handover.mock.calls[1][0]).toEqual({...first,orderId:'TEST-order-b',expectedVersion:9});
 await waitFor(()=>expect(opened).toHaveBeenCalled());expect(opened.mock.calls.at(-1)?.[0]).toMatchObject({detail:{ziel:'auftrag',arg:'TEST-order-b'}});
 }finally{window.removeEventListener('kreile:oeffne',opened);}
});


it('RM01 retries the same reply key and shows waiting only after the persisted view reload',async()=>{
 const message=row('TEST-rekla',{concerns:['reklamation'],openConcerns:['reklamation'],photoCount:0});
 const requestPhotos=vi.fn().mockResolvedValueOnce({code:'UNAVAILABLE',message:'TEST provider unavailable'}).mockResolvedValueOnce({code:'OK',data:{}});
 const list=vi.fn<IntakeMessagesPorts['list']>().mockResolvedValueOnce({code:'OK',messages:[message],areas:['mails','eingang','kunden'],currentLogin:'TEST-actor'}).mockResolvedValue({code:'OK',messages:[{...message,version:2,photoRequest:{at:'2026-11-08T11:00:00Z',threadId:'TEST-thread'}}],areas:['mails','eingang','kunden'],currentLogin:'TEST-actor'});
 const ports:IntakeMessagesPorts={list,requestPhotos,select:vi.fn(),finish:vi.fn(),reopen:vi.fn(),assignment:{read:vi.fn(),assign:vi.fn()}};
 render(<IntakeMessages ports={ports}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Fotos anfordern'}));
 await screen.findByText('Nicht gespeichert · TEST provider unavailable');
 expect(screen.queryByText('Wartet auf Fotos von TEST Schmidt')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Erneut'}));
 await screen.findByText('Wartet auf Fotos von TEST Schmidt');
 expect(requestPhotos).toHaveBeenCalledTimes(2);expect(requestPhotos.mock.calls[1][0]).toEqual(requestPhotos.mock.calls[0][0]);
 expect(screen.queryByRole('button',{name:'Fotos anfordern'})).toBeNull();expect(list).toHaveBeenCalledTimes(2);
});
