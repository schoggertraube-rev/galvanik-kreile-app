import 'server-only';
import {sql} from 'drizzle-orm';
import {isDeepStrictEqual} from 'node:util';
import {hasAuthorizationArea,resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {INTAKE_CONCERN_AREAS,type IntakeSelectionInput,type IntakeUseInput,type IntakeReopenInput,type IntakeUseResult} from '../intakeLifecycleContract';
import type {IntakeCaptureResult} from '../captureContract';
import {intakeCaptureSnapshot} from './intakeCapture';

type Failure=Exclude<IntakeCaptureResult,{code:'OK'}>;
type Source={id:string;kanal:string;erstellt_von:string;version:number;kunde_id:string|null;vorgang_art:string|null;vorgang_id:string|null;zuordnung:string;einsatz:string;einsatz_aktion:string|null;anliegen:string[];anliegen_offen:string[];aussortiert:string|null};
class Rejected extends Error{constructor(readonly result:Failure){super(result.code);}}
class InvoiceReviewRequired extends Error{constructor(readonly itemId:string){super('INTAKE_INVOICE_REVIEW_REQUIRED');}}
function reject(code:Failure['code'],message:string):never{throw new Rejected({code,message});}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,expected:string)=>Object.keys(v).sort().join(',')===expected;
const identity=(v:Record<string,unknown>)=>uuid(v.itemId)&&Number.isSafeInteger(v.version)&&(v.version as number)>0;
const strings=(values:string[])=>sql`ARRAY[${sql.join(values.map(value=>sql`${value}`),sql`, `)}]::text[]`;
function mayWrite(auth:AuthorizationSnapshot,row:Source){return hasAuthorizationArea(auth,'mails')||row.kanal!=='mail'&&row.erstellt_von===auth.userId&&hasAuthorizationArea(auth,'eingang');}
async function session(){const auth=await resolveAuthorization();if(!auth.ok)reject(auth.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED','Sitzung konnte nicht geprüft werden. Code: INTAKE_LIFECYCLE_SESSION.');return auth.data;}
function failure(error:unknown):Failure{console.error('[INTAKE_LIFECYCLE_FAILED]',{code:error instanceof Rejected?error.result.code:'INTAKE_LIFECYCLE_FAILED',message:error instanceof Error?error.message:'UnknownError'});return error instanceof Rejected?error.result:{code:'UNAVAILABLE',message:'Nicht gespeichert · Eingaben bleiben erhalten. Code: INTAKE_LIFECYCLE_FAILED.'};}
async function source(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string){
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${id},0))`);
 const rows=await tx.execute<Source>(sql`SELECT id::text,kanal,erstellt_von::text,version,kunde_id,vorgang_art,vorgang_id,zuordnung,einsatz,einsatz_aktion,anliegen,anliegen_offen,aussortiert
  FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid FOR UPDATE`);
 if(rows.length!==1)reject('NOT_FOUND','Eingang nicht verfügbar.');
 if(!mayWrite(auth,rows[0]))reject('FORBIDDEN','Dieses Anliegen benötigt Mails oder den eigenen Eingang.');
 return rows[0];
}
async function repeated(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,row:Source,key:string,art:string,intent:unknown){
 const rows=await tx.execute<{von:string;nachher:{intent:unknown;version:number}}>(sql`SELECT von,nachher FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${row.id}::uuid AND art=${art} AND befehl_id=${key}::uuid`);
 if(!rows.length)return false;
 if(rows.length!==1||rows[0].von!==auth.userId||!isDeepStrictEqual(rows[0].nachher.intent,intent)||rows[0].nachher.version!==row.version)reject('CONFLICT','Diese Anfragekennung wurde bereits anders verwendet oder der Eingang wurde inzwischen geändert.');
 return true;
}
async function event(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,row:Source,key:string,art:string,intent:unknown,after:unknown){
 await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
  VALUES(${auth.tenantId},${row.id}::uuid,${art},${key}::uuid,${auth.userId},${JSON.stringify(row)}::jsonb,${JSON.stringify({intent,version:row.version+1,...after as object})}::jsonb)`);
}
/** M6 persists the selected concern before the caller opens its existing target. */
export async function selectIntakeConcern(input:unknown):Promise<IntakeCaptureResult>{
 if(!record(input)||!keys(input,'clientEventId,concern,itemId,version')||!identity(input)||!uuid(input.clientEventId)||typeof input.concern!=='string'||!Object.hasOwn(INTAKE_CONCERN_AREAS,input.concern))return {code:'VALIDATION_ERROR',message:'Anliegen oder Eingangsstand ist ungültig.'};
 const value=input as IntakeSelectionInput;
 try{const auth=await session();await withPrivilegedTenantTransaction(auth,async tx=>{
  const row=await source(tx,auth,value.itemId);
  if(INTAKE_CONCERN_AREAS[value.concern].some(area=>!hasAuthorizationArea(auth,area)))reject('FORBIDDEN','Das gewählte Anliegen ist für diesen Login nicht freigegeben.');
  const intent={command:'eingang.anliegen',concern:value.concern,version:value.version};
  if(await repeated(tx,auth,row,value.clientEventId,'anliegen',intent))return;
  if(row.version!==value.version)reject('CONFLICT','Eingang wurde inzwischen geändert · bitte neu lesen.');
  if(row.einsatz!=='offen')reject('CONFLICT','Eingang ist bereits erledigt · zuerst mit Grund wieder öffnen.');
  const concerns=[value.concern,...row.anliegen_offen.filter(id=>id!=='lesen'&&id!==value.concern)];
  await tx.execute(sql`UPDATE public.intake_item SET anliegen=${strings(concerns)},anliegen_offen=${strings(concerns)},anliegen_haupt=${value.concern},version=version+1,
   geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${value.version}`);
  await event(tx,auth,row,value.clientEventId,'anliegen',intent,{anliegen:concerns,anliegen_offen:concerns,einsatz:'offen'});
 });return await intakeCaptureSnapshot(auth,value.itemId);}catch(error){return failure(error);}
}
/** Explicit Info/Erledigt is the documented override, even while a reply draft exists. */
export async function finishIntakeUse(input:unknown):Promise<IntakeUseResult>{
 if(!record(input)||!keys(input,'clientEventId,items,kind,note')||!uuid(input.clientEventId)||!['info','erledigt'].includes(String(input.kind))
  ||!(input.note===null||typeof input.note==='string'&&input.note.length<=2000)||!Array.isArray(input.items)||!input.items.length||input.items.length>100
  ||input.items.some(item=>!record(item)||!keys(item,'itemId,version')||!identity(item))||new Set(input.items.map(item=>item.itemId)).size!==input.items.length)return {code:'VALIDATION_ERROR',message:'Eingänge oder Vermerk sind ungültig.'};
 const value=input as IntakeUseInput;
 try{const auth=await session();await withPrivilegedTenantTransaction(auth,async tx=>{
  for(const item of [...value.items].sort((a,b)=>a.itemId.localeCompare(b.itemId))){
   const row=await source(tx,auth,item.itemId),intent={command:'eingang.einsatz_erledigen',kind:value.kind,note:value.note,version:item.version};
   if(await repeated(tx,auth,row,value.clientEventId,'einsatz',intent))continue;
   if(row.version!==item.version)reject('CONFLICT','Ein Eingang wurde inzwischen geändert · nichts gespeichert.');
   if(row.einsatz!=='offen')reject('CONFLICT','Ein Eingang ist bereits erledigt · nichts gespeichert.');
   if(row.anliegen.includes('rechnung')&&!(row.vorgang_art==='rechnung'&&row.vorgang_id))throw new InvoiceReviewRequired(row.id);
   await tx.execute(sql`UPDATE public.intake_item SET einsatz=${value.kind},anliegen_offen='{}'::text[],einsatz_aktion=${value.kind},einsatz_vermerk=${value.note},einsatz_am=statement_timestamp(),einsatz_von=${auth.userId}::uuid,
    geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${item.version}`);
   await event(tx,auth,row,value.clientEventId,'einsatz',intent,{einsatz:value.kind,anliegen_offen:[],vermerk:value.note});
  }
 });const captures=[];for(const item of value.items){const read=await intakeCaptureSnapshot(auth,item.itemId);if(read.code!=='OK')return read;captures.push(read.capture);}return {code:'OK',captures};}catch(error){
  if(error instanceof InvoiceReviewRequired){console.error('[INTAKE_INVOICE_REVIEW_REQUIRED]',{itemId:error.itemId});return {code:'INVOICE_REVIEW_REQUIRED',itemId:error.itemId,message:'Sieht aus wie eine Rechnung · Eingang bleibt offen. Rechnung prüfen.'};}
  return failure(error);
 }
}
export async function reopenIntake(input:unknown):Promise<IntakeCaptureResult>{
 if(!record(input)||!keys(input,'clientEventId,itemId,reason,version')||!identity(input)||!uuid(input.clientEventId)||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.length>200)return {code:'VALIDATION_ERROR',message:'Grund fehlt · 3 bis 200 Zeichen erforderlich.'};
 const value=input as IntakeReopenInput;
 try{const auth=await session();if(!hasAuthorizationArea(auth,'mails'))reject('FORBIDDEN','Wieder öffnen erfordert Mails.');
  await withPrivilegedTenantTransaction(auth,async tx=>{
   const row=await source(tx,auth,value.itemId),intent={command:'eingang.wieder_oeffnen',reason:value.reason.trim(),version:value.version};
   if(await repeated(tx,auth,row,value.clientEventId,'wieder_geoeffnet',intent))return;
   if(row.version!==value.version)reject('CONFLICT','Eingang wurde inzwischen geändert · bitte neu lesen.');
   if(row.einsatz==='offen'&&row.aussortiert===null)reject('CONFLICT','Eingang ist bereits offen.');
   const withoutTarget=row.vorgang_id===null&&(row.einsatz==='info'||row.einsatz_aktion==='kein_gv');
   await tx.execute(sql`UPDATE public.intake_item SET einsatz='offen',anliegen_offen=anliegen,wartet_seit=statement_timestamp(),aussortiert=NULL,
    zuordnung=${withoutTarget?'offen':row.zuordnung},kunde_id=${withoutTarget?null:row.kunde_id},vorgang_art=${withoutTarget?null:row.vorgang_art},vorgang_id=${withoutTarget?null:row.vorgang_id},
    geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${value.version}`);
   await event(tx,auth,row,value.clientEventId,'wieder_geoeffnet',intent,{einsatz:'offen',anliegen_offen:row.anliegen,grund:value.reason.trim(),zuordnung:withoutTarget?'offen':row.zuordnung});
  });return await intakeCaptureSnapshot(auth,value.itemId);
 }catch(error){return failure(error);}
}
