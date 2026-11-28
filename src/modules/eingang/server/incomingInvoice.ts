import {FINANCIAL_ACCESS_COPY} from '@/ui/financialAccessCopy';
import {INCOMING_INVOICE_COPY} from '@/ui/situationCatalog';
import {eingangCopy} from '@/ui/eingangCopy';
import {recordObservedFailure} from '@/lib/server/actionObservation';
import {readIntakeActorTraces} from './actorRead';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {sql,type SQL} from 'drizzle-orm';
import {resolveAuthorization,hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,withTenantSavepoint,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {normaliseIban,type CustomerStoredProfile} from '@/modules/customers/public';
import {writeIntakeNoteInTransaction} from './intakeCapture';
import {gespeichertesBelegoriginal as invoiceOriginal,invoicePageFilter,readIntakeInvoicePageSource,readSecuredIntakeMailOriginal} from './intakeOriginal';
import {liesGetrenntenRechnungswiderspruch} from './invoiceOriginalAgreement';
import {speichereErkennungskorrekturen,type Erkennungskorrektur} from './eingangsRegeln';
import {EMPTY_INVOICE_FIELDS,invoiceCents,invoiceDecimal,invoiceDate,invoiceFieldErrors,invoiceFieldShape,invoiceTaxBreakdown,
 type IncomingInvoice,type InvoiceChangeInput,type InvoiceDuplicate,type InvoiceFailure,type InvoiceFields,
 type InvoicePageRange,type InvoiceReadResult,type InvoiceResult,type InvoiceSaveInput,type InvoiceSupplier,type InvoiceView} from '../invoiceContract';

export type InvoiceDependencies={
 findSuppliers:(auth:AuthorizationSnapshot,query:string,by:'vat'|'name')=>Promise<{id:string}[]>;
 readCustomer:(tx:PrivilegedTenantTransaction,tenantId:string,id:string,lock?:boolean)=>Promise<CustomerStoredProfile|null>;
 updateCustomer:(tx:PrivilegedTenantTransaction,context:{tenantId:string;userId:string;capabilities:{canCreateCustomer:boolean;canEditCustomer:boolean;canManageMoney:boolean;canDecide:boolean}},input:unknown)=>Promise<{code:'OK';customer:CustomerStoredProfile;replayed:boolean}|InvoiceFailure>;
 createTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;clientKey:string;reason:string})=>Promise<string>;
 resolveTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;taskId:string;note:string})=>Promise<void>;
};
type InvoiceReadDependencies=Pick<InvoiceDependencies,'findSuppliers'|'readCustomer'>;
type Source={id:string;version:number;at:string;channel:string;sender:string|null;kunde_id:string|null;vorgang_art:string|null;vorgang_id:string|null;einsatz:string;anliegen_offen:string[];aussortiert:string|null};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const optionalText=(v:unknown,max:number)=>v===null||typeof v==='string'&&v.length<=max;
const keys=(v:object,names:string[])=>Object.keys(v).sort().join(',')===[...names].sort().join(',');
const columns=sql`id::text,nummer_intern,item_id::text,file_id::text,seite_von,seite_bis,lieferant_id,nummer,datum::text,netto::text,ust::text,brutto::text,faellig_am::text,
 iban,iban_geprueft,ust_saetze,zahlstatus,bezahlt_am::text,nachweis_file_id::text,verweis_id::text,dublette_grund,unklar_grund,aufgabe_id::text,ungueltig_grund,erfasst_von::text,erfasst_am::text,version`;
