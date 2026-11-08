import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {KrApp} from '@/ui/kr';
import {ConcernMenu} from '../ui/ConcernMenu';
import type {IntakeMessage} from '../messageContract';
afterEach(cleanup);
const base:IntakeMessage={id:'TEST-source',version:1,channel:'mail',direction:'rein',assignment:'hand',usage:'offen',senderName:'TEST Kunde',senderAddress:'synthetic@local.invalid',groupAddress:null,subject:'TEST Zusage',text:'TEST einverstanden',at:'2026-11-08T10:00:00Z',customerId:'TEST-customer',customerName:'TEST Kunde',customerType:'business',orderId:'TEST-quote',orderKind:'kv',orderNumber:'TEST-KV-1',orderStation:null,goods:null,concerns:['kv_annahme'],openConcerns:['kv_annahme'],discardReason:null,createdBy:'TEST-actor',fileIds:[]};
it('pending acceptance offers its actual domain action and cannot be completed as generic Info',()=>{
 const select=vi.fn(),info=vi.fn();render(<KrApp geraet="desktop"><ConcernMenu message={base} areas={['mails','geld','auftraege','kunden']} anchor={{x:20,y:20}} busy={false} error={null} onSelect={select} onInfo={info} onNoBusiness={vi.fn()} onClose={vi.fn()}/></KrApp>);
 expect(screen.queryByRole('button',{name:'Nur Info'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Zusage übernehmen · Ware erwartet'}));expect(select).toHaveBeenCalledWith(expect.objectContaining({concern:'kv_annahme'}));expect(info).not.toHaveBeenCalled();
});
it('ordinary notes retain the existing explicit Info action',()=>{
 const info=vi.fn();render(<KrApp geraet="desktop"><ConcernMenu message={{...base,orderId:null,orderKind:null,concerns:['rueckruf'],openConcerns:['rueckruf']}} areas={['mails']} anchor={{x:20,y:20}} busy={false} error={null} onSelect={vi.fn()} onInfo={info} onNoBusiness={vi.fn()} onClose={vi.fn()}/></KrApp>);
 fireEvent.click(screen.getByRole('button',{name:'Nur Info'}));expect(info).toHaveBeenCalledOnce();
});
