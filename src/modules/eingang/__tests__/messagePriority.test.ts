import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {readFallbackMessagePriority} from '../messageContract';
// Synthetic boundaries of the canonical stored message projection.
const base={id:'TEST-message',version:4,sendState:null,usage:'offen',discardReason:null,openConcerns:[],assignment:'kunde',customerId:'TEST-customer',direction:'rein'} satisfies Parameters<typeof readFallbackMessagePriority>[0];
it.each([{rank:1,row:{sendState:'unklar' as const,openConcerns:['kv_annahme','reklamation']}},{rank:2,row:{openConcerns:['kv_ablehnung','reklamation','ware']}},{rank:3,row:{openConcerns:['reklamation','abholung','ware']}},{rank:4,row:{openConcerns:['abholung','ware']}},{rank:5,row:{openConcerns:['ware'],assignment:'offen',customerId:null}},{rank:6,row:{assignment:'offen',customerId:null}},{rank:8,row:{usage:'erledigt',sendState:'unklar' as const}},{rank:8,row:{openConcerns:[]}}])('keeps PL fallback rank $rank and its actual source version',({rank,row})=>{
 expect(readFallbackMessagePriority({...base,...row})).toEqual({code:'OK',rank,source:{kind:'intake',id:base.id,version:4}});
});
it('does not turn a production deadline into a pickup confirmation',()=>expect(readFallbackMessagePriority({...base,openConcerns:['termin']})).toMatchObject({code:'OK',rank:8}));
it('does not fabricate an overdue outgoing question or an absent dispatch receipt',()=>{
 expect(readFallbackMessagePriority({...base,direction:'raus'})).toMatchObject({code:'SOURCE_INCOMPLETE',missing:['QUESTION_REPLY_HISTORY']});
 expect(readFallbackMessagePriority({...base,sendState:undefined,openConcerns:['ware']})).toMatchObject({code:'SOURCE_INCOMPLETE',missing:['DISPATCH_STATE']});
});


it('keeps unknown stored classifications incomplete instead of calling them calm',()=>expect(readFallbackMessagePriority({...base,openConcerns:['TEST-unknown']})).toMatchObject({code:'SOURCE_INCOMPLETE',missing:['MESSAGE_CLASSIFICATION']}));

it('R13 keeps a known higher-priority concern actionable even when outgoing reply history is missing',()=>{
 expect(readFallbackMessagePriority({...base,direction:'raus',openConcerns:['kv_annahme']})).toMatchObject({code:'OK',rank:2});
});

// PL06:21: synthetic missing-source boundaries; these do not simulate a product mail.
it.each([2,3,6] as const)('KORR S04 rank %s retains message first look when its source is missing',async rank=>{
 const {readMessageNextAction}=await import('../server/messageNextAction');
 const {getPermissionsForAreas}=await import('@/lib/auth/authorizationContract');
 const row={id:'TEST-missing-message',version:2,channel:'email',direction:'rein',assignment:'offen',usage:'offen',senderName:'TEST sender',senderAddress:'test@example.invalid',groupAddress:null,subject:'TEST original',text:'TEST content',at:'2026-11-12T01:00:00Z',customerId:null,customerName:null,customerType:null,orderId:null,orderKind:null,orderNumber:null,orderStation:null,goods:null,concerns:[],openConcerns:[],discardReason:null,createdBy:'TEST actor',fileIds:[],files:[]};
 const areas=['mails','eingang','kunden'] as const;
 const auth={tenantId:'TEST-U2-table',userId:'11111111-1111-4111-8111-111111111111',displayName:'TEST',role:'meister' as const,active:true as const,areas,permissions:getPermissionsForAreas(areas)};
 const source={kind:'intake' as const,id:row.id,version:row.version};
 const priority=rank===6?{code:'SOURCE_INCOMPLETE' as const,missing:['TEST_ASSIGNMENT_SOURCE'],source}:{code:'OK' as const,rank,source};
 const result=readMessageNextAction(auth,row,priority);
 expect(result.code).toBe('OK');expect(result.hauptaktion).toBeNull();expect(result.weitere).toBeNull();
 expect(result.erstblick.find(field=>field.key==='nachrichten.inhalt')?.werte.betreff).toBe('TEST original');
 expect(result.datenluecken.length).toBeGreaterThan(0);
});
