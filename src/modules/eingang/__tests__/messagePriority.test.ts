import {it,expect} from 'vitest';
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
