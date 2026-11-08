import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {COMPLAINT_RESULT_TEMPLATE,COMPLAINT_GOODS_TEMPLATE,renderComplaintGoodsTemplate,renderComplaintResultTemplate,type StoredEmailTemplate} from '@/lib/email/templateContract';

type Failure={code:'FORBIDDEN'|'VALIDATION_ERROR'|'CONFLICT'|'NOT_FOUND'|'UNAVAILABLE';message:string};
const html=(value:string)=>'<p>'+value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>')+'</p>';
export async function readStoredEmailTemplates(auth:AuthorizationSnapshot):Promise<{code:'OK';templates:StoredEmailTemplate[]}|Failure>{
 if(!hasAuthorizationArea(auth,'einstellungen'))return {code:'FORBIDDEN',message:'Mailvorlagen benötigen Einstellungen.'};
 try{
  const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<StoredEmailTemplate>(sql`SELECT id::text,template_key AS key,name,subject_template AS subject,body_text_template AS body,updated_at::text AS "updatedAt" FROM public.email_templates WHERE tenant_id=${auth.tenantId} ORDER BY name,id`));
  return {code:'OK',templates:[...rows]};
 }catch(error){console.error('[EMAIL_TEMPLATE_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Mailvorlagen konnten nicht geladen werden.'};}
}
export async function saveStoredEmailTemplate(auth:AuthorizationSnapshot,input:unknown):Promise<{code:'OK';template:StoredEmailTemplate;replayed:boolean}|Failure>{
 if(!hasAuthorizationArea(auth,'einstellungen'))return {code:'FORBIDDEN',message:'Mailvorlagen benötigen Einstellungen.'};
 if(!input||typeof input!=='object'||Array.isArray(input))return {code:'VALIDATION_ERROR',message:'Mailvorlage ist ungültig.'};
 const value=input as Record<string,unknown>;
 if(Object.keys(value).sort().join(',')!=='body,clientKey,id,subject,updatedAt'||typeof value.id!=='string'||!/^[0-9a-f-]{36}$/i.test(value.id)||typeof value.clientKey!=='string'||!/^[0-9a-f-]{36}$/i.test(value.clientKey)||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt))||typeof value.subject!=='string'||!value.subject.trim()||value.subject.length>500||typeof value.body!=='string'||!value.body.trim()||value.body.length>20000)return {code:'VALIDATION_ERROR',message:'Betreff und Nachricht fehlen oder sind zu lang.'};
 const v=value as {id:string;clientKey:string;updatedAt:string;subject:string;body:string};
 const hash=createHash('sha256').update(JSON.stringify([v.id,v.updatedAt,v.subject,v.body])).digest('hex');
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('email-template:'||${auth.tenantId}||':'||${v.clientKey},0))`);
  const prior=await tx.execute<{payload:{requestHash:string;after:StoredEmailTemplate}}>(sql`SELECT payload FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${v.clientKey}::uuid AND event_type='EMAIL_TEMPLATE_UPDATED_V1'`);
  if(prior[0])return prior[0].payload.requestHash===hash?{code:'OK' as const,template:prior[0].payload.after,replayed:true}:{code:'CONFLICT' as const,message:'Dieser Speicherschlüssel gehört zu einer anderen Änderung.'};
  const old=await tx.execute<StoredEmailTemplate>(sql`SELECT id::text,template_key AS key,name,subject_template AS subject,body_text_template AS body,updated_at::text AS "updatedAt" FROM public.email_templates WHERE tenant_id=${auth.tenantId} AND id=${v.id}::uuid FOR UPDATE`);
  if(!old[0])return {code:'NOT_FOUND' as const,message:'Mailvorlage nicht gefunden.'};
  if(old[0].key.endsWith(':'+COMPLAINT_RESULT_TEMPLATE)){
   try{renderComplaintResultTemplate(v.subject+'\n'+v.body,{'Kunde':'','RK-Nummer':'','Ergebnis':'','Begründung':''});}
   catch{return {code:'VALIDATION_ERROR' as const,message:'Erlaubte Platzhalter: Kunde, RK-Nummer, Ergebnis, Begründung.'};}
  }
  if(old[0].key.endsWith(':'+COMPLAINT_GOODS_TEMPLATE)){
   try{renderComplaintGoodsTemplate(v.subject+'\n'+v.body,{Kunde:'',Auftragsnummer:'','RK-Nummer':''});}
   catch(error){console.warn('[EMAIL_TEMPLATE_VARIABLE_UNKNOWN]',error instanceof Error?error.name:'UnknownError');return {code:'VALIDATION_ERROR' as const,message:'Erlaubte Platzhalter: Kunde, Auftragsnummer, RK-Nummer.'};}
  }
  const rows=await tx.execute<StoredEmailTemplate>(sql`UPDATE public.email_templates SET subject_template=${v.subject},body_text_template=${v.body},body_html_template=${html(v.body)},updated_at=clock_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${v.id}::uuid AND updated_at=${v.updatedAt}::timestamp RETURNING id::text,template_key AS key,name,subject_template AS subject,body_text_template AS body,updated_at::text AS "updatedAt"`);
  if(!rows[0])return {code:'CONFLICT' as const,message:'Mailvorlage wurde inzwischen geändert · bitte neu laden.'};
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,created_at) VALUES(${randomUUID()}::uuid,${auth.tenantId},'EMAIL_TEMPLATE_UPDATED_V1','Mailvorlage gespeichert',${JSON.stringify({templateId:v.id,requestHash:hash,before:old[0],after:rows[0]})}::jsonb,'success',${auth.userId}::uuid,${v.clientKey}::uuid,1,${v.clientKey}::uuid,clock_timestamp())`);
  return {code:'OK' as const,template:rows[0],replayed:false};
 });}catch(error){console.error('[EMAIL_TEMPLATE_WRITE_FAILED]',error);return {code:'UNAVAILABLE',message:'Mailvorlage nicht gespeichert · Eingaben bleiben erhalten.'};}
}
export async function readComplaintResultMail(auth:AuthorizationSnapshot,values:Record<'Kunde'|'RK-Nummer'|'Ergebnis'|'Begründung',string>){
 if(!hasAuthorizationArea(auth,'kunden'))return null;
 const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{subject:string;body:string|null}>(sql`SELECT subject_template AS subject,body_text_template AS body FROM public.email_templates WHERE tenant_id=${auth.tenantId} AND template_key=${auth.tenantId+':'+COMPLAINT_RESULT_TEMPLATE}`));
 if(rows.length!==1||!rows[0].body)return null;
 return {subject:renderComplaintResultTemplate(rows[0].subject,values),body:renderComplaintResultTemplate(rows[0].body,values)};
}
export async function readComplaintGoodsMail(auth:AuthorizationSnapshot,values:Record<'Kunde'|'Auftragsnummer'|'RK-Nummer',string>){
 if(!hasAuthorizationArea(auth,'kunden'))return null;
 const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{subject:string;body:string|null}>(sql`SELECT subject_template AS subject,body_text_template AS body FROM public.email_templates WHERE tenant_id=${auth.tenantId} AND template_key=${auth.tenantId+':'+COMPLAINT_GOODS_TEMPLATE}`));
 if(rows.length!==1||!rows[0].body)return null;
 return {subject:renderComplaintGoodsTemplate(rows[0].subject,values),body:renderComplaintGoodsTemplate(rows[0].body,values)};
}
