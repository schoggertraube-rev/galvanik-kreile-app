import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
import {ComplaintDialog} from '../ui/ComplaintDialog';
import {ComplaintDialogs} from '../ui/ComplaintDialogs';
import type {ComplaintDialogData,ComplaintPorts} from '../dialogContract';

const base:ComplaintDialogData={complaint:null,source:{id:'test-order',number:'A-TEST-4C',customerName:'TEST Kunde',items:[{id:'test-part',name:'TEST Gehäuse',quantity:3,unit:'Stück'}]},initial:{description:'',defect:'',photoIds:[],intakeItemId:null,intakeVersion:null},suggestedDate:'2027-05-18',rework:null};
function setup(data=base,areas:ComplaintPorts['areas']=['auftraege','entscheiden','geld','kunden']) {
  const ports:ComplaintPorts={areas,read:vi.fn<ComplaintPorts['read']>(async()=>({code:'OK',data})),write:vi.fn<ComplaintPorts['write']>(async()=>({code:'OK',receipt:{complaintId:'test-complaint',number:'RK-TEST-4C',state:'aufgenommen',version:1,eventId:'test-event'},replayed:false})),rework:vi.fn<ComplaintPorts['rework']>(async()=>({code:'OK',receipt:{orderId:'test-rework'}})),openOrder:vi.fn(),createQuote:vi.fn(),openPhoto:vi.fn(async()=>undefined),addPhoto:vi.fn<ComplaintPorts['addPhoto']>(async()=>({code:'OK',id:'test-photo'})),sendResult:vi.fn<ComplaintPorts['sendResult']>(async()=>({code:'UNAVAILABLE',message:'TEST Offline'}))};
  const onClose=vi.fn(),onMessage=vi.fn();
  render(<ComplaintDialog request={data.complaint?{complaintId:data.complaint.id}:{orderId:data.source.id}} ports={ports} onClose={onClose} onMessage={onMessage}/>);
  return {ports,onClose,onMessage};
}
beforeEach(()=>{vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

function recorded(state:'aufgenommen'|'massnahme_gutschrift'='aufgenommen'):ComplaintDialogData{
 return {...base,complaint:{id:'test-complaint',customerId:'test-customer',orderId:base.source.id,itemId:null,legacyPositionId:null,reason:'Blasen',stationId:null,description:'',photoIds:[],createdAt:'2026-11-07T10:00:00Z',resolvedAt:null,resolution:null,status:'open',nummer:'RK-TEST-REST',stand:state,version:2,wareZurueck:'nein',teile:[{position_id:'test-part',menge:1}],mangel:'Blasen',...(state==='massnahme_gutschrift'?{massnahme:'gutschrift',bewertung:'kulanz',gutschriftBetrag:'50.00'}:{})}};
}

it('L04/L06 show field errors at the editable gap without the missing-fields screen',async()=>{
 const {ports}=setup(recorded());
 fireEvent.click(await screen.findByRole('button',{name:'abgelehnt'}));
 fireEvent.click(screen.getByRole('button',{name:'Ergebnis speichern'}));
 expect(document.querySelector('[data-spec-id="reklamation.begruendung.fehler"]')).toHaveTextContent('Begründung fehlt');
 expect(document.querySelector('[data-spec-id="reklamation.zustand.teilweise"]')).toBeNull();
 await waitFor(()=>expect(screen.getByRole('textbox',{name:/Begründung/})).toHaveFocus());
 expect(ports.write).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Kunde zieht zurück'}));
 fireEvent.click(screen.getByRole('button',{name:'Zurückgezogen · abschließen'}));
 expect(document.querySelector('[data-spec-id="reklamation.notiz.fehler"]')).toHaveTextContent('3–500 Zeichen');
 expect(document.querySelector('[data-spec-id="reklamation.zustand.teilweise"]')).toBeNull();
 expect(ports.write).not.toHaveBeenCalled();
});

it('L05 keeps the reason with the disabled rework action',async()=>{
 const {ports}=setup(recorded());
 fireEvent.click(await screen.findByRole('button',{name:'berechtigt'}));
 const choice=document.querySelector('[data-spec-id="reklamation.massnahme"]') as HTMLElement;
 expect(within(choice).getByRole('button',{name:'Nacharbeit'})).toBeDisabled();
 expect(within(choice).getByText('Nacharbeit braucht die Teile')).toBeVisible();
 expect(ports.rework).not.toHaveBeenCalled();
});

it('L08 credit success closes only after the returned receipt and shows the bound message',async()=>{
 const {ports,onClose,onMessage}=setup(recorded('massnahme_gutschrift'));
 fireEvent.click(await screen.findByRole('button',{name:'Gutschrift erteilt'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Betrag'}),{target:{value:'50,00'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Gutschrift- bzw. Storno-Nr.'}),{target:{value:'GS-TEST-REST'}});
 vi.mocked(ports.write).mockResolvedValue({code:'OK',receipt:{complaintId:'test-complaint',number:'RK-TEST-REST',state:'kunde_informieren',version:3,eventId:'test-event'},replayed:false});
 fireEvent.click(screen.getByRole('button',{name:'Gutschrift vermerken'}));
 await waitFor(()=>expect(onClose).toHaveBeenCalledTimes(1));
 expect(ports.write).toHaveBeenCalledWith(expect.objectContaining({action:'gutschrift',creditCents:5000,creditNumber:'GS-TEST-REST',version:2}));
 expect(onMessage).toHaveBeenCalledWith('Gutschrift vermerkt · Kunde informieren');
});

it('L09 closes both actual layers after discard, and reopening starts a clean recording',async()=>{
 const ports:ComplaintPorts={areas:['auftraege'],read:vi.fn(async()=>({code:'OK' as const,data:base})),write:vi.fn(),rework:vi.fn(),openOrder:vi.fn(),openPhoto:vi.fn(),addPhoto:vi.fn(),sendResult:vi.fn()};
 render(<ComplaintDialogs ports={ports} onRefresh={vi.fn()}/>);
 const open=()=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'reklamation',arg:'test-order#aufnehmen'},cancelable:true}));
 open();await screen.findByRole('button',{name:'Reklamation aufnehmen'});
 fireEvent.keyDown(window,{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 open();await screen.findByRole('button',{name:'Reklamation aufnehmen'});
 fireEvent.change(screen.getByRole('textbox',{name:'Beschreibung'}),{target:{value:'TEST zu verwerfende Beschreibung'}});
 fireEvent.keyDown(window,{key:'Escape'});
 expect(await screen.findByRole('dialog',{name:'Änderungen nicht gespeichert'})).toHaveTextContent('Beschreibung');
 fireEvent.click(screen.getByRole('button',{name:'Verwerfen'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 open();await screen.findByRole('button',{name:'Reklamation aufnehmen'});
 expect(screen.getByRole('textbox',{name:'Beschreibung'})).toHaveValue('');
 expect(ports.write).not.toHaveBeenCalled();
});

it('L09 an old closing animation cannot close a newly opened complaint',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 const ports:ComplaintPorts={areas:['auftraege'],read:vi.fn(async()=>({code:'OK' as const,data:base})),write:vi.fn(),rework:vi.fn(),openOrder:vi.fn(),openPhoto:vi.fn(),addPhoto:vi.fn(),sendResult:vi.fn()};
 render(<ComplaintDialogs ports={ports} onRefresh={vi.fn()}/>);
 const open=()=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'reklamation',arg:'test-order#aufnehmen'},cancelable:true}));
 open();await screen.findByRole('button',{name:'Reklamation aufnehmen'});
 fireEvent.keyDown(window,{key:'Escape'});
 open();await screen.findByRole('button',{name:'Reklamation aufnehmen'});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,230));});
 expect(screen.getByRole('dialog',{name:'Reklamation'})).toBeInTheDocument();
 expect(ports.write).not.toHaveBeenCalled();
});

