import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
import {ComplaintDialog} from '../ui/ComplaintDialog';
import {ComplaintDialogs} from '../ui/ComplaintDialogs';
import type {ComplaintDialogData,ComplaintPorts} from '../dialogContract';

const base:ComplaintDialogData={complaint:null,source:{id:'test-order',number:'A-TEST-4C',customerName:'TEST Kunde',items:[{id:'test-part',name:'TEST Gehäuse',quantity:3,unit:'Stück'}]},initial:{description:'',defect:'',photoIds:[],intakeItemId:null,intakeVersion:null},suggestedDate:'2027-05-18',rework:null};
function setup(data=base,areas:ComplaintPorts['areas']=['auftraege','entscheiden','geld','kunden']) {
  const ports:ComplaintPorts={areas,read:vi.fn<ComplaintPorts['read']>(async()=>({code:'OK',data})),write:vi.fn<ComplaintPorts['write']>(async()=>({code:'OK',receipt:{complaintId:'test-complaint',number:'RK-TEST-4C',state:'aufgenommen',version:1,eventId:'test-event'},replayed:false})),rework:vi.fn<ComplaintPorts['rework']>(async()=>({code:'OK',receipt:{orderId:'test-rework'}})),openOrder:vi.fn(),openPhoto:vi.fn(async()=>undefined),addPhoto:vi.fn<ComplaintPorts['addPhoto']>(async()=>({code:'OK',id:'test-photo'})),sendResult:vi.fn<ComplaintPorts['sendResult']>(async()=>({code:'UNAVAILABLE',message:'TEST Offline'}))};
  const onClose=vi.fn(),onMessage=vi.fn();
  render(<ComplaintDialog request={data.complaint?{complaintId:data.complaint.id}:{orderId:data.source.id}} ports={ports} onClose={onClose} onMessage={onMessage}/>);
  return {ports,onClose,onMessage};
}
beforeEach(()=>{vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('4.8 real component interactions (isolated TEST ports; server effects have Replay tests)',()=>{
  it('keeps missing fields on screen and sends nothing; delivered quantity is the editable initial quantity',async()=>{
    const {ports}=setup();
    const save=await screen.findByRole('button',{name:'Reklamation aufnehmen'});
    fireEvent.click(save);
    expect(await screen.findByText('Noch offen: Betroffene Teile, Mangel')).toBeInTheDocument();
    expect(ports.write).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
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
    fireEvent.click(screen.getByRole('checkbox'));
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
    expect(await screen.findByText(/Speicherergebnis unklar · alle Eingaben sind noch da · TEST Offline/)).toBeInTheDocument();
    const first=vi.mocked(ports.write).mock.calls[0][0];
    expect(screen.getByRole('spinbutton')).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button',{name:'Erneut'})[0]);
    await waitFor(()=>expect(ports.write).toHaveBeenCalledTimes(2));
    expect(vi.mocked(ports.write).mock.calls[1][0]).toEqual(first);
    expect(onClose).not.toHaveBeenCalled();expect(screen.getByRole('spinbutton')).toHaveValue(3);
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
 window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'reklamation',arg:'test-customer#kundenwahl'},cancelable:true}));
 expect(await screen.findByText('TEST Lesen unterbrochen')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Erneut'}));
 const choice=await screen.findByRole('button',{name:/A-TEST-4C.*TEST Gehäuse/});
 expect(ports.write).not.toHaveBeenCalled();
 fireEvent.click(choice);
 expect(await screen.findByRole('button',{name:'Reklamation aufnehmen'})).toBeInTheDocument();
 expect(ports.read).toHaveBeenCalledWith({orderId:'test-order'});
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
 expect(await screen.findByText(/TEST network unclear/)).toBeInTheDocument();expect(body).toHaveValue('TEST eigene Nachricht');expect(body).toBeDisabled();
 const original=send.mock.calls[0][0];expect(original).toMatchObject({complaintId:'TEST-complaint',orderId:'TEST-rework',version:2,body:'TEST eigene Nachricht'});
 fireEvent.click(screen.getAllByRole('button',{name:'Erneut'})[0]);
 expect(await screen.findByText('Begleitschein gesendet · Erinnerung ruht für 5 Arbeitstage')).toBeInTheDocument();
 expect(send.mock.calls[1][0]).toEqual(original);expect(ports.write).not.toHaveBeenCalled();expect(ports.sendResult).not.toHaveBeenCalled();expect(refreshed).toHaveBeenCalledTimes(1);
});
