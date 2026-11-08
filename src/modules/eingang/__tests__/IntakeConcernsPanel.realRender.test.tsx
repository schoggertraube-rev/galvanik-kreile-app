import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
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