it('a missing legacy version is named before sending, and is never replaced by an invented version',async()=>{
 const data=recorded();data.complaint!.version=null;
 const {ports}=setup(data);
 fireEvent.click(await screen.findByRole('button',{name:'abgelehnt'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Begründung'}),{target:{value:'TEST sachliche Begründung'}});
 fireEvent.click(screen.getByRole('button',{name:'Ergebnis speichern'}));
 expect(await screen.findByText(/Bearbeitungsstand fehlt · Reklamation neu laden/)).toBeInTheDocument();
 expect(ports.write).not.toHaveBeenCalled();
 expect(screen.getByRole('textbox',{name:'Begründung'})).toHaveValue('TEST sachliche Begründung');
});

describe('4.8 real component interactions (isolated TEST ports; server effects have Replay tests)',()=>{
  it('keeps missing fields on screen and sends nothing; delivered quantity is the editable initial quantity',async()=>{
    const {ports}=setup();
    const save=await screen.findByRole('button',{name:'Reklamation aufnehmen'});
    fireEvent.click(save);
    expect(await screen.findByText('Noch offen: Betroffene Teile, Mangel')).toBeInTheDocument();
    expect(ports.write).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('[data-spec-id="reklamation.teile"]')!);
    expect(screen.getByRole('spinbutton',{name:'Menge betroffen · TEST Gehäuse'})).toHaveValue(3);
    fireEvent.change(screen.getByRole('combobox'),{target:{value:'Blasen'}});
    fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'4'}});
    fireEvent.click(save);
    expect(await screen.findAllByText('Menge betroffen muss zwischen 1 und geliefert liegen.')).not.toHaveLength(0);
    expect(ports.write).not.toHaveBeenCalled();
  });
  it('records once on double click and closes only after the real port result is OK',async()=>{
    const {ports,onClose,onMessage}=setup();
    const save=await screen.findByRole('button',{name:'Reklamation aufnehmen'});
    fireEvent.click(document.querySelector('[data-spec-id="reklamation.teile"]')!);
    fireEvent.change(screen.getByRole('combobox'),{target:{value:'Blasen'}});
    fireEvent.click(save);fireEvent.click(save);
    await waitFor(()=>expect(ports.write).toHaveBeenCalledTimes(1));
    expect(ports.write).toHaveBeenCalledWith(expect.objectContaining({action:'aufnehmen',goodsReturn:'offen',parts:[{position_id:'test-part',menge:3}]}));
    await waitFor(()=>expect(onClose).toHaveBeenCalledTimes(1));
    expect(onMessage).toHaveBeenCalledWith('Reklamation RK-TEST-4C aufgenommen · Meister entscheidet');
  });
  it('keeps inputs and request identity on a failed write and an explicit retry',async()=>{
    const {ports,onClose}=setup();
    vi.mocked(ports.write).mockResolvedValue({code:'UNAVAILABLE',message:'TEST Offline'});
    const save=await screen.findByRole('button',{name:'Reklamation aufnehmen'});
    fireEvent.click(screen.getByRole('checkbox'));fireEvent.change(screen.getByRole('combobox'),{target:{value:'Blasen'}});fireEvent.click(save);
    expect(await screen.findByText(/Du prüfst den ungeklärten Ausgang/)).toBeInTheDocument();
    const first=vi.mocked(ports.write).mock.calls[0][0];
    expect(screen.getByRole('spinbutton')).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button',{name:'Erneut'})[0]);
    await waitFor(()=>expect(ports.write).toHaveBeenCalledTimes(2));
    expect(vi.mocked(ports.write).mock.calls[1][0]).toEqual(first);
    expect(onClose).not.toHaveBeenCalled();expect(screen.getByRole('spinbutton')).toHaveValue(3);
  });
  it('RM13 conflict rereads actual context without losing editable input or closing',async()=>{
    const data={...base,initial:{...base.initial,intakeItemId:'TEST-source',intakeVersion:1}};
    const {ports,onClose}=setup(data);
    vi.mocked(ports.write).mockResolvedValue({code:'CONFLICT',message:'TEST private conflict detail'});
    await screen.findByRole('button',{name:'Reklamation aufnehmen'});
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByRole('combobox'),{target:{value:'Blasen'}});
    fireEvent.change(screen.getByRole('textbox',{name:'Beschreibung'}),{target:{value:'TEST eigene Eingabe'}});
    fireEvent.click(screen.getByRole('button',{name:'Reklamation aufnehmen'}));
    const reload=await screen.findByRole('button',{name:'Neu laden · Eingaben behalten'});
    expect(screen.queryByText(/TEST private conflict detail/)).not.toBeInTheDocument();
    vi.mocked(ports.read).mockResolvedValue({code:'OK',data:{...data,initial:{...data.initial,intakeVersion:2}}});
    fireEvent.click(reload);
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Neu laden · Eingaben behalten'})).not.toBeInTheDocument());
    expect(screen.getByRole('textbox',{name:'Beschreibung'})).toHaveValue('TEST eigene Eingabe');
    expect(screen.getByRole('spinbutton')).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Reklamation aufnehmen'}));
    await waitFor(()=>expect(ports.write).toHaveBeenCalledTimes(2));
    expect(vi.mocked(ports.write).mock.calls[1][0]).toMatchObject({intakeVersion:2,description:'TEST eigene Eingabe'});
    expect(onClose).not.toHaveBeenCalled();
  });
  it('Esc on an edited description opens only the discard layer, and discard writes no row',async()=>{
    const {ports,onClose}=setup();
    await screen.findByRole('button',{name:'Reklamation aufnehmen'});
    fireEvent.change(screen.getByRole('textbox',{name:'Beschreibung'}),{target:{value:'TEST Beschreibung'}});
    fireEvent.keyDown(window,{key:'Escape'});
    expect(await screen.findByRole('dialog',{name:'Änderungen nicht gespeichert'})).toBeInTheDocument();
    expect(screen.getByText(/Geändert: Beschreibung/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Weiter bearbeiten'}));
    expect(screen.getByRole('textbox',{name:'Beschreibung'})).toHaveValue('TEST Beschreibung');
    fireEvent.keyDown(window,{key:'Escape'});fireEvent.click(await screen.findByRole('button',{name:'Verwerfen'}));
    expect(onClose).toHaveBeenCalledTimes(1);expect(ports.write).not.toHaveBeenCalled();
  });
});

