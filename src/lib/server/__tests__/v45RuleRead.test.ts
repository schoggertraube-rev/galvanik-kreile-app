import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readV45Rule} from '../v45RuleRead';
import {V45_RULES,V45_SOURCE_HASHES} from '@/ui/v45.generated';
// Explicitly synthetic complete rule facts; these are not a domain-data adapter.
function baseline(area:string):Record<string,unknown>{
 const facts=Object.fromEntries(V45_RULES.filter(rule=>rule.bereich===area).flatMap(rule=>Object.entries(rule.wenn).map(([key,value])=>[key,typeof value==='boolean'?false:typeof value==='number'?0:''])));
 // A synthetic completed prerequisite is necessary to reach later rule rows.
 return {...facts,...(area==='auftrag'?{invoiceIssued:true,noticeSent:true,paymentReady:true,labelReady:true,packPhoto:true}:area==='kv'?{sent:true}:{})};
}
describe('S04 single V45 rule reading seam',()=>{
 it.each(V45_RULES)('$id preserves state, action, colour and exact source binding',rule=>{
  const facts={...baseline(rule.bereich),...rule.wenn};
  expect(readV45Rule(rule.bereich,facts)).toMatchObject({code:'OK',ruleId:rule.id,...rule.dann,quelle:{rule:rule.id,sha256:V45_SOURCE_HASHES['regeln.json']}});
 });
 it('uses the actual V45 overlap order, never whichever state is convenient',()=>{
  expect(readV45Rule('auftrag',{...baseline('auftrag'),returning:true,closed:true,workProblem:true,complaint:true})).toMatchObject({code:'OK',ruleId:'auftrag.ruecklauf',hauptaktion:'shipping.return_receive'});
  expect(readV45Rule('kv',{...baseline('kv'),accepted:true,goods:true,sent:true})).toMatchObject({code:'OK',ruleId:'kv.ware',hauptaktion:'quote.convert'});
  expect(readV45Rule('kunde',{...baseline('kunde'),unsentInvoice:true,overdue:true,reminderNeeded:true})).toMatchObject({code:'OK',ruleId:'kunde.rechnung'});
 });
 it('does not turn missing higher-priority evidence into false or a calm customer',()=>{
  expect(readV45Rule('auftrag',{closed:true})).toMatchObject({code:'SOURCE_INCOMPLETE',ruleId:'auftrag.ruecklauf',missing:['returning']});
  expect(readV45Rule('kunde',{})).toMatchObject({code:'SOURCE_INCOMPLETE'});
  expect(readV45Rule('kunde',{...baseline('kunde'),overdue:undefined,reminderNeeded:true})).toMatchObject({code:'SOURCE_INCOMPLETE',ruleId:'kunde.ueberfaellig'});
  expect(readV45Rule('kunde',{...baseline('kunde'),overdue:null,reminderNeeded:true})).toMatchObject({code:'SOURCE_INCOMPLETE'});
  expect(readV45Rule('kunde',{...baseline('kunde'),overdue:'false',reminderNeeded:true})).toMatchObject({code:'SOURCE_INCOMPLETE'});
 });
 it('can skip an impossible conjunction without inventing its other missing fact',()=>{
  expect(readV45Rule('kunde',{...baseline('kunde'),emailMissing:false,hasAction:undefined})).toMatchObject({code:'OK',ruleId:'kunde.ruhig',hauptaktion:null});
  expect(readV45Rule('missing',{})).toEqual({code:'VALIDATION_ERROR'});
 });
});
