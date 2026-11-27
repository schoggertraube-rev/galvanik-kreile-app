import {randomUUID} from 'node:crypto';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';

/** Explicit synthetic carrier configuration; parcel and receipt use the real
 * existing tracking action. Call only where the scenario actually ships. */
export async function manualTrackingFixture(orderId:string){
 if(!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('FIXTURE_SYNTHETIC_TENANT_REQUIRED');
 const configured=await sql`UPDATE public.company_settings SET versand_dienst='TEST Fixture Parcel',versand_nummer_format='',versand_nummer_hinweis='' WHERE tenant_id=${KREILE_TENANT_SLUG} RETURNING id`;
 if(configured.length!==1)throw Error('FIXTURE_TRACKING_SETTINGS_REQUIRED');
 const {saveManualTrackingAction}=await import('@/app/actions/orders.actions');
 const input={orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'TEST-'+randomUUID(),allowFormatMismatch:false,reason:null,clientEventId:randomUUID()};
 const saved=await withSession(full,()=>saveManualTrackingAction(input));
 if(saved.code!=='OK')throw Error('FIXTURE_TRACKING:'+saved.code+':'+saved.message);
 return saved.receipt;
}

export async function customerFixture(label:string){
 const customerId=randomUUID();
 await sql`INSERT INTO public.customers(id,tenant_id,customer_number,name,company_name,type,contact_person,email,phone,street,house_number,zip_code,city,country,payment_preference,ziel_freigeschaltet,ziel_tage,source,first_name,last_name,salutation)
 VALUES(${customerId},${KREILE_TENANT_SLUG},${'TEST-'+label.slice(0,8)+'-'+customerId},${'TEST '+label+' Firma'},${'TEST '+label+' Firma GmbH'},'business','TEST Person',${'TEST-'+customerId+'@example.invalid'},'+49 711 5550189','TEST Weg','1','70176','Stuttgart','DE','rechnung',true,14,'manual','TEST','Person','ohne')`;
 return customerId;
}

export async function intakeOrderFixture(label:string,customerId:string,handoverMode:'pickup'|'shipping'='pickup',quantity=1,unitPriceCents=10000,unit='Stück'){
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode,paymentMode:'rechnung',note:'TEST '+label,items:[{catalogServiceId:null,name:'TEST '+label+' Teil',quantity,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit,unitPriceCents,vatRateBasisPoints:1900}]}));
 if(created.code!=='OK')throw Error('FIXTURE_ORDER:'+created.code);
 return created;
}

export async function invoiceCompanySettingsFixture(){
 if(!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('FIXTURE_SYNTHETIC_TENANT_REQUIRED');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days,versand_pauschale_netto_cents,material_aufschlag_prozent,lager_regelversion)
 SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST Ablauf Galvanik','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14,1000,20,'TEST-Ablauf'
 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
}

/** Synthetic initial state for later boundaries, using the actual order writers. */
export async function readyOrderForInvoice(label:string,handoverMode:'pickup'|'shipping'='pickup',existingCustomerId?:string,unitPriceCents=10000,quantity=1,beforeFinish?:(input:{orderId:string;itemId:string;version:number})=>Promise<number>,unit='Stück'){
 const customerId=existingCustomerId??await customerFixture(label);
 const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,setExtraWorkHourlyRateAction,freezeOrderAction,getExtraWorkMasterDataAction}=await import('@/app/actions/orders.actions');
 const created=await intakeOrderFixture(label,customerId,handoverMode,quantity,unitPriceCents,unit);
 const orderId=created.receipt.orderId;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 if(moved.code!=='OK')throw Error('FIXTURE_HANDOFF:'+moved.code);
 const {storeItemPhoto}=await import('./photoFixture');
 for(const item of created.receipt.items)await storeItemPhoto(orderId,item.id);
 const itemId=created.receipt.items[0].id;
 let version=moved.receipt.aggregateVersion;
 if(beforeFinish)version=await beforeFinish({orderId,itemId,version});
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId,expectedVersion:version,clientEventId:randomUUID(),finished:true}));
 if(finished.code!=='OK')throw Error('FIXTURE_PART:'+finished.code);
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());
 if(master.code!=='OK')throw Error('FIXTURE_RATE_READ:'+master.code);
 if(!master.data.currentRate){const rate=await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}));if(rate.code!=='OK')throw Error('FIXTURE_RATE:'+rate.code);}
 // H3 independently retains the red mandatory-photo boundary. This fixture uses
 // the current completion command solely to reach the later invoice/release gate.
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}));
 if(frozen.code!=='OK')throw Error('FIXTURE_FREEZE:'+frozen.code);
 await invoiceCompanySettingsFixture();
 return {customerId,orderId,version:frozen.receipt.aggregateVersion,items:created.receipt.items};
}

export async function readyInvoiceOrder(label:string,handoverMode:'pickup'|'shipping'='pickup',options:boolean|number=false,existingCustomerId?:string,unitPriceCents=10000){
 const concurrentIssue=typeof options==='boolean'?options:false;
 const quantity=typeof options==='number'?options:1;
 const prepared=await readyOrderForInvoice(label,handoverMode,existingCustomerId,unitPriceCents,quantity);
 const {customerId,orderId}=prepared;
 const {issueInvoiceAction}=await import('@/app/actions/invoices.actions');
 const issueInput={orderId,expectedVersion:prepared.version,clientEventId:randomUUID()};
 const issuanceResults=await Promise.all(Array.from({length:concurrentIssue?2:1},()=>withSession(full,()=>issueInvoiceAction(structuredClone(issueInput)))));
 const issued=issuanceResults[0];
 if(issued.code!=='OK')throw Error('FIXTURE_INVOICE:'+issued.code+':'+('message'in issued?issued.message:''));
 return {customerId,orderId,invoice:issued.receipt,version:issued.receipt.orderVersion,issueInput,items:prepared.items,issuanceResults};
}

/** Read the real source projection for a confirmed TEST document command. */
export async function deliveryNoteInputFixture(orderIds:string[],clientEventId=randomUUID()):Promise<import('@/lib/domain/deliveryNoteContract').DeliveryNoteInput>{
 const {getOrderPaymentStateAction}=await import('@/app/actions/payments.actions');
 const input:import('@/lib/domain/deliveryNoteContract').DeliveryNoteInput={orderIds,clientEventId,expectedVersions:{},expectedSources:{}};
 for(const orderId of orderIds){
  const read=await withSession(full,()=>getOrderPaymentStateAction({orderId,includeDeliveryNoteSource:true}));
  if(read.code!=='OK'||read.deliveryNoteSource?.code!=='OK')throw Error('FIXTURE_DELIVERY_NOTE_SOURCE:'+read.code);
  Object.assign(input.expectedVersions,read.deliveryNoteSource.source.expectedVersions);
  Object.assign(input.expectedSources,read.deliveryNoteSource.source.expectedSources);
 }
 return input;
}
