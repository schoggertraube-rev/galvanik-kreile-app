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
for(const suppressed of [false,true])it('automatic goods conversion follows real eligibility and persists reversal suppression '+suppressed,async()=>{
 const current={...quote,linkedOrderId:null,status:'draft' as const,lifecycle:{sentEdition:1,sentAt:'2026-11-08T09:00:00Z',sentChannel:'druck' as const,declinedAt:null,declineReason:null,followupAt:null,sourceItemId:null,sourceMessageId:null,specialRequests:null,deliveryWeeks:null,calculation:null,edition:1,stage:'zugesagt' as const,acceptedEdition:1,acceptedAt:'2026-11-08T10:00:00Z',acceptanceEvidence:'TEST ausdrueckliche Zusage',goods:[{id:'TEST-goods',orderId:null,edition:1,location:'TEST Regal',blocked:false,version:1}]}};
 const convert=vi.fn(async()=>({code:'OK' as const,quote,orderReceipt:{orderId:'TEST-order',orderNumber:'TEST-A-1'}}));
 const ports:QuoteGoodsPorts={read:vi.fn(async()=>({code:'OK' as const,quote:current,canOperate:true,canEdit:false,conversion:{handoverMode:'pickup' as const,paymentMode:'abholung' as const},undo:{ready:true,automaticSuppressed:suppressed}})),scope:async()=>({code:'OK',scope:'TEST-scope'}),capture:vi.fn(),device:vi.fn(),prepareFile:vi.fn(),finishFile:vi.fn(),original:vi.fn(),save:vi.fn(),convert};
 const onOrder=vi.fn();render(<QuoteGoodsDialog quoteId={quote.quoteId} ports={ports} onClose={vi.fn()} onOriginal={vi.fn()} onCustomer={vi.fn()} onOrder={onOrder} onMessage={vi.fn()} onQuote={vi.fn()}/>);
 if(suppressed){await screen.findByRole('button',{name:'Auftrag aus TEST-KV-1 anlegen'});expect(convert).not.toHaveBeenCalled();}else{await vi.waitFor(()=>expect(onOrder).toHaveBeenCalledWith('TEST-order'));expect(convert).toHaveBeenCalledOnce();}
});

it('AF6 converts all stored package receipts through the same port without requesting a new capture',async()=>{
 const current={...quote,status:'draft' as const,linkedOrderId:null,lifecycle:{edition:1,stage:'zugesagt' as const,sentEdition:1,sentAt:'2026-11-08T09:00:00Z',sentChannel:'druck' as const,acceptedEdition:1,acceptedAt:'2026-11-08T10:00:00Z',acceptanceEvidence:'TEST Zusage',calculation:null,declinedAt:null,declineReason:null,followupAt:null,sourceItemId:null,sourceMessageId:null,specialRequests:null,deliveryWeeks:null,goods:[{id:'TEST-goods-1',orderId:null,edition:1,location:'TEST Regal 1',blocked:false,version:1},{id:'TEST-goods-2',orderId:null,edition:1,location:'TEST Regal 2',blocked:false,version:1}]}};
 const convert=vi.fn(async()=>({code:'OK' as const,quote,orderReceipt:{orderId:'TEST-order',orderNumber:'TEST-A-1'}}));
 const ports:QuoteGoodsPorts={read:vi.fn(async()=>({code:'OK' as const,quote:current,canOperate:true,canReceive:false,conversion:{handoverMode:'pickup' as const,paymentMode:'abholung' as const},undo:{ready:true,automaticSuppressed:true}})),scope:async()=>({code:'OK',scope:'TEST-scope'}),capture:vi.fn(),device:vi.fn(),prepareFile:vi.fn(),finishFile:vi.fn(),original:vi.fn(),save:vi.fn(),convert};
 render(<QuoteGoodsDialog quoteId={quote.quoteId} ports={ports} onClose={vi.fn()} onOriginal={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()} onMessage={vi.fn()} onQuote={vi.fn()}/>);
 expect(await screen.findByText('Ware liegt in TEST Regal 1')).toBeVisible();expect(screen.getByText('Ware liegt in TEST Regal 2')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Auftrag aus TEST-KV-1 anlegen'}));
 await vi.waitFor(()=>expect(convert).toHaveBeenCalledOnce());expect(convert.mock.calls[0]).toEqual([expect.objectContaining({goodsReceiptId:'TEST-goods-1'}),undefined,undefined]);
 expect(ports.save).not.toHaveBeenCalled();expect(ports.capture).not.toHaveBeenCalled();expect(document.querySelector('input[type=file]')).toBeNull();
});


it('PE condition photo stays in the single existing content camera after the required original is present',async()=>{
 const current={...quote,status:'draft' as const,linkedOrderId:null};
 const source={id:'TEST-source',version:1,text:null,customerId:quote.customerId,orderId:null,assignment:'hand',usage:'offen',concerns:['ware'],files:[{id:'TEST-content',name:'TEST Inhalt.jpg',mime:'image/jpeg',bytes:32,readable:true,status:'fertig',secured:true}]};
 const ports:QuoteGoodsPorts={read:vi.fn(async()=>({code:'OK' as const,quote:current,canEdit:true})),scope:async()=>({code:'OK',scope:'TEST-scope'}),capture:vi.fn(async()=>({code:'OK' as const,capture:source})),device:vi.fn(),prepareFile:vi.fn(),finishFile:vi.fn(),original:vi.fn(async()=>({code:'UNAVAILABLE' as const,message:'TEST no external preview'})),save:vi.fn(),convert:vi.fn()};
 render(<QuoteGoodsDialog quoteId={quote.quoteId} sourceId={source.id} ports={ports} onClose={vi.fn()} onOriginal={vi.fn()} onCustomer={vi.fn()} onOrder={vi.fn()} onMessage={vi.fn()} onQuote={vi.fn()}/>);
 const role=await screen.findByRole('button',{name:'TEST Inhalt.jpg · Inhaltsfoto'});expect(screen.queryByText('Zusätzliches Zustandsfoto · optional')).toBeNull();
 fireEvent.click(role);
 expect(await screen.findByText('Zusätzliches Zustandsfoto · optional')).toBeVisible();
 expect(screen.getAllByText('Ware fotografieren · Zustand bei Annahme')).toHaveLength(1);
 expect(document.querySelectorAll('input[type=file][capture=environment]')).toHaveLength(2);
 expect(ports.save).not.toHaveBeenCalled();expect(ports.convert).not.toHaveBeenCalled();
});
