import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {v45CustomerFacts} from '../v45CustomerRead';
import {readV45Rule} from '../v45RuleRead';
// Explicit synthetic boundaries of the actual summary/profile projection.
const customer={email:'TEST@example.invalid',billingEmail:null,invoiceUnsentCount:1};
it('selects the invoice from the existing count and never returns its amounts',()=>{
 const facts=v45CustomerFacts(customer,true,0);
 expect(readV45Rule('kunde',facts)).toMatchObject({code:'OK',ruleId:'kunde.rechnung'});
 expect(facts).toEqual({unsentInvoice:true,overdue:false,hasAction:true,emailMissing:false});
});
it('uses billing email only for proven financial work',()=>{
 expect(v45CustomerFacts({...customer,email:null,billingEmail:'TEST-billing@example.invalid'},true,0)).toMatchObject({emailMissing:false,hasAction:true});
 expect(v45CustomerFacts({...customer,email:null,billingEmail:'TEST-billing@example.invalid',invoiceUnsentCount:0},true,0)).toMatchObject({emailMissing:true});
 expect(readV45Rule('kunde',v45CustomerFacts({...customer,email:null},true,0))).toMatchObject({code:'OK',ruleId:'kunde.mailfehlt'});
});
it('never derives hidden financial facts without geld or calls absent reminder facts calm',()=>{
 const hidden=v45CustomerFacts(customer,false,9);expect(hidden).not.toHaveProperty('unsentInvoice');expect(hidden).not.toHaveProperty('overdue');expect(hidden).not.toHaveProperty('hasAction');
 expect(readV45Rule('kunde',hidden)).toMatchObject({code:'SOURCE_INCOMPLETE'});
 const sent=v45CustomerFacts({...customer,invoiceUnsentCount:0},true,0);
 expect(sent).not.toHaveProperty('hasAction');expect(sent).not.toHaveProperty('followupMissing');expect(sent).not.toHaveProperty('dunningDue');
 expect(readV45Rule('kunde',sent)).toMatchObject({code:'SOURCE_INCOMPLETE'});
});
it('keeps malformed or absent counts unknown',()=>{
 const facts=v45CustomerFacts({...customer,invoiceUnsentCount:Number.NaN},true,-1);
 expect(facts).toEqual({emailMissing:false});
});
