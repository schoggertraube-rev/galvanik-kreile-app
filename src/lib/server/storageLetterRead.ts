import 'server-only';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {customerCountryLabel,customerFieldError,EMPTY_CUSTOMER_FORM} from '@/modules/customers/public';
import type {ShippingSettings,CompanyLetterSettings} from '@/modules/fundament/public';
import type {OperationalOrder} from '@/lib/types/operationalOrder';
import type {StorageLetterSnapshot} from '@/lib/pdf/StorageLetterDocument';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {freezeStorageDeadline} from './storageDeadline';
import {readOrderInformed} from './orderReleaseRead';
import {readCollectionReminderHistory} from './collectionReminderPort';
import {readDispatchCalls} from './dispatchCallPort';
import {getPaymentState} from './paymentSummaryRead';
import {CUSTOMER_COLLECTION_COPY,type CollectionCustomerFacts,COLLECTION_REMINDER_COPY as copy} from '@/ui/situationCatalog';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from './privilegedDb';
import {isAppRole,normalizeAccessAreasForRole,ROLE_LABELS,type AccessArea} from '@/lib/auth/authorizationContract';

/** Only a permission requirement leaves this reader; prices remain in the money port. */
export async function readCollectionMoneyAccess(auth:AuthorizationSnapshot,orderIds:readonly string[],settings:Pick<ShippingSettings,'dispatchPolicy'>,stage:'E1'|'E2'|'E4'){
 if(!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails'))throw Error('COLLECTION_MONEY_ACCESS_FORBIDDEN');
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{order_id:string;invoice_id:string|null;payment_open_amount_cents:number|null}>(sql`SELECT order_id,invoice_id,payment_open_amount_cents FROM private.v_goods_out_ui_state_v1 WHERE tenant_id=${auth.tenantId} AND order_id=ANY(ARRAY[${sql.join(orderIds.map(id=>sql`${id}`),sql`, `)}]::text[])`);
  if(rows.length!==new Set(orderIds).size||!rows.length)throw Error('COLLECTION_MONEY_SOURCE_MISSING');
  const payment=rows.every(row=>row.invoice_id&&row.payment_open_amount_cents!==null)&&rows.some(row=>Number(row.payment_open_amount_cents)>0);
  const required=payment||stage==='E4'&&settings.dispatchPolicy?.storageWeeklyCents!=null;
  const sendAllowed=!required||hasAuthorizationArea(auth,'geld');
  let roles:string[]=[];
  if(required){
   const users=await tx.execute<{role:string;areas:AccessArea[]}>(sql`SELECT users.role,ARRAY(SELECT rights.bereich FROM public.app_user_rights rights WHERE rights.tenant_id=users.tenant_id AND rights.user_id=users.id) AS areas FROM public.app_users users WHERE users.tenant_id=${auth.tenantId} AND users.active=true`);
   roles=[...new Set(users.filter(user=>isAppRole(user.role)&&normalizeAccessAreasForRole(user.role,user.areas).includes('geld')).map(user=>ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]))].sort();
  }
  return {required,sendAllowed,roles};
 });
}

