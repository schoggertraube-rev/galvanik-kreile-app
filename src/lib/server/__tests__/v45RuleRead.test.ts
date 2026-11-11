import {describe,it,expect,vi} from 'vitest';
import {ROLE_ACCESS_AREA_TEMPLATES,getPermissionsForAreas,hasAuthorizationArea,type AppRole} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from '../authorization';
vi.mock('server-only',()=>({}));
import {readV45Rule,readAuthorizedV45Rule} from '../v45RuleRead';
import {V45_RULES,V45_SOURCE_HASHES,V45_ELEMENTS} from '@/ui/v45.generated';
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

describe('S04 canonical authorization across every imported rule',()=>{
 const roles=Object.keys(ROLE_ACCESS_AREA_TEMPLATES) as AppRole[];
 const snapshot=(role:AppRole):AuthorizationSnapshot=>({userId:'11111111-1111-4111-8111-111111111111',tenantId:'TEST-rule-only',role,displayName:'TEST rule-only',active:true,areas:ROLE_ACCESS_AREA_TEMPLATES[role],permissions:getPermissionsForAreas(ROLE_ACCESS_AREA_TEMPLATES[role])});
 it.each(V45_RULES.flatMap(rule=>roles.map(role=>({rule,role}))))('$rule.id x $role preserves the state but shows no unauthorized primary action',({rule,role})=>{
  const auth=snapshot(role),result=readAuthorizedV45Rule(auth,rule.bereich,{...baseline(rule.bereich),...rule.wenn,TEST_private_amount_cents:987654321});
  expect(result.code).toBe('OK');
  if(result.code!=='OK')throw Error('TEST_RULE_READ_REQUIRED');
  const action=V45_ELEMENTS.find(row=>row.id===rule.dann.hauptaktion);
  const permitted=!action||action.recht===null||action.recht==='status'&&auth.permissions.includes('perm_op_status')||action.recht!=='status'&&hasAuthorizationArea(auth,action.recht as Parameters<typeof hasAuthorizationArea>[1]);
  expect(result.zustand).toBe(rule.dann.zustand);expect(result.hauptaktion).toBe(permitted?rule.dann.hauptaktion:null);
  expect(result.gesperrt).toEqual(permitted?[]:[{elementId:rule.dann.hauptaktion,grundKey:'error.permission'}]);
  expect(JSON.stringify(result)).not.toContain('987654321');
 });
 it('never turns an inactive login or incomplete source into an action grant',()=>{
  expect(readAuthorizedV45Rule({...snapshot('meister'),active:false} as unknown as AuthorizationSnapshot,'auftrag',{})).toEqual({code:'FORBIDDEN'});
  expect(readAuthorizedV45Rule(snapshot('meister'),'auftrag',{})).toMatchObject({code:'SOURCE_INCOMPLETE'});
 });
});
