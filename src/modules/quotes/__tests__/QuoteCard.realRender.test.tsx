import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {QuoteCard,type QuoteCardPorts} from '../ui/QuoteCard';
import type {QuoteReadback} from '../public';

const quote:QuoteReadback={quoteId:'TEST-quote',quoteNumber:'KV-TEST-118',customerId:'TEST-customer',customerNumber:'K-TEST-1',customerDisplayName:'TEST Schmidt',status:'draft',version:2,currency:'EUR',dueDate:'2026-12-01',validUntil:'2026-12-20',termStatus:null,intakeSource:null,note:'TEST Originalteile erhalten',totalNetCents:4000,linkedOrderId:null,actorId:'TEST-actor',actorDisplayName:'TEST Rolf',createdAt:'2026-11-08T10:00:00Z',updatedAt:'2026-11-08T10:00:00Z',convertedAt:null,positions:[{id:'TEST-position',position:1,name:'TEST Halter',quantity:4,material:null,surfaceRequested:'Verchromen',unitPriceCents:1000,lineTotalCents:4000}],lifecycle:{edition:1,stage:'versendet',sentEdition:1,sentAt:'2026-11-08T10:00:00Z',sentChannel:'mail',acceptedEdition:null,acceptedAt:null,acceptanceEvidence:null,calculation:{hours:'4',hourlyRateCents:1000,setupCents:0,materialCents:0},goods:[],declinedAt:null,declineReason:null,followupAt:null,sourceItemId:null,sourceMessageId:null,specialRequests:null,deliveryWeeks:2}};
function setup(canEdit=true){
 const ports:QuoteCardPorts={read:vi.fn(async()=>({code:'OK' as const,quote,canEdit})),change:vi.fn(async()=>({code:'UNAVAILABLE' as const,message:'TEST Offline'})),prepare:vi.fn(async()=>({code:'UNAVAILABLE' as const,message:'TEST Offline'})),update:vi.fn(async()=>({code:'UNAVAILABLE' as const,message:'TEST Offline'}))};
 const onClose=vi.fn(),onCustomer=vi.fn(),onOrder=vi.fn();
 render(<QuoteCard quoteId={quote.quoteId} ports={ports} onClose={onClose} onCustomer={onCustomer} onOrder={onOrder}/>);
 return {ports,onClose,onCustomer};
}
beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('keeps sent facts read-only until the explicit new-edition action and opens the real customer target',async()=>{
 const {onCustomer}=setup();
 await screen.findByRole('button',{name:'Ändern · Fassung 2 anlegen'});
 expect(screen.queryAllByRole('textbox')).toHaveLength(0);
 expect(screen.getByText('40,00 € netto')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'TEST Schmidt'}));expect(onCustomer).toHaveBeenCalledWith('TEST-customer');
 fireEvent.click(screen.getByRole('button',{name:'Ändern · Fassung 2 anlegen'}));
 expect(screen.getByRole('textbox',{name:'Was soll geändert werden?'})).toBeVisible();
});

it('never offers write controls without the server supplied edit grant',async()=>{
 setup(false);await screen.findByRole('button',{name:'TEST Schmidt'});
 expect(screen.queryByRole('button',{name:/Fassung 2 anlegen/})).toBeNull();
 expect(screen.queryByRole('button',{name:/Telefon zugesagt/})).toBeNull();
});

it('shows server errors inside the dialog and retries the same acceptance request after a double click',async()=>{
 const {ports}=setup();const accept=await screen.findByRole('button',{name:'TEST Schmidt hat am Telefon zugesagt'});
 fireEvent.click(accept);fireEvent.click(accept);
 await screen.findByText('TEST Offline');expect(ports.change).toHaveBeenCalledTimes(1);
 const first=vi.mocked(ports.change).mock.calls[0][0];
 fireEvent.click(screen.getByRole('button',{name:'TEST Schmidt hat am Telefon zugesagt'}));
 await waitFor(()=>expect(ports.change).toHaveBeenCalledTimes(2));
 expect(vi.mocked(ports.change).mock.calls[1][0]).toEqual(first);
 expect(screen.getByRole('dialog').textContent).toContain('TEST Offline');
});

