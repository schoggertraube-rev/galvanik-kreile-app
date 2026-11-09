import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {IntakeSituation,IntakeResultHeader,IntakeResultOriginal} from '../ui/IntakeSituation';
import type {IntakeCapture} from '../captureContract';
afterEach(cleanup);
const capture:IntakeCapture={id:'TEST-intake',version:1,text:'TEST unlesbarer Eingang',customerId:null,orderId:null,assignment:'offen',usage:'offen',concerns:[],files:[{id:'TEST-original',name:'TEST-Etikett.png',mime:'image/png',bytes:1,readable:true,secured:true,status:'fertig'}]};
function setup(value:IntakeCapture=capture){const onAssign=vi.fn(),onOrder=vi.fn();render(<IntakeSituation capture={value} kind="ware" busy={false} primary={null} onAssign={onAssign} onOriginal={vi.fn()} onOrder={onOrder} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()}/>);return{onAssign,onOrder};}
it('unknown goods ask for assignment and never invent an order action',()=>{const{onAssign,onOrder}=setup();expect(screen.getByRole('heading',{name:'Ware'})).toBeVisible();expect(screen.queryByRole('button',{name:/Auftrag erfassen|Auftrag anlegen/})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Anderen Kunden oder Vorgang wählen'}));expect(onAssign).toHaveBeenCalledOnce();expect(onOrder).not.toHaveBeenCalled();expect(screen.queryByRole('textbox')).toBeNull();});
it('ambiguous goods show at most three real candidate IDs without choosing automatically',()=>{const expectedOrders=Array.from({length:4},(_,index)=>({id:'TEST-order-'+index,number:'TEST-A-'+index,customerId:'TEST-customer',customerName:'TEST Kunde',title:'TEST Teile',since:null}));const{onOrder}=setup({...capture,expectedOrders});expect(onOrder).not.toHaveBeenCalled();const group=screen.getByRole('group',{name:'Passende Vorgänge'});expect(group.querySelectorAll('button')).toHaveLength(3);fireEvent.click(screen.getByRole('button',{name:'TEST-A-1 · TEST Kunde · TEST Teile'}));expect(onOrder).toHaveBeenCalledWith('TEST-order-1');});

it('a real matching quote opens the same goods target and never creates or chooses another customer',()=>{
 const onQuote=vi.fn(),onOrder=vi.fn();
 render(<IntakeSituation capture={{...capture,customerId:'TEST-customer'}} kind="ware" busy={false} primary={null} onAssign={vi.fn()} onOriginal={vi.fn()} onOrder={onOrder} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()} quotes={[{id:'TEST-quote',number:'TEST-KV-1',customer:'TEST Kunde',accepted:true,edition:1,goodsHere:false,location:null}]} onQuote={onQuote}/>);
 expect(screen.getByRole('heading',{name:'TEST-KV-1 · TEST Kunde'})).toBeVisible();
 expect(screen.getByText('Zusage übernommen – jetzt fehlt nur die Ware.')).toBeVisible();expect(onQuote).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Paket kommt an'}));
 expect(onQuote).toHaveBeenCalledWith('TEST-quote');expect(onOrder).not.toHaveBeenCalled();
});
it('unidentified goods retain a task tied to the same capture rather than a guessed order',()=>{
 const task=vi.fn(),order=vi.fn();render(<IntakeSituation capture={capture} kind="ware" busy={false} primary={null} onAssign={vi.fn()} onOriginal={vi.fn()} onOrder={order} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()} onTask={task}/>);
 fireEvent.click(screen.getByRole('button',{name:'Ablegen · Absender klären'}));expect(task).toHaveBeenCalledOnce();expect(order).not.toHaveBeenCalled();
});

it('PE-04 offers history only as an explicit customer choice, retains the task fallback',()=>{
 const choose=vi.fn(),order=vi.fn();
 render(<IntakeSituation capture={{...capture,packageContext:{status:'OK',customers:[{customerId:'TEST-history-customer',customerName:'TEST historische Kundin',lastAt:'2026-11-08T10:00:00Z',source:'order'}],candidates:[],ambiguous:false,moreCandidates:false}}} kind="ware" busy={false} primary={null} onAssign={vi.fn()} onCustomerCandidate={choose} onOriginal={vi.fn()} onOrder={order} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()} onTask={vi.fn()}/>);
 expect(choose).not.toHaveBeenCalled();expect(order).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Ablegen · Absender klären'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'TEST historische Kundin · Kunde auswählen'}));expect(choose).toHaveBeenCalledExactlyOnceWith('TEST-history-customer');expect(order).not.toHaveBeenCalled();
});
it('PE context read error stays visible and never claims nothing is expected',()=>{
 render(<IntakeSituation capture={{...capture,packageContext:{status:'UNAVAILABLE',message:'TEST read unavailable'}}} kind="ware" busy={false} primary={null} onAssign={vi.fn()} onOriginal={vi.fn()} onOrder={vi.fn()} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('Erwartete Ware konnte nicht sicher gelesen werden');expect(screen.queryByText('Nichts angekündigt')).toBeNull();
});

it('E2 uses real facts without filling missing values and keeps the supplied action live',()=>{
 const action=vi.fn();render(<IntakeResultHeader title="TEST Rechnung" originalCount={0} original={null} presentation={{status:'missing',missing:['Aussteller'],waiting:null,facts:[{label:'Nummer',value:'TEST-RG-1'},{label:'Brutto',value:'0,00 €',emphasis:true},{label:'Aussteller',value:null}]}}><button onClick={action}>TEST ergänzen</button></IntakeResultHeader>);
 expect(screen.getByText('Fehlt noch: Aussteller')).toBeVisible();expect(screen.queryByText('Erledigt')).toBeNull();expect(screen.getByText('0,00 €').tagName).toBe('DD');expect(screen.getByText('Nummer').tagName).toBe('DT');expect(screen.queryByText('Aussteller',{exact:true})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'TEST ergänzen'}));expect(action).toHaveBeenCalledOnce();
});
it('E2 only shows completion when its existing reader supplied completion',()=>{
 render(<IntakeResultHeader title="TEST Auftrag" originalCount={0} original={null} presentation={{status:'done',missing:[],waiting:null,facts:[]}}/>);expect(screen.getByText('Erledigt')).toBeVisible();expect(screen.queryByText(/Fehlt noch/)).toBeNull();
});
it('E2 opens the first actual original and counts the remaining originals without guessing IDs',()=>{
 const open=vi.fn();render(<IntakeResultOriginal originals={[{id:'TEST-first',name:'TEST erstes Foto',mime:'image/png'},{id:'TEST-second',name:'TEST weitere Seite',mime:'image/png'}]} onOpen={open}/>);expect(screen.getByText('+1')).toBeVisible();expect(open).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Original ansehen · TEST erstes Foto'}));expect(open).toHaveBeenCalledExactlyOnceWith('TEST-first');
});

