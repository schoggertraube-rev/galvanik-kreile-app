import {readIntakeActorTraces} from './actorRead';
import 'server-only';
import {invoiceAutomaticReadiness} from '../invoiceAutomation';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {sql} from 'drizzle-orm';
import {resolveAuthorization,hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {normaliseIban,type CustomerStoredProfile} from '@/modules/customers/public';
import {writeIntakeNoteInTransaction} from './intakeCapture';
import {EMPTY_INVOICE_FIELDS,invoiceCents,invoiceDecimal,invoiceDate,invoiceFieldErrors,invoiceFieldShape,
 type IncomingInvoice,type InvoiceChangeInput,type InvoiceDuplicate,type InvoiceFailure,type InvoiceFields,
 type InvoiceReadResult,type InvoiceResult,type InvoiceSaveInput,type InvoiceSupplier,type InvoiceView} from '../invoiceContract';

export type InvoiceDependencies={
 readCustomer:(tx:PrivilegedTenantTransaction,tenantId:string,id:string,lock?:boolean)=>Promise<CustomerStoredProfile|null>;
 updateCustomer:(tx:PrivilegedTenantTransaction,context:{tenantId:string;userId:string;capabilities:{canCreateCustomer:boolean;canEditCustomer:boolean;canManageMoney:boolean;canDecide:boolean}},input:unknown)=>Promise<{code:'OK';customer:CustomerStoredProfile;replayed:boolean}|InvoiceFailure>;
 createTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;clientKey:string;reason:string})=>Promise<string>;
 resolveTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;taskId:string;note:string})=>Promise<void>;
};
type Source={id:string;version:number;at:string;channel:string;sender:string|null;kunde_id:string|null;vorgang_art:string|null;vorgang_id:string|null;einsatz:string;anliegen_offen:string[];aussortiert:string|null;zuordnung:string};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const optionalText=(v:unknown,max:number)=>v===null||typeof v==='string'&&v.length<=max;
const keys=(v:object,names:string[])=>Object.keys(v).sort().join(',')===[...names].sort().join(',');
const columns=sql`id::text,nummer_intern,item_id::text,file_id::text,lieferant_id,nummer,datum::text,netto::text,ust::text,brutto::text,faellig_am::text,
 iban,iban_geprueft,zahlstatus,bezahlt_am::text,nachweis_file_id::text,verweis_id::text,dublette_grund,unklar_grund,aufgabe_id::text,ungueltig_grund,erfasst_von::text,erfasst_am::text,version`;
