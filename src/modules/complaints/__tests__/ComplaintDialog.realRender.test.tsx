import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
import {ComplaintDialog} from '../ui/ComplaintDialog';
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
    expect(await screen.findByText(/Nicht gespeichert · alle Eingaben sind noch da · TEST Offline/)).toBeInTheDocument();
    const first=vi.mocked(ports.write).mock.calls[0][0];
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
