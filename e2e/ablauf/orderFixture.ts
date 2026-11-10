import {randomUUID} from 'node:crypto';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';

export async function customerFixture(label:string){
 const customerId=randomUUID();
 await sql`INSERT INTO public.customers(id,tenant_id,customer_number,name,company_name,type,contact_person,email,phone,street,house_number,zip_code,city,country,payment_preference,ziel_freigeschaltet,ziel_tage,source,first_name,last_name,salutation)
 VALUES(${customerId},${KREILE_TENANT_SLUG},${'TEST-'+label.slice(0,8)+'-'+customerId},${'TEST '+label+' Firma'},${'TEST '+label+' Firma GmbH'},'business','TEST Person',${'TEST-'+customerId+'@example.invalid'},'+49 711 5550189','TEST Weg','1','70176','Stuttgart','DE','rechnung',true,14,'manual','TEST','Person','ohne')`;
 return customerId;
}

export async function intakeOrderFixture(label:string,customerId:string,handoverMode:'pickup'|'shipping'='pickup',quantity=1){
 const {createOrderIntakeAction}=await import('@/app/actions/eingang.actions');
 const created=await withSession(full,()=>createOrderIntakeAction({geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING',customerId},dueDate:'2027-05-15',termStatus:'bestaetigt',intakeSource:'persoenlich',handoverMode,paymentMode:'rechnung',note:'TEST '+label,items:[{catalogServiceId:null,name:'TEST '+label+' Teil',quantity,material:'Messing',surfaceRequested:'Verchromen',executionRequested:'offen',unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]}));
 if(created.code!=='OK')throw Error('FIXTURE_ORDER:'+created.code);
 return created;
}

/** Synthetic initial state for later boundaries, using the actual order writers. */
export async function readyInvoiceOrder(label:string,handoverMode:'pickup'|'shipping'='pickup',options:boolean|number=false,existingCustomerId?:string){
 const concurrentIssue=typeof options==='boolean'?options:false;
 const quantity=typeof options==='number'?options:1;
 const customerId=existingCustomerId??await customerFixture(label);
 const {transitionWareneingangToGalvanikAction,setOrderItemFinishedAction,setExtraWorkHourlyRateAction,freezeOrderAction,getExtraWorkMasterDataAction}=await import('@/app/actions/orders.actions');
 const created=await intakeOrderFixture(label,customerId,handoverMode,quantity);
 const orderId=created.receipt.orderId;
 const moved=await withSession(full,()=>transitionWareneingangToGalvanikAction({orderId,expectedVersion:1,clientEventId:randomUUID()}));
 if(moved.code!=='OK')throw Error('FIXTURE_HANDOFF:'+moved.code);
 const {storeItemPhoto}=await import('./photoFixture');
 for(const item of created.receipt.items)await storeItemPhoto(orderId,item.id);
 const finished=await withSession(full,()=>setOrderItemFinishedAction({orderId,itemId:created.receipt.items[0].id,expectedVersion:moved.receipt.aggregateVersion,clientEventId:randomUUID(),finished:true}));
 if(finished.code!=='OK')throw Error('FIXTURE_PART:'+finished.code);
 const master=await withSession(full,()=>getExtraWorkMasterDataAction());
 if(master.code!=='OK')throw Error('FIXTURE_RATE_READ:'+master.code);
 if(!master.data.currentRate){const rate=await withSession(full,()=>setExtraWorkHourlyRateAction({rateId:randomUUID(),expectedVersion:0,hourlyRateCents:14000,clientEventId:randomUUID()}));if(rate.code!=='OK')throw Error('FIXTURE_RATE:'+rate.code);}
 // H3 independently retains the red mandatory-photo boundary. This fixture uses
 // the current completion command solely to reach the later invoice/release gate.
 const frozen=await withSession(full,()=>freezeOrderAction({orderId,freezeId:randomUUID(),expectedVersion:finished.receipt.aggregateVersion,clientEventId:randomUUID()}));
 if(frozen.code!=='OK')throw Error('FIXTURE_FREEZE:'+frozen.code);
 if(!KREILE_TENANT_SLUG.startsWith('TEST-ablauf-'))throw Error('FIXTURE_SYNTHETIC_TENANT_REQUIRED');
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days)
 SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST Ablauf Galvanik','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14
 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 const {issueInvoiceAction}=await import('@/app/actions/invoices.actions');
 const issueInput={orderId,expectedVersion:frozen.receipt.aggregateVersion,clientEventId:randomUUID()};
 const issuanceResults=await Promise.all(Array.from({length:concurrentIssue?2:1},()=>withSession(full,()=>issueInvoiceAction(structuredClone(issueInput)))));
 const issued=issuanceResults[0];
 if(issued.code!=='OK')throw Error('FIXTURE_INVOICE:'+issued.code+':'+('message'in issued?issued.message:''));
 return {customerId,orderId,invoice:issued.receipt,version:issued.receipt.orderVersion,issueInput,items:created.receipt.items,issuanceResults};
}
