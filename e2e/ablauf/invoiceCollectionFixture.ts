// Explicit SYNTHETIC initial historical TEST records; issuance remains real.
// Shared fixture only: no clock override, guard change or production import.
import {randomUUID} from 'node:crypto';
import {KREILE_TENANT_SLUG as tenant} from '@/lib/tenant';
import {sql} from './replayHarness';

export async function historicalCollection(rates:readonly number[],existing?:{customerId:string;agreementId:string}){
 if(!tenant.startsWith('TEST-ablauf-')||rates.length!==3)throw Error('TEST_HISTORICAL_SOURCE_REQUIRED');
 const [clock]=await sql`SELECT to_char(date_trunc('month',statement_timestamp() AT TIME ZONE 'Europe/Berlin')-interval '1 month','YYYY-MM-DD') AS month`;
 const month=String(clock.month),frozenAt=month.slice(0,8)+'10T12:00:00.000Z',handoverAt=month.slice(0,8)+'12T12:00:00.000Z',start=month+'T08:00:00.000Z';
 const customerId=existing?existing.customerId:randomUUID(),historicalActor=randomUUID(),rateId=randomUUID(),agreementId=existing?existing.agreementId:randomUUID(),collectionId=randomUUID();
 const members:Array<{orderId:string;number:string;freezeId:string}> = [];
 try{await sql.begin(async tx=>{
  if(existing){
   const known=await tx`SELECT agreement.id FROM public.customer_agreements agreement JOIN public.customers customer ON customer.tenant_id=agreement.tenant_id AND customer.id=agreement.customer_id WHERE agreement.tenant_id=${tenant} AND agreement.id=${agreementId}::uuid AND agreement.customer_id=${customerId} AND agreement.typ='sammelrechnung'`;
   if(known.length!==1)throw Error('TEST_EXISTING_COLLECTION_CUSTOMER_REQUIRED');
  }
  await tx`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,created_at,updated_at)
   VALUES(${historicalActor}::uuid,${tenant},${'TEST-old-'+historicalActor+'@example.invalid'},'TEST Historical Source','meister',false,${start}::timestamptz,${start}::timestamptz)`;
  if(!existing)await tx`INSERT INTO public.customers(id,tenant_id,customer_number,name,company_name,type,contact_person,email,phone,street,house_number,zip_code,city,country,payment_preference,ziel_freigeschaltet,ziel_tage,source,first_name,last_name,salutation,created_at,updated_at)
   VALUES(${customerId},${tenant},${'TEST-'+customerId},'TEST Collection Customer','TEST Collection Customer GmbH','business','TEST Person',${'TEST-'+customerId+'@example.invalid'},'+49 711 5550189','TEST Weg','1','70176','Stuttgart','DE','rechnung',true,14,'manual','TEST','Person','ohne',${start}::timestamptz,${start}::timestamptz)`;
  await tx`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days,versand_pauschale_netto_cents)
   SELECT ${randomUUID()},${tenant},'TEST Collection Seller','TEST Seller 1','70176','Stuttgart','DE','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14,1000 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
  await tx`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by,effective_at)
   SELECT ${rateId}::uuid,${tenant},14000,1,${historicalActor}::uuid,${start}::timestamptz WHERE NOT EXISTS(SELECT 1 FROM private.extra_work_hourly_rates WHERE tenant_id=${tenant})`;
  const [existingRate]=await tx`SELECT id::text FROM private.extra_work_hourly_rates WHERE tenant_id=${tenant} ORDER BY version DESC LIMIT 1`;
  if(!existing)await tx`INSERT INTO public.customer_agreements(id,tenant_id,customer_id,position,bezeichnung,typ,ziel_tage,geld,hinweis,grund,version,client_key,created_at,created_by)
   VALUES(${agreementId}::uuid,${tenant},${customerId},1,'TEST Monthly Collection','sammelrechnung',30,true,false,'TEST agreed monthly invoice',1,${randomUUID()}::uuid,${start}::timestamptz,${historicalActor}::uuid)`;
  await tx`INSERT INTO public.invoice_collections(id,tenant_id,customer_id,monat,ziel_tage,status,version,created_at,created_by)
   VALUES(${collectionId}::uuid,${tenant},${customerId},${month}::date,30,'offen',1,${start}::timestamptz,${historicalActor}::uuid)`;
  for(let i=0;i<3;i++){
   const orderId=randomUUID(),freezeId=randomUUID(),freezeEvent=randomUUID(),number='TEST-COL-'+randomUUID().slice(0,8);
   await tx`INSERT INTO public.orders(id,tenant_id,order_number,customer_id,title,station,current_station,current_station_id,status,version,payment_mode,payment_mode_version,handover_mode,source,created_at,due_date,geprueft)
    VALUES(${orderId},${tenant},${number},${customerId},${'TEST Historical Member '+i},'abgeholt','abgeholt','abgeholt','abgeholt',3,'rechnung',0,'pickup','F1_ORDER_INTAKE',${start}::timestamptz,${frozenAt}::timestamptz,true)`;
   await tx`INSERT INTO public.items(id,tenant_id,order_id,customer_id,name,quantity,current_station_id,preis_netto,unit,vat_rate_basis_points,material,surface_requested,created_at)
    VALUES(${randomUUID()},${tenant},${orderId},${customerId},${'TEST Collection Part '+i},1,'abgeholt',${i===2?'33.34':'33.33'}::numeric,'Stück',${rates[i]},'Messing','Verchromen',${start}::timestamptz)`;
   const payload={freezeId,rateId:existingRate.id,hourlyRateCents:14000,totalAmountCents:0,lineCount:0};
   await tx`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,created_at,payload,status,station,from_station,client_event_id,event_schema_version,correlation_id,aggregate_version)
    VALUES(${freezeEvent},${tenant},${orderId},'ORDER_FROZEN_V1','TEST SYNTHETIC initial historical freeze',${historicalActor}::uuid,${frozenAt}::timestamptz AT TIME ZONE 'UTC',${tx.json(payload)}::jsonb,'success','fertig','galvanik',${randomUUID()}::uuid,1,${randomUUID()}::uuid,2)`;
   await tx`INSERT INTO private.order_freezes(id,tenant_id,order_id,event_id,hourly_rate_id,hourly_rate_cents,total_amount_cents,line_count,order_version,frozen_by,frozen_at)
    VALUES(${freezeId}::uuid,${tenant},${orderId},${freezeEvent},${existingRate.id}::uuid,14000,0,0,2,${historicalActor}::uuid,${frozenAt}::timestamptz)`;
   await tx`INSERT INTO public.invoice_collection_orders(collection_id,tenant_id,order_id,created_at) VALUES(${collectionId}::uuid,${tenant},${orderId},${handoverAt}::timestamptz)`;
   const out={orderId,orderVersion:3,paymentMode:'rechnung',mode:'abholung',gateAllowed:true,settlement:'collection',agreementId,agreementType:'sammelrechnung',agreementVersion:1};
   await tx`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,created_at,payload,status,station,from_station,client_event_id,event_schema_version,correlation_id,aggregate_version)
    VALUES(${randomUUID()},${tenant},${orderId},'ORDER_PICKED_UP_V3','TEST SYNTHETIC initial historical handover',${historicalActor}::uuid,${handoverAt}::timestamptz AT TIME ZONE 'UTC',${tx.json(out)}::jsonb,'success','abgeholt','fertig',${randomUUID()}::uuid,3,${randomUUID()}::uuid,3)`;
   members.push({orderId,number,freezeId});
  }
 });}catch(error){console.error('[TEST_HISTORICAL_SOURCE_CONSTRAINT]',(error as {detail?:string}).detail);throw error;}
 return {collectionId,customerId,agreementId,month,members};
}
