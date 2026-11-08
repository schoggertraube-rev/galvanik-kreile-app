import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {QuoteGoodsDialog,type QuoteGoodsPorts} from '../QuoteGoodsDialog';
import type {QuoteReadback} from '@/modules/quotes/public';
const quote:QuoteReadback={quoteId:'TEST-quote',quoteNumber:'TEST-KV-1',customerId:'TEST-customer',customerNumber:null,customerDisplayName:'TEST Kunde',status:'converted',version:3,currency:'EUR',dueDate:'2026-12-01',validUntil:null,termStatus:null,intakeSource:null,note:null,totalNetCents:100,linkedOrderId:'TEST-order',actorId:'TEST-actor',actorDisplayName:'TEST Person',createdAt:'2026-11-08T10:00:00Z',updatedAt:'2026-11-08T10:00:00Z',convertedAt:'2026-11-08T10:00:00Z',positions:[{id:'TEST-part',position:1,name:'TEST Teil',quantity:1,material:null,surfaceRequested:'Verchromen',unitPriceCents:100,lineTotalCents:100}]};
beforeEach(()=>vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('a converted KV opens its exact order without an edit grant and offers no second goods capture',async()=>{
 const ports:QuoteGoodsPorts={read:vi.fn(async()=>({code:'OK' as const,quote,canEdit:false})),scope:async()=>({code:'OK',scope:'TEST-scope'}),capture:vi.fn(),device:vi.fn(),prepareFile:vi.fn(),finishFile:vi.fn(),original:vi.fn(),save:vi.fn(),convert:vi.fn()};
 const onOrder=vi.fn(),onClose=vi.fn();render(<QuoteGoodsDialog quoteId={quote.quoteId} ports={ports} onClose={onClose} onOriginal={vi.fn()} onCustomer={vi.fn()} onOrder={onOrder} onMessage={vi.fn()} onQuote={vi.fn()}/>);
 const open=await screen.findByRole('button',{name:'Auftrag öffnen'});expect(open).toBeEnabled();
 expect(screen.queryByRole('spinbutton')).toBeNull();expect(document.querySelector('input[type=file]')).toBeNull();
 fireEvent.click(open);expect(onOrder).toHaveBeenCalledWith('TEST-order');expect(onClose).toHaveBeenCalledOnce();expect(ports.convert).not.toHaveBeenCalled();expect(ports.save).not.toHaveBeenCalled();
});