it('reopened completed rework preserves the historical link and starts a new complaint only after discarding edits',async()=>{
 const data:ComplaintDialogData={...base,complaint:{id:'test-complaint',customerId:'test-customer',orderId:base.source.id,itemId:null,legacyPositionId:null,reason:'Blasen',stationId:null,description:'',photoIds:[],createdAt:'2026-11-07T10:00:00Z',resolvedAt:null,resolution:null,status:'open',nummer:'RK-TEST-4C',stand:'aufgenommen',version:4,wareZurueck:'ja',nacharbeitAuftragId:'test-rework',reworkNumber:'A-TEST-REWORK'},rework:{station:'abgeholt',goods:'raus'}};
 const {ports}=setup(data),opened=vi.fn((event:Event)=>event.preventDefault());
 window.addEventListener('kreile:oeffne',opened);
 try{
  const next=await screen.findByRole('button',{name:'Neue Reklamation zum Nacharbeitsauftrag A-TEST-REWORK aufnehmen'});
  fireEvent.click(screen.getByRole('button',{name:'berechtigt'}));
  expect(screen.getByRole('button',{name:'Nacharbeit'})).toBeDisabled();
  fireEvent.click(next);
  expect(await screen.findByRole('dialog',{name:'Änderungen nicht gespeichert'})).toBeInTheDocument();
  expect(opened).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Verwerfen'}));
  expect(opened).toHaveBeenCalledTimes(1);
  expect((opened.mock.calls[0][0] as CustomEvent).detail).toEqual({ziel:'reklamation',arg:'test-rework#aufnehmen'});
  expect(ports.write).not.toHaveBeenCalled();expect(ports.rework).not.toHaveBeenCalled();
 }finally{window.removeEventListener('kreile:oeffne',opened);}
});

