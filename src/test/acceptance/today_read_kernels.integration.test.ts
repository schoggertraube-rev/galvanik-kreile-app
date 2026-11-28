// @vitest-environment node
// E-B1a: complete existing reader kernels, isolated TEST data and actual
// Actions/Auth/DB/Storage. No read-model schema, worker or fabricated identity.
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi,expectTypeOf} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization,authorizationReadContext,type AuthorizationSnapshot,type AuthorizedReadContext} from '@/lib/server/authorization';
import {readTodayOrderCards} from '@/lib/server/orderCardRead';
import {getOperationalOrders} from '@/lib/server/operationalOrders';
import {readOrderEvidenceBatch} from '@/lib/server/evidenceRead';
import {quoteCommandContext,quoteReadContext} from '@/lib/server/quoteAuthorization';
import {todaySourceAccess} from '@/lib/server/todayDashboard';
import {createQuoteAction,readQuoteDefaultsAction,changeQuoteLifecycleAction,getQuoteFollowupsForTodayAction} from '@/app/actions/quotes.actions';
import {saveQuoteSettingsAction} from '@/app/actions/settings.actions';
import {saveIntakeTaskAction,getIntakeTaskAction} from '@/app/actions/eingang.actions';
import {readQuoteFollowupTasksForToday} from '@/modules/tasks/server-public';
import {reklamationAusfuehrenAction,getComplaints} from '@/app/actions/complaints.actions';
import {readComplaintsForAuthorization} from '@/modules/complaints/server-public';
import {storeOrderPhoto} from '../../../e2e/ablauf/photoFixture';
import {setOrderPickupAppointmentAction,getManualShippingAction,markOrderInformedByPhoneAction} from '@/app/actions/orders.actions';
import {readOrderPickupAppointment,readOrderPickupAppointmentInTransaction} from '@/lib/server/pickupAppointmentPort';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readInvoiceShippingConsequences,readInvoiceShippingConsequencesBatch,readShippingMergeAllocation} from '@/lib/server/commands/immutableInvoiceCommand';
import {readInvoiceVat} from '@/modules/accounting/public';
import {readBetriebsruheInTransaction, readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
import {readCustomerProfile,readCustomerProfiles} from '@/modules/customers/server-public';
import {readManualShipping,readManualShippingBatch} from '@/modules/orders/server-public';
import {readOrdersInformed,readOrderInformed} from '@/lib/server/orderReleaseRead';
import {confirmPaymentAction,setPaymentModeAction,getOrderPaymentStateAction} from '@/app/actions/payments.actions';
import {getPaymentState,getPaymentStatesBatch,readPaymentSummary} from '@/lib/server/paymentSummaryRead';
import {paymentReadAuthorization,type PaymentReadProfile,type PaymentReadAuthorization} from '@/lib/server/paymentContract';
import {readCustomerCreditInTransaction} from '@/modules/accounting/server-public';
import {readQuoteCommand,listOpenQuotesCommand,readQuoteActors,type QuoteCommandContext} from '@/modules/quotes/server-public';
let prepared:Awaited<ReturnType<typeof readyInvoiceOrder>>;
let quoteId:string,quoteVersion:number;
beforeAll(async()=>{
 prepared=await readyInvoiceOrder('TEST complete readonly kernels');
 const result=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:prepared.customerId,dueDate:'2027-05-15',validUntil:'2027-05-31',note:'TEST kernel original',positions:[{name:'TEST kernel part',quantity:2,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:12345,lineTotalCents:24690}]}));
 if(result.code!=='OK')throw Error('TEST_KERNEL_QUOTE_REQUIRED:'+result.code);
 quoteId=result.quote.quoteId;quoteVersion=result.quote.version;
});