class Rejected extends Error{constructor(readonly result:InvoiceFailure|Extract<InvoiceResult,{code:'DUPLICATE'}>){super(result.code);}}
function reject(code:InvoiceFailure['code'],message:string,fields?:Record<string,string>):never{throw new Rejected({code,message,...(fields?{fields}:{})});}
function failure(error:unknown):InvoiceFailure|Extract<InvoiceResult,{code:'DUPLICATE'}>{
 const cause=error&&typeof error==='object'&&'cause'in error?error.cause:error;
 console.error('[INCOMING_INVOICE_FAILED]',{code:error instanceof Rejected?error.result.code:object(cause)&&typeof cause.code==='string'?cause.code:'INCOMING_INVOICE_FAILED'});
 return error instanceof Rejected?error.result:{code:'UNAVAILABLE',message:'Speichern fehlgeschlagen · alle Eingaben sind noch da. Fehlercode: INCOMING_INVOICE_FAILED.'};
}
async function authorization(){
 const result=await resolveAuthorization();if(!result.ok)reject(result.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED','Sitzung nicht verfügbar.');
 if(!hasAuthorizationArea(result.data,'geld'))reject('FORBIDDEN','Recht Geld fehlt.');return result.data;
}
async function findInvoice(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,byItem=false,lock=false){
 const rows=await tx.execute<IncomingInvoice>(sql`SELECT ${columns} FROM public.supplier_invoice WHERE tenant_id=${auth.tenantId}
  AND ${byItem?sql`item_id=${id}::uuid`:sql`id=${id}::uuid`} ${lock?sql`FOR UPDATE`:sql``}`);
 if(rows.length>1)throw Error('INVOICE_ID_AMBIGUOUS');return rows[0]??null;
}
/** Task service reads invoice facts through this injected port, never through a second table owner. */
export async function readInvoiceTaskContext(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,readCustomer:InvoiceDependencies['readCustomer']){
 if(!hasAuthorizationArea(auth,'geld'))return null;
 const invoice=await findInvoice(tx,auth,id,false,true);if(!invoice)return null;
 const selected=invoice.lieferant_id?await readCustomer(tx,auth.tenantId,invoice.lieferant_id):null;
 return {name:selected?.name??null,status:invoice.zahlstatus,taskId:invoice.aufgabe_id};
}
async function source(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,lock=false){
 if(lock)await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${id},0))`);
 const rows=await tx.execute<Source>(sql`SELECT id::text,version,coalesce(empfangen_am,erstellt_am)::text AS at,kanal AS channel,absender_name AS sender,
  kunde_id,vorgang_art,vorgang_id,einsatz,anliegen_offen,aussortiert,zuordnung FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid ${lock?sql`FOR UPDATE`:sql``}`);
 if(rows.length!==1)reject('NOT_FOUND','Eingang der Rechnung nicht verfügbar.');return rows[0];
}
function fieldsFrom(invoice:IncomingInvoice):InvoiceFields{return {
 lieferantId:invoice.lieferant_id??'',nummer:invoice.nummer??'',datum:invoice.datum??'',netto:invoice.netto??'',ust:invoice.ust??'',brutto:invoice.brutto??'',
 faelligAm:invoice.faellig_am??'',iban:invoice.iban??'',ibanGeprueft:invoice.iban_geprueft,
};}
async function supplier(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,deps:InvoiceDependencies,lock=false):Promise<InvoiceSupplier|null>{
 if(!id)return null;const value=await deps.readCustomer(tx,auth.tenantId,id,lock);
 if(!value||value.customerType!=='lieferant')reject('VALIDATION_ERROR','Lieferant ist nicht verfügbar.',{lieferantId:'Lieferant fehlt oder ist kein Lieferant'});
 return {id:value.id,name:value.name,iban:value.iban,paymentTermDays:value.paymentTermDays};
}
async function duplicate(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,fields:InvoiceFields,excludeId?:string):Promise<InvoiceDuplicate|null>{
 if(!fields.lieferantId||!fields.nummer.trim())return null;
 const rows=await tx.execute<InvoiceDuplicate>(sql`SELECT id::text,nummer AS number,nummer_intern AS "internalNumber",datum::text AS date,brutto::text AS gross,
  (datum=${invoiceDate(fields.datum)?fields.datum:null}::date AND brutto=${invoiceCents(fields.brutto)===null?null:invoiceDecimal(invoiceCents(fields.brutto)!)}::numeric) AS exact
  FROM public.supplier_invoice WHERE tenant_id=${auth.tenantId} AND lieferant_id=${fields.lieferantId} AND nummer=${fields.nummer.trim()}
  AND zahlstatus NOT IN ('doppelt','ungueltig') AND (${excludeId??null}::uuid IS NULL OR id<>${excludeId??null}::uuid)
  ORDER BY (datum=${invoiceDate(fields.datum)?fields.datum:null}::date AND brutto=${invoiceCents(fields.brutto)===null?null:invoiceDecimal(invoiceCents(fields.brutto)!)}::numeric) DESC NULLS LAST,erfasst_am,id LIMIT 1`);
 return rows.length?{...rows[0],exact:rows[0].exact===true}:null;
}
/** One read model for a fresh source and every stored invoice/status. */
export async function readIncomingInvoice(input:unknown,deps:InvoiceDependencies):Promise<InvoiceReadResult>{
 if(!object(input)||!keys(input,['id'])||!uuid(input.id))return {code:'VALIDATION_ERROR',message:'Rechnungsaufruf ist ungültig.'};
 try{const auth=await authorization();return await withPrivilegedTenantTransaction(auth,async tx=>{
  return readInvoiceView(tx,auth,input.id as string,deps);
 });}catch(error){const result=failure(error);return result.code==='DUPLICATE'?{code:'CONFLICT',message:result.message}:result;}
}
async function readInvoiceView(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,deps:InvoiceDependencies){
  const invoice=await findInvoice(tx,auth,id)??await findInvoice(tx,auth,id,true);
  const row=await source(tx,auth,invoice?.item_id??id);
  const originals=await tx.execute<{id:string;name:string;mime:string;sha256:string}>(sql`SELECT file.id::text,file.dateiname AS name,file.mime,file.sha256 FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${row.id}::uuid AND file.art<>'mime' AND file.mime<>'message/rfc822' AND lower(file.dateiname) NOT LIKE '%.eml'
   AND EXISTS(SELECT 1 FROM public.intake_event event WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.art='original_gespeichert' AND event.nachher->>'fileId'=file.id::text) ORDER BY file.reihenfolge,file.id`);
  const primaryFileId=invoice?.file_id??originals[0]?.id??null;
  const selected=await supplier(tx,auth,invoice?(invoice.lieferant_id??''):(row.kunde_id??''),deps);
  const fields=invoice?fieldsFrom(invoice):{...EMPTY_INVOICE_FIELDS,lieferantId:selected?.id??''};
  const suggestions=await tx.execute<{feld:string;wert:unknown;sicherheit:string;verified:boolean}>(sql`SELECT feld,wert,sicherheit,geprueft_am IS NOT NULL AS verified FROM public.intake_suggestion
   WHERE tenant_id=${auth.tenantId} AND item_id=${row.id}::uuid AND (file_id=${primaryFileId}::uuid OR file_id IS NULL) AND feld IN ('rechnung.nummer','rechnung.datum','rechnung.betrag','rechnung.faellig','rechnung.iban')
   AND status<>'verworfen' ORDER BY id`);
  if(!invoice)for(const suggestion of suggestions){
   const value=suggestion.wert;
   if(suggestion.feld==='rechnung.betrag'&&object(value))for(const key of ['netto','ust','brutto'] as const){if(typeof value[key]==='number'||typeof value[key]==='string')fields[key]=String(value[key]);}
   else if(typeof value==='string'){
    const key=({'rechnung.nummer':'nummer','rechnung.datum':'datum','rechnung.faellig':'faelligAm','rechnung.iban':'iban'} as Record<string,string>)[suggestion.feld];
    if(key)Object.assign(fields,{[key]:value});
   }
  }
  if(!invoice&&!fields.faelligAm&&invoiceDate(fields.datum)&&selected?.paymentTermDays!==null&&selected?.paymentTermDays!==undefined){
   const [date]=await tx.execute<{due:string}>(sql`SELECT (${fields.datum}::date+${selected.paymentTermDays}::integer)::text AS due`);fields.faelligAm=date.due;
  }
  const actorTrace=(await readIntakeActorTraces(tx,auth,[row.id],invoice?.id)).get(row.id);
  const view:InvoiceView={actorTrace,item:{id:row.id,version:row.version,at:row.at,channel:row.channel,sender:row.sender},invoice,supplier:selected,originals:[...originals],fileId:primaryFileId,
   fields,uncertain:invoice?0:suggestions.filter(value=>value.sicherheit!=='sicher'&&!value.verified).length,conflict:null,duplicate:await duplicate(tx,auth,fields,invoice?.id)};
  const secured=primaryFileId?await tx.execute(sql`SELECT file.id FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${row.id}::uuid AND file.id=${primaryFileId}::uuid AND file.art<>'mime' AND EXISTS(SELECT 1 FROM public.intake_event receipt WHERE receipt.tenant_id=file.tenant_id AND receipt.item_id=file.item_id AND receipt.art='original_gespeichert' AND receipt.nachher->>'fileId'=file.id::text AND receipt.nachher->>'sha256'=file.sha256)`):[];
  view.automation=invoiceAutomaticReadiness({fields,originalSecured:secured.length===1,supplierConfirmed:Boolean(selected&&row.kunde_id===selected.id&&row.zuordnung!=='offen'),stored:invoice!==null,duplicate:view.duplicate!==null,suggestions:[...suggestions]});
  view.canUndo=invoice?.zahlstatus==='offen';view.canRebook=false;
  if(invoice?.zahlstatus==='ungueltig'){const [last]=await tx.execute<{command:string}>(sql`SELECT nachher->>'command' AS command FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND item_id=${row.id}::uuid AND art='einsatz' AND nachher->>'invoiceId'=${invoice.id} AND nachher->>'invoiceVersion'=${String(invoice.version)} ORDER BY zeit DESC,id DESC LIMIT 1`);view.canRebook=last?.command==='rechnung.rueckgaengig';}
  return {code:'OK' as const,view};
}

function validSave(input:unknown):input is InvoiceSaveInput{
 return object(input)&&keys(input,['itemId','fileId','version','clientKey','fields','status','paidDate','proofFileId','duplicateId','duplicateReason','unclearReason',...(input.automatic===true?['automatic']:[])])
  &&uuid(input.itemId)&&uuid(input.fileId)&&uuid(input.clientKey)&&Number.isSafeInteger(input.version)&&Number(input.version)>=1&&invoiceFieldShape(input.fields)
  &&['offen','bezahlt','unklar','doppelt'].includes(String(input.status))&&optionalText(input.paidDate,10)
  &&(input.proofFileId===null||uuid(input.proofFileId))&&(input.duplicateId===null||uuid(input.duplicateId))&&optionalText(input.duplicateReason,200)&&optionalText(input.unclearReason,200);
}
function validChange(input:unknown):input is InvoiceChangeInput{
 return object(input)&&keys(input,['invoiceId','version','clientKey','result','paidDate','proofFileId','duplicateId','reason','fields',...(['undo','rebook'].includes(String(input.command))?['command']:[])])
  &&uuid(input.invoiceId)&&uuid(input.clientKey)&&Number.isSafeInteger(input.version)&&Number(input.version)>=1&&['offen','bezahlt','doppelt','ungueltig'].includes(String(input.result))
  &&optionalText(input.paidDate,10)&&(input.proofFileId===null||uuid(input.proofFileId))&&(input.duplicateId===null||uuid(input.duplicateId))
  &&optionalText(input.reason,200)&&(input.fields===null||invoiceFieldShape(input.fields));
}
async function validate(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,fields:InvoiceFields,status:string,paidDate:string|null,proofId:string|null,itemId:string,deps:InvoiceDependencies){
 const errors=invoiceFieldErrors(fields,status==='unklar'||status==='ungueltig');
 if(status==='offen'&&!fields.lieferantId)delete errors.lieferantId;
 const [clock]=await tx.execute<{today:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD') AS today`);
 if(status==='bezahlt'&&(!paidDate||!invoiceDate(paidDate)||paidDate>clock.today))errors.paidDate='Bezahlt am fehlt oder liegt in der Zukunft';
 if(Object.keys(errors).length)reject('VALIDATION_ERROR','Pflichtangaben prüfen.',errors);
 const selected=await supplier(tx,auth,fields.lieferantId,deps,true);
 if(proofId){const proof=await tx.execute(sql`SELECT file.id FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.id=${proofId}::uuid AND file.item_id=${itemId}::uuid AND EXISTS(SELECT 1 FROM public.intake_event event WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.art='original_gespeichert' AND event.nachher->>'fileId'=file.id::text)`);if(proof.length!==1)reject('VALIDATION_ERROR','Gesicherter Zahlungsnachweis dieses Eingangs fehlt.');}
 return selected;
}
async function verifyDuplicate(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,fields:InvoiceFields,status:string,referenceId:string|null,reason:string|null,excludeId?:string){
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('invoice-identity:'||${auth.tenantId}||':'||${fields.lieferantId}||':'||${fields.nummer.trim()},0))`);
 const existing=await duplicate(tx,auth,fields,excludeId);
 if(status==='doppelt'){
  if(!referenceId||referenceId===excludeId)reject('VALIDATION_ERROR','Verweis auf die vorhandene Rechnung fehlt.');
  const reference=await findInvoice(tx,auth,referenceId);
  if(!reference||reference.lieferant_id!==fields.lieferantId||reference.zahlstatus==='doppelt'||reference.zahlstatus==='ungueltig')reject('VALIDATION_ERROR','Verweis gehört nicht zu einer gültigen Rechnung dieses Lieferanten.');
 }else if(existing&&(existing.exact||!reason?.trim()))throw new Rejected({code:'DUPLICATE',message:'Rechnung gibt es schon',duplicate:existing});
 if(reason!==null&&(reason.trim().length<3||reason.trim().length>200))reject('VALIDATION_ERROR','Begründung braucht 3 bis 200 Zeichen.',{duplicateReason:'Grund fehlt'});
}
async function record(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,row:Source,key:string,command:string,intent:unknown,before:IncomingInvoice|null,after:IncomingInvoice,deps:InvoiceDependencies){
 await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES
  (${auth.tenantId},${row.id}::uuid,'einsatz',${key}::uuid,${auth.userId},${JSON.stringify(before)}::jsonb,
   ${JSON.stringify({command,intent,invoiceId:after.id,invoiceVersion:after.version,invoice:after})}::jsonb)`);
 const historyId=randomUUID(),text='Rechnung '+after.nummer_intern+' erfasst · '+after.zahlstatus+(after.faellig_am?' · fällig '+after.faellig_am:'')+(after.unklar_grund&&after.zahlstatus==='unklar'?' · '+after.unklar_grund:'');
 const result=await writeIntakeNoteInTransaction(tx,auth,{itemId:historyId,textstand:historyId,text,concerns:[],context:after.lieferant_id?{customerId:after.lieferant_id}:undefined},deps.readCustomer);
 if(result)throw new Rejected(result);
 await tx.execute(sql`UPDATE public.intake_item SET verweis_item=${row.id}::uuid WHERE tenant_id=${auth.tenantId} AND id=${historyId}::uuid`);
}
async function replay(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,row:Source,key:string,command:string,intent:unknown){
 const events=await tx.execute<{von:string;nachher:{command:string;intent:unknown;invoiceId:string;invoiceVersion:number}}>(sql`SELECT von,nachher FROM public.intake_event
  WHERE tenant_id=${auth.tenantId} AND item_id=${row.id}::uuid AND art='einsatz' AND befehl_id=${key}::uuid`);
 if(!events.length)return null;
 if(events.length!==1||events[0].von!==auth.userId||events[0].nachher.command!==command||!isDeepStrictEqual(events[0].nachher.intent,intent))reject('CONFLICT','Anfragekennung wurde bereits anders verwendet.');
 const invoice=await findInvoice(tx,auth,events[0].nachher.invoiceId);
 if(!invoice||invoice.version!==events[0].nachher.invoiceVersion)reject('CONFLICT','Rechnung wurde inzwischen geändert. Bitte neu lesen.');
 return {code:'OK' as const,invoice,replayed:true};
}
/** All four commands compose existing customer/task/history writers in this transaction. */
export async function saveIncomingInvoice(input:unknown,deps:InvoiceDependencies):Promise<InvoiceResult>{
 if(!validSave(input))return {code:'VALIDATION_ERROR',message:'Rechnungsangaben oder Eingangsstand sind ungültig.'};
 try{const auth=await authorization();return await withPrivilegedTenantTransaction(auth,async tx=>{
  const row=await source(tx,auth,input.itemId,true),command=input.status==='unklar'?'rechnung.unklar':'rechnung.erfassen';
  const repeated=await replay(tx,auth,row,input.clientKey,command,input);if(repeated)return repeated;
  if(input.automatic){
   const read=await readInvoiceView(tx,auth,row.id,deps),view=read.view;
   if(view.automation?.state!=='ready')reject('VALIDATION_ERROR','Nicht automatisch abgelegt · '+(view.automation?.missing.join(' · ')||'Beleg zuerst prüfen.'));
   if(input.status!=='offen'||input.fileId!==view.fileId||!isDeepStrictEqual(input.fields,view.fields)||input.paidDate!==null||input.proofFileId!==null||input.duplicateId!==null||input.duplicateReason!==null||input.unclearReason!==null)reject('VALIDATION_ERROR','Automatische Ablage verwendet ausschließlich die sicher erkannten Originalangaben.');
   if(input.fields.iban.trim()&&normaliseIban(input.fields.iban)!==normaliseIban(view.supplier?.iban??''))reject('VALIDATION_ERROR','IBAN zuerst beim Lieferanten prüfen · keine automatische Stammdatenänderung.');
  }
  if(row.version!==input.version)reject('CONFLICT','Eingang wurde inzwischen geändert · Eingaben bleiben erhalten.');
  if(await findInvoice(tx,auth,row.id,true))reject('CONFLICT','Dieser Eingang hat bereits eine Rechnung.');
  if(row.einsatz!=='offen'||row.aussortiert)reject('CONFLICT','Eingang ist nicht mehr offen.');
  if(row.vorgang_id)reject('CONFLICT','Eingang ist bereits einem anderen Vorgang zugeordnet.');
  const originals=await tx.execute(sql`SELECT file.id FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${row.id}::uuid AND file.id=${input.fileId}::uuid AND EXISTS(SELECT 1 FROM public.intake_event event WHERE event.tenant_id=file.tenant_id AND event.item_id=file.item_id AND event.art='original_gespeichert' AND event.nachher->>'fileId'=file.id::text)`);
  if(originals.length!==1)reject('VALIDATION_ERROR','Gesichertes Original dieser Rechnung fehlt.');
  const missingSupplier=input.status==='offen'&&!input.fields.lieferantId;
  const savedStatus=missingSupplier?'unklar':input.status,unclearReason=missingSupplier?'Lieferant fehlt':input.unclearReason;
  const selected=await validate(tx,auth,input.fields,input.status,input.paidDate,input.proofFileId,row.id,deps);
  if(row.kunde_id&&row.kunde_id!==selected?.id)reject('CONFLICT','Rechnung gehört zu einem anderen zugeordneten Lieferanten.');
  if(input.status==='unklar'&&(!input.unclearReason||input.unclearReason.trim().length<3))reject('VALIDATION_ERROR','Grund fehlt',{unclearReason:'Grund fehlt · 3 bis 200 Zeichen'});
  await verifyDuplicate(tx,auth,input.fields,input.status,input.duplicateId,input.duplicateReason);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('invoice-number:'||${auth.tenantId},0))`);
  const [number]=await tx.execute<{value:string}>(sql`SELECT 'ER-'||to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY')||'-'||lpad(next_value,greatest(4,length(next_value)),'0') AS value FROM (
   SELECT (coalesce(max(substring(nummer_intern from '[0-9]+$')::bigint),0)+1)::text AS next_value FROM public.supplier_invoice
   WHERE tenant_id=${auth.tenantId} AND nummer_intern LIKE 'ER-'||to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY')||'-%') next_number`);
  const id=randomUUID(),f=input.fields,money=(raw:string)=>raw.trim()?invoiceDecimal(invoiceCents(raw)!):null;
  await tx.execute(sql`INSERT INTO public.supplier_invoice(id,tenant_id,nummer_intern,item_id,file_id,lieferant_id,nummer,datum,netto,ust,brutto,faellig_am,iban,iban_geprueft,zahlstatus,bezahlt_am,nachweis_file_id,verweis_id,dublette_grund,unklar_grund,erfasst_von)
   VALUES(${id}::uuid,${auth.tenantId},${number.value},${row.id}::uuid,${input.fileId}::uuid,${selected?.id??null},${f.nummer.trim()||null},${f.datum||null}::date,${money(f.netto)}::numeric,${money(f.ust)}::numeric,${money(f.brutto)}::numeric,
    ${f.faelligAm||null}::date,${normaliseIban(f.iban)||null},${f.ibanGeprueft},${savedStatus},${input.status==='bezahlt'?input.paidDate:null}::date,${input.proofFileId}::uuid,${input.status==='doppelt'?input.duplicateId:null}::uuid,${input.duplicateReason?.trim()||null},${savedStatus==='unklar'?unclearReason!.trim():null},${auth.userId}::uuid)`);
  if(selected&&!selected.iban&&f.iban.trim()){
   const updated=await deps.updateCustomer(tx,{tenantId:auth.tenantId,userId:auth.userId,capabilities:{canCreateCustomer:false,canEditCustomer:true,canManageMoney:true,canDecide:hasAuthorizationArea(auth,'entscheiden')}},
    {customerId:selected.id,clientEventId:input.clientKey,iban:normaliseIban(f.iban)});
   if(updated.code!=='OK')throw new Rejected(updated);
  }
  if(savedStatus==='unklar'){
   const taskId=await deps.createTask(tx,auth,{invoiceId:id,clientKey:input.clientKey,reason:unclearReason!.trim()});
   await tx.execute(sql`UPDATE public.supplier_invoice SET aufgabe_id=${taskId}::uuid WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid`);
  }
  const concerns=row.anliegen_offen.filter(value=>value!=='rechnung'),usage=concerns.length?'offen':'erledigt';
  await tx.execute(sql`UPDATE public.intake_item SET kunde_id=${selected?.id??null},zuordnung=${selected?'hand':row.kunde_id?'hand':'offen'},vorgang_art='rechnung',vorgang_id=${id},
   einsatz=${usage},anliegen_offen=ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[],einsatz_aktion=${command},einsatz_am=statement_timestamp(),einsatz_von=${auth.userId}::uuid,
   geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${row.version}`);
  const after=await findInvoice(tx,auth,id);if(!after)throw Error('INVOICE_READBACK_FAILED');
  await record(tx,auth,row,input.clientKey,command,input,null,after,deps);return {code:'OK' as const,invoice:after,replayed:false};
 });}catch(error){return failure(error);}
}
export async function changeIncomingInvoice(input:unknown,deps:InvoiceDependencies,clarify=false):Promise<InvoiceResult>{
 if(!validChange(input))return {code:'VALIDATION_ERROR',message:'Rechnungsänderung ist ungültig.'};
 if(!clarify&&!input.command&&!['offen','bezahlt'].includes(input.result))return {code:'VALIDATION_ERROR',message:'Statuswechsel ist ungültig.'};
 try{const auth=await authorization();return await withPrivilegedTenantTransaction(auth,async tx=>{
  const initial=await findInvoice(tx,auth,input.invoiceId);if(!initial)reject('NOT_FOUND','Rechnung nicht verfügbar.');
  const row=await source(tx,auth,initial.item_id,true),command=input.command==='undo'?'rechnung.rueckgaengig':input.command==='rebook'?'rechnung.neu_ablegen':clarify?'rechnung.klaeren':'rechnung.status';
  const repeated=await replay(tx,auth,row,input.clientKey,command,input);if(repeated)return repeated;
  const before=await findInvoice(tx,auth,input.invoiceId,false,true);if(!before)reject('NOT_FOUND','Rechnung nicht verfügbar.');
  if(before.version!==input.version)reject('CONFLICT','Rechnung wurde inzwischen geändert · Eingaben bleiben erhalten.');
  if(input.command==='undo'){
   if(clarify||before.zahlstatus!=='offen'||input.result!=='ungueltig'||input.fields!==null||input.paidDate!==null||input.proofFileId!==null||input.duplicateId!==null)reject('VALIDATION_ERROR','Nur eine offene, unbezahlte Ablage kann zurückgenommen werden.');
  }else if(input.command==='rebook'){
   const read=await readInvoiceView(tx,auth,before.id,deps);
   if(clarify||!read.view.canRebook||input.result!=='offen'||!input.fields||input.paidDate!==null||input.proofFileId!==null||input.duplicateId!==null||row.einsatz!=='offen'||!row.anliegen_offen.includes('rechnung'))reject('VALIDATION_ERROR','Zum erneuten Ablegen zuerst die Ablage zurücknehmen und die Angaben ergänzen.');
  }else{
   if(clarify?before.zahlstatus!=='unklar':!['offen','bezahlt'].includes(before.zahlstatus))reject('VALIDATION_ERROR',clarify?'Rechnung ist nicht unklar':'Dieser Status wird ausschließlich in Rechnung klären geändert.');
   if(!clarify&&input.fields!==null)reject('VALIDATION_ERROR','Status ändern verändert keine Rechnungsfelder.');
  }
  if(input.result==='ungueltig'&&(!input.reason||input.reason.trim().length<3))reject('VALIDATION_ERROR','Grund fehlt',{reason:'Grund fehlt · 3 bis 200 Zeichen'});
  const fields=input.fields??fieldsFrom(before);
  const addingSupplier=clarify&&!before.lieferant_id&&before.unklar_grund==='Lieferant fehlt'&&Boolean(fields.lieferantId);
  if(input.command!=='rebook'&&(!addingSupplier&&fields.lieferantId!==(before.lieferant_id??'')||normaliseIban(fields.iban)!==normaliseIban(before.iban??'')||fields.ibanGeprueft!==before.iban_geprueft))reject('VALIDATION_ERROR','Klärung berichtigt Nummer, Datum, Beträge und Fälligkeit; Lieferant und IBAN bleiben erhalten.');
  if(!fields.lieferantId&&input.result!=='ungueltig')reject('VALIDATION_ERROR','Lieferant fehlt.',{lieferantId:'Lieferant fehlt'});
  await validate(tx,auth,fields,input.result,input.paidDate,input.proofFileId,row.id,deps);
  await verifyDuplicate(tx,auth,fields,input.result,input.duplicateId,before.dublette_grund,before.id);
  const money=(raw:string)=>raw.trim()?invoiceDecimal(invoiceCents(raw)!):null;
  await tx.execute(sql`UPDATE public.supplier_invoice SET lieferant_id=${fields.lieferantId||null},nummer=${fields.nummer.trim()||null},datum=${fields.datum||null}::date,
   netto=${money(fields.netto)}::numeric,ust=${money(fields.ust)}::numeric,brutto=${money(fields.brutto)}::numeric,faellig_am=${fields.faelligAm||null}::date,iban=${normaliseIban(fields.iban)||null},iban_geprueft=${fields.ibanGeprueft},
   zahlstatus=${input.result},bezahlt_am=${input.result==='bezahlt'?input.paidDate:null}::date,nachweis_file_id=${input.proofFileId}::uuid,verweis_id=${input.result==='doppelt'?input.duplicateId:null}::uuid,
   ungueltig_grund=${input.result==='ungueltig'?input.reason!.trim():null},version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${before.id}::uuid AND version=${before.version}`);
  if(input.command){
   const concerns=input.command==='undo'?[...new Set([...row.anliegen_offen,'rechnung'])]:row.anliegen_offen.filter(value=>value!=='rechnung');
   const pending=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND antwort_auf_item=${row.id}::uuid AND sendestatus IN ('entwurf','sendet','unklar','fehler') LIMIT 1`);
   const usage=concerns.length||pending.length?'offen':'erledigt';
   const changed=await tx.execute(sql`UPDATE public.intake_item SET kunde_id=${fields.lieferantId||null},einsatz=${usage},anliegen_offen=ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[],einsatz_aktion=${command},einsatz_am=statement_timestamp(),einsatz_von=${auth.userId}::uuid,version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${row.version} RETURNING id`);if(changed.length!==1)reject('CONFLICT','Eingang ist inzwischen geändert.');
  }
  if(addingSupplier)await tx.execute(sql`UPDATE public.intake_item SET kunde_id=${fields.lieferantId},zuordnung='hand',version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid`);
  if(clarify){if(!before.aufgabe_id)reject('CONFLICT','Rechnungsaufgabe fehlt.');await deps.resolveTask(tx,auth,{invoiceId:before.id,taskId:before.aufgabe_id,note:'Rechnung geklärt · '+input.result+(input.reason?' · '+input.reason.trim():'')});}
  const after=await findInvoice(tx,auth,before.id);if(!after||after.version!==before.version+1)throw Error('INVOICE_STATUS_READBACK_FAILED');
  await record(tx,auth,row,input.clientKey,command,input,before,after,deps);return {code:'OK' as const,invoice:after,replayed:false};
 });}catch(error){return failure(error);}
}
