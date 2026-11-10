import 'server-only';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import {customerCountryLabel,customerFieldError,EMPTY_CUSTOMER_FORM} from '@/modules/customers/public';
import type {ShippingSettings,CompanyLetterSettings} from '@/modules/fundament/public';
import type {OperationalOrder} from '@/lib/types/operationalOrder';
import type {StorageLetterSnapshot} from '@/lib/pdf/StorageLetterDocument';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {COLLECTION_REMINDER_COPY as copy} from '@/ui/situationCatalog';

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
 if(!letter||letter.state!=='DUE'||candidates.some(order=>letter.orderIds.includes(order.id)&&(order.finishedDispatch?.reminder?.requiresResponseCheck!==false||order.finishedDispatch?.pickupAppointment!==undefined)))return {code:'CONFLICT' as const,message:copy.notReady};
 const members=candidates.filter(order=>letter.orderIds.includes(order.id)).sort((a,b)=>a.id.localeCompare(b.id));
 if(members.length!==letter.orderIds.length)return {code:'CONFLICT' as const,message:copy.notReady};
 try{
  const [customer,sender]=await Promise.all([ports.readCustomer(),ports.readCompany()]);
  if(!customer)return {code:'NOT_FOUND' as const,message:copy.letterAddressMissing};
  const country=customer.country,zip=customer.zipCode;
  if(!customer.name?.trim()||!customer.street?.trim()||!zip?.trim()||!customer.city?.trim()||!country?.trim()||country==='andere'||customerFieldError('country',{...EMPTY_CUSTOMER_FORM,country})||customerFieldError('zipCode',{...EMPTY_CUSTOMER_FORM,country,zipCode:zip}))return {code:'VALIDATION_ERROR' as const,message:copy.letterAddressMissing};
  if(sender.code!=='OK')return {code:sender.code==='FORBIDDEN'?'FORBIDDEN' as const:'VALIDATION_ERROR' as const,message:copy.letterSenderMissing};
  const numbers=members.map(order=>order.orderNumber),snapshot:StorageLetterSnapshot={date:berlinCalendarDay(),company:sender.company,
   recipient:{name:customer.name,street:[customer.street,customer.houseNumber].filter(Boolean).join(' '),zip,city:customer.city,country:customerCountryLabel(country)},
   orderNumbers:numbers,body:copy.letterBody(numbers,settings.dispatchPolicy?.finalStageAfterLetterDays??null)};
  return {code:'OK' as const,data:{snapshot,clientKey:letter.clientKey,channel:customer.email?.trim()?'mail' as const:'postal' as const,orders:members.map(order=>({id:order.id,version:order.version,number:order.orderNumber})),callTaskId:letter.callTaskId,freezes:letter.freezes,settingsUpdatedAt:settings.updatedAt}};
 }catch(error){console.error('[STORAGE_LETTER_PREVIEW_READ_FAILED]',error instanceof Error?error.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:copy.proofUnavailable};}
}
