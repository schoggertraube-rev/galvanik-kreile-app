import {it,expect,vi} from 'vitest';
import type {QuoteReadback} from '@/modules/quotes/public';
vi.mock('server-only',()=>({}));
import {v45QuoteFacts,readV45QuoteRule} from '../v45QuoteRead';
import {readV45Rule} from '../v45RuleRead';

// Explicitly synthetic readback boundaries. The separate acceptance test obtains
// the same shape from real actions/Auth/DB and rereads after each command.
type QuoteFactsInput=Parameters<typeof v45QuoteFacts>[0];
const life:NonNullable<QuoteReadback['lifecycle']>={edition:2,stage:'versendet',sentEdition:2,sentAt:'2026-11-01T10:00:00Z',sentChannel:'druck',acceptedEdition:null,acceptedAt:null,acceptanceEvidence:null,conditional:null,goods:[],declinedAt:null,declineReason:null,followupAt:null,sourceItemId:null,sourceMessageId:null,specialRequests:null,deliveryWeeks:null};
const goods:NonNullable<typeof life.goods>=[{id:'TEST-goods',orderId:null,edition:2,location:'TEST Regal',blocked:true,version:1}];
const now=new Date('2026-11-11T09:00:00Z');
const base:QuoteFactsInput={linkedOrderId:null,validUntil:'2026-12-01',lifecycle:life};
const cases:Array<{rule:string;quote:QuoteFactsInput}>=[
 {rule:'kv.umgewandelt',quote:{...base,linkedOrderId:'TEST-order'}},
 {rule:'kv.abgesagt_mit_ware',quote:{...base,lifecycle:{...life,declinedAt:'2026-11-10T10:00:00Z',goods}}},
 {rule:'kv.abgesagt',quote:{...base,lifecycle:{...life,declinedAt:'2026-11-10T10:00:00Z'}}},
 {rule:'kv.abgelaufen',quote:{...base,validUntil:'2026-11-10'}},
 {rule:'kv.vorbehalt',quote:{...base,lifecycle:{...life,conditional:{edition:2,recordedAt:'2026-11-10T10:00:00Z',reason:'TEST Preisvorbehalt'}}}},
 {rule:'kv.waregesperrt',quote:{...base,lifecycle:{...life,goods}}},
 {rule:'kv.entwurf',quote:{...base,lifecycle:{...life,sentEdition:1}}},
 {rule:'kv.ware',quote:{...base,lifecycle:{...life,acceptedEdition:2,goods}}},
 {rule:'kv.zugesagt',quote:{...base,lifecycle:{...life,acceptedEdition:2}}},
 {rule:'kv.versendet',quote:base},
];
it.each(cases)('$rule follows canonical edition/goods evidence',({rule,quote})=>{
 expect(readV45Rule('kv',v45QuoteFacts(quote,now))).toMatchObject({code:'OK',ruleId:rule});
});
it('does not revive acceptance or a conditional promise from an older edition',()=>{
 expect(v45QuoteFacts({...base,lifecycle:{...life,acceptedEdition:1,conditional:{edition:1,recordedAt:'2026-11-01T10:00:00Z',reason:'TEST alter Vorbehalt'}}},now)).toMatchObject({accepted:false,conditional:false,sent:true});
 expect(v45QuoteFacts({...base,lifecycle:{...life,acceptedEdition:2,conditional:{edition:2,recordedAt:'2026-11-01T10:00:00Z',reason:'TEST aktueller Vorbehalt'}}},now)).toMatchObject({accepted:false,conditional:true});
});
it('keeps missing lifecycle or goods unknown rather than manufacturing an empty store',()=>{
 expect(readV45Rule('kv',v45QuoteFacts({...base,lifecycle:undefined},now))).toMatchObject({code:'SOURCE_INCOMPLETE'});
 expect(readV45Rule('kv',v45QuoteFacts({...base,lifecycle:{...life,goods:undefined}},now))).toMatchObject({code:'SOURCE_INCOMPLETE'});
 expect(readV45Rule('kv',v45QuoteFacts({...base,linkedOrderId:'TEST-order',lifecycle:undefined},now))).toMatchObject({code:'OK',ruleId:'kv.umgewandelt'});
});
it('PL09:00 keeps the current accepted promise valid after its acceptance deadline, never an older edition',()=>{
 const expired={...base,validUntil:'2026-11-10'};
 expect(readV45Rule('kv',v45QuoteFacts({...expired,lifecycle:{...life,acceptedEdition:2}},now))).toMatchObject({code:'OK',ruleId:'kv.zugesagt'});
 expect(readV45Rule('kv',v45QuoteFacts({...expired,lifecycle:{...life,acceptedEdition:1}},now))).toMatchObject({code:'OK',ruleId:'kv.abgelaufen'});
 expect(v45QuoteFacts({...expired,lifecycle:undefined},now)).not.toHaveProperty('expired');
});

it('retains source-bound first look and money filtering when synthetic lifecycle evidence is missing',()=>{
 const quote={quoteId:'TEST-incomplete',version:3,quoteNumber:'TEST-KV-3',linkedOrderId:null,validUntil:null,dueDate:null,termStatus:null,lifecycle:undefined,positions:[],totalNetCents:987654321} as unknown as QuoteReadback;
 const auth={userId:'TEST-actor',tenantId:'TEST-only',active:true,areas:['auftraege'],permissions:[],role:'werkstatt',displayName:'TEST'} as unknown as Parameters<typeof readV45QuoteRule>[0];
 for(const financial of [false,true]){
  const result=readV45QuoteRule(auth,quote,{financial,commandRights:{}});
  expect(result).toMatchObject({code:'OK',hauptaktion:null,source:{id:quote.quoteId,version:3,edition:null}});
  if(!('erstblick'in result)||!Array.isArray(result.erstblick))throw Error('TEST_FIRST_LOOK_REQUIRED');
  expect(result.erstblick.map(row=>row.key)).toEqual(['kv.lage','kv.teile','kv.termin',...[],'kv.hauptaktion']);
  expect(JSON.stringify(result).includes('987654321')).toBe(false);
 }
});
