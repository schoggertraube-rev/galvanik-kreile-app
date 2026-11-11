import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {v45OrderFacts} from '../v45OrderRead';
import {readV45Rule} from '../v45RuleRead';
// Explicit synthetic boundaries of the real versioned card read contract.
const card={station:'galvanik',handoverMode:'pickup' as const,items:[]};
it('does not equate dispatched with delivered or invent a return receipt',()=>{
 const facts=v45OrderFacts({...card,station:'versendet',handoverMode:'shipping'});
 expect(facts).not.toHaveProperty('closed');expect(facts).not.toHaveProperty('inTransit');expect(facts).not.toHaveProperty('returning');
 expect(readV45Rule('auftrag',facts)).toMatchObject({code:'SOURCE_INCOMPLETE'});
});
it('projects the V45 physical pickup terminal fact without money or approval guesses',()=>{
 const facts=v45OrderFacts({...card,station:'abgeholt'});
 expect(facts).toMatchObject({closed:true,inTransit:false,returning:false,shipping:false,allDone:false});
 expect(readV45Rule('auftrag',facts)).toMatchObject({code:'OK',ruleId:'auftrag.abgeschlossen',hauptaktion:null});
 expect(facts).not.toHaveProperty('paymentReady');expect(facts).not.toHaveProperty('extraPending');expect(facts).not.toHaveProperty('photosMissing');
});
it('keeps a missing handover mode unknown and an empty item list unfinished',()=>{
 const facts=v45OrderFacts({...card,handoverMode:null});expect(facts).not.toHaveProperty('shipping');expect(facts.allDone).toBe(false);
});
