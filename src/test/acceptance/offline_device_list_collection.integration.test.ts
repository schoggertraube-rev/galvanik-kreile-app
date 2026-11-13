// @vitest-environment node
// Real canonical Actions/Auth/DB. Synthetic generation1 is collection input,
// not a persisted device stand or a browser/24h proof.
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {full,withRequest,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../e2e/ablauf/orderFixture';
import {getOrdersDb,getLiveOrderCardAction,transitionWareneingangToGalvanikAction} from '@/app/actions/orders.actions';
import {getCustomersDb,getCustomerSummaryAction} from '@/app/actions/customers.actions';
import {COOKIE_NAME,getSecretKey,signAppSession} from '@/lib/server/appSession';
import {offlinePartition} from '@/lib/server/offlinePartition';
import {createQuoteAction,listOpenQuotesAction,readQuoteAction} from '@/app/actions/quotes.actions';
import {getIntakeMessagesAction} from '@/app/actions/eingang.actions';
import {getTodayDeviceAction} from '@/app/actions/today.actions';
import {collectDeviceStand} from '@/lib/offline/collectDeviceStand';
import {collectDeviceMessages} from '@/lib/offline/refreshDeviceMessages';
import {collectDeviceQuotes} from '@/lib/offline/refreshDeviceQuotes';
import {collectDeviceOrders,collectDeviceCustomers} from '@/lib/offline/collectDeviceLists';
if(!process.env.DATABASE_URL||process.env.DATABASE_URL!==process.env.H18_EXPECTED_DATABASE_URL||!['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname)||new URL(process.env.DATABASE_URL).pathname!=='/postgres'||!tenant.startsWith('TEST-'))throw Error('TEST_OWN_LOOPBACK_REQUIRED');
it('S06 collects actual list and matching card sources and preserves canonical denial',async()=>{
 const cookie=signAppSession({userId:full.actorId,tenantId:KREILE_TENANT_SLUG,role:full.role,displayName:'TEST collection actor',issuedAt:full.actorIssuedAt,expiresAt:Date.now()+5*60_000},getSecretKey());
 const request=<T>(work:()=>Promise<T>)=>withRequest(`${COOKIE_NAME}=${cookie}`,work);
 const source=await request(getOrdersDb);if(!source.ok||!source.cacheLoginScope)throw Error('TEST_LIST_AUTH');
 const scope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:full.actorId}),fence={scope,loginScope:source.cacheLoginScope,generation:1};
 const orders={list:()=>request(getOrdersDb),read:(id:string)=>request(()=>getLiveOrderCardAction({orderId:id})),currentScope:()=>scope};
 const customers={list:()=>request(getCustomersDb),read:(id:string)=>request(()=>getCustomerSummaryAction({customerId:id})),currentScope:()=>scope};
 const emptyOrders=await collectDeviceOrders(fence,orders),emptyCustomers=await collectDeviceCustomers(fence,customers);expect(emptyOrders.code).toBe('COLLECTED');expect(emptyCustomers.code).toBe('COLLECTED');if(emptyOrders.code!=='COLLECTED'||emptyCustomers.code!=='COLLECTED')throw Error('TEST_EMPTY_COLLECTION');expect(emptyOrders.values.filter(row=>row.port==='order.u2')).toHaveLength(0);expect(emptyCustomers.values.filter(row=>row.port==='customer.u2')).toHaveLength(0);
 const customerId=await customerFixture('TEST device list collection'),order=await intakeOrderFixture('TEST device list collection',customerId);
 const collected=await collectDeviceOrders(fence,orders),customerReads=await collectDeviceCustomers(fence,customers);
 expect(collected.code).toBe('COLLECTED');expect(customerReads.code).toBe('COLLECTED');if(collected.code!=='COLLECTED'||customerReads.code!=='COLLECTED')throw Error('TEST_ACTUAL_COLLECTION');
 expect(collected.values.filter(row=>row.port==='order.u2').map(row=>row.objectId)).toContain(order.receipt.orderId);expect(customerReads.values.filter(row=>row.port==='customer.u2').map(row=>row.objectId)).toContain(customerId);
 const secondCustomer=await customerFixture('TEST second list collection'),secondOrder=await intakeOrderFixture('TEST second list collection',secondCustomer);
 const multipleOrders=await collectDeviceOrders(fence,orders),multipleCustomers=await collectDeviceCustomers(fence,customers);if(multipleOrders.code!=='COLLECTED'||multipleCustomers.code!=='COLLECTED')throw Error('TEST_MULTIPLE_COLLECTION');expect(multipleOrders.values.filter(row=>row.port==='order.u2').map(row=>row.objectId).sort()).toEqual([order.receipt.orderId,secondOrder.receipt.orderId].sort());expect(multipleCustomers.values.filter(row=>row.port==='customer.u2').map(row=>row.objectId).sort()).toEqual([customerId,secondCustomer].sort());
 const quote=await request(()=>createQuoteAction({clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',validUntil:'2027-05-31',note:'TEST full read collection',positions:[{name:'TEST collected part',quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:2500}]}));expect(quote.code).toBe('OK');
 const rootPorts={orders,customers,quotes:{list:()=>request(()=>listOpenQuotesAction({purpose:'device'})),read:(id:string)=>request(()=>readQuoteAction({quoteId:id,purpose:'operations'}))},messages:{read:()=>request(()=>getIntakeMessagesAction({purpose:'device'}))},today:{read:()=>request(()=>getTodayDeviceAction())},currentScope:()=>scope};
 const root=await collectDeviceStand(fence,rootPorts);expect(root.code).toBe('COLLECTED');expect(root.sources.map(row=>row.source)).toEqual(['orders','customers','quotes','messages','today']);expect(root.serverReadAt).not.toBeNull();expect(root.values.filter(row=>row.port==='order.u2')).toHaveLength(2);expect(root.values.filter(row=>row.port==='customer.u2')).toHaveLength(2);expect(root.values.filter(row=>row.port==='quote.u2')).toHaveLength(1);expect(root.values.filter(row=>row.port==='today.u3')).toHaveLength(1);
 expect(await collectDeviceStand(fence,{...rootPorts,currentScope:()=>null})).toMatchObject({code:'STALE',sources:[],serverReadAt:null});
 const staleList=await collectDeviceOrders(fence,{...orders,list:async()=>{const before=await request(getOrdersDb);expect(await request(()=>transitionWareneingangToGalvanikAction({orderId:order.receipt.orderId,expectedVersion:1,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});return before;}});expect(staleList).toEqual({code:'SOURCE_INCOMPLETE'});
 expect(await collectDeviceOrders({...fence,loginScope:'0'.repeat(64)},orders)).toEqual({code:'STALE'});
 expect(await collectDeviceCustomers(fence,{...customers,currentScope:()=>null})).toEqual({code:'STALE'});
 const denied=await createFixture(['mails'],'werkstatt'),deniedCookie=signAppSession({userId:denied.actorId,tenantId:KREILE_TENANT_SLUG,role:denied.role,displayName:'TEST denied collector',issuedAt:denied.actorIssuedAt,expiresAt:Date.now()+5*60_000},getSecretKey());
 const deniedRequest=<T>(work:()=>Promise<T>)=>withRequest(`${COOKIE_NAME}=${deniedCookie}`,work),deniedSource=await deniedRequest(getOrdersDb);expect(deniedSource).toMatchObject({ok:false,error:'FORBIDDEN'});if(!deniedSource.cacheLoginScope)throw Error('TEST_DENIED_IDENTITY');
 const deniedScope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:denied.actorId}),deniedFence={scope:deniedScope,loginScope:deniedSource.cacheLoginScope,generation:1};
 const deniedOrders=await collectDeviceOrders(deniedFence,{list:()=>deniedRequest(getOrdersDb),read:id=>deniedRequest(()=>getLiveOrderCardAction({orderId:id})),currentScope:()=>deniedScope});
 const deniedCustomers=await collectDeviceCustomers(deniedFence,{list:()=>deniedRequest(getCustomersDb),read:id=>deniedRequest(()=>getCustomerSummaryAction({customerId:id})),currentScope:()=>deniedScope});
 expect(await collectDeviceStand(fence,{...rootPorts,quotes:{...rootPorts.quotes,read:id=>deniedRequest(()=>readQuoteAction({quoteId:id,purpose:'operations'}))}})).toMatchObject({code:'STALE',serverReadAt:null});
 const partial=await collectDeviceStand(deniedFence,{orders:{list:()=>deniedRequest(getOrdersDb),read:id=>deniedRequest(()=>getLiveOrderCardAction({orderId:id}))},customers:{list:()=>deniedRequest(getCustomersDb),read:id=>deniedRequest(()=>getCustomerSummaryAction({customerId:id}))},quotes:{list:()=>deniedRequest(()=>listOpenQuotesAction({purpose:'device'})),read:id=>deniedRequest(()=>readQuoteAction({quoteId:id,purpose:'operations'}))},messages:{read:()=>deniedRequest(()=>getIntakeMessagesAction({purpose:'device'}))},today:{read:()=>deniedRequest(()=>getTodayDeviceAction())},currentScope:()=>deniedScope});
 expect(partial.values.filter(row=>row.port==='orders.list'||row.port==='customers.list')).toHaveLength(2);expect(partial.sources).toHaveLength(5);
 for(const result of [deniedOrders,deniedCustomers]){expect(result.code).toBe('COLLECTED');if(result.code!=='COLLECTED')throw Error('TEST_CANONICAL_DENIAL');expect(result.values).toHaveLength(1);const row=result.values[0];if(row.port!=='orders.list'&&row.port!=='customers.list')throw Error('TEST_DENIAL_NOT_LIST');expect(row.response.result).toMatchObject({ok:false,error:'FORBIDDEN'});}
 const workshop=await createFixture(['auftraege'],'werkstatt'),workshopCookie=signAppSession({userId:workshop.actorId,tenantId:KREILE_TENANT_SLUG,role:workshop.role,displayName:'TEST restricted device',issuedAt:workshop.actorIssuedAt,expiresAt:Date.now()+5*60_000},getSecretKey());
 const workshopRequest=<T>(work:()=>Promise<T>)=>withRequest(`${COOKIE_NAME}=${workshopCookie}`,work),workshopSource=await workshopRequest(getOrdersDb);
 if(!workshopSource.cacheLoginScope)throw Error('TEST_RESTRICTED_IDENTITY');
 const workshopScope=offlinePartition({tenantId:KREILE_TENANT_SLUG,userId:workshop.actorId}),workshopFence={scope:workshopScope,loginScope:workshopSource.cacheLoginScope,generation:1};
 const messages=await workshopRequest(()=>getIntakeMessagesAction({purpose:'device'}));expect(messages).toMatchObject({code:'FORBIDDEN',cacheLoginScope:workshopFence.loginScope});
 const messageCollection=await collectDeviceMessages(workshopFence,{read:()=>workshopRequest(()=>getIntakeMessagesAction({purpose:'device'})),currentScope:()=>workshopScope});
 expect(messageCollection).toMatchObject({code:'COLLECTED',values:[],denial:{code:'FORBIDDEN'}});
 expect(await collectDeviceMessages({...workshopFence,loginScope:fence.loginScope},{read:()=>workshopRequest(()=>getIntakeMessagesAction({purpose:'device'})),currentScope:()=>workshopScope})).toEqual({code:'STALE'});
 const quoteCollection=await collectDeviceQuotes(workshopFence,{list:()=>workshopRequest(()=>listOpenQuotesAction({purpose:'device'})),read:id=>workshopRequest(()=>readQuoteAction({quoteId:id,purpose:'operations'})),currentScope:()=>workshopScope});
 // Operational quote reads are allowed for every active login by the existing
 // quoteOperationContext. Absence of Geld must strip prices, not deny that read.
 expect(quoteCollection.code).toBe('COLLECTED');if(quoteCollection.code!=='COLLECTED')throw Error('TEST_OPERATIONAL_QUOTE_SOURCE');expect(quoteCollection.values).toHaveLength(1);expect(quoteCollection.values[0].response).not.toHaveProperty('totalNetCents');
 const restricted=await collectDeviceStand(workshopFence,{orders:{list:()=>workshopRequest(getOrdersDb),read:id=>workshopRequest(()=>getLiveOrderCardAction({orderId:id}))},customers:{list:()=>workshopRequest(getCustomersDb),read:id=>workshopRequest(()=>getCustomerSummaryAction({customerId:id}))},quotes:{list:()=>workshopRequest(()=>listOpenQuotesAction({purpose:'device'})),read:id=>workshopRequest(()=>readQuoteAction({quoteId:id,purpose:'operations'}))},messages:{read:()=>workshopRequest(()=>getIntakeMessagesAction({purpose:'device'}))},today:{read:()=>workshopRequest(getTodayDeviceAction)},currentScope:()=>workshopScope});
 expect(restricted.code).toBe('COLLECTED');expect(restricted.values.some(row=>row.port==='message.u2'||row.port==='customer.u2')).toBe(false);expect(restricted.values.filter(row=>row.port==='quote.u2')).toHaveLength(1);
});