it('customer entry reuses the delivered-order picker, retries a read failure and opens only the selected source',async()=>{
 const list=vi.fn<NonNullable<ComplaintPorts['listDeliveredOrders']>>().mockResolvedValueOnce({code:'UNAVAILABLE',message:'TEST Lesen unterbrochen'}).mockResolvedValueOnce({code:'OK',orders:[{id:'test-order',number:'A-TEST-4C',title:'TEST Gehäuse'}]});
 const ports:ComplaintPorts={areas:['auftraege','kunden'],listDeliveredOrders:list,read:vi.fn<ComplaintPorts['read']>(async()=>({code:'OK',data:base})),write:vi.fn(),rework:vi.fn(),openOrder:vi.fn(),openPhoto:vi.fn(),addPhoto:vi.fn(),sendResult:vi.fn()};
 render(<ComplaintDialogs ports={ports} onRefresh={vi.fn()}/>);
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'reklamation',arg:'test-customer#kundenwahl',sourceItemId:'TEST-original-source'},cancelable:true}));
 expect(await screen.findByText('Du lädst die Aufträge erneut. Deine Nachricht bleibt unverändert.')).toBeInTheDocument();expect(screen.queryByText('TEST Lesen unterbrochen')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Erneut'}));
 const choice=await screen.findByRole('button',{name:/A-TEST-4C.*TEST Gehäuse/});
 expect(ports.write).not.toHaveBeenCalled();
 fireEvent.click(choice);
 expect(await screen.findByRole('button',{name:'Reklamation aufnehmen'})).toBeInTheDocument();
 expect(ports.read).toHaveBeenCalledWith({orderId:'test-order',sourceItemId:'TEST-original-source'});
 expect(list).toHaveBeenNthCalledWith(1,'test-customer');expect(list).toHaveBeenNthCalledWith(2,'test-customer');
 expect(screen.queryByRole('dialog',{name:'Vorgang wählen'})).not.toBeInTheDocument();
 expect(ports.write).not.toHaveBeenCalled();
});

