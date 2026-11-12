import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {V45_RULES} from '@/ui/v45.generated';
import {readV45QuoteCommand} from '../v45QuoteCommandRead';

it.each(V45_RULES.filter(row=>row.bereich==='kv'&&row.dann.hauptaktion!==null))('$id has an existing public command boundary',rule=>{
 const command=readV45QuoteCommand(rule.dann.hauptaktion!);
 expect(command).not.toBeNull();expect(command?.datei).toMatch(/^src\/app\/actions\//);expect(command?.funktion).toMatch(/Action$/);
});
it('keeps the documented lifecycle intentions distinct while using the one writer',()=>{
 expect(readV45QuoteCommand('quote.extend')).toMatchObject({funktion:'changeQuoteLifecycleAction',argumente:{action:'extend'}});
 expect(readV45QuoteCommand('quote.accept')).toMatchObject({funktion:'changeQuoteLifecycleAction',argumente:{action:'accept'}});
 expect(readV45QuoteCommand('quote.receive')).toMatchObject({funktion:'saveGoodsReceiptAction'});
 expect(readV45QuoteCommand('quote.return_goods')).toMatchObject({funktion:'recordQuoteGoodsReturnAction'});
 expect(readV45QuoteCommand('unbound.action')).toBeNull();
});

it('binds existing quote command inputs to the same persisted version without generating click keys',()=>{
 const context={quoteId:'TEST-quote',customerId:'TEST-customer',version:7,lifecycle:{edition:3}} as Parameters<typeof readV45QuoteCommand>[1];
 expect(readV45QuoteCommand('quote.send',context)?.argumente).toEqual({targetType:'CUSTOMER',targetId:'TEST-customer',attachment:{kind:'QUOTE',documentId:'TEST-quote'}});
 for(const action of ['accept','extend'])expect(readV45QuoteCommand('quote.'+action,context)?.argumente).toEqual({action,quoteId:'TEST-quote',expectedVersion:7,edition:3});
 for(const action of ['receive','return_goods'])expect(readV45QuoteCommand('quote.'+action,context)?.argumente).toEqual({quoteId:'TEST-quote',expectedQuoteVersion:7});
 for(const action of ['revise','convert'])expect(readV45QuoteCommand('quote.'+action,context)?.argumente).toEqual({quoteId:'TEST-quote',expectedVersion:7});
 expect(JSON.stringify(readV45QuoteCommand('quote.accept',context))).not.toContain('clientEventId');
});
