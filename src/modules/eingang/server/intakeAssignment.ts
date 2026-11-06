import 'server-only';
import {sql} from 'drizzle-orm';
import {isDeepStrictEqual} from 'node:util';
import {hasAuthorizationArea,resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {ACCESS_AREAS} from '@/lib/auth/authorizationContract';
import type {CustomerStoredProfile} from '@/modules/customers/public';
import type {CustomerWriter} from '@/lib/server/commands/orderIntakeCommand';
import type {CustomerCreateCommandResult} from '@/modules/customers/public';
import type {AssignmentReadResult,AssignmentFailure,AssignmentCustomer,AssignmentInput,AssignmentResult,NoBusinessInput,NoBusinessResult} from '../assignmentContract';
import {intakeInvoiceReviewRequired} from '../intakeLifecycleContract';

type CustomerReader=(tx:PrivilegedTenantTransaction,tenantId:string,id:string)=>Promise<CustomerStoredProfile|null>;
type Source={id:string;version:number;kanal:string;richtung:string;zuordnung:string;einsatz:string;erstellt_von:string;geaendert_von:string|null;kunde_id:string|null;vorgang_art:string|null;vorgang_id:string|null;gruppe_adresse:string|null;absender_name:string|null;absender_adresse:string|null;betreff:string|null;text:string|null;at:string;anliegen:string[];anliegen_offen:string[]};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
class Rejected extends Error{constructor(readonly result:AssignmentFailure){super(result.code);}}
function reject(code:AssignmentFailure['code'],message:string):never{throw new Rejected({code,message});}
function failed(error:unknown):AssignmentFailure{console.error('[INTAKE_ASSIGNMENT_FAILED]',{code:error instanceof Rejected?error.result.code:'INTAKE_ASSIGNMENT_FAILED',message:error instanceof Rejected?error.result.message:error instanceof Error?error.message:'UnknownError'});return error instanceof Rejected?error.result:{code:'UNAVAILABLE',message:'Nicht gespeichert · alle Eingaben sind noch da. Code: INTAKE_ASSIGNMENT_FAILED.'};}
async function session(){const auth=await resolveAuthorization();if(!auth.ok)reject(auth.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED','Sitzung konnte nicht geprüft werden.');return auth.data;}
async function source(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,lock=false){
 if(lock)await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${id},0))`);
 const rows=await tx.execute<Source>(sql`SELECT id::text,version,kanal,richtung,zuordnung,einsatz,erstellt_von::text,geaendert_von::text,kunde_id,vorgang_art,vorgang_id,gruppe_adresse,absender_name,absender_adresse,betreff,text,
  coalesce(empfangen_am,erstellt_am)::text AS at,anliegen,anliegen_offen FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid ${lock?sql`FOR UPDATE`:sql``}`);
 if(rows.length!==1)reject('NOT_FOUND','Eingang nicht verfügbar.');return rows[0];
}
async function customer(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,read:CustomerReader):Promise<AssignmentCustomer>{
 const row=await read(tx,auth.tenantId,id);if(!row)reject('NOT_FOUND','Kunde nicht verfügbar.');if(row.customerType==='lieferant'&&!hasAuthorizationArea(auth,'geld'))reject('FORBIDDEN','Lieferanten benötigen das Recht Geld.');return {id:row.id,name:row.name,type:row.customerType,reason:null};
}
async function suggestions(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string){return tx.execute<{id:string;wert:unknown;grund:string|null}>(sql`SELECT id::text,wert,grund FROM public.intake_suggestion WHERE tenant_id=${auth.tenantId} AND item_id=${id}::uuid AND feld='kunde' AND status='offen' ORDER BY id`);}
export async function readIntakeAssignment(input:unknown,readCustomer:CustomerReader):Promise<AssignmentReadResult>{
 if(!object(input)||Object.keys(input).sort().join(',')!=='itemId,mode'||!uuid(input.itemId)||!['normal','rein','kein','umhaengen'].includes(String(input.mode)))return {code:'VALIDATION_ERROR',message:'Zuordnungsaufruf ist ungültig.'};
 try{const auth=await session();if(!hasAuthorizationArea(auth,'eingang')&&!(input.mode==='kein'&&hasAuthorizationArea(auth,'mails')))reject('FORBIDDEN','Zuordnung benötigt Eingang.');
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const row=await source(tx,auth,input.itemId as string),restricted=row.kanal==='mail'&&!hasAuthorizationArea(auth,'mails'),proposals:AssignmentCustomer[]=[];
   if(hasAuthorizationArea(auth,'kunden')||hasAuthorizationArea(auth,'geld'))for(const proposal of await suggestions(tx,auth,row.id)){
    if(typeof proposal.wert!=='string'||!proposal.wert.trim()||proposals.some(value=>value.id===proposal.wert))continue;
    const profile=await readCustomer(tx,auth.tenantId,proposal.wert);if(!profile)continue;
    if(profile.customerType==='lieferant'?!hasAuthorizationArea(auth,'geld'):!hasAuthorizationArea(auth,'kunden'))continue;
    proposals.push({id:profile.id,name:profile.name,type:profile.customerType,reason:proposal.grund});
   }
   let current:AssignmentCustomer|null=null;if(row.kunde_id){const profile=await readCustomer(tx,auth.tenantId,row.kunde_id);if(profile&&(profile.customerType!=='lieferant'||hasAuthorizationArea(auth,'geld')))current={id:profile.id,name:profile.name,type:profile.customerType,reason:null};}
   const files=restricted?[]:await tx.execute<{id:string;name:string}>(sql`SELECT id::text,dateiname AS name FROM public.intake_file WHERE tenant_id=${auth.tenantId} AND item_id=${row.id}::uuid AND art<>'mime' ORDER BY reihenfolge,id`);
   const duplicates=hasAuthorizationArea(auth,'mails')?await tx.execute<{id:string;title:string|null;at:string}>(sql`SELECT id::text,coalesce(betreff,left(text,100)) AS title,coalesce(empfangen_am,erstellt_am)::text AS at FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id<>${row.id}::uuid
    AND erstellt_am>=statement_timestamp()-interval '30 days' AND einsatz_aktion IS DISTINCT FROM 'kein_gv' AND (${row.kunde_id}::text IS NOT NULL AND kunde_id=${row.kunde_id} OR ${row.gruppe_adresse}::text IS NOT NULL AND gruppe_adresse=${row.gruppe_adresse}) ORDER BY erstellt_am DESC,id DESC`):[];
   return {code:'OK' as const,view:{itemId:row.id,version:row.version,channel:row.kanal,assignment:row.zuordnung,usage:row.einsatz,senderName:row.absender_name,senderAddress:row.absender_adresse,subject:restricted?null:row.betreff,text:restricted?null:row.text,at:row.at,customer:current,proposals,files:[...files],areas:ACCESS_AREAS.filter(area=>hasAuthorizationArea(auth,area)),restricted,concerns:restricted?[]:row.anliegen,duplicates:[...duplicates]}};
  });
 }catch(error){return failed(error);}
}
function validIdentity(input:Record<string,unknown>){return uuid(input.itemId)&&uuid(input.clientEventId)&&Number.isSafeInteger(input.version)&&(input.version as number)>0;}
async function event(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,row:Source,key:string,art:string,intent:unknown,after:unknown){
 await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES(${auth.tenantId},${row.id}::uuid,${art},${key}::uuid,${auth.userId},${JSON.stringify({version:row.version,kundeId:row.kunde_id,vorgangArt:row.vorgang_art,vorgangId:row.vorgang_id,zuordnung:row.zuordnung,einsatz:row.einsatz})}::jsonb,${JSON.stringify({intent,version:row.version+1,...after as object})}::jsonb)`);
}
export async function assignIntakeCustomer(input:unknown,readCustomer:CustomerReader):Promise<AssignmentResult>{
 if(!object(input)||Object.keys(input).sort().join(',')!=='clientEventId,customerId,itemId,mode,version'||!validIdentity(input)||typeof input.customerId!=='string'||!input.customerId.trim()||input.customerId.length>128||!['confirm','manual','move'].includes(String(input.mode)))return {code:'VALIDATION_ERROR',message:'Kunde oder Eingangsstand ist ungültig.'};
 const value=input as AssignmentInput;
 try{const auth=await session();if(!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'kunden')&&!hasAuthorizationArea(auth,'geld'))reject('FORBIDDEN','Zuordnen benötigt Eingang sowie das Recht des Ziels.');
  return await withPrivilegedTenantTransaction(auth,tx=>assignInTransaction(tx,auth,value,readCustomer));
 }catch(error){return failed(error);}
}
async function assignInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,value:AssignmentInput,readCustomer:CustomerReader,propagate=true):Promise<Exclude<AssignmentResult,AssignmentFailure>>{
   // Serializes group propagation before row locks; all assignment writers use this order.
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake-assignment:'||${auth.tenantId},0))`);
   const row=await source(tx,auth,value.itemId,true),target=await customer(tx,auth,value.customerId,readCustomer),intent={command:'eingang.zuordnen',customerId:value.customerId,mode:value.mode,version:value.version};
   if(target.type!=='lieferant'&&!hasAuthorizationArea(auth,'kunden'))reject('FORBIDDEN','Kunde zuordnen benötigt Kunden.');
   const receipts=await tx.execute<{von:string;nachher:{intent:unknown;version:number;additional:number}}>(sql`SELECT von,nachher FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${row.id}::uuid AND art IN ('zugeordnet','umgehaengt') AND befehl_id=${value.clientEventId}::uuid`);
   if(receipts.length){const receipt=receipts[0];if(receipts.length!==1||receipt.von!==auth.userId||!isDeepStrictEqual(receipt.nachher.intent,intent)||row.kunde_id!==target.id||row.version!==receipt.nachher.version)reject('CONFLICT','Diese Anfragekennung gehört zu einem anderen Zuordnungsstand.');return {code:'OK' as const,customer:target,version:row.version,additional:receipt.nachher.additional,replayed:true};}
   if(value.mode!=='move'&&row.zuordnung!=='offen')return {code:'ALREADY_ASSIGNED' as const,customer:row.kunde_id?await customer(tx,auth,row.kunde_id,readCustomer):null};
   if(row.version!==value.version)reject('CONFLICT','Eingang wurde inzwischen geändert. Bitte neu lesen.');
   const proposals=await suggestions(tx,auth,row.id);
   if(value.mode==='confirm'&&(new Set(proposals.filter(proposal=>typeof proposal.wert==='string').map(proposal=>proposal.wert)).size!==1||!proposals.some(proposal=>proposal.wert===target.id)))reject('CONFLICT','Kundenvorschlag ist nicht mehr eindeutig.');
   const additional:Source[]=[];
   if(propagate&&value.mode!=='move'&&row.gruppe_adresse){
    const siblings=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND gruppe_adresse=${row.gruppe_adresse} AND zuordnung='offen' AND id<>${row.id}::uuid ORDER BY id`);
    for(const candidate of siblings){const sibling=await source(tx,auth,candidate.id,true);if((await suggestions(tx,auth,sibling.id)).some(proposal=>typeof proposal.wert==='string'&&proposal.wert!==target.id))continue;additional.push(sibling);}
   }
   for(const candidate of [row,...additional]){
    const assigned=value.mode==='confirm'&&candidate.id===row.id?'bestaetigt':'hand',art=value.mode==='move'?'umgehaengt':'zugeordnet';
    const changed=await tx.execute(sql`UPDATE public.intake_item SET kunde_id=${target.id},vorgang_art=${value.mode==='move'?null:candidate.vorgang_art},vorgang_id=${value.mode==='move'?null:candidate.vorgang_id},zuordnung=${assigned},version=version+1,
     geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${candidate.id}::uuid AND version=${candidate.version} RETURNING id`);
    if(changed.length!==1)throw Error('INTAKE_ASSIGNMENT_WRITE_CONFLICT');
    await tx.execute(sql`UPDATE public.intake_suggestion SET status='uebernommen',geprueft_von=${auth.userId}::uuid,geprueft_am=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND item_id=${candidate.id}::uuid AND feld='kunde' AND wert=${JSON.stringify(target.id)}::jsonb AND status='offen'`);
    await event(tx,auth,candidate,value.clientEventId,art,intent,{customerId:target.id,zuordnung:assigned,additional:additional.length});
   }
   return {code:'OK' as const,customer:target,version:row.version+1,additional:additional.length,replayed:false};
}
/** 3.1 from 3.4 composes the existing customer writer and the same assignment writer atomically. */
export async function createCustomerForIntake(input:unknown,writeCustomer:CustomerWriter,readCustomer:CustomerReader):Promise<CustomerCreateCommandResult|AssignmentFailure>{
 if(!object(input)||Object.keys(input).sort().join(',')!=='customer,itemId,version'||!uuid(input.itemId)||!Number.isSafeInteger(input.version)||(input.version as number)<1||!object(input.customer)||!uuid(input.customer.clientEventId))return {code:'VALIDATION_ERROR',message:'Kunde oder Eingangsstand ist ungültig.'};
 try{const auth=await session(),isSupplier=(input.customer as Record<string,unknown>).customerType==='lieferant';
  if(!hasAuthorizationArea(auth,isSupplier?'geld':'kunden')||!hasAuthorizationArea(auth,'eingang')&&!isSupplier)reject('FORBIDDEN','Neukunde aus Absender benötigt Eingang sowie das Recht des Ziels.');
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const invoiceOnly=!hasAuthorizationArea(auth,'eingang');
   const row=await source(tx,auth,input.itemId as string);
   const missingInvoiceSupplier=isSupplier&&row.vorgang_art==='rechnung'&&row.vorgang_id!==null&&row.kunde_id===null&&(await tx.execute(sql`SELECT id FROM public.supplier_invoice WHERE tenant_id=${auth.tenantId} AND id=${row.vorgang_id}::uuid AND item_id=${row.id}::uuid AND lieferant_id IS NULL AND zahlstatus='unklar' AND unklar_grund='Lieferant fehlt'`)).length===1;
   if(missingInvoiceSupplier){const locked=await source(tx,auth,row.id,true);if(locked.version!==input.version)reject('CONFLICT','Eingang wurde inzwischen geändert.');}
   if(invoiceOnly&&!missingInvoiceSupplier&&(row.einsatz!=='offen'||!row.anliegen.includes('rechnung')||row.vorgang_id!==null))reject('FORBIDDEN','Geld erlaubt Lieferantenanlage nur aus einer offenen Eingangsrechnung.');
   const saved=await writeCustomer(tx,{tenantId:auth.tenantId,userId:auth.userId,capabilities:{canCreateCustomer:true,canManageMoney:hasAuthorizationArea(auth,'geld'),canDecide:hasAuthorizationArea(auth,'entscheiden')}},input.customer);
   if(saved.code!=='OK')throw new Rejected(saved);
   if(missingInvoiceSupplier)return saved;
   const assigned=await assignInTransaction(tx,auth,{itemId:input.itemId as string,version:input.version as number,clientEventId:(input.customer as Record<string,unknown>).clientEventId as string,customerId:saved.customer.id,mode:'manual'},readCustomer,!invoiceOnly);
   if(assigned.code!=='OK')reject('CONFLICT','Eingang wurde inzwischen einem anderen Kunden zugeordnet · kein neuer Kunde gespeichert.');
   return saved;
  });
 }catch(error){return failed(error);}
}
export async function setIntakeNoBusiness(input:unknown):Promise<NoBusinessResult>{
 if(!object(input)||Object.keys(input).some(key=>!['itemId','version','clientEventId','reason','originalId'].includes(key))||!validIdentity(input)||!['werbung','privat','fehlzustellung','doppelt','info'].includes(String(input.reason))||(input.originalId!==undefined&&(!uuid(input.originalId)||input.reason!=='doppelt'))||input.reason==='doppelt'&&!uuid(input.originalId))return {code:'VALIDATION_ERROR',message:'Grund fehlt oder Original wählen.'};
 const value=input as NoBusinessInput;
 try{const auth=await session();if(!hasAuthorizationArea(auth,'mails'))reject('FORBIDDEN','Kein Geschäftsvorgang benötigt Mails.');
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const row=await source(tx,auth,value.itemId,true),intent={command:'eingang.kein_vorgang',reason:value.reason,originalId:value.originalId??null,version:value.version};
   const receipts=await tx.execute<{von:string;nachher:{intent:unknown;version:number}}>(sql`SELECT von,nachher FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${row.id}::uuid AND art='einsatz' AND befehl_id=${value.clientEventId}::uuid`);
   if(receipts.length){if(receipts.length!==1||receipts[0].von!==auth.userId||!isDeepStrictEqual(receipts[0].nachher.intent,intent)||row.version!==receipts[0].nachher.version)reject('CONFLICT','Anfragekennung gehört zu einem anderen Eingangsstand.');return {code:'OK' as const};}
   if(row.version!==value.version)reject('CONFLICT','Eingang wurde inzwischen geändert.');
   if(row.einsatz!=='offen')reject('CONFLICT','Eingang ist bereits erledigt · zuerst mit Grund wieder öffnen.');
   if(intakeInvoiceReviewRequired(row.anliegen,row.vorgang_art,row.vorgang_id))return {code:'INVOICE_REVIEW_REQUIRED' as const,itemId:row.id,message:'Sieht aus wie eine Rechnung · Eingang bleibt offen. Rechnung prüfen.'};
   if(value.reason==='doppelt'){
    if(value.originalId===row.id)reject('VALIDATION_ERROR','Ein Eingang kann nicht sein eigenes Original sein.');
    const original=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${value.originalId}::uuid AND erstellt_am>=statement_timestamp()-interval '30 days' AND einsatz_aktion IS DISTINCT FROM 'kein_gv'
     AND (${row.kunde_id}::text IS NOT NULL AND kunde_id=${row.kunde_id} OR ${row.gruppe_adresse}::text IS NOT NULL AND gruppe_adresse=${row.gruppe_adresse})`);
    if(original.length!==1)reject('VALIDATION_ERROR','Original gehört nicht zu diesem Absender oder Kunden der letzten 30 Tage.');
   }
   const usage=value.reason==='info'?'info':'erledigt';
   const changed=await tx.execute(sql`UPDATE public.intake_item SET kunde_id=NULL,vorgang_art=NULL,vorgang_id=NULL,zuordnung='hand',einsatz=${usage},anliegen_offen='{}'::text[],
    einsatz_aktion=${value.reason==='info'?'info':'kein_gv'},einsatz_vermerk=${value.reason},einsatz_am=statement_timestamp(),einsatz_von=${auth.userId}::uuid,verweis_item=${value.originalId??null}::uuid,
    geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${row.version} RETURNING id`);
   if(changed.length!==1)throw Error('INTAKE_NO_BUSINESS_WRITE_CONFLICT');await event(tx,auth,row,value.clientEventId,'einsatz',intent,{einsatz:usage,reason:value.reason,kundeId:null,vorgangId:null});return {code:'OK' as const};
  });
 }catch(error){return failed(error);}
}
