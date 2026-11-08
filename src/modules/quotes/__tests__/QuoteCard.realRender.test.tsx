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