it('opens the reminder in the existing composer, retains edits on failure and retries the same key without closing the complaint',async()=>{
 const data:ComplaintDialogData={...base,complaint:{id:'TEST-complaint',customerId:'TEST-customer',orderId:base.source.id,itemId:null,legacyPositionId:null,reason:'TEST defect',stationId:null,description:'TEST',photoIds:[],createdAt:'2026-10-12T08:00:00Z',resolvedAt:null,resolution:null,status:'open',stand:'massnahme_nacharbeit',nummer:'RK-TEST',version:2,nacharbeitAuftragId:'TEST-rework'},resultMail:{subject:'TEST Begleitschein',body:'TEST Vorlage'},rework:{station:'angenommen',goods:'erwartet'}};
 const send=vi.fn<NonNullable<ComplaintPorts['sendReminder']>>().mockResolvedValueOnce({code:'UNAVAILABLE',message:'TEST network unclear'}).mockResolvedValueOnce({code:'OK'});
 const ports:ComplaintPorts={areas:['kunden'],read:vi.fn(async()=>({code:'OK' as const,data})),write:vi.fn(),rework:vi.fn(),openOrder:vi.fn(),openPhoto:vi.fn(),addPhoto:vi.fn(),sendResult:vi.fn(),sendReminder:send,ResultMail:p=><label>TEST Nachricht<textarea aria-label="TEST Nachricht" value={p.body} disabled={p.busy} onChange={e=>p.onBody(e.target.value)}/></label>};
 const refreshed=vi.fn();render(<ComplaintDialogs ports={ports} onRefresh={refreshed}/>);
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'mail',arg:'TEST-rework#auftragsbestaetigung'}}));
 const body=await screen.findByRole('textbox',{name:'TEST Nachricht'});
 expect(ports.read).toHaveBeenCalledWith({reminderOrderId:'TEST-rework'});
 fireEvent.change(body,{target:{value:'TEST eigene Nachricht'}});
 fireEvent.click(screen.getByRole('button',{name:'Begleitschein senden'}));
 expect(await screen.findByText(/Du prüfst den ungeklärten Ausgang/)).toBeInTheDocument();expect(body).toHaveValue('TEST eigene Nachricht');expect(body).toBeDisabled();
 expect(screen.queryByText(/TEST network unclear/)).not.toBeInTheDocument();const original=send.mock.calls[0][0];expect(original).toMatchObject({complaintId:'TEST-complaint',orderId:'TEST-rework',version:2,body:'TEST eigene Nachricht'});
 fireEvent.click(screen.getAllByRole('button',{name:'Erneut'})[0]);
 expect(await screen.findByText('Begleitschein gesendet · Erinnerung ruht für 5 Arbeitstage')).toBeInTheDocument();
 expect(send.mock.calls[1][0]).toEqual(original);expect(ports.write).not.toHaveBeenCalled();expect(ports.sendResult).not.toHaveBeenCalled();expect(refreshed).toHaveBeenCalledTimes(1);
});


it('AF-11 shows the preserved issued credit after reopening and disables a second credit',async()=>{
 const value=recorded();value.complaint={...value.complaint!,gutschriftNr:'GS-TEST-REST',gutschriftBetrag:'50.00',version:5};
 const {ports}=setup(value);
 await screen.findByText('Gutschrift GS-TEST-REST besteht · 50,00 € · keine zweite Gutschrift anlegen.');
 fireEvent.click(screen.getByRole('button',{name:'berechtigt'}));
 expect(screen.getByRole('button',{name:'Gutschrift'})).toBeDisabled();
 expect(ports.write).not.toHaveBeenCalled();
});