it('phone acceptance with stored goods calls the one atomic conversion port and never separate acceptance',async()=>{
 const stored={...quote,lifecycle:{...quote.lifecycle!,goods:[{id:'TEST-goods',orderId:null,edition:1,location:'TEST Regal',blocked:true,version:1}]}};
 const change=vi.fn(),convert=vi.fn(async()=>({code:'OK' as const,quote:{...stored,linkedOrderId:'TEST-order'},orderReceipt:{orderId:'TEST-order',orderNumber:'TEST-A-1'}}));
 const ports:QuoteCardPorts={read:async()=>({code:'OK',quote:stored,canEdit:true,conversion:{handoverMode:'pickup',paymentMode:'abholung'}}),change,convert,prepare:vi.fn(),update:vi.fn()};
 render(<QuoteCard quoteId={quote.quoteId} ports={ports} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 const phone=await screen.findByRole('button',{name:'TEST Schmidt hat am Telefon zugesagt'});fireEvent.click(phone);fireEvent.click(phone);
 await screen.findByText('Aus KV-TEST-118 ist Auftrag TEST-A-1 geworden');
 expect(convert).toHaveBeenCalledOnce();expect(change).not.toHaveBeenCalled();
 expect(vi.mocked(convert).mock.calls[0]).toEqual([expect.objectContaining({goodsReceiptId:'TEST-goods',expectedVersion:2,confirmedOrderDueDate:quote.dueDate,handoverMode:'pickup',paymentMode:'abholung'}),expect.objectContaining({edition:1,evidence:expect.stringContaining('Telefon')})]);
});

it('quote mail uses the existing send port, retains uncertain payload and only rereads after confirmed delivery',async()=>{
 const send=vi.fn().mockResolvedValueOnce({code:'ERROR',message:'TEST Versand ungeklärt',unclear:true}).mockResolvedValueOnce({code:'OK'}),read=vi.fn(async()=>({code:'OK' as const,quote,canEdit:true}));
 const ports:QuoteCardPorts={read,send,change:vi.fn(),prepare:vi.fn(),update:vi.fn()};
 const close=vi.fn();render(<QuoteCard quoteId={quote.quoteId} ports={ports} onClose={close} onCustomer={vi.fn()} onOrder={vi.fn()} MailView={({draft})=><><label>TEST Betreff<input value={draft.subject} disabled={draft.busy} onChange={e=>draft.onSubject(e.target.value)}/></label><label>TEST Nachricht<textarea value={draft.body} disabled={draft.busy} onChange={e=>draft.onBody(e.target.value)}/></label></>}/>);
 fireEvent.click(await screen.findByRole('button',{name:'KV per E-Mail senden'}));
 fireEvent.change(screen.getByLabelText('TEST Nachricht'),{target:{value:'TEST Bitte aktuelle Fassung bestätigen'}});
 const sendButton=screen.getByRole('button',{name:'KV senden'});fireEvent.click(sendButton);fireEvent.click(sendButton);
 await screen.findByText('TEST Versand ungeklärt');expect(send).toHaveBeenCalledOnce();
 expect(screen.getByLabelText('TEST Nachricht')).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Zurück'}));expect(close).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Mit gleicher Kennung erneut senden'}));
 await waitFor(()=>expect(send).toHaveBeenCalledTimes(2));expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);
 expect(send.mock.calls[0][0]).toMatchObject({quoteId:quote.quoteId,customerId:quote.customerId,subject:'KV-TEST-118',body:'TEST Bitte aktuelle Fassung bestätigen'});
 await waitFor(()=>expect(read.mock.calls.length).toBeGreaterThan(1));
});

