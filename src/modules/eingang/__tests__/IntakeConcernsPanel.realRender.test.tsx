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
 await screen.findByText('Nicht gespeichert · Fotoanfrage konnte nicht sicher gesendet werden · Versandbeleg prüfen.');
 expect(screen.queryByText('Wartet auf Fotos von TEST Schmidt')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Erneut'}));
 await screen.findByText('Wartet auf Fotos von TEST Schmidt');
 expect(requestPhotos).toHaveBeenCalledTimes(2);expect(requestPhotos.mock.calls[1][0]).toEqual(requestPhotos.mock.calls[0][0]);
 expect(screen.queryByRole('button',{name:'Fotos anfordern'})).toBeNull();expect(list).toHaveBeenCalledTimes(2);
});

it('RM07 photo UI checks automatically and offers a new-key retry only after confirmed non-delivery',async()=>{
 const message=row('TEST-rekla-rm07',{concerns:['reklamation'],openConcerns:['reklamation'],photoCount:0});
 const requestPhotos=vi.fn().mockImplementationOnce(async()=>({code:'UNAVAILABLE',delivery:'checking',retryAt:new Date(Date.now()+200).toISOString(),message:'TEST secret provider detail'})).mockResolvedValueOnce({code:'CONFLICT',delivery:'failed',message:'TEST secret failure detail'}).mockResolvedValueOnce({code:'OK',data:{}});
 const list=vi.fn<IntakeMessagesPorts['list']>().mockResolvedValueOnce({code:'OK',messages:[message],areas:['mails','eingang','kunden'],currentLogin:'TEST-actor'}).mockResolvedValue({code:'OK',messages:[{...message,version:2,photoRequest:{at:'2026-11-09T04:00:00Z',threadId:'TEST-rm07-thread'}}],areas:['mails','eingang','kunden'],currentLogin:'TEST-actor'});
 render(<IntakeMessages ports={{list,requestPhotos,select:vi.fn(),finish:vi.fn(),reopen:vi.fn(),assignment:{read:vi.fn(),assign:vi.fn()}}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Fotos anfordern'}));
 await waitFor(()=>expect(screen.getAllByText('Wird gerade geprüft').length).toBeGreaterThan(0));
 expect(screen.queryByRole('button',{name:'Fotos anfordern'})).toBeNull();expect(screen.queryByText('TEST secret provider detail')).toBeNull();
 const retry=await screen.findByRole('button',{name:'Erneut senden'});expect(requestPhotos).toHaveBeenCalledTimes(2);expect(requestPhotos.mock.calls[1][0]).toEqual(requestPhotos.mock.calls[0][0]);
 fireEvent.click(retry);await screen.findByText('Wartet auf Fotos von TEST Schmidt');
 expect(requestPhotos).toHaveBeenCalledTimes(3);expect(requestPhotos.mock.calls[2][0].clientRequestId).not.toBe(requestPhotos.mock.calls[0][0].clientRequestId);expect(list).toHaveBeenCalledTimes(2);
});

it.each([true,false])('RM07 reopened photo view recovers its actual server key before confirmed outcome (found=%s)',async(found)=>{
 const oldKey=crypto.randomUUID(),message=row('TEST-photo-resume',{concerns:['reklamation'],openConcerns:['reklamation'],photoCount:0,photoDelivery:{state:'checking',clientRequestId:oldKey,version:1,retryAt:new Date(Date.now()+200).toISOString()}});
 const requestPhotos=vi.fn().mockResolvedValueOnce(found?{code:'OK',data:{}}:{code:'CONFLICT',delivery:'failed',message:'TEST secret failure'}).mockResolvedValue({code:'OK',data:{}}),list=vi.fn<IntakeMessagesPorts['list']>().mockResolvedValueOnce({code:'OK',messages:[message],areas:['mails','eingang','kunden'],currentLogin:'TEST-actor'}).mockResolvedValue({code:'OK',messages:[{...message,version:2,photoDelivery:undefined,photoRequest:{at:'2026-11-09T04:00:00Z',threadId:'TEST-recovered'}}],areas:['mails','eingang','kunden'],currentLogin:'TEST-actor'});
 render(<IntakeMessages ports={{list,requestPhotos,select:vi.fn(),finish:vi.fn(),reopen:vi.fn(),assignment:{read:vi.fn(),assign:vi.fn()}}}/>);
 await screen.findByText('Wird gerade geprüft');expect(screen.queryByRole('button',{name:'Fotos anfordern'})).toBeNull();
 if(!found){fireEvent.click(await screen.findByRole('button',{name:'Erneut senden'}));}
 await screen.findByText('Wartet auf Fotos von TEST Schmidt');
 expect(requestPhotos).toHaveBeenCalledTimes(found?1:2);expect(requestPhotos.mock.calls[0][0]).toMatchObject({clientRequestId:oldKey,complaintPhotoRequest:{itemId:message.id,version:1}});
 if(!found)expect(requestPhotos.mock.calls[1][0].clientRequestId).not.toBe(oldKey);
});

it('RM07 reopening after reassignment reconciles the original version and recipient, then reads the confirmed conflict',async()=>{
 const oldKey=crypto.randomUUID(),message=row('TEST-photo-changed',{version:2,customerId:'TEST-new-customer',customerName:'TEST neue Zuordnung',concerns:['reklamation'],openConcerns:['reklamation'],photoCount:0,photoDelivery:{state:'checking',clientRequestId:oldKey,version:1,deliveryCustomerId:'TEST-original-customer',deliveryCustomer:'TEST ursprünglicher Kunde',retryAt:new Date(Date.now()+150).toISOString()}});
 const requestPhotos=vi.fn().mockResolvedValue({code:'OK',data:{sourceChanged:true,deliveryCustomer:'TEST ursprünglicher Kunde'}});
 const list=vi.fn<IntakeMessagesPorts['list']>().mockResolvedValueOnce({code:'OK',messages:[message],areas:['mails','eingang','kunden'],currentLogin:'TEST-actor'}).mockResolvedValue({code:'OK',messages:[{...message,photoDelivery:{...message.photoDelivery!,state:'source-changed'}}],areas:['mails','eingang','kunden'],currentLogin:'TEST-actor'});
 render(<IntakeMessages ports={{list,requestPhotos,select:vi.fn(),finish:vi.fn(),reopen:vi.fn(),assignment:{read:vi.fn(),assign:vi.fn()}}}/>);
 await screen.findByText('Die Mail an TEST ursprünglicher Kunde ist rausgegangen. Der Vorgang wurde inzwischen geändert – lies ihn neu, die Mail steht im Verlauf.');
 expect(requestPhotos).toHaveBeenCalledOnce();expect(requestPhotos).toHaveBeenCalledWith(expect.objectContaining({targetId:'TEST-original-customer',clientRequestId:oldKey,complaintPhotoRequest:{itemId:message.id,version:1}}));
 expect(list).toHaveBeenCalledTimes(2);expect(screen.queryByText('Wird gerade geprüft')).toBeNull();expect(screen.queryByRole('button',{name:'Fotos anfordern'})).toBeNull();expect(screen.getByRole('button',{name:'Neu laden'})).toBeEnabled();
});

it('RM08 photo-less close requires a reason, retains it after rejection and uses the existing lifecycle port',async()=>{
 const message=row('TEST-close-no-photos',{concerns:['reklamation','aufgabe'],openConcerns:['reklamation','aufgabe'],photoCount:0});
 const finish=vi.fn().mockResolvedValueOnce({code:'CONFLICT',message:'TEST hidden SQL'}).mockResolvedValue({code:'OK',captures:[]});
 const list=vi.fn<IntakeMessagesPorts['list']>().mockResolvedValue({code:'OK',messages:[message],areas:['mails','eingang','kunden','auftraege'],currentLogin:'TEST-actor'});
 render(<IntakeMessages ports={{list,finish,select:vi.fn(),reopen:vi.fn(),assignment:{read:vi.fn(),assign:vi.fn()}}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Ohne Fotos schließen'}));fireEvent.click(screen.getByText('Schließen',{selector:'footer button'}));
 await screen.findByText('Nenne einen konkreten Grund.');expect(finish).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Grund'),{target:{value:'TEST Kunde liefert keine Fotos'}});
 fireEvent.click(screen.getByText('Schließen',{selector:'footer button'}));await screen.findByRole('button',{name:'Stand neu laden'});expect(screen.queryByText('TEST hidden SQL')).toBeNull();expect(screen.getByDisplayValue('TEST Kunde liefert keine Fotos')).toBeEnabled();
 fireEvent.click(screen.getByText('Schließen',{selector:'footer button'}));await screen.findByText('Reklamationsanliegen ohne Fotos geschlossen.');
 expect(finish).toHaveBeenCalledTimes(2);expect(finish.mock.calls[1][0]).toEqual(finish.mock.calls[0][0]);expect(finish.mock.calls[0][0]).toMatchObject({items:[{itemId:message.id,version:1}],kind:'reklamation_ohne_fotos',note:'TEST Kunde liefert keine Fotos'});
});


it.each([null,'TEST-order'])('RM06 photo original opens one complaint flow with the exact source and explicit order choice (%s)',async orderId=>{
 const message=row('TEST-unthreaded-photo',{concerns:['reklamation'],openConcerns:['reklamation'],photoCount:2,orderId,orderKind:orderId?'auftrag':null});
 const list=vi.fn<IntakeMessagesPorts['list']>().mockResolvedValue({code:'OK',messages:[message],areas:['mails','eingang','kunden','auftraege'],currentLogin:'TEST-actor'});
 const ports:IntakeMessagesPorts={list,select:vi.fn(),finish:vi.fn(),reopen:vi.fn(),assignment:{read:vi.fn(),assign:vi.fn()}};
 const opened=vi.fn((event:Event)=>event.preventDefault());window.addEventListener('kreile:oeffne',opened);
 try{render(<IntakeMessages ports={ports}/>);fireEvent.click(await screen.findByRole('button',{name:'Reklamation anlegen'}));
 expect(opened).toHaveBeenCalledOnce();expect((opened.mock.calls[0][0] as CustomEvent).detail).toEqual({ziel:'reklamation',arg:orderId?orderId+'#'+message.id:message.customerId+'#kundenwahl',sourceItemId:message.id});
 expect(ports.select).not.toHaveBeenCalled();expect(ports.finish).not.toHaveBeenCalled();expect(ports.assignment.assign).not.toHaveBeenCalled();
 }finally{window.removeEventListener('kreile:oeffne',opened);}
});


it('RM14 offers the same task dialog with an intake reference and no implicit assignee without complaint rights',async()=>{
 const message=row('TEST-handover-rekla',{concerns:['reklamation'],openConcerns:['reklamation'],photoCount:2});
 const ports:IntakeMessagesPorts={list:vi.fn().mockResolvedValue({code:'OK',messages:[message],areas:['mails','eingang'],currentLogin:'TEST-actor'}),select:vi.fn(),finish:vi.fn(),reopen:vi.fn(),assignment:{read:vi.fn(),assign:vi.fn()}};
 const opened=vi.fn((event:Event)=>event.preventDefault());window.addEventListener('kreile:oeffne',opened);
 try{render(<IntakeMessages ports={ports}/>);fireEvent.click(await screen.findByRole('button',{name:'Reklamation übergeben'}));expect((opened.mock.calls[0][0] as CustomEvent).detail.taskRequest).toEqual({reference:{type:'eingang',id:message.id},kind:'aufgabe',handover:'complaint'});expect(screen.queryByRole('button',{name:'Reklamation anlegen'})).toBeNull();expect(ports.finish).not.toHaveBeenCalled();}finally{window.removeEventListener('kreile:oeffne',opened);}
});
