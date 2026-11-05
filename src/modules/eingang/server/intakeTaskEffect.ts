import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {CustomerStoredProfile} from '@/modules/customers/public';
import {writeIntakeNoteInTransaction} from './intakeCapture';

type Effect={key:string;taskId:string;action:'angelegt'|'geaendert'|'erledigt';kind:string;title:string;note:string|null;reference:{type:string;id:string|null;customerId:string|null;customerType:string|null;orderId:string|null};itemId?:string;itemVersion?:number};
type CustomerReader=(tx:PrivilegedTenantTransaction,tenantId:string,id:string)=>Promise<CustomerStoredProfile|null>;

/** Task and its visible history use the existing original/event writer in the same transaction. */
export async function recordIntakeTaskEffect(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:Effect,readCustomer:CustomerReader){
 let targetItem=input.itemId;
 if(targetItem){
  const sources=await tx.execute<{id:string;kanal:string;erstellt_von:string;version:number;kunde_id:string|null;vorgang_art:string|null;vorgang_id:string|null;anliegen_offen:string[]}>(sql`SELECT id::text,kanal,erstellt_von::text,version,kunde_id,vorgang_art,vorgang_id,anliegen_offen
   FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${targetItem}::uuid FOR UPDATE`);
  if(sources.length!==1)return {code:'NOT_FOUND' as const,message:'Auslösender Eingang nicht verfügbar.'};const source=sources[0];
  if(!hasAuthorizationArea(auth,'mails')&&(source.kanal==='mail'||!hasAuthorizationArea(auth,'eingang')||source.erstellt_von!==auth.userId))return {code:'FORBIDDEN' as const,message:'Dieses Anliegen benötigt Mails oder den eigenen Eingang.'};
  if(source.version!==input.itemVersion)return {code:'CONFLICT' as const,message:'Eingang wurde inzwischen geändert · Eingaben bleiben erhalten.'};
  if(source.kunde_id&&source.kunde_id!==input.reference.customerId||source.vorgang_id&&input.reference.orderId&&source.vorgang_id!==input.reference.orderId)return {code:'CONFLICT' as const,message:'Eingang gehört zu einem anderen Bezug.'};
  if(!['rueckruf','frist','aufgabe'].includes(input.kind)||!source.anliegen_offen.includes(input.kind))return {code:'CONFLICT' as const,message:'Dieses Anliegen ist nicht mehr offen.'};
  const concerns=source.anliegen_offen.filter(value=>value!==input.kind);
  const waiting=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND antwort_auf_item=${targetItem}::uuid AND sendestatus IN ('entwurf','sendet','unklar','fehler') LIMIT 1`);
  const usage=concerns.length||waiting.length?'offen':'erledigt';
  const changed=await tx.execute(sql`UPDATE public.intake_item SET anliegen_offen=ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[],einsatz=${usage},
   kunde_id=${source.kunde_id??input.reference.customerId},vorgang_art=${source.vorgang_art??(input.reference.orderId?'auftrag':null)},vorgang_id=${source.vorgang_id??input.reference.orderId},zuordnung=${source.kunde_id||input.reference.customerId?'hand':'offen'},
   geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1
   WHERE tenant_id=${auth.tenantId} AND id=${targetItem}::uuid AND version=${source.version} RETURNING id`);
  if(changed.length!==1)throw Error('TASK_SOURCE_WRITE_CONFLICT');
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
   VALUES(${auth.tenantId},${targetItem}::uuid,'anliegen',${input.key}::uuid,${auth.userId},${JSON.stringify(source)}::jsonb,
    ${JSON.stringify({action:'aufgabe.'+input.action,taskId:input.taskId,anliegenOffen:concerns,einsatz:usage})}::jsonb)`);
  return;
 }
 const text=input.action==='erledigt'?(input.note??'Aufgabe „'+input.title+'“ erledigt'):'Aufgabe „'+input.title+'“ '+input.action+(input.note?'\n'+input.note:'');
 const note={itemId:input.key,textstand:input.key,text,concerns:[],context:input.reference.orderId?{orderId:input.reference.orderId,customerId:input.reference.customerId??undefined}:input.reference.customerId?{customerId:input.reference.customerId}:undefined};
 const failure=await writeIntakeNoteInTransaction(tx,auth,note,readCustomer,input.reference.orderId?input.reference.customerId:null);
 if(failure)throw Error('TASK_HISTORY_'+failure.code);
 if(input.reference.type==='eingang')await tx.execute(sql`UPDATE public.intake_item SET verweis_item=${input.reference.id}::uuid WHERE tenant_id=${auth.tenantId} AND id=${input.key}::uuid`);
 targetItem=input.key;
 await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
  VALUES(${auth.tenantId},${targetItem}::uuid,'einsatz',${input.key}::uuid,${auth.userId},${JSON.stringify({action:'aufgabe.'+input.action,taskId:input.taskId,bezugTyp:input.reference.type,bezugId:input.reference.id})}::jsonb)`);
}