const invalidInvoiceRequest='Rechnungsaufruf ist ungültig.';
class Rejected extends Error{constructor(readonly result:InvoiceFailure|Extract<InvoiceResult,{code:'DUPLICATE'}>){super(result.code);}}
function reject(code:InvoiceFailure['code'],message:string,fields?:Record<string,string>):never{throw new Rejected({code,message,...(fields?{fields}:{})});}
function failure(error:unknown):InvoiceFailure|Extract<InvoiceResult,{code:'DUPLICATE'}>{
 const cause=error&&typeof error==='object'&&'cause'in error?error.cause:error;
 console.error('[INCOMING_INVOICE_FAILED]',{code:error instanceof Rejected?error.result.code:object(cause)&&typeof cause.code==='string'?cause.code:'INCOMING_INVOICE_FAILED'});
 return error instanceof Rejected?error.result:{code:'UNAVAILABLE',message:'Speichern fehlgeschlagen · alle Eingaben sind noch da. Fehlercode: INCOMING_INVOICE_FAILED.'};
}
async function authorization(){
 const result=await resolveAuthorization();if(!result.ok)reject(result.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED','Sitzung nicht verfügbar.');
 return requireBookkeeping(result.data);
}
function requireBookkeeping(auth:AuthorizationSnapshot){
 if(!auth.active||!hasAuthorizationArea(auth,'buchhaltung'))reject('FORBIDDEN',FINANCIAL_ACCESS_COPY.bookkeepingMissing);
 return auth;
}
async function findInvoice(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,byItem=false,lock=false,fileId?:string,itemId?:string){
 const rows=await tx.execute<IncomingInvoice>(sql`SELECT ${columns} FROM public.supplier_invoice WHERE tenant_id=${auth.tenantId}
  AND ${byItem?sql`item_id=${id}::uuid`:sql`id=${id}::uuid`}
  ${itemId?sql`AND item_id=${itemId}::uuid`:sql``}
  ${fileId?sql`AND file_id=${fileId}::uuid`:sql``} LIMIT 2 ${lock?sql`FOR UPDATE`:sql``}`);
 if(rows.length>1)reject('CONFLICT',invalidInvoiceRequest);
 return rows[0]??null;
}
/** The caller holds the intake lock before choosing and locking the exact invoice. */
export async function readInvoiceForSupplierChange(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string,rechnungId?:string){
 const invoice=await findInvoice(tx,auth,rechnungId??itemId,rechnungId===undefined,true,undefined,rechnungId?itemId:undefined);
 if(rechnungId&&!invoice)throw Error('CONFLICT');
 return invoice;
}
async function writeInvoiceChange(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,before:IncomingInvoice,changes:SQL){
 const updated=await tx.execute(sql`UPDATE public.supplier_invoice SET ${changes},version=version+1
  WHERE tenant_id=${auth.tenantId} AND item_id=${before.item_id}::uuid AND id=${before.id}::uuid AND version=${before.version}
  RETURNING id`);
 if(updated.length!==1)reject('CONFLICT','Rechnung wurde inzwischen geändert · Eingaben bleiben erhalten.');
}
export async function writeInvoiceSupplierInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,before:IncomingInvoice,lieferantId:string){
 if(before.lieferant_id===lieferantId)return;
 try{
  await verifyDuplicate(tx,auth,{...fieldsFrom(before),lieferantId},before.zahlstatus,before.verweis_id,before.dublette_grund,before.id);
 }catch(error){
  if(error instanceof Rejected&&error.result.code==='DUPLICATE')throw Error('CONFLICT',{cause:error});
  throw error;
 }
 await writeInvoiceChange(tx,auth,before,sql`lieferant_id=${lieferantId}`);
}
/** Task service reads invoice facts through this injected port, never through a second table owner. */
export async function readInvoiceTaskContext(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,readCustomer:InvoiceDependencies['readCustomer']){
 if(!hasAuthorizationArea(auth,'buchhaltung'))return null;
 const invoice=await findInvoice(tx,auth,id,false,true);if(!invoice)return null;
 const selected=invoice.lieferant_id?await readCustomer(tx,auth.tenantId,invoice.lieferant_id):null;
 return {name:selected?.name??null,status:invoice.zahlstatus,taskId:invoice.aufgabe_id};
}
async function source(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,lock=false){
 if(lock)await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${id},0))`);
 const rows=await tx.execute<Source>(sql`SELECT id::text,version,coalesce(empfangen_am,erstellt_am)::text AS at,kanal AS channel,absender_name AS sender,
  kunde_id,vorgang_art,vorgang_id,einsatz,anliegen_offen,aussortiert FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid ${lock?sql`FOR UPDATE`:sql``}`);
 if(rows.length!==1)reject('NOT_FOUND','Eingang der Rechnung nicht verfügbar.');return rows[0];
}
function fieldsFrom(invoice:IncomingInvoice):InvoiceFields{return {
 lieferantId:invoice.lieferant_id??'',nummer:invoice.nummer??'',datum:invoice.datum??'',netto:invoice.netto??'',ust:invoice.ust??'',brutto:invoice.brutto??'',
 faelligAm:invoice.faellig_am??'',iban:invoice.iban??'',ibanGeprueft:invoice.iban_geprueft,
};}
async function supplier(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string,deps:Pick<InvoiceDependencies,'readCustomer'>,lock=false):Promise<InvoiceSupplier|null>{
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
async function invoiceSuggestions(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string,fileId:string|null,pages:InvoicePageRange|null,includeItemHints=true){
 const original=pages?sql`file_id=${fileId}::uuid AND ${invoicePageFilter(pages)}`
  :sql`(file_id=${fileId}::uuid OR ${includeItemHints} AND file_id IS NULL)`;
 const vorschlaege=await tx.execute<{feld:string;wert:unknown;sicherheit:string;verified:boolean}>(sql`SELECT feld,wert,sicherheit,geprueft_am IS NOT NULL AS verified FROM public.intake_suggestion
  WHERE tenant_id=${auth.tenantId} AND item_id=${itemId}::uuid AND ${original}
  AND feld IN ('rechnung.nummer','rechnung.datum','rechnung.betrag','rechnung.faellig','rechnung.iban','rechnung.absender','rechnung.steuersaetze','rechnung.abgleich')
  AND status<>'verworfen' ORDER BY id`);
 if(fileId&&!hatRechnungswiderspruch(vorschlaege)){
  const abgleich=await liesGetrenntenRechnungswiderspruch(tx,auth.tenantId,itemId,fileId,pages);
  if(abgleich)vorschlaege.push({feld:'rechnung.abgleich',wert:abgleich,sicherheit:'unsicher',verified:false});
 }
 return vorschlaege;
}

function hatRechnungswiderspruch(vorschlaege:readonly {feld:string;sicherheit:string}[]){
 return vorschlaege.some(vorschlag=>vorschlag.feld==='rechnung.abgleich'&&vorschlag.sicherheit==='unsicher');
}
function storedPages(invoice:IncomingInvoice|null):InvoicePageRange|null{
 return invoice&&invoice.seite_von!==null&&invoice.seite_bis!==null?{from:invoice.seite_von,to:invoice.seite_bis}:null;
}
function taxRates(suggestions:readonly {feld:string;wert:unknown}[],totalTax:string,stored:IncomingInvoice|null){
 const original=suggestions.filter(value=>value.feld==='rechnung.steuersaetze').at(-1);
 return invoiceTaxBreakdown(original?original.wert:stored?.ust_saetze,totalTax);
}
export async function readIncomingInvoice(input:unknown,deps:InvoiceReadDependencies,caller?:AuthorizationSnapshot):Promise<InvoiceReadResult>{
 if(!object(input)||(!keys(input,['id'])&&!keys(input,['id','fileId']))||!uuid(input.id)||(Object.hasOwn(input,'fileId')&&!uuid(input.fileId)))
  return {code:'VALIDATION_ERROR',message:invalidInvoiceRequest};
 const id=input.id,requestedFile=typeof input.fileId==='string'?input.fileId:undefined;
 try{const auth=caller?requireBookkeeping(caller):await authorization();return await withPrivilegedTenantTransaction(auth,async tx=>{
  const invoice=await findInvoice(tx,auth,id)??await findInvoice(tx,auth,id,true,false,requestedFile);
  if(requestedFile&&invoice&&invoice.file_id!==requestedFile)reject('NOT_FOUND','Gesichertes Original dieser Rechnung fehlt.');
  const row=await source(tx,auth,invoice?.item_id??id);
  const originals=await tx.execute<{id:string;name:string;mime:string;sha256:string}>(sql`SELECT file.id::text,file.dateiname AS name,file.mime,file.sha256 FROM public.intake_file file
   WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${row.id}::uuid AND ${invoiceOriginal} ORDER BY file.reihenfolge,file.id`);
  if(requestedFile&&!originals.some(file=>file.id===requestedFile))reject('NOT_FOUND','Gesichertes Original dieser Rechnung fehlt.');
  const primaryFileId=invoice?.file_id??requestedFile??originals[0]?.id??null;
  const supplierId=invoice?invoice.lieferant_id:requestedFile&&row.vorgang_art==='rechnung'?null:row.kunde_id;
  let selected=await supplier(tx,auth,supplierId??'',deps);
  const fields=invoice?fieldsFrom(invoice):{...EMPTY_INVOICE_FIELDS,lieferantId:selected?.id??''};
  const suggestions=await invoiceSuggestions(tx,auth,row.id,primaryFileId,storedPages(invoice),!requestedFile&&(!invoice||row.vorgang_id===invoice.id));
  if(!invoice)for(const suggestion of suggestions){
   const value=suggestion.wert;
   if(suggestion.feld==='rechnung.betrag'&&object(value))for(const key of ['netto','ust','brutto'] as const){if(typeof value[key]==='number'||typeof value[key]==='string')fields[key]=String(value[key]);}
   else if(typeof value==='string'){
    const key=({'rechnung.nummer':'nummer','rechnung.datum':'datum','rechnung.faellig':'faelligAm','rechnung.iban':'iban'} as Record<string,string>)[suggestion.feld];
    if(key)Object.assign(fields,{[key]:value});
   }
  }
  const sender=suggestions.filter(value=>value.feld==='rechnung.absender').at(-1)?.wert;
  const supplierPrefill:NonNullable<InvoiceView['supplierPrefill']>={};
  if(object(sender)){
   if(typeof sender.name==='string'&&sender.name.trim())supplierPrefill.name=sender.name.trim();
   if(typeof sender.ustId==='string'&&sender.ustId.trim())supplierPrefill.vatId=sender.ustId.replace(/\s/gu,'').toUpperCase();
  }
  let supplierConflict:string|null=null;
  if(!selected)try{
   let matches:{id:string}[]=[];
   if(supplierPrefill.vatId&&supplierPrefill.vatId.length<=40)matches=await deps.findSuppliers(auth,supplierPrefill.vatId,'vat');
   if(matches.length===0&&supplierPrefill.name&&supplierPrefill.name.length<=254)matches=await deps.findSuppliers(auth,supplierPrefill.name,'name');
   if(matches.length===1){selected=await withTenantSavepoint(tx,nested=>supplier(nested,auth,matches[0].id,deps));fields.lieferantId=selected?.id??'';}
  }catch{
   supplierConflict=INCOMING_INVOICE_COPY.supplierSearchUnavailable;
   recordObservedFailure('INVOICE_SUPPLIER_SEARCH_FAILED');
  }
  if(!invoice&&!fields.faelligAm&&invoiceDate(fields.datum)&&selected?.paymentTermDays!==null&&selected?.paymentTermDays!==undefined){
   const [date]=await tx.execute<{due:string}>(sql`SELECT (${fields.datum}::date+${selected.paymentTermDays}::integer)::text AS due`);fields.faelligAm=date.due;
  }
  const actorTrace=(await readIntakeActorTraces(tx,auth,[row.id],invoice?.id)).get(row.id);
  const mailOriginal=invoice&&row.channel==='mail'?await readSecuredIntakeMailOriginal(tx,auth,row.id):null;
  const view:InvoiceView={actorTrace,supplierPrefill,taxRateWarning:taxRates(suggestions,fields.ust,invoice).warning?INCOMING_INVOICE_COPY.taxRateMismatch:null,item:{id:row.id,version:row.version,at:row.at,channel:row.channel,sender:row.sender},invoice,supplier:selected,originals:mailOriginal?[...originals,mailOriginal]:[...originals],fileId:primaryFileId,
   fields,uncertain:invoice?0:suggestions.filter(value=>value.sicherheit!=='sicher'&&!value.verified).length,conflict:supplierConflict,duplicate:await duplicate(tx,auth,fields,invoice?.id)};
  return {code:'OK' as const,view};
 });}catch(error){const result=failure(error);return result.code==='DUPLICATE'?{code:'CONFLICT',message:result.message}:result;}
}
function validSave(input:unknown):input is InvoiceSaveInput{
 if(!object(input))return false;
 const fields=['itemId','fileId','version','clientKey','fields','status','paidDate','proofFileId','duplicateId','duplicateReason','unclearReason'];
 if(Object.hasOwn(input,'pages')){
  fields.push('pages');
  const pages=input.pages;
  if(pages!==null&&(!object(pages)||!keys(pages,['from','to'])||typeof pages.from!=='number'||typeof pages.to!=='number'
   ||!Number.isSafeInteger(pages.from)||!Number.isSafeInteger(pages.to)||pages.from<1||pages.to<pages.from||pages.to>2147483647))return false;
 }
 return keys(input,fields)
  &&uuid(input.itemId)&&uuid(input.fileId)&&uuid(input.clientKey)&&Number.isSafeInteger(input.version)&&Number(input.version)>=1&&invoiceFieldShape(input.fields)
  &&['offen','bezahlt','unklar','doppelt'].includes(String(input.status))&&optionalText(input.paidDate,10)
  &&(input.proofFileId===null||uuid(input.proofFileId))&&(input.duplicateId===null||uuid(input.duplicateId))&&optionalText(input.duplicateReason,200)&&optionalText(input.unclearReason,200);
}
function validChange(input:unknown):input is InvoiceChangeInput{
 return object(input)&&keys(input,['invoiceId','version','clientKey','result','paidDate','proofFileId','duplicateId','reason','fields'])
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
function rechnungKorrekturen(vorschlaege:Awaited<ReturnType<typeof invoiceSuggestions>>,before:InvoiceFields,after:InvoiceFields) {
 const korrekturen:Erkennungskorrektur[]=[];
 for(const [feld,key] of [['rechnung.nummer','nummer'],['rechnung.datum','datum'],['rechnung.faellig','faelligAm']] as const){
  const alt=vorschlaege.find(vorschlag=>vorschlag.feld===feld)?.wert;
  if(typeof alt==='string'&&before[key]!==after[key]&&alt.trim()!==after[key].trim())korrekturen.push({feld,alt,neu:after[key]});
 }
 const betrag=vorschlaege.find(vorschlag=>vorschlag.feld==='rechnung.betrag')?.wert;
 if(object(betrag))for(const key of ['netto','ust','brutto'] as const){
  const alt=betrag[key];
  if(typeof alt!=='string'&&typeof alt!=='number')continue;
  const vorher=invoiceCents(before[key]),neu=invoiceCents(after[key]),erkannt=invoiceCents(String(alt));
  if(erkannt!==null&&vorher!==neu&&erkannt!==neu)korrekturen.push({feld:'rechnung.'+key,alt,neu:after[key]});
 }
 return korrekturen;
}

/** All four commands compose existing customer/task/history writers in this transaction. */
export async function saveIncomingInvoice(input:unknown,deps:InvoiceDependencies):Promise<InvoiceResult>{
 if(!validSave(input))return {code:'VALIDATION_ERROR',message:'Rechnungsangaben oder Eingangsstand sind ungültig.'};
 try{const auth=await authorization();return await withPrivilegedTenantTransaction(auth,async tx=>{
  const row=await source(tx,auth,input.itemId,true),command=input.status==='unklar'?'rechnung.unklar':'rechnung.erfassen';
  const pages=input.pages??null;
  const pageSource=pages?await readIntakeInvoicePageSource(tx,auth,row.id,input.fileId):null;
  if(pageSource?.code==='FORBIDDEN')reject('FORBIDDEN',pageSource.message);
  if(pageSource?.code==='INVALID_FILE')reject('VALIDATION_ERROR','Gesichertes Original dieser Rechnung fehlt.');
  const repeated=await replay(tx,auth,row,input.clientKey,command,input);if(repeated)return repeated;
  if(row.version!==input.version)reject('CONFLICT','Eingang wurde inzwischen geändert · Eingaben bleiben erhalten.');
  const mailInvoice=row.vorgang_art==='rechnung'&&uuid(row.vorgang_id)?await findInvoice(tx,auth,row.vorgang_id):null;
  const existingInvoice=mailInvoice?.item_id===row.id?mailInvoice:null;
  if(row.aussortiert||(row.einsatz!=='offen'&&!(existingInvoice&&row.einsatz==='erledigt')))reject('CONFLICT','Eingang ist nicht mehr offen.');
  if(row.vorgang_id&&!existingInvoice)reject('CONFLICT','Eingang ist bereits einem anderen Vorgang zugeordnet.');
  const [original]=await tx.execute<{dateiname:string}>(sql`SELECT file.dateiname
   FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${row.id}::uuid AND file.id=${input.fileId}::uuid AND ${invoiceOriginal}`);
  if(!original)reject('VALIDATION_ERROR','Gesichertes Original dieser Rechnung fehlt.');
  if(pages&&pageSource?.code==='OK'&&(pageSource.mime!=='application/pdf'||pages.to>await pageSource.countPages()))
   reject('VALIDATION_ERROR','Rechnungsangaben oder Eingangsstand sind ungültig.');
  const [belegt]=await tx.execute<{nummer_intern:string;seite_von:number|null;seite_bis:number|null}>(sql`
   SELECT nummer_intern,seite_von,seite_bis FROM public.supplier_invoice
   WHERE tenant_id=${auth.tenantId} AND file_id=${input.fileId}::uuid
     AND int4range(coalesce(seite_von,1),seite_bis,'[]') && int4range(${pages?.from??1}::integer,${pages?.to??null}::integer,'[]')
   ORDER BY seite_von NULLS FIRST,nummer_intern LIMIT 1`);
  if(belegt)reject('CONFLICT',belegt.seite_von===null||belegt.seite_bis===null
   ?eingangCopy.rechnungDateiBelegt(original.dateiname,belegt.nummer_intern)
   :eingangCopy.rechnungSeitenBelegt(belegt.seite_von,belegt.seite_bis,original.dateiname,belegt.nummer_intern));
  const vorschlaege=await invoiceSuggestions(tx,auth,row.id,input.fileId,pages,existingInvoice===null);
  const widerspruch=hatRechnungswiderspruch(vorschlaege);
  const missingSupplier=input.status==='offen'&&!input.fields.lieferantId;
  const savedStatus=widerspruch||missingSupplier?'unklar':input.status;
  const unclearReason=widerspruch?eingangCopy.rechnungswiderspruch:missingSupplier?'Lieferant fehlt':input.unclearReason;
  const selected=await validate(tx,auth,input.fields,widerspruch?savedStatus:input.status,input.paidDate,widerspruch?null:input.proofFileId,row.id,deps);
  const andererLieferant=row.kunde_id!==null&&row.kunde_id!==selected?.id;
  if(!existingInvoice&&andererLieferant){
   const originale=await tx.execute(sql`SELECT file.id FROM public.intake_file file
    WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${row.id}::uuid AND ${invoiceOriginal} LIMIT 2`);
   if(originale.length===1)reject('CONFLICT','Rechnung gehört zu einem anderen zugeordneten Lieferanten.');
  }
  if(savedStatus==='unklar'&&(!unclearReason||unclearReason.trim().length<3))reject('VALIDATION_ERROR','Grund fehlt',{unclearReason:'Grund fehlt · 3 bis 200 Zeichen'});
  await verifyDuplicate(tx,auth,input.fields,widerspruch?savedStatus:input.status,input.duplicateId,input.duplicateReason);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('invoice-number:'||${auth.tenantId},0))`);
  const [number]=await tx.execute<{value:string}>(sql`SELECT 'ER-'||to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY')||'-'||lpad(next_value,greatest(4,length(next_value)),'0') AS value FROM (
   SELECT (coalesce(max(substring(nummer_intern from '[0-9]+$')::bigint),0)+1)::text AS next_value FROM public.supplier_invoice
   WHERE tenant_id=${auth.tenantId} AND nummer_intern LIKE 'ER-'||to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY')||'-%') next_number`);
  const id=randomUUID(),f=input.fields,money=(raw:string)=>raw.trim()?invoiceDecimal(invoiceCents(raw)!):null;
  const breakdown=taxRates(vorschlaege,f.ust,null);
  await tx.execute(sql`INSERT INTO public.supplier_invoice(id,tenant_id,nummer_intern,item_id,file_id,seite_von,seite_bis,lieferant_id,nummer,datum,netto,ust,brutto,faellig_am,iban,iban_geprueft,ust_saetze,zahlstatus,bezahlt_am,nachweis_file_id,verweis_id,dublette_grund,unklar_grund,erfasst_von)
   VALUES(${id}::uuid,${auth.tenantId},${number.value},${row.id}::uuid,${input.fileId}::uuid,${pages?.from??null},${pages?.to??null},${selected?.id??null},${f.nummer.trim()||null},${f.datum||null}::date,${money(f.netto)}::numeric,${money(f.ust)}::numeric,${money(f.brutto)}::numeric,
    ${f.faelligAm||null}::date,${normaliseIban(f.iban)||null},${f.ibanGeprueft},${breakdown.rates===null?null:JSON.stringify(breakdown.rates)}::jsonb,${savedStatus},${savedStatus==='bezahlt'?input.paidDate:null}::date,${widerspruch?null:input.proofFileId}::uuid,${savedStatus==='doppelt'?input.duplicateId:null}::uuid,${input.duplicateReason?.trim()||null},${savedStatus==='unklar'?unclearReason!.trim():null},${auth.userId}::uuid)`);
  if(!widerspruch&&selected&&!selected.iban&&f.iban.trim()){
   const updated=await deps.updateCustomer(tx,{tenantId:auth.tenantId,userId:auth.userId,capabilities:{canCreateCustomer:false,canEditCustomer:true,canManageMoney:true,canDecide:hasAuthorizationArea(auth,'entscheiden')}},
    {customerId:selected.id,clientEventId:input.clientKey,iban:normaliseIban(f.iban)});
   if(updated.code!=='OK')throw new Rejected(updated);
  }
  if(savedStatus==='unklar'){
   const taskId=await deps.createTask(tx,auth,{invoiceId:id,clientKey:input.clientKey,reason:unclearReason!.trim()});
   await tx.execute(sql`UPDATE public.supplier_invoice SET aufgabe_id=${taskId}::uuid WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid`);
  }
  const concerns=row.anliegen_offen.filter(value=>value!=='rechnung'),usage=concerns.length?'offen':'erledigt';
  await tx.execute(sql`UPDATE public.intake_item SET kunde_id=${existingInvoice?row.kunde_id:row.kunde_id??selected?.id??null},
   zuordnung=CASE WHEN ${existingInvoice!==null||andererLieferant} THEN zuordnung ELSE ${selected?'hand':row.kunde_id?'hand':'offen'} END,
   vorgang_art='rechnung',vorgang_id=${existingInvoice?.id??id},
   einsatz=${usage},anliegen_offen=ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[],einsatz_aktion=${command},einsatz_am=statement_timestamp(),einsatz_von=${auth.userId}::uuid,
   geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${row.version}`);
  const after=await findInvoice(tx,auth,id);if(!after)throw Error('INVOICE_READBACK_FAILED');
  await record(tx,auth,row,input.clientKey,command,input,null,after,deps);
  if(breakdown.warning)recordObservedFailure('INCOMING_INVOICE_TAX_BREAKDOWN_MISMATCH');
  return {code:'OK' as const,invoice:after,replayed:false};
 });}catch(error){return failure(error);}
}
export async function changeIncomingInvoice(input:unknown,deps:InvoiceDependencies,clarify=false):Promise<InvoiceResult>{
 if(!validChange(input))return {code:'VALIDATION_ERROR',message:'Rechnungsänderung ist ungültig.'};
 if(!clarify&&!['offen','bezahlt'].includes(input.result))return {code:'VALIDATION_ERROR',message:'Statuswechsel ist ungültig.'};
 try{const auth=await authorization();return await withPrivilegedTenantTransaction(auth,async tx=>{
  const initial=await findInvoice(tx,auth,input.invoiceId);if(!initial)reject('NOT_FOUND','Rechnung nicht verfügbar.');
  const row=await source(tx,auth,initial.item_id,true),command=clarify?'rechnung.klaeren':'rechnung.status';
  const repeated=await replay(tx,auth,row,input.clientKey,command,input);if(repeated)return repeated;
  const before=await findInvoice(tx,auth,input.invoiceId,false,true);if(!before)reject('NOT_FOUND','Rechnung nicht verfügbar.');
  if(before.version!==input.version)reject('CONFLICT','Rechnung wurde inzwischen geändert · Eingaben bleiben erhalten.');
  const vorschlaege=await invoiceSuggestions(tx,auth,row.id,before.file_id,storedPages(before),row.vorgang_id===before.id);
  if((before.unklar_grund===eingangCopy.rechnungswiderspruch||hatRechnungswiderspruch(vorschlaege))&&['offen','bezahlt'].includes(input.result))
   reject('CONFLICT',eingangCopy.rechnungswiderspruch);
  if(clarify?before.zahlstatus!=='unklar':!['offen','bezahlt'].includes(before.zahlstatus))reject('VALIDATION_ERROR',clarify?'Rechnung ist nicht unklar':'Dieser Status wird ausschließlich in Rechnung klären geändert.');
  if(!clarify&&input.fields!==null)reject('VALIDATION_ERROR','Status ändern verändert keine Rechnungsfelder.');
  if(input.result==='ungueltig'&&(!input.reason||input.reason.trim().length<3))reject('VALIDATION_ERROR','Grund fehlt',{reason:'Grund fehlt · 3 bis 200 Zeichen'});
  const fields=input.fields??fieldsFrom(before);
  const addingSupplier=clarify&&!before.lieferant_id&&before.unklar_grund==='Lieferant fehlt'&&Boolean(fields.lieferantId);
  if(!addingSupplier&&fields.lieferantId!==(before.lieferant_id??'')||normaliseIban(fields.iban)!==normaliseIban(before.iban??'')||fields.ibanGeprueft!==before.iban_geprueft)reject('VALIDATION_ERROR','Klärung berichtigt Nummer, Datum, Beträge und Fälligkeit; Lieferant und IBAN bleiben erhalten.');
  if(!fields.lieferantId&&input.result!=='ungueltig')reject('VALIDATION_ERROR','Lieferant fehlt.',{lieferantId:'Lieferant fehlt'});
  await validate(tx,auth,fields,input.result,input.paidDate,input.proofFileId,row.id,deps);
  await verifyDuplicate(tx,auth,fields,input.result,input.duplicateId,before.dublette_grund,before.id);
  const money=(raw:string)=>raw.trim()?invoiceDecimal(invoiceCents(raw)!):null;
  const breakdown=taxRates(vorschlaege,fields.ust,before);
  await writeInvoiceChange(tx,auth,before,sql`lieferant_id=${fields.lieferantId||null},nummer=${fields.nummer.trim()||null},datum=${fields.datum||null}::date,
   netto=${money(fields.netto)}::numeric,ust=${money(fields.ust)}::numeric,brutto=${money(fields.brutto)}::numeric,ust_saetze=${breakdown.rates===null?null:JSON.stringify(breakdown.rates)}::jsonb,faellig_am=${fields.faelligAm||null}::date,iban=${normaliseIban(fields.iban)||null},iban_geprueft=${fields.ibanGeprueft},
   zahlstatus=${input.result},bezahlt_am=${input.result==='bezahlt'?input.paidDate:null}::date,nachweis_file_id=${input.proofFileId}::uuid,verweis_id=${input.result==='doppelt'?input.duplicateId:null}::uuid,
   ungueltig_grund=${input.result==='ungueltig'?input.reason!.trim():null}`);
  if(addingSupplier&&row.vorgang_id===before.id)await tx.execute(sql`UPDATE public.intake_item SET kunde_id=${fields.lieferantId},zuordnung='hand',version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid`);
  if(clarify){if(!before.aufgabe_id)reject('CONFLICT','Rechnungsaufgabe fehlt.');await deps.resolveTask(tx,auth,{invoiceId:before.id,taskId:before.aufgabe_id,note:'Rechnung geklärt · '+input.result+(input.reason?' · '+input.reason.trim():'')});}
  const after=await findInvoice(tx,auth,before.id);if(!after||after.version!==before.version+1)throw Error('INVOICE_STATUS_READBACK_FAILED');
  await record(tx,auth,row,input.clientKey,command,input,before,after,deps);
  if(input.fields)await speichereErkennungskorrekturen(tx,auth,{itemId:row.id,befehlId:input.clientKey,absender:row.sender,
   korrekturen:rechnungKorrekturen(vorschlaege,fieldsFrom(before),fieldsFrom(after))});
  if(breakdown.warning)recordObservedFailure('INCOMING_INVOICE_TAX_BREAKDOWN_MISMATCH');
  return {code:'OK' as const,invoice:after,replayed:false};
 });}catch(error){return failure(error);}
}
