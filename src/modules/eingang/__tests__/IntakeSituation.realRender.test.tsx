import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IntakeSituation} from '../ui/IntakeSituation';
import type {IntakeCapture} from '../captureContract';
afterEach(cleanup);
const capture:IntakeCapture={id:'TEST-intake',version:1,text:'TEST unlesbarer Eingang',customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],files:[{id:'TEST-original',name:'TEST-Etikett.png',mime:'image/png',bytes:1,readable:true,secured:true,status:'fertig'}]};
function setup(value:IntakeCapture=capture){const onAssign=vi.fn(),onOrder=vi.fn();render(<IntakeSituation capture={value} kind="ware" busy={false} primary={null} onAssign={onAssign} onOriginal={vi.fn()} onOrder={onOrder} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()}/>);return{onAssign,onOrder};}
it('unknown goods ask for assignment and never invent an order action',()=>{const{onAssign,onOrder}=setup();expect(screen.getByRole('heading',{name:'Absender nicht erkannt'})).toBeVisible();expect(screen.queryByRole('button',{name:/Auftrag erfassen|Auftrag anlegen/})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Anderen Kunden oder Vorgang wählen'}));expect(onAssign).toHaveBeenCalledOnce();expect(onOrder).not.toHaveBeenCalled();expect(screen.queryByRole('textbox')).toBeNull();});
it('ambiguous goods show at most three real candidate IDs without choosing automatically',()=>{const expectedOrders=Array.from({length:4},(_,index)=>({id:'TEST-order-'+index,number:'TEST-A-'+index,customerId:'TEST-customer',customerName:'TEST Kunde',title:'TEST Teile',since:null}));const{onOrder}=setup({...capture,expectedOrders});expect(onOrder).not.toHaveBeenCalled();const group=screen.getByRole('group',{name:'Passende Vorgänge'});expect(group.querySelectorAll('button')).toHaveLength(3);fireEvent.click(screen.getByRole('button',{name:'TEST-A-1 · TEST Kunde · TEST Teile'}));expect(onOrder).toHaveBeenCalledWith('TEST-order-1');});

it('a real matching quote opens the same goods target and never creates or chooses another customer',()=>{
 const onQuote=vi.fn(),onOrder=vi.fn();
 render(<IntakeSituation capture={{...capture,customerId:'TEST-customer'}} kind="ware" busy={false} primary={null} onAssign={vi.fn()} onOriginal={vi.fn()} onOrder={onOrder} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()} quotes={[{id:'TEST-quote',number:'TEST-KV-1',customer:'TEST Kunde',accepted:true,edition:1,goodsHere:false,location:null}]} onQuote={onQuote}/>);
 expect(screen.getByRole('heading',{name:'Zusage übernommen – jetzt fehlt nur die Ware.'})).toBeVisible();
 expect(onQuote).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Paket kommt an'}));
 expect(onQuote).toHaveBeenCalledWith('TEST-quote');expect(onOrder).not.toHaveBeenCalled();
});
it('unidentified goods retain a task tied to the same capture rather than a guessed order',()=>{
 const task=vi.fn(),order=vi.fn();render(<IntakeSituation capture={capture} kind="ware" busy={false} primary={null} onAssign={vi.fn()} onOriginal={vi.fn()} onOrder={order} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()} onTask={task}/>);
 fireEvent.click(screen.getByRole('button',{name:'Ablegen · Absender klären'}));expect(task).toHaveBeenCalledOnce();expect(order).not.toHaveBeenCalled();
});