it('E2 excludes an unsecured upload from first-original selection and page count',()=>{
 const open=vi.fn();render(<IntakeSituation capture={{...capture,files:[{...capture.files[0],id:'TEST-pending',secured:false},...capture.files,{...capture.files[0],id:'TEST-next'}]}} kind="ware" busy={false} primary={null} onAssign={vi.fn()} onOriginal={open} onOrder={vi.fn()} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()}/>);expect(screen.getByText('+1')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Original ansehen · TEST-Etikett.png'}));expect(open).toHaveBeenCalledExactlyOnceWith('TEST-original');
});

it('E2 additional chips remain real controls and respect the existing busy guard',()=>{
 const choose=vi.fn(),blocked=vi.fn();render(<IntakeResultHeader title="TEST Zusatzangaben" originalCount={0} original={null} presentation={{status:'waiting',missing:[],waiting:'deine Bestätigung',facts:[]}} chips={[{id:'edit',label:'TEST Packstücke ändern',onSelect:choose},{id:'blocked',label:'TEST gesperrt',onSelect:blocked,disabled:true}]}/>);fireEvent.click(screen.getByRole('button',{name:'TEST Packstücke ändern'}));expect(choose).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'TEST gesperrt'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'TEST gesperrt'}));expect(blocked).not.toHaveBeenCalled();
});

it('E2 keeps existing recovery controls inside the one result and exposes the stored wording once',()=>{
 const retry=vi.fn(),task=vi.fn();const {container}=render(<IntakeSituation capture={{...capture,text:'TEST erhaltener Wortlaut'}} kind="notiz" busy={false} primary={null} onAssign={vi.fn()} onOriginal={vi.fn()} onOrder={vi.fn()} onMore={vi.fn()} onEdit={vi.fn()} onKind={vi.fn()} onTask={task} details={<section data-spec-id="TEST-recovery"><button onClick={retry}>TEST erneut übertragen</button></section>}/>);expect(container.querySelectorAll('[data-spec-id="rein.situation"]')).toHaveLength(1);expect(container.querySelector('[data-spec-id="rein.situation"] [data-spec-id="TEST-recovery"]')).not.toBeNull();expect(screen.getAllByText('TEST erhaltener Wortlaut')).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'TEST erneut übertragen'}));expect(retry).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'Aufgabe anlegen'}));expect(task).toHaveBeenCalledOnce();
});
