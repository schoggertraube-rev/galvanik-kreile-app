// @vitest-environment node
// E-B1a: complete existing reader kernels, isolated TEST data and actual
// Actions/Auth/DB/Storage. No read-model schema, worker or fabricated identity.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi,expectTypeOf} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization,authorizationReadContext,type AuthorizationSnapshot,type AuthorizedReadContext} from '@/lib/server/authorization';
import {readTodayOrderCards} from '@/lib/server/orderCardRead';
import {getOperationalOrders} from '@/lib/server/operationalOrders';
import {readOrderEvidenceBatch} from '@/lib/server/evidenceRead';
import {quoteCommandContext,quoteReadContext} from '@/lib/server/quoteAuthorization';
import {todaySourceAccess} from '@/lib/server/todayDashboard';
import {createQuoteAction} from '@/app/actions/quotes.actions';
import {readQuoteCommand,listOpenQuotesCommand,readQuoteActors,type QuoteCommandContext} from '@/modules/quotes/server-public';
let prepared:Awaited<ReturnType<typeof readyInvoiceOrder>>;
let quoteId:string,quoteVersion:number;
beforeAll(async()=>{
 prepared=await readyInvoiceOrder('TEST complete readonly kernels');
 const result=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:prepared.customerId,dueDate:'2027-05-15',validUntil:'2027-05-31',note:'TEST kernel original',positions:[{name:'TEST kernel part',quantity:2,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:12345,lineTotalCents:24690}]}));
 if(result.code!=='OK')throw Error('TEST_KERNEL_QUOTE_REQUIRED:'+result.code);
 quoteId=result.quote.quoteId;quoteVersion=result.quote.version;
});
const profiles:Array<{name:string;rights:string[]|null;role:'meister'|'werkstatt'}>=[
 {name:'all canonical areas',rights:null,role:'meister'},
 {name:'orders without prices',rights:['auftraege'],role:'werkstatt'},
 {name:'prices without orders',rights:['preise'],role:'meister'},
 {name:'mail without money',rights:['mails'],role:'meister'},
];
it.each(profiles)('keeps session/projector callbacks equal for $name and cannot become a command identity',async profile=>{
 expectTypeOf<AuthorizedReadContext>().not.toExtend<AuthorizationSnapshot>();
 expectTypeOf<ReturnType<typeof quoteReadContext>>().not.toExtend<QuoteCommandContext>();
 const fixture=profile.rights===null?full:await createFixture(profile.rights,profile.role);
 const resolved=await withSession(fixture,()=>resolveAuthorization());if(!resolved.ok)throw Error('TEST_KERNEL_AUTH_REQUIRED');
 const auth=resolved.data,session=authorizationReadContext(auth);
 const areas=auth.areas;if(!Array.isArray(areas))throw Error('TEST_NORMALIZED_AREA_SOURCE_REQUIRED');
 // The projector callback uses only the actual already role-normalized areas.
 const projection:AuthorizedReadContext={tenantId:auth.tenantId,permissions:auth.permissions,canReadArea:area=>areas.includes(area)};
 expect(projection).not.toHaveProperty('userId');expect(projection).not.toHaveProperty('role');expect(projection).not.toHaveProperty('active');
 expect(todaySourceAccess(projection)).toEqual(todaySourceAccess(session));
 const command=quoteCommandContext(auth),read=quoteReadContext(projection);
 expect(read).toEqual(quoteReadContext(session));expect(read.capabilities.canReadQuote).toBe(command.capabilities.canReadQuote);
 const before=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 expect(await getOperationalOrders(projection,{purpose:'today'})).toEqual(await getOperationalOrders(auth,{purpose:'today'}));
 const expectedCards=await readTodayOrderCards(auth,[prepared.orderId]),cards=await readTodayOrderCards(projection,[prepared.orderId]);
 expect(cards).toEqual(expectedCards);
 const expectedProof=await readOrderEvidenceBatch(auth,[prepared.orderId]),proof=await readOrderEvidenceBatch(projection,[prepared.orderId]);
 expect(proof).toEqual(expectedProof);
 const input={quoteId},actorInput={quoteId,version:quoteVersion};
 expect(await readQuoteCommand(read,input)).toEqual(await readQuoteCommand(command,input));
 expect(await listOpenQuotesCommand(read,prepared.customerId)).toEqual(await listOpenQuotesCommand(command,prepared.customerId));
 expect(await readQuoteActors(read,actorInput)).toEqual(await readQuoteActors(command,actorInput));
 expect((await readTodayOrderCards({...projection,permissions:[]},[prepared.orderId])).get(prepared.orderId)).toMatchObject({code:'FORBIDDEN'});
 expect((await readOrderEvidenceBatch({...projection,permissions:[]},[prepared.orderId])).get(prepared.orderId)).toMatchObject({code:'FORBIDDEN'});
 if(profile.rights===null){
  const card=cards.get(prepared.orderId),evidence=proof.get(prepared.orderId);
  expect(card?.code).toBe('OK');expect(evidence?.code).toBe('OK');
  if(evidence?.code!=='OK')throw Error('TEST_REAL_PHOTO_SOURCE_REQUIRED');
  expect(evidence.data.some(row=>row.source==='ORDER_STATION_ATTACHMENT'&&row.original.state==='VERIFIED'&&row.original.hashAlgorithm==='SHA256')).toBe(true);
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(before);
});