it('operational purpose shows the phone decision but hides finance and editing',async()=>{
 const safe={...quote,totalNetCents:null,plannedHours:'4',positions:quote.positions.map(row=>({...row,unitPriceCents:null,lineTotalCents:null})),lifecycle:{...quote.lifecycle!,calculation:null}};
 const change=vi.fn(async()=>({code:'UNAVAILABLE' as const,message:'TEST Offline'}));
 render(<QuoteCard quoteId={quote.quoteId} ports={{read:async()=>({code:'OK',quote:safe,canEdit:false,canOperate:true,canReceive:false}),change,prepare:vi.fn(),update:vi.fn()}} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 const phone=await screen.findByRole('button',{name:'TEST Schmidt hat am Telefon zugesagt'});
 expect(screen.queryByText('40,00 € netto')).toBeNull();expect(screen.queryByRole('link',{name:'Drucken'})).toBeNull();expect(screen.queryByRole('button',{name:/Fassung 2 anlegen/})).toBeNull();expect(screen.queryByRole('button',{name:'KV per E-Mail senden'})).toBeNull();
 fireEvent.click(phone);await screen.findByText('TEST Offline');expect(change).toHaveBeenCalledOnce();
});

it('copy requires a new date and retries an uncertain result with identical intent',async()=>{
 const duplicate=vi.fn().mockResolvedValueOnce({code:'UNAVAILABLE',message:'TEST Kopie ungeklärt'}).mockResolvedValueOnce({code:'OK',quote:{...quote,quoteId:'TEST-copy'}}),onQuote=vi.fn();
 const ports:QuoteCardPorts={read:async()=>({code:'OK',quote,canEdit:true}),change:vi.fn(),prepare:vi.fn(),update:vi.fn(),copySource:async()=>({code:'OK',preparation:{source:{number:quote.quoteNumber,version:2},positions:quote.positions,missing:[]}}),duplicate};
 render(<QuoteCard quoteId={quote.quoteId} ports={ports} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()} onQuote={onQuote}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Diesen KV als Vorlage'}));
 const date=await screen.findByLabelText('Neuer Fertigtermin');expect(date).toHaveValue('');
 fireEvent.click(screen.getByRole('button',{name:'Neuen Fertigtermin wählen'}));expect(duplicate).not.toHaveBeenCalled();
 fireEvent.change(date,{target:{value:'2026-12-15'}});
 const save=screen.getByRole('button',{name:'Neuen KV aus Vorlage anlegen'});fireEvent.click(save);fireEvent.click(save);
 await screen.findByText('TEST Kopie ungeklärt');expect(duplicate).toHaveBeenCalledOnce();expect(date).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Mit gleicher Kennung erneut kopieren'}));
 await waitFor(()=>expect(onQuote).toHaveBeenCalledWith('TEST-copy'));
 expect(duplicate.mock.calls[1][0]).toEqual(duplicate.mock.calls[0][0]);
});

it('shows the actual date comparison and preserves the edition wording before applying',async()=>{
 const candidate={quoteId:quote.quoteId,expectedVersion:2,dueDate:'2026-12-18',note:quote.note,positions:quote.positions.map(({name,quantity,material,surfaceRequested,unitPriceCents})=>({name,quantity,material,surfaceRequested,unitPriceCents}))};
 const prepare=vi.fn(async()=>({code:'OK' as const,preparation:{dateOnly:true,before:quote,after:{dueDate:'2026-12-18',positions:candidate.positions,calculation:null,totalNetCents:4000},changes:['Liefertermin'],missing:[],canApply:true,candidate}})),update=vi.fn();
 render(<QuoteCard quoteId={quote.quoteId} ports={{read:async()=>({code:'OK',quote,canEdit:true}),change:vi.fn(),prepare,update}} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Ändern · Fassung 2 anlegen'}));fireEvent.change(screen.getByRole('textbox',{name:'Was soll geändert werden?'}),{target:{value:'Termin 18.12.2026'}});fireEvent.click(screen.getByRole('button',{name:'Änderungsvorschlag anzeigen'}));
 await screen.findByText('Fertig · 1.12.2026 → 18.12.2026');
 expect(screen.getByRole('button',{name:'Termin ändern · Fassung bleibt gültig'})).toBeVisible();expect(update).not.toHaveBeenCalled();
});

it.each([['TEST Fassung verbindlich angenommen','accept','Zusage aus dieser Antwort übernehmen'],['TEST einverstanden, aber nicht für den Preis','conditional','Vorbehalt aus dieser Antwort festhalten'],['TEST Vorhaben abgesagt','reject','Absage aus dieser Antwort übernehmen']] as const)('uses the persisted reply and source version for %s',async(text,action,label)=>{
 const source={itemId:'TEST-source',version:4,message:true},change=vi.fn<QuoteCardPorts['change']>(async()=>({code:'CONFLICT' as const,message:'TEST Quelle geändert'}));
 render(<QuoteCard quoteId={quote.quoteId} ports={{read:async()=>({code:'OK',quote,canEdit:true,reply:{source,text,concerns:[action==='reject'?'kv_ablehnung':'kv_annahme'],files:[]}}),change,prepare:vi.fn(),update:vi.fn()}} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 const button=await screen.findByRole('button',{name:label});expect(screen.queryByRole('button',{name:/hat am Telefon zugesagt/})).toBeNull();fireEvent.click(button);fireEvent.click(button);
 await screen.findByText('TEST Quelle geändert');expect(change).toHaveBeenCalledOnce();expect(change.mock.calls[0][0]).toMatchObject({quoteId:quote.quoteId,expectedVersion:2,edition:1,source,action,...(action==='reject'?{reason:text}:{evidence:text})});
});

it('keeps a late reply visible but offers the actual order instead of another acceptance',async()=>{
 const stored={...quote,linkedOrderId:'TEST-order'},onOrder=vi.fn(),change=vi.fn();
 render(<QuoteCard quoteId={quote.quoteId} ports={{read:async()=>({code:'OK',quote:stored,canEdit:true,reply:{source:{itemId:'TEST-source',version:3,message:true},text:'TEST späte Zusage',concerns:['kv_annahme'],files:[]}}),change,prepare:vi.fn(),update:vi.fn()}} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={onOrder}/>);
 await screen.findByText('TEST späte Zusage');expect(screen.queryByRole('button',{name:'Zusage aus dieser Antwort übernehmen'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Auftrag öffnen'}));expect(onOrder).toHaveBeenCalledWith('TEST-order');expect(change).not.toHaveBeenCalled();
});
it('offers reversal only from current server eligibility, preserves a failed reason and repeats the identical request',async()=>{
 const linked={...quote,linkedOrderId:'TEST-order'};
 const read=vi.fn().mockResolvedValueOnce({code:'OK',quote:linked,canEdit:false,canOperate:true,undo:{ready:true,canUndo:true,reason:null,automaticSuppressed:false}}).mockResolvedValue({code:'OK',quote,canEdit:false,undo:{ready:true,canUndo:false,reason:null,automaticSuppressed:true}});
 const undo=vi.fn().mockResolvedValueOnce({code:'UNAVAILABLE',message:'TEST Rücknahme ungeklärt'}).mockResolvedValueOnce({code:'OK',quote});
 const ports:QuoteCardPorts={read,undo,change:vi.fn(),prepare:vi.fn(),update:vi.fn()};
 render(<QuoteCard quoteId={quote.quoteId} ports={ports} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Rückgängig'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Grund der Rücknahme'}),{target:{value:'TEST falsche Ware'}});
 const confirm=screen.getByRole('button',{name:'Auftrag zurücknehmen'});fireEvent.click(confirm);fireEvent.click(confirm);
 await screen.findByText('TEST Rücknahme ungeklärt');expect(undo).toHaveBeenCalledOnce();
 expect(screen.getByRole('textbox',{name:'Grund der Rücknahme'})).toHaveValue('TEST falsche Ware');
 fireEvent.click(screen.getByRole('button',{name:'Auftrag zurücknehmen'}));
 await screen.findByText('Auftrag zurückgenommen · die Ware ist wieder beim KV.');
 expect(undo).toHaveBeenCalledTimes(2);expect(undo.mock.calls[1]).toEqual(undo.mock.calls[0]);
 expect(screen.queryByRole('button',{name:'Rückgängig'})).toBeNull();
});

it('AF3 offers a reasoned validity extension to an operational login without edit or money rights',async()=>{
 const current={...quote,totalNetCents:null,lifecycle:{...quote.lifecycle!,stage:'abgelaufen' as const,calculation:null}};
 const change=vi.fn<QuoteCardPorts['change']>(async()=>({code:'CONFLICT',message:'TEST Stand geändert'}));
 render(<QuoteCard quoteId={quote.quoteId} ports={{read:async()=>({code:'OK',quote:current,canEdit:false,canOperate:true}),change,prepare:vi.fn(),update:vi.fn()}} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Gültig bis verlängern'}));
 fireEvent.change(screen.getByLabelText('Neues Gültigkeitsdatum'),{target:{value:'2027-01-20'}});fireEvent.change(screen.getByRole('textbox',{name:'Grund / Wortlaut'}),{target:{value:'TEST Kunde benötigt Zeit'}});
 fireEvent.click(screen.getAllByRole('button',{name:'Gültig bis verlängern'}).at(-1)!);await screen.findByText('TEST Stand geändert');
 expect(change).toHaveBeenCalledWith({action:'extend',quoteId:quote.quoteId,expectedVersion:2,edition:1,clientEventId:expect.any(String),validUntil:'2027-01-20',evidence:'TEST Kunde benötigt Zeit'});
 expect(screen.getByRole('textbox',{name:'Grund / Wortlaut'})).toHaveValue('TEST Kunde benötigt Zeit');expect(screen.queryByText('40,00 € netto')).toBeNull();
});
it('AF4 returns declined goods through the existing port and rereads its persistent actor receipt',async()=>{
 let returned=false;const goods={id:'TEST-goods',orderId:null,edition:1,location:'TEST Regal',blocked:true,version:1};
 const current={...quote,lifecycle:{...quote.lifecycle!,stage:'abgesagt' as const,declinedAt:'2026-11-08T10:00:00Z',declineReason:'TEST Kunde sagt ab',goods:[goods]}};
 const receipt={eventId:'TEST-event',receiptId:goods.id,quoteNumber:quote.quoteNumber,quantity:4,location:goods.location,reason:'TEST Kunde hat abgeholt',actorName:'TEST Phillip',returnedAt:'2026-11-08T10:00:00Z'};
 const returnGoods=vi.fn<NonNullable<QuoteCardPorts['returnGoods']>>().mockResolvedValueOnce({code:'UNAVAILABLE',message:'TEST Rückgabe unbestätigt'}).mockImplementationOnce(async()=>{returned=true;return {code:'OK'};});
 render(<QuoteCard quoteId={quote.quoteId} ports={{read:async()=>({code:'OK',quote:returned?{...current,lifecycle:{...current.lifecycle,goods:[]}}:current,canEdit:false,canOperate:true,goodsReturns:returned?[receipt]:[]}),returnGoods,change:vi.fn(),prepare:vi.fn(),update:vi.fn()}} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Ware an TEST Schmidt zurückgeben · TEST Regal'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Grund / Wortlaut'}),{target:{value:receipt.reason}});fireEvent.click(screen.getByRole('button',{name:'Rückgabe mit Beleg bestätigen'}));await screen.findByText('TEST Rückgabe unbestätigt');
 fireEvent.click(screen.getByRole('button',{name:'Rückgabe mit Beleg bestätigen'}));await screen.findByText('Rückgabebeleg · KV-TEST-118');
 expect(returnGoods).toHaveBeenCalledTimes(2);expect(returnGoods.mock.calls[1][0]).toEqual(returnGoods.mock.calls[0][0]);expect(returnGoods.mock.calls[0][0]).toEqual({quoteId:quote.quoteId,receiptId:goods.id,expectedQuoteVersion:2,expectedVersion:1,clientEventId:expect.any(String),reason:receipt.reason});
 expect(screen.getByText(/4 Stück.*TEST Regal.*TEST Phillip/)).toBeVisible();expect(screen.getByText(receipt.reason)).toBeVisible();expect(screen.queryByRole('button',{name:'Ware an TEST Schmidt zurückgeben · TEST Regal'})).toBeNull();
});
it('AF18 requires explicit confirmation before replacing an accepted edition, retains invalidated evidence',async()=>{
 const accepted={...quote,lifecycle:{...quote.lifecycle!,acceptedEdition:1,acceptedAt:'2026-11-08T10:00:00Z',acceptanceEvidence:'TEST alte verbindliche Zusage'}};
 const candidate={quoteId:quote.quoteId,expectedVersion:2,dueDate:quote.dueDate,note:quote.note,positions:quote.positions.map(({name,quantity,material,surfaceRequested,unitPriceCents})=>({name,quantity,material,surfaceRequested,unitPriceCents:unitPriceCents!+100}))};
 const prepare=vi.fn(async()=>({code:'OK' as const,preparation:{dateOnly:false,before:accepted,after:{dueDate:quote.dueDate,positions:candidate.positions,calculation:null,totalNetCents:4400},changes:['TEST Preis'],missing:[],canApply:true,candidate}}));
 const updated={...accepted,version:3,lifecycle:{...accepted.lifecycle,edition:2,stage:'geaendert_seit_versand' as const}};
 const update=vi.fn(async()=>({code:'OK' as const,quote:updated,receipt:{} as never,replayed:false}));
 render(<QuoteCard quoteId={quote.quoteId} ports={{read:async()=>({code:'OK',quote:update.mock.calls.length?updated:accepted,canEdit:true}),change:vi.fn(),prepare,update}} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Ändern · Fassung 2 anlegen'}));fireEvent.change(screen.getByRole('textbox',{name:'Was soll geändert werden?'}),{target:{value:'TEST Preis anpassen'}});fireEvent.click(screen.getByRole('button',{name:'Änderungsvorschlag anzeigen'}));
 fireEvent.click(await screen.findByRole('button',{name:'Fassung 2 anlegen'}));expect(update).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Neue Fassung speichern · Zusage aufheben'}));
 await waitFor(()=>expect(update).toHaveBeenCalledOnce());
 fireEvent.click(screen.getByText('Verlauf und Anfrage'));
 expect(await screen.findByText(/Zusage zu Fassung 1 ist ungültig.*TEST alte verbindliche Zusage/)).toBeVisible();
});

it('AF5 shows physical discrepancy, retains a failed reason and retries the same existing writer',async()=>{
 let cleared=false;
 const goods={id:'TEST-goods',orderId:null,edition:1,location:'TEST Fach 3',blocked:true,version:1,packagesReceived:2,packagesTotal:3,condition:'teillieferung',deviations:['TEST Schaden']};
 const current={...quote,lifecycle:{...quote.lifecycle!,goods:[goods]}};
 const clarify=vi.fn<NonNullable<QuoteCardPorts['clarify']>>().mockResolvedValueOnce({code:'UNAVAILABLE',message:'TEST Klärung unbestätigt'}).mockImplementationOnce(async()=>{cleared=true;return {code:'OK'};});
 const read:QuoteCardPorts['read']=async()=>({code:'OK',quote:cleared?{...current,lifecycle:{...current.lifecycle,goods:[{...goods,version:2,clearance:{reason:'TEST Kunde bestätigt',actorId:'TEST-actor',at:'2026-11-08T10:00:00Z'}}]}}:current,canEdit:false,canOperate:true});
 render(<QuoteCard quoteId={quote.quoteId} ports={{read,clarify,change:vi.fn(),prepare:vi.fn(),update:vi.fn()}} onClose={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()}/>);
 expect(await screen.findByText('TEST Fach 3 · 2 von 3 Packstücke · TEST Schaden')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Abweichung geklärt'}));fireEvent.change(screen.getByRole('textbox',{name:'Grund der Klärung'}),{target:{value:'TEST Kunde bestätigt'}});
 fireEvent.click(screen.getAllByRole('button',{name:'Abweichung geklärt'}).at(-1)!);await screen.findByText('TEST Klärung unbestätigt');
 expect(screen.getByRole('textbox',{name:'Grund der Klärung'})).toHaveValue('TEST Kunde bestätigt');
 fireEvent.click(screen.getAllByRole('button',{name:'Abweichung geklärt'}).at(-1)!);await screen.findByText('Abweichung geklärt · die ursprünglichen Prüfdaten bleiben im Verlauf.');
 expect(clarify).toHaveBeenCalledTimes(2);expect(clarify.mock.calls[1][0]).toEqual(clarify.mock.calls[0][0]);expect(clarify.mock.calls[0][0]).toEqual({command:'clarify',quoteId:quote.quoteId,receiptId:'TEST-goods',expectedVersion:1,expectedQuoteVersion:2,clientEventId:expect.any(String),reason:'TEST Kunde bestätigt'});
 expect(screen.getByText('TEST Fach 3 · 2 von 3 Packstücke · TEST Schaden')).toBeVisible();
});