export type StorageLetterRequest={customerId:string;handover:'pickup'|'shipping';clientKey:string};
export function storageLetterRequestValid(input:unknown):input is StorageLetterRequest{
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const value=input as Record<string,unknown>;
 return Object.keys(value).sort().join(',')==='clientKey,customerId,handover'&&typeof value.customerId==='string'&&value.customerId.length>0&&value.customerId.length<=128&&value.customerId===value.customerId.trim()&&['pickup','shipping'].includes(String(value.handover))&&typeof value.clientKey==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value.clientKey);
}
/** Read the existing operational projection and source profiles. A preview advances no stage. */
export async function readStorageLetterPreview(auth:AuthorizationSnapshot,input:StorageLetterRequest,orders:readonly OperationalOrder[],settings:ShippingSettings,ports:{readCustomer:()=>Promise<{name:string;street:string|null;houseNumber:string|null;zipCode:string|null;city:string|null;country:string|null;email:string|null}|null>;readCompany:()=>Promise<{code:'OK';company:CompanyLetterSettings}|{code:'FORBIDDEN'|'NOT_FOUND'|'VALIDATION_ERROR'|'UNAVAILABLE'}>}){
 if(!hasAuthorizationArea(auth,'auftraege')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:copy.forbidden};
 const candidates=orders.filter(order=>order.customerId===input.customerId&&order.station==='fertig'&&order.finishedDispatch?.handover===input.handover);
 const letter=candidates.find(order=>order.finishedDispatch?.storage?.letter?.clientKey===input.clientKey)?.finishedDispatch?.storage?.letter;
 if(!letter||letter.state!=='DUE'||candidates.some(order=>letter.orderIds.includes(order.id)&&(order.finishedDispatch?.reminder?.requiresResponseCheck!==false||order.finishedDispatch?.pickupAppointment!==undefined&&!letter.replyEventId&&letter.appointmentEventId!==order.finishedDispatch.pickupAppointment.eventId)))return {code:'CONFLICT' as const,message:copy.notReady};
 const members=candidates.filter(order=>letter.orderIds.includes(order.id)).sort((a,b)=>a.id.localeCompare(b.id));
 if(members.length!==letter.orderIds.length)return {code:'CONFLICT' as const,message:copy.notReady};
 try{
  const [customer,sender]=await Promise.all([ports.readCustomer(),ports.readCompany()]);
  if(!customer)return {code:'NOT_FOUND' as const,message:copy.letterAddressMissing};
  const access=await readCollectionMoneyAccess(auth,members.map(order=>order.id),settings,'E4');
  if(!access.sendAllowed)return {code:'FORBIDDEN' as const,message:access.roles.length?copy.moneyRequired(customer.name,access.roles.join(', ')):copy.forbidden};
  const country=customer.country,zip=customer.zipCode;
  if(!customer.name?.trim()||!customer.street?.trim()||!zip?.trim()||!customer.city?.trim()||!country?.trim()||country==='andere'||customerFieldError('country',{...EMPTY_CUSTOMER_FORM,country})||customerFieldError('zipCode',{...EMPTY_CUSTOMER_FORM,country,zipCode:zip}))return {code:'VALIDATION_ERROR' as const,message:copy.letterAddressMissing};
  if(sender.code!=='OK')return {code:sender.code==='FORBIDDEN'?'FORBIDDEN' as const:'VALIDATION_ERROR' as const,message:copy.letterSenderMissing};
  const deadline=freezeStorageDeadline(settings.dispatchPolicy),numbers=members.map(order=>order.orderNumber),customerText=await readCollectionCustomerFacts(auth,members,settings,{name:customer.name,company:sender.company.companyName},deadline.due),snapshot:StorageLetterSnapshot={date:berlinCalendarDay(),deadline,company:sender.company,
   recipient:{name:customer.name,street:[customer.street,customer.houseNumber].filter(Boolean).join(' '),zip,city:customer.city,country:customerCountryLabel(country)},
   orderNumbers:numbers,customerText,body:CUSTOMER_COLLECTION_COPY.render('E4',customerText).body};
  return {code:'OK' as const,data:{snapshot,clientKey:letter.clientKey,channel:customer.email?.trim()?'mail' as const:'postal' as const,orders:members.map(order=>({id:order.id,version:order.version,number:order.orderNumber})),callTaskId:letter.callTaskId,appointmentEventId:letter.appointmentEventId,replyEventId:letter.replyEventId,freezes:letter.freezes,settingsUpdatedAt:settings.updatedAt}};
 }catch(error){console.error('[STORAGE_LETTER_PREVIEW_READ_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:copy.proofUnavailable};}
}

/** Only qualified existing sources fill customer sentences; no current date is a substitute for a missing event. */
export async function readCollectionCustomerFacts(auth:AuthorizationSnapshot,members:readonly OperationalOrder[],settings:ShippingSettings,profile:{name:string|null;company:string|null},deadline:string|null):Promise<CollectionCustomerFacts>{
 if(!members.length)throw Error('CUSTOMER_TEXT_EMPTY_GROUP');
 const first=members[0],handover=first.finishedDispatch?.handover;if(!handover)throw Error('CUSTOMER_TEXT_HANDOVER_MISSING');
 const ids=members.map(order=>order.id),[history,calls]=await Promise.all([readCollectionReminderHistory(auth,first.customerId,handover,ids),readDispatchCalls(auth,first.customerId,handover,ids)]);
 const facts:CollectionCustomerFacts={name:profile.name,company:profile.company,deadline,members:[]};let open=0,allPayments=true;
 for(const order of members){
  const informed=await readOrderInformed(auth,order.id);if(informed.code!=='OK')throw Error('CUSTOMER_TEXT_FINISHED_SOURCE_UNAVAILABLE');
  const sent=(stage:'E1'|'E2')=>history.filter(row=>row.stage===stage&&row.orderIds.includes(order.id)&&row.sentAt&&informed.frozenAt&&Date.parse(row.sentAt)>=Date.parse(informed.firstInformed?.recordedAt??informed.frozenAt)&&!row.deliveryFailedAt&&!row.voidId).sort((a,b)=>a.sentAt!.localeCompare(b.sentAt!)).at(-1)?.sentAt;
  const call=calls.find(row=>row.orderIds.includes(order.id)&&row.freezes.some(proof=>proof.orderId===order.id&&proof.freezeId===informed.freezeId)&&row.result==='notReached'&&row.recordedAt);
  facts.members.push({number:order.orderNumber,quantity:order.parts.length?order.parts.reduce((sum,part)=>sum+part.quantity,0):null,finishedDate:informed.frozenAt?berlinCalendarDay(new Date(informed.frozenAt)):null,e1Date:sent('E1')?berlinCalendarDay(new Date(sent('E1')!)):null,e2Date:sent('E2')?berlinCalendarDay(new Date(sent('E2')!)):null,callDate:call?.recordedAt?berlinCalendarDay(new Date(call.recordedAt)):null});
  if(hasAuthorizationArea(auth,'geld')){const payment=await getPaymentState(auth,order.id);if(payment.code!=='OK'||!payment.data.payment)allPayments=false;else open+=payment.data.payment.openAmountCents;}else allPayments=false;
 }
 const money=(cents:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
 if(allPayments&&open>0)facts.openAmount=money(open);
 if(hasAuthorizationArea(auth,'geld')&&settings.dispatchPolicy?.storageWeeklyCents!=null){facts.storageAmount=money(settings.dispatchPolicy.storageWeeklyCents);facts.storageUnit='Woche';}
 return facts;
}
