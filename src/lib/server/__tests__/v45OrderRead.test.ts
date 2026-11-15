import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {v45OrderFacts,v45OrderSourceFacts,v45OrderReleaseFacts,readV45OrderRule} from '../v45OrderRead';
import {readV45Rule} from '../v45RuleRead';
// Explicit synthetic boundaries of the real versioned card read contract.
const card={station:'galvanik',handoverMode:'pickup' as const,items:[]};

// Deliberately synthetic port-result boundaries; actual source/writer proof is A5.
type Sources=NonNullable<Parameters<typeof v45OrderSourceFacts>[1]>;
const sourceCard={id:'TEST-order',version:3,handoverMode:'pickup' as const};
const knownSources={shipping:{code:'OK',orderId:'TEST-order',orderVersion:3,shippingCostMissing:false},
 payment:{code:'OK',data:{orderId:'TEST-order',orderVersion:3,creditApplication:{code:'OK',proposal:null}}},
 shipment:{code:'OK',data:{orderId:'TEST-order',orderVersion:3,shipments:[{status:'created',labelUrl:'TEST-secured-label'}]}}} as unknown as Sources;
it('KORR-S13-2 reads booleans from matching qualified port versions without projecting money',()=>{
 expect(v45OrderSourceFacts(sourceCard,knownSources)).toEqual({shippingCostMissing:false,creditApplicable:false,labelReady:true});
 expect(v45OrderSourceFacts(sourceCard,{...knownSources,shipping:{...knownSources.shipping,shippingCostMissing:true}} as Sources)).toMatchObject({shippingCostMissing:true});
});
it.each([
 {key:'shipping',fact:'shippingCostMissing'},
 {key:'payment',fact:'creditApplicable'},
 {key:'shipment',fact:'labelReady'},
] as const)('KORR-S13-2 unreadable or stale $key is unknown, never false',({key,fact})=>{
 const failed={...knownSources,[key]:{code:'SOURCE_INCOMPLETE'}} as unknown as Sources;
 expect(v45OrderSourceFacts(sourceCard,failed)).not.toHaveProperty(fact);
 expect(v45OrderSourceFacts({...sourceCard,version:4},knownSources)).not.toHaveProperty(fact);
});
it('KORR-S13-2 never turns a malformed captured credit proposal into applicable credit',()=>{
 const malformed={...knownSources,payment:{code:'OK',data:{orderId:'TEST-order',orderVersion:3,creditApplication:{code:'OK'}}}} as unknown as Sources;
 expect(v45OrderSourceFacts(sourceCard,malformed)).not.toHaveProperty('creditApplicable');
});
it('KORR-S13-2 overdue uses the versioned release source; absent or stale debt evidence is unknown',()=>{
 type Release=NonNullable<Parameters<typeof v45OrderReleaseFacts>[1]>;
 const source={orderId:sourceCard.id,value:{code:'OK',orderVersion:3,informed:null,overdueInvoiceIds:['TEST-invoice']}} as unknown as Release;
 expect(v45OrderReleaseFacts(sourceCard,source)).toMatchObject({overdue:true});
 expect(v45OrderReleaseFacts({...sourceCard,version:4},source)).not.toHaveProperty('overdue');
 expect(v45OrderReleaseFacts(sourceCard,{...source,value:{code:'UNAVAILABLE'}})).not.toHaveProperty('overdue');
});
it('KORR-S13-2 no money right exposes the canonical blocked action and preserves the first look',async()=>{
 const {getPermissionsForAreas}=await import('@/lib/auth/authorizationContract');
 const areas=['auftraege'] as const;
 const auth={tenantId:'TEST-source-right',userId:'11111111-1111-4111-8111-111111111111',displayName:'TEST',role:'werkstatt' as const,active:true as const,areas,permissions:getPermissionsForAreas(areas)};
 const result=readV45OrderRule(auth,{...card,...sourceCard,customerId:'TEST-customer',orderNumber:'TEST-1',title:'TEST object',dueAt:null,station:'fertig',operationalFacts:{rework:false,pricesMissing:false,complaint:false}});
 expect(result.hauptaktion).toBeNull();expect(result.gesperrt).toContainEqual({elementId:'shipping.cost',grundKey:'error.permission'});
 expect(result.datenluecken).toContain('shippingCostMissing');expect(result.erstblick.some(field=>field.key==='auftrag.lage')).toBe(true);
});
it('KORR-S13-1 retains absent collection names even when the next captured subsource is unknown',()=>{
 const auth={tenantId:'TEST-collection',userId:'11111111-1111-4111-8111-111111111111',displayName:'TEST',role:'werkstatt' as const,active:true as const,areas:[] as const,permissions:[]};
 const result=readV45OrderRule(auth,{...card,id:'TEST-order',version:3,customerId:'TEST-customer',orderNumber:'TEST-1',title:'TEST object',dueAt:null,station:'fertig',operationalFacts:{rework:false,pricesMissing:false,complaint:false}});
 expect(result.hauptaktion).toBeNull();
 expect(result.datenluecken).toEqual(expect.arrayContaining(['collectionPlanned','collectionPrepared','shippingCostMissing']));
 expect(result.erstblick.some(field=>field.key==='auftrag.lage')).toBe(true);
});
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