it('AF12 opens the existing paid quote route with the rejected complaint and actual customer',async()=>{
 const current=recorded();current.complaint={...current.complaint!,bewertung:'abgelehnt',massnahme:'ablehnen',stand:'kunde_informieren',begruendung:'TEST Leistung ausserhalb Gewährleistung'};
 const {ports}=setup(current);
 fireEvent.click(await screen.findByRole('button',{name:'KV aus Reklamation RK-TEST-REST'}));
 expect(ports.createQuote).toHaveBeenCalledOnce();expect(ports.createQuote).toHaveBeenCalledWith({id:'test-complaint',number:'RK-TEST-REST',customerId:'test-customer'});
 expect(ports.write).not.toHaveBeenCalled();expect(ports.rework).not.toHaveBeenCalled();
});

it('RM07 reminder checks without a send button then uses a fresh key only after confirmed failure',async()=>{
 const data:ComplaintDialogData={...base,complaint:{id:'TEST-complaint',customerId:'TEST-customer',orderId:base.source.id,itemId:null,legacyPositionId:null,reason:'TEST defect',stationId:null,description:'TEST',photoIds:[],createdAt:'2026-10-12T08:00:00Z',resolvedAt:null,resolution:null,status:'open',stand:'massnahme_nacharbeit',nummer:'RK-TEST',version:2,nacharbeitAuftragId:'TEST-rework'},resultMail:{subject:'TEST Begleitschein',body:'TEST Vorlage'},rework:{station:'angenommen',goods:'erwartet'}};
 const send=vi.fn<NonNullable<ComplaintPorts['sendReminder']>>().mockResolvedValueOnce({code:'UNAVAILABLE',delivery:'checking',retryAt:new Date(Date.now()+250).toISOString(),message:'TEST hidden transport'}).mockResolvedValueOnce({code:'CONFLICT',delivery:'failed',deliveryCustomer:'TEST Kunde',message:'TEST hidden failure'}).mockResolvedValueOnce({code:'OK'});
 const ports:ComplaintPorts={areas:['kunden'],read:vi.fn(async()=>({code:'OK' as const,data})),write:vi.fn(),rework:vi.fn(),openOrder:vi.fn(),openPhoto:vi.fn(),addPhoto:vi.fn(),sendResult:vi.fn(),sendReminder:send,ResultMail:p=><label>TEST Nachricht<textarea aria-label="TEST Nachricht" value={p.body} disabled={p.busy} onChange={e=>p.onBody(e.target.value)}/></label>};
 const refreshed=vi.fn();render(<ComplaintDialogs ports={ports} onRefresh={refreshed}/>);
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'mail',arg:'TEST-rework#auftragsbestaetigung'}}));
 const body=await screen.findByRole('textbox',{name:'TEST Nachricht'});
 expect(ports.read).toHaveBeenCalledWith({reminderOrderId:'TEST-rework'});
 fireEvent.change(body,{target:{value:'TEST eigene Nachricht'}});
 fireEvent.click(screen.getByRole('button',{name:'Begleitschein senden'}));
 await screen.findByText('Wird gerade geprüft');expect(screen.queryByRole('button',{name:'Erneut'})).toBeNull();expect(screen.queryByRole('button',{name:'Begleitschein senden'})).toBeNull();expect(body).toBeDisabled();
 const retry=await screen.findByRole('button',{name:'Erneut senden'});expect(send).toHaveBeenCalledTimes(2);expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);expect(body).toBeEnabled();expect(body).toHaveValue('TEST eigene Nachricht');const original=send.mock.calls[0][0];
 fireEvent.click(retry);await screen.findByText('Begleitschein gesendet · Erinnerung ruht für 5 Arbeitstage');expect(send).toHaveBeenCalledTimes(3);expect(send.mock.calls[2][0].clientKey).not.toBe(original.clientKey);
 expect(send.mock.calls[1][0]).toEqual(original);expect(ports.write).not.toHaveBeenCalled();expect(ports.sendResult).not.toHaveBeenCalled();expect(refreshed).toHaveBeenCalledTimes(1);
});


