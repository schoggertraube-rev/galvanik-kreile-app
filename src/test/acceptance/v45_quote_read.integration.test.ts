// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {v45QuoteFacts} from '@/lib/server/v45QuoteRead';
import {createQuoteAction,changeQuoteLifecycleAction,readQuoteAction} from '@/app/actions/quotes.actions';

it('reads actual KV editions after commands, retains unknown evidence and exposes no prices to an operational login',async()=>{
 const customerId=await customerFixture('V45 KV Regeln');
 const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',validUntil:'2027-05-31',note:'TEST V45 Quelle',positions:[{name:'TEST V45 Teil',quantity:2,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:12345,lineTotalCents:24690}]}));
 if(created.code!=='OK')throw Error('TEST_QUOTE_CREATE:'+created.code);
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_AUTH');
 const input={quoteId:created.quote.quoteId};
 const readRule=async(fixture=full)=>{const read=await withSession(fixture,()=>readQuoteAction({...input,purpose:'operations'}));if(read.code!=='OK')throw Error('TEST_CANONICAL_QUOTE_READ:'+read.code);return read.nextActionRule;};
 expect(await readRule()).toMatchObject({code:'OK',ruleId:'kv.entwurf',source:{id:input.quoteId,version:1,edition:1}});
 const first=await readRule();if(first.code!=='OK')throw Error('TEST_FIRST_LOOK');
 expect(first.erstblick.map(row=>row.key)).toEqual(['kv.lage','kv.teile','kv.termin','kv.kalkulation','kv.hauptaktion']);
 expect(first.erstblick.find(row=>row.key==='kv.kalkulation')?.werte).toEqual({nettoCents:24690});
 expect(first.erstblick.find(row=>row.key==='kv.teile')?.werte).toMatchObject({teile:[{name:'TEST V45 Teil',menge:2}]});
 const sent={...input,expectedVersion:1,edition:1,clientEventId:randomUUID(),action:'sent' as const,channel:'druck' as const,evidence:'TEST wirklich ausgehaendigt'};
 expect(await withSession(full,()=>changeQuoteLifecycleAction(sent))).toMatchObject({code:'OK'});
 expect(await readRule()).toMatchObject({code:'OK',ruleId:'kv.versendet',source:{version:2}});
 expect(await withSession(full,()=>changeQuoteLifecycleAction(JSON.parse(JSON.stringify(sent))))).toMatchObject({code:'OK',replayed:true});
 expect(await readRule()).toMatchObject({code:'OK',ruleId:'kv.versendet',source:{version:2}});
 const accepted=await withSession(full,()=>changeQuoteLifecycleAction({...input,expectedVersion:2,edition:1,clientEventId:randomUUID(),action:'accept',evidence:'TEST aktuelle Fassung zugesagt'}));
 expect(accepted).toMatchObject({code:'OK'});
 expect(await readRule()).toMatchObject({code:'OK',ruleId:'kv.zugesagt',source:{version:3}});
 const operator=await createFixture(['auftraege'],'werkstatt'),operationalAuth=await withSession(operator,()=>resolveAuthorization());if(!operationalAuth.ok)throw Error('TEST_OPERATOR_AUTH');
 const operational=await readRule(operator);
 expect(operational).toMatchObject({code:'OK',ruleId:'kv.zugesagt'});
 if(operational.code!=='OK')throw Error('TEST_OPERATIONAL_FIRST_LOOK');
 expect(operational.erstblick.map(row=>row.key)).toEqual(['kv.lage','kv.teile','kv.termin','kv.hauptaktion']);
 const serialized=JSON.stringify(operational);for(const forbidden of ['12345','24690','totalNetCents','unitPriceCents','positions','TEST V45 Quelle'])expect(serialized).not.toContain(forbidden);
 const reread=await withSession(full,()=>readQuoteAction(input));if(reread.code!=='OK')throw Error('TEST_QUOTE_READ');
 expect(v45QuoteFacts({...reread.quote,lifecycle:undefined})).not.toHaveProperty('sent');
 expect(v45QuoteFacts({...reread.quote,lifecycle:{...reread.quote.lifecycle!,goods:undefined}})).not.toHaveProperty('goods');
 expect(v45QuoteFacts(reread.quote,new Date('2027-05-31T22:30:00Z'))).toMatchObject({accepted:true,expired:false});
 // Explicit synthetic unaccepted boundary; the stored accepted promise stays unchanged.
 expect(v45QuoteFacts({...reread.quote,lifecycle:{...reread.quote.lifecycle!,acceptedEdition:null,acceptedAt:null,acceptanceEvidence:null}},new Date('2027-05-31T22:30:00Z'))).toMatchObject({expired:true});
 expect(v45QuoteFacts(reread.quote,new Date('2027-05-31T21:30:00Z'))).toMatchObject({expired:false});
});