it('keeps the actual pickup agreement, actor and freeze identical through both read callbacks and fresh retries',async()=>{
 const input={orderId:prepared.orderId,expectedVersion:prepared.version,previousEventId:null,date:'2027-06-10',channel:'telefon' as const,clientEventId:randomUUID()};
 const before=await sql`SELECT due_date,version FROM public.orders WHERE tenant_id=${tenant} AND id=${prepared.orderId}`;
 const created=await withSession(full,()=>setOrderPickupAppointmentAction(input));
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK',replayed:false});
 if(created.code!=='OK')throw Error('TEST_KERNEL_APPOINTMENT_REQUIRED');
 expect(await withSession(full,()=>setOrderPickupAppointmentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:created.receipt});
 expect(await sql`SELECT due_date,version FROM public.orders WHERE tenant_id=${tenant} AND id=${prepared.orderId}`).toEqual(before);
 const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 for(const profile of profiles){
  const fixture=profile.rights===null?full:await createFixture(profile.rights,profile.role);
  const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_PICKUP_READ_AUTH');
  const areas=result.data.areas;if(!Array.isArray(areas))throw Error('TEST_PICKUP_AREAS_REQUIRED');
  const session=authorizationReadContext(result.data),projection:AuthorizedReadContext={tenantId:result.data.tenantId,permissions:result.data.permissions,canReadArea:area=>areas.includes(area)};
  const expected=await readOrderPickupAppointment(result.data,prepared.orderId);
  expect(await readOrderPickupAppointment(session,prepared.orderId)).toEqual(expected);
  const actual=await readOrderPickupAppointment(projection,prepared.orderId);expect(actual).toEqual(expected);
  expect(await readOrderPickupAppointment(projection,JSON.parse(JSON.stringify(prepared.orderId)))).toEqual(actual);
  expect(await readOrderPickupAppointment(projection,'invalid')).toEqual({code:session.canReadArea('auftraege')?'VALIDATION_ERROR':'FORBIDDEN'});
  if(actual.code==='OK'){
   expect(actual.appointment).toEqual(created.receipt);
   expect(await withPrivilegedTenantTransaction(projection,tx=>readOrderPickupAppointmentInTransaction(tx,projection,prepared.orderId))).toEqual(created.receipt);
  }else {
   expect(actual).toEqual({code:'FORBIDDEN'});
   await expect(withPrivilegedTenantTransaction(projection,tx=>readOrderPickupAppointmentInTransaction(tx,projection,prepared.orderId))).rejects.toThrow('PICKUP_APPOINTMENT_FORBIDDEN');
  }
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
});
it('shares qualified shipping-invoice consequences and original numbers for zero, one and several actual orders without a write',async()=>{
 const shipping=await readyInvoiceOrder('TEST shipping consequence kernel','shipping');
 const inputs=[prepared,shipping].map(order=>({orderId:order.orderId,expectedVersion:order.version}));
 const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 for(const profile of profiles){
  const fixture=profile.rights===null?full:await createFixture(profile.rights,profile.role);
  const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_SHIPPING_READ_AUTH');
  const areas=result.data.areas;if(!Array.isArray(areas))throw Error('TEST_SHIPPING_AREAS_REQUIRED');
  const session=authorizationReadContext(result.data),projection:AuthorizedReadContext={tenantId:result.data.tenantId,permissions:result.data.permissions,canReadArea:area=>areas.includes(area)};
  for(const scope of [[],inputs.slice(0,1),inputs]){
   const expected=await readInvoiceShippingConsequencesBatch(result.data,scope,readInvoiceVat,readShippingSettingsInTransaction);
   expect(await readInvoiceShippingConsequencesBatch(session,scope,readInvoiceVat,readShippingSettingsInTransaction)).toEqual(expected);
   const actual=await readInvoiceShippingConsequencesBatch(projection,scope,readInvoiceVat,readShippingSettingsInTransaction);expect(actual).toEqual(expected);
   expect(actual.size).toBe(scope.length);
   for(const input of scope){
    expect(await readInvoiceShippingConsequences(projection,JSON.parse(JSON.stringify(input)),readInvoiceVat,readShippingSettingsInTransaction)).toEqual(actual.get(input.orderId));
    if(session.canReadArea('preise'))expect(actual.get(input.orderId)).toMatchObject({code:'OK',orderId:input.orderId,orderVersion:input.expectedVersion,additionalInvoices:[],reissueWithoutShipping:null});
    else expect(actual.get(input.orderId)).toBeUndefined();
   }
  }
  const stale={...inputs[0],expectedVersion:inputs[0].expectedVersion+1};
  const expected=await readInvoiceShippingConsequences(result.data,stale,readInvoiceVat,readShippingSettingsInTransaction);
  expect(await readInvoiceShippingConsequences(projection,stale,readInvoiceVat,readShippingSettingsInTransaction)).toEqual(expected);
  if(session.canReadArea('preise'))expect(expected).toMatchObject({code:'SOURCE_INCOMPLETE',datenluecken:['SHIPPING_INVOICE_SOURCE']});
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
});
it('reads actual manual shipment originals and address fields through one shipping kernel for both callbacks',async()=>{
 const shipping=await readyInvoiceOrder('TEST manual shipment kernel','shipping');
 const receipt=await manualTrackingFixture(shipping.orderId);
 const ports:Parameters<typeof readManualShipping>[2]={readCustomer:readCustomerProfile,readCustomers:readCustomerProfiles,readSettings:readShippingSettingsInTransaction,readAllocation:(tx,tenantId,customerId,input)=>readShippingMergeAllocation(tx,tenantId,customerId,input,readInvoiceVat)};
 const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 for(const profile of profiles){
  const fixture=profile.rights===null?full:await createFixture(profile.rights,profile.role);
  const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_MANUAL_SHIPPING_AUTH');
  const areas=result.data.areas;if(!Array.isArray(areas))throw Error('TEST_MANUAL_SHIPPING_AREAS_REQUIRED');
  const session=authorizationReadContext(result.data),projection:AuthorizedReadContext={tenantId:result.data.tenantId,permissions:result.data.permissions,canReadArea:area=>areas.includes(area)};
  for(const ids of [[],[shipping.orderId],[prepared.orderId,shipping.orderId]]){
   const expected=await readManualShippingBatch(result.data,ids,ports);
   expect(await readManualShippingBatch(session,ids,ports)).toEqual(expected);
   const actual=await readManualShippingBatch(projection,ids,ports);expect(actual).toEqual(expected);expect(actual.size).toBe(ids.length);
   for(const orderId of ids)expect(await readManualShipping(projection,JSON.parse(JSON.stringify(orderId)),ports)).toEqual(actual.get(orderId));
  }
  const actual=await readManualShipping(projection,shipping.orderId,ports);
  if(session.canReadArea('auftraege')){
   expect(actual).toMatchObject({code:'OK',data:{orderId:shipping.orderId,fields:{street:'TEST Weg',houseNumber:'1'},shipments:[{id:receipt.shipmentId,trackingNumber:receipt.trackingNumber,carrier:receipt.carrier,updatedAt:receipt.updatedAt}]}});
   expect(await withSession(fixture,()=>getManualShippingAction({orderId:shipping.orderId}))).toEqual(actual);
  }else expect(actual).toMatchObject({code:'FORBIDDEN',reason:'SHIPPING_FORBIDDEN'});
  expect(await readManualShipping(projection,'invalid id',ports)).toEqual(await readManualShipping(result.data,'invalid id',ports));
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
});
it('projects the same persisted phone notice, release and collection sources for each read callback',async()=>{
 const input={orderId:prepared.orderId,expectedVersion:prepared.version,clientEventId:randomUUID()};
 const created=await withSession(full,()=>markOrderInformedByPhoneAction(input));expect(created).toMatchObject({code:'OK',replayed:false});
 if(created.code!=='OK')throw Error('TEST_INFORMED_ORIGINAL_REQUIRED');
 expect(await withSession(full,()=>markOrderInformedByPhoneAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 const absent=randomUUID(),ids=[prepared.orderId,absent];
 for(const profile of [...profiles,{name:'orders and prices',rights:['auftraege','preise'],role:'meister' as const},{name:'orders and payments',rights:['auftraege','zahlungen'],role:'meister' as const}]){
  const fixture=profile.rights===null?full:await createFixture(profile.rights,profile.role);
  const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_INFORMED_READ_AUTH');
  const areas=result.data.areas;if(!Array.isArray(areas))throw Error('TEST_INFORMED_AREAS_REQUIRED');
  const session=authorizationReadContext(result.data),projection:AuthorizedReadContext={tenantId:result.data.tenantId,permissions:result.data.permissions,canReadArea:area=>areas.includes(area)};
  for(const scope of [[],ids.slice(0,1),ids,[...ids,prepared.orderId]]){
   const expected=await readOrdersInformed(result.data,scope);
   expect(await readOrdersInformed(session,scope)).toEqual(expected);
   const actual=await readOrdersInformed(projection,scope);expect(actual).toEqual(expected);
   expect(actual.size).toBe(new Set(scope).size);
   for(const orderId of new Set(scope))expect(await readOrderInformed(projection,JSON.parse(JSON.stringify(orderId)))).toEqual(actual.get(orderId));
  }
  const actual=await readOrderInformed(projection,prepared.orderId);
  if(actual.code==='OK'){
   expect(actual.informed).toMatchObject({orderId:prepared.orderId,actorId:full.actorId,channel:'telefon',threadId:null});
   expect(actual.collectionState).toMatchObject({orderId:prepared.orderId,orderVersion:prepared.version,collectionPlanned:false,collectionPrepared:false});
   if(session.canReadArea('preise'))expect(actual.invoiceMailOriginals?.some(original=>original.id===prepared.invoice.invoiceId)).toBe(true);
   else expect(actual.invoiceMailOriginals).toBeUndefined();
   if(session.canReadArea('zahlungen'))expect(actual.overdueInvoiceIds).toEqual([]);
   else expect(actual.overdueInvoiceIds).toBeUndefined();
  }else expect(actual).toEqual({code:'FORBIDDEN'});
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
});
it('keeps actual payment and pickup-cashier predicates unchanged without adding a command identity to the read kernel',async()=>{
 expectTypeOf<PaymentReadAuthorization>().not.toExtend<AuthorizationSnapshot>();
 const cashOrder=await readyInvoiceOrder('TEST payment callback kernel');
 const initialAuth=await withSession(full,()=>resolveAuthorization());if(!initialAuth.ok)throw Error('TEST_PAYMENT_INITIAL_AUTH');
 const initial=await getPaymentState(initialAuth.data,cashOrder.orderId);if(initial.code!=='OK'||!initial.data.payment)throw Error('TEST_PAYMENT_INITIAL_SOURCE');
 expect(await withSession(full,()=>setPaymentModeAction({orderId:cashOrder.orderId,paymentMode:'abholung',expectedVersion:initial.data.paymentModeVersion,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const cashier=await createFixture(['auftraege','kassieren']);
 const input={invoiceId:cashOrder.invoice.invoiceId,amount:1000,method:'bar' as const,expectedVersion:initial.data.payment.paymentVersion,expectedOpenAmountCents:initial.data.payment.openAmountCents,clientEventId:randomUUID()};
 const paid=await withSession(cashier,()=>confirmPaymentAction(input));expect(paid).toMatchObject({code:'OK',replayed:false});if(paid.code!=='OK')throw Error('TEST_PAYMENT_REAL_RECEIPT');
 expect(await withSession(cashier,()=>confirmPaymentAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:paid.receipt});
 const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 for(const profile of [...profiles,{name:'payments only',rights:['zahlungen'],role:'meister' as const},{name:'cashier only',rights:['kassieren'],role:'meister' as const},{name:'orders and cashier',rights:['auftraege','kassieren'],role:'meister' as const}]){
  const fixture=profile.rights===null?full:await createFixture(profile.rights,profile.role);
  const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_PAYMENT_READ_AUTH');
  // These are the actual resolved active-profile facts, not a made-up role,
  // user or session. The resulting callback has neither role nor actor ID.
  const source:PaymentReadProfile={tenantId:result.data.tenantId,active:result.data.active,permissions:result.data.permissions,areas:result.data.areas,role:result.data.role};
  const session=paymentReadAuthorization(result.data),projection=paymentReadAuthorization(source);
  expect(projection).not.toHaveProperty('userId');expect(projection).not.toHaveProperty('role');
  const readCredit=authorizationReadContext(result.data).canReadArea('zahlungen')?((tx:Parameters<typeof readCustomerCreditInTransaction>[0],tenantId:string,customerId:string)=>readCustomerCreditInTransaction(tx,tenantId,customerId,readCustomerProfile)):undefined;
  const summary=await readPaymentSummary(result.data);expect(await readPaymentSummary(session)).toEqual(summary);expect(await readPaymentSummary(projection)).toEqual(summary);
  for(const ids of [[],[cashOrder.orderId],[cashOrder.orderId,prepared.orderId],[cashOrder.orderId,cashOrder.orderId]]){
   const expected=await getPaymentStatesBatch(result.data,ids,readCredit);
   expect(await getPaymentStatesBatch(session,ids,readCredit)).toEqual(expected);
   const actual=await getPaymentStatesBatch(projection,ids,readCredit);expect(actual).toEqual(expected);expect(actual.size).toBe(new Set(ids).size);
   for(const orderId of new Set(ids))expect(await getPaymentState(projection,JSON.parse(JSON.stringify(orderId)),readCredit)).toEqual(actual.get(orderId));
  }
  expect(await getPaymentState(projection,'invalid id',readCredit)).toEqual(await getPaymentState(result.data,'invalid id',readCredit));
  const actual=await getPaymentState(projection,cashOrder.orderId,readCredit);
  expect(await withSession(fixture,()=>getOrderPaymentStateAction({orderId:cashOrder.orderId}))).toEqual(actual);
  if(profile.name==='orders and cashier'){
   expect(actual).toMatchObject({code:'OK',data:{payment:{invoiceId:cashOrder.invoice.invoiceId,openAmountCents:initial.data.payment.openAmountCents-1000,paymentVersion:paid.receipt.paymentVersion}}});
   expect(await getPaymentState(projection,prepared.orderId)).toMatchObject({code:'FORBIDDEN'});expect(summary).toMatchObject({code:'FORBIDDEN'});
  }
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
});
it('keeps quote followup assignments factual and derives personal sorting only for the actual login',async()=>{
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_FOLLOWUP_FULL_AUTH');
 expect(await withPrivilegedTenantTransaction(auth.data,tx=>readQuoteFollowupTasksForToday(tx,authorizationReadContext(auth.data)))).toEqual([]);
 const defaults=await withSession(full,()=>readQuoteDefaultsAction());if(defaults.code!=='OK')throw Error('TEST_FOLLOWUP_DEFAULTS');
 expect(await withSession(full,()=>saveQuoteSettingsAction({clientEventId:randomUUID(),expectedUpdatedAt:defaults.settings.updatedAt,setupCents:defaults.settings.setupCents,materialCents:defaults.settings.materialCents,followupDays:1,validityDays:14}))).toMatchObject({code:'OK'});
 const assignee=await createFixture(['mails','preise']);
 const [clock]=await sql`SELECT ((statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1)::text AS yesterday`;
 const taskIds:string[]=[],quoteIds:string[]=[];
 for(let index=0;index<2;index++){
  const created=await withSession(full,()=>createQuoteAction({clientEventId:randomUUID(),customerId:prepared.customerId,dueDate:'2027-05-15',note:'TEST canonical followup source',positions:[{name:'TEST followup part '+index,quantity:1,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:10000,lineTotalCents:10000}]}));
  if(created.code!=='OK')throw Error('TEST_FOLLOWUP_QUOTE');quoteIds.push(created.quote.quoteId);
  // Real documented manual lifecycle evidence, not a physical printer test.
  const sent={quoteId:created.quote.quoteId,expectedVersion:created.quote.version,edition:1,action:'sent' as const,channel:'druck' as const,evidence:'TEST documented manual quote handover',clientEventId:randomUUID()};
  expect(await withSession(full,()=>changeQuoteLifecycleAction(sent))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>changeQuoteLifecycleAction(JSON.parse(JSON.stringify(sent))))).toMatchObject({code:'OK',replayed:true});
  const [task]=await sql`SELECT id::text FROM public.tasks WHERE tenant_id=${tenant} AND bezug_typ='kv' AND bezug_id=${created.quote.quoteId}`;if(!task)throw Error('TEST_REAL_FOLLOWUP_TASK');taskIds.push(task.id);
  const read=await withSession(full,()=>getIntakeTaskAction({taskId:task.id}));if(read.code!=='OK'||!read.task)throw Error('TEST_FOLLOWUP_TASK_READ');const value=read.task;
  const input={clientKey:value.client_key,taskId:value.id,version:value.version,kind:value.art,title:'TEST interner Preis 123,45 €',dueDate:clock.yesterday,time:value.uhrzeit,forLogin:index===0?full.actorId:assignee.actorId,forArea:null,reference:{type:value.bezug_typ,id:value.bezug_id},note:value.notiz};
  expect(await withSession(full,()=>saveIntakeTaskAction(input))).toMatchObject({code:'OK'});
  expect(await withSession(full,()=>saveIntakeTaskAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 }
 const events=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
 for(const fixture of [full,assignee,await createFixture(['mails']),await createFixture(['auftraege'],'werkstatt')]){
  const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_FOLLOWUP_AUTH');const areas=result.data.areas;if(!Array.isArray(areas))throw Error('TEST_FOLLOWUP_AREAS');
  const session=authorizationReadContext(result.data),projection:AuthorizedReadContext={tenantId:result.data.tenantId,permissions:result.data.permissions,canReadArea:area=>areas.includes(area)};
  const expected=await withPrivilegedTenantTransaction(result.data,tx=>readQuoteFollowupTasksForToday(tx,result.data));
  const raw=await withPrivilegedTenantTransaction(projection,tx=>readQuoteFollowupTasksForToday(tx,projection));
  expect(await withPrivilegedTenantTransaction(session,tx=>readQuoteFollowupTasksForToday(tx,session))).toEqual(raw);
  for(const row of raw){expect(row).not.toHaveProperty('isMine');expect(row).not.toHaveProperty('currentLogin');}
  expect(raw.map(({assignedLogin,...row})=>({...row,isMine:assignedLogin===result.data.userId})).sort((left,right)=>Number(right.isMine)-Number(left.isMine))).toEqual(expected);
  if(session.canReadArea('mails')){
   expect(raw.map(row=>row.id).sort()).toEqual([...taskIds].sort());expect(raw.map(row=>row.quoteId).sort()).toEqual([...quoteIds].sort());
   expect(await withSession(fixture,()=>getQuoteFollowupsForTodayAction())).toEqual({code:'OK',tasks:expected});
   for(const row of raw){if(session.canReadArea('preise'))expect(row.title).toBe('TEST interner Preis 123,45 €');else expect(row.title).not.toContain('123,45');}
   if(fixture.actorId===full.actorId||fixture.actorId===assignee.actorId)expect(expected[0]).toMatchObject({isMine:true});
  }else{expect(raw).toEqual([]);expect(await withSession(fixture,()=>getQuoteFollowupsForTodayAction())).toMatchObject({code:'FORBIDDEN'});}
 }
 expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(events);
});
const profiles:Array<{name:string;rights:string[]|null;role:'meister'|'werkstatt'}>=[
 {name:'all canonical areas',rights:null,role:'meister'},
 {name:'orders without prices',rights:['auftraege'],role:'werkstatt'},
 {name:'prices without orders',rights:['preise'],role:'meister'},
 {name:'mail without money',rights:['mails'],role:'meister'},
 {name:'decision without prices',rights:['entscheiden'],role:'meister'},
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
 expect(await getOperationalOrders(projection,{purpose:'today'}, readBetriebsruheInTransaction)).toEqual(await getOperationalOrders(auth,{purpose:'today'}, readBetriebsruheInTransaction));
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


it('keeps the complete complaint reader and real credit values equal through session/projector area callbacks',async()=>{
 const order=await readyInvoiceOrder('TEST complaint read callback'),photo=await storeOrderPhoto(order.orderId);
 const input={action:'aufnehmen' as const,clientKey:randomUUID(),orderId:order.orderId,intakeItemId:null,intakeVersion:null,parts:[{position_id:order.items[0].id,menge:1}],defect:'Abplatzung',description:'TEST original complaint read source',photoIds:[photo],goodsReturn:'ja' as const};
 const recorded=await withSession(full,()=>reklamationAusfuehrenAction(input));expect(recorded).toMatchObject({code:'OK'});if(recorded.code!=='OK')throw Error('TEST_REAL_COMPLAINT_SOURCE:'+JSON.stringify(recorded));
 expect(await withSession(full,()=>reklamationAusfuehrenAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true});
 const decider=await createFixture(['auftraege','entscheiden','zahlungen']);
 const decision=await withSession(decider,()=>reklamationAusfuehrenAction({action:'entscheiden',clientKey:randomUUID(),complaintId:recorded.receipt.complaintId,version:recorded.receipt.version,assessment:'berechtigt',measure:'gutschrift',reason:'TEST recorded actual credit decision',creditCents:null}));
 expect(decision,JSON.stringify(decision)).toMatchObject({code:'OK'});if(decision.code!=='OK')throw Error('TEST_REAL_COMPLAINT_DECISION:'+JSON.stringify(decision));
 const creditNumber='TEST-KERNEL-'+randomUUID().slice(0,8);
 const credit=await withSession(decider,()=>reklamationAusfuehrenAction({action:'gutschrift',clientKey:randomUUID(),complaintId:recorded.receipt.complaintId,version:decision.receipt.version,creditCents:1000,creditNumber}));
 expect(credit,JSON.stringify(credit)).toMatchObject({code:'OK'});if(credit.code!=='OK')throw Error('TEST_REAL_COMPLAINT_CREDIT:'+JSON.stringify(credit));
 const filter={complaintId:recorded.receipt.complaintId};
 for(const profile of [...profiles,{name:'payments',rights:['zahlungen'],role:'meister' as const},{name:'customer',rights:['kunden'],role:'meister' as const}]){
  const fixture=profile.rights===null?full:await createFixture(profile.rights,profile.role);
  const result=await withSession(fixture,()=>resolveAuthorization());if(!result.ok)throw Error('TEST_COMPLAINT_READ_AUTH');
  const areas=result.data.areas;if(!Array.isArray(areas))throw Error('TEST_COMPLAINT_AREAS_REQUIRED');
  const context=authorizationReadContext(result.data),projection:AuthorizedReadContext={tenantId:result.data.tenantId,permissions:result.data.permissions,canReadArea:area=>areas.includes(area)};
  const before=await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`;
  const expected=await withSession(fixture,()=>getComplaints(filter));
  expect(await readComplaintsForAuthorization(context,filter)).toEqual(expected);
  const actual=await readComplaintsForAuthorization(projection,filter);expect(actual).toEqual(expected);
  expect(await readComplaintsForAuthorization(projection,JSON.parse(JSON.stringify(filter)))).toEqual(actual);
  if(actual.code==='OK'){
   expect(actual.complaints).toHaveLength(1);const row=actual.complaints[0];
   expect(row).toMatchObject({id:recorded.receipt.complaintId,version:credit.receipt.version,actorTrace:{createdBy:{userId:full.actorId},lastActor:{userId:decider.actorId}}});
   if(context.canReadArea('zahlungen')){expect(Number(row.gutschriftBetrag)*100).toBe(1000);expect(row.gutschriftNr).toBe(creditNumber);}
   else {expect(row.gutschriftBetrag).toBeNull();expect(row.gutschriftNr).toBeNull();}
  }else expect(actual.code).toBe('FORBIDDEN');
  expect(await sql`SELECT id::text,payload FROM public.events WHERE tenant_id=${tenant} ORDER BY id`).toEqual(before);
 }
});