it('RM07 result source conflict offers reload rather than claiming the complaint is closed',async()=>{
 const data:ComplaintDialogData={...base,complaint:{id:'TEST-complaint',customerId:'TEST-customer',orderId:base.source.id,itemId:null,legacyPositionId:null,reason:'TEST defect',stationId:null,description:'TEST',photoIds:[],createdAt:'2026-10-12T08:00:00Z',resolvedAt:null,resolution:null,status:'open',stand:'kunde_informieren',nummer:'RK-TEST',version:2},resultMail:{subject:'TEST Ergebnis',body:'TEST Nachricht'}};
 const send=vi.fn<ComplaintPorts['sendResult']>().mockResolvedValue({code:'CONFLICT',delivery:'source-changed',deliveryCustomer:'TEST Kunde',sentThreadId:'TEST-thread',message:'TEST internal failure'});
 const read=vi.fn(async()=>({code:'OK' as const,data}));const ports:ComplaintPorts={areas:['kunden'],read,write:vi.fn(),rework:vi.fn(),openOrder:vi.fn(),openPhoto:vi.fn(),addPhoto:vi.fn(),sendResult:send,ResultMail:p=><label>TEST Nachricht<textarea value={p.body} disabled={p.busy} onChange={e=>p.onBody(e.target.value)}/></label>};
 const onClose=vi.fn(),onMessage=vi.fn();render(<ComplaintDialog request={{complaintId:'TEST-complaint'}} ports={ports} onClose={onClose} onMessage={onMessage}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Kunde informieren'}));fireEvent.click(screen.getByRole('button',{name:'Senden'}));
 await screen.findByText('Die Mail an TEST Kunde ist rausgegangen. Der Vorgang wurde inzwischen geändert – lies ihn neu, die Mail steht im Verlauf.');
 expect(screen.queryByText('TEST internal failure')).toBeNull();expect(screen.queryByRole('button',{name:'Erneut'})).toBeNull();expect(onClose).not.toHaveBeenCalled();expect(onMessage).not.toHaveBeenCalled();expect(ports.write).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Neu laden'}));await waitFor(()=>expect(read).toHaveBeenCalledTimes(2));expect(send).toHaveBeenCalledOnce();
});


it.each(['result','reminder'] as const)('RM07 fully reopened %s dialog recovers original version and message before reconciliation',async kind=>{
 const request={complaintId:'TEST-complaint',version:2,clientKey:crypto.randomUUID(),subject:'TEST Originalbetreff',body:'TEST Ursprünglicher Inhalt',...(kind==='reminder'?{orderId:'TEST-rework'}:{})};
 const data:ComplaintDialogData={...base,complaint:{id:'TEST-complaint',customerId:'TEST-customer',orderId:base.source.id,itemId:null,legacyPositionId:null,reason:'TEST defect',stationId:null,description:'TEST',photoIds:[],createdAt:'2026-10-12T08:00:00Z',resolvedAt:null,resolution:null,status:'open',stand:kind==='result'?'abgeschlossen':'massnahme_nacharbeit',nummer:'RK-TEST',version:3,nacharbeitAuftragId:'TEST-rework'},resultMail:{subject:'TEST heutige Vorlage',body:'TEST geänderte Vorlage'},rework:{station:'angenommen',goods:'da'},mailRecovery:{kind,request,retryAt:new Date(Date.now()+200).toISOString()}};
 const send=vi.fn().mockResolvedValue({code:'CONFLICT',delivery:'source-changed',deliveryCustomer:'TEST Kunde',message:'TEST raw conflict'});
 const ports:ComplaintPorts={areas:['kunden'],read:vi.fn(async()=>({code:'OK' as const,data})),write:vi.fn(),rework:vi.fn(),openOrder:vi.fn(),openPhoto:vi.fn(),addPhoto:vi.fn(),sendResult:send,sendReminder:send,ResultMail:p=><label>TEST wiederhergestellt<textarea value={p.body} disabled={p.busy} onChange={e=>p.onBody(e.target.value)}/></label>};
 const onClose=vi.fn();const old=render(<ComplaintDialog request={{complaintId:'TEST-complaint'}} ports={ports} onClose={onClose} onMessage={vi.fn()}/>);old.unmount();
 render(<ComplaintDialog request={kind==='result'?{complaintId:'TEST-complaint'}:{reminderOrderId:'TEST-rework'}} ports={ports} onClose={onClose} onMessage={vi.fn()}/>);
 const body=await screen.findByRole('textbox',{name:'TEST wiederhergestellt'});expect(body).toHaveValue(request.body);expect(body).toBeDisabled();
 expect(screen.queryByRole('button',{name:'Senden'})).toBeNull();expect(screen.queryByRole('button',{name:'Begleitschein senden'})).toBeNull();
 await screen.findByText('Die Mail an TEST Kunde ist rausgegangen. Der Vorgang wurde inzwischen geändert – lies ihn neu, die Mail steht im Verlauf.');
 expect(send).toHaveBeenCalledExactlyOnceWith(request);expect(ports.write).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
});
