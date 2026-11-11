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
