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

it.each(['shipping',null] as const)('does not turn the shared output station into delivery with mode %s',handoverMode=>{
 const facts=v45OrderFacts({...card,station:'abgeholt',handoverMode});
 expect(facts).not.toHaveProperty('closed');expect(facts).not.toHaveProperty('inTransit');expect(facts).not.toHaveProperty('returning');
 expect(readV45Rule('auftrag',facts)).toMatchObject({code:'SOURCE_INCOMPLETE'});
});

// PL06:21: explicitly synthetic domain-card boundaries, no writer/provider claim.
it.each([
 {name:'bound',station:'angenommen',allowed:true,source:true,main:true},
 {name:'missing source',station:'versendet',allowed:true,source:false,main:false},
 {name:'R15 capture absent',station:'angenommen',allowed:true,source:true,main:true},
 {name:'without right',station:'angenommen',allowed:false,source:true,main:false},
])('KORR S04 retains first look: $name',async scenario=>{
 const {readV45OrderRule}=await import('../v45OrderRead');
 const {getPermissionsForAreas}=await import('@/lib/auth/authorizationContract');
 const areas=scenario.allowed?['auftraege'] as const:[] as const;
 const auth={tenantId:'TEST-U2-table',userId:'11111111-1111-4111-8111-111111111111',displayName:'TEST',role:'werkstatt' as const,active:true as const,areas,permissions:getPermissionsForAreas(areas)};
 const result=readV45OrderRule(auth,{id:'TEST-order',version:3,customerId:'TEST-customer',orderNumber:'TEST-1',title:'TEST object',dueAt:null,station:scenario.station,handoverMode:scenario.source?'pickup':'shipping',items:[],operationalFacts:{rework:false,pricesMissing:false,complaint:false}});
 expect(result.code).toBe('OK');expect(result.erstblick.some(field=>field.key==='auftrag.lage')).toBe(true);
 expect(result.hauptaktion!==null,JSON.stringify(result)).toBe(scenario.main);
 if(scenario.main)expect(result.hauptaktion?.befehl.funktion).toBe('transitionWareneingangToGalvanikAction');
 else expect(result.datenluecken.length+result.gesperrt.length).toBeGreaterThan(0);
 if(scenario.name==='R15 capture absent')expect(result.datenluecken).toContain('workProblem');
});
