import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {hasOwnOrderIntakeReceipt} from '@/lib/server/intakeDraftEvents';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {CustomerWriter} from '@/lib/server/commands/orderIntakeCommand';
import type {CustomerStoredProfile} from '@/modules/customers/public';
import {orderPositionUnitLabel,normaliseOrderPositionUnit} from '@/lib/orderPositionContract';
import {authorizedIntakeContext,writeIntakeNoteInTransaction} from './intakeCapture';
import {writeIntakeDraftInTransaction} from './intakeDraft';
import type {IntakeProspectInput,IntakeProspectResult} from '../prospectContract';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
type ProspectFailure=Exclude<IntakeProspectResult,{code:'OK'}>;
class Rejected extends Error{constructor(readonly result:ProspectFailure){super(result.code);}}
type CustomerReader=(tx:PrivilegedTenantTransaction,tenantId:string,id:string)=>Promise<CustomerStoredProfile|null>;
export type IntakeProspectReference={itemId:string;customerId:string;draftId:string;version:number;intent:string};

/** Receipt references the existing customer and draft; it stores no second customer record. */
export async function readIntakeProspectReference(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,clientKey:string):Promise<IntakeProspectReference|null>{
  const rows=await tx.execute<IntakeProspectReference>(sql`SELECT item.id::text AS "itemId",item.kunde_id AS "customerId",
    event.nachher->>'draftId' AS "draftId",(event.nachher->>'version')::int AS version,event.nachher->>'intent' AS intent
    FROM public.intake_event event JOIN public.intake_item item ON item.tenant_id=event.tenant_id AND item.id=event.item_id
    WHERE event.tenant_id=${auth.tenantId} AND event.von=${auth.userId} AND event.befehl_id=${clientKey}::uuid
      AND event.art='zugeordnet' AND event.nachher->>'befehlsart'='interessent' AND item.erstellt_von=${auth.userId}::uuid`);
  if(!rows.length)return null;
  const row=rows[0];
  if(rows.length!==1||![row.itemId,row.customerId,row.draftId].every(id=>typeof id==='string'&&UUID.test(id))||!Number.isSafeInteger(row.version)||row.version<1||!/^[a-f0-9]{64}$/.test(row.intent))throw Error('INTAKE_PROSPECT_RECEIPT_INVALID');
  return row;
}

function valid(input:unknown):input is IntakeProspectInput{
  return object(input)&&Object.keys(input).every(key=>['clientKey','customer','text','draft','activeDraft'].includes(key))
    &&typeof input.clientKey==='string'&&UUID.test(input.clientKey)&&object(input.customer)
    &&['business','privat'].includes(String(input.customer.customerType))&&!('clientEventId' in input.customer)
    &&typeof input.text==='string'&&input.text.length<=20_000&&object(input.draft)&&input.draft.clientKey===input.clientKey
    &&Array.isArray(input.draft.items)&&input.draft.items.length<=20&&input.draft.items.every(object)
    &&JSON.stringify(input.draft).length<=250_000
    &&(input.activeDraft===undefined||object(input.activeDraft)&&Object.keys(input.activeDraft).sort().join(',')==='id,version'
      &&typeof input.activeDraft.id==='string'&&UUID.test(input.activeDraft.id)&&typeof input.activeDraft.version==='number'&&Number.isSafeInteger(input.activeDraft.version)&&input.activeDraft.version>=0);
}

function originalText(input:IntakeProspectInput,name:string):string{
  const items=Array.isArray(input.draft.items)?input.draft.items:[];
  const lines=items.slice(0,20).filter(object).filter(item=>typeof item.name==='string'&&item.name.trim()).map((item,index)=>{
    const unit=normaliseOrderPositionUnit(item.unit);
    return `Position ${index+1}: ${typeof item.quantity==='string'?item.quantity:'fehlt'} ${unit?orderPositionUnitLabel(unit):'Einheit fehlt'} · ${String(item.name).slice(0,200)}`;
  });
  const date=typeof input.draft.date==='string'&&input.draft.date?['Termin: '+input.draft.date]:[];
  const note=typeof input.draft.note==='string'&&input.draft.note?['Notiz: '+input.draft.note]:[];
  return [input.text,...lines,...date,...note].filter(Boolean).join('\n')||'Interessent '+name;
}

/** werkbank.interessent: existing customer, note and X12 writers in one transaction. */
export async function saveIntakeProspect(input:unknown,createCustomer:CustomerWriter,readCustomer:CustomerReader):Promise<IntakeProspectResult>{
  if(!valid(input))return {code:'VALIDATION_ERROR',message:'Interessentendaten sind unvollständig oder ungültig.'};
  const auth=await authorizedIntakeContext();if('code' in auth)return auth;
  if(!auth.permissions.includes('perm_data_customers'))return {code:'FORBIDDEN',message:'Kundenanlage ist nicht freigegeben.'};
  if(!hasAuthorizationArea(auth,'geld')&&Array.isArray(input.draft.items)&&input.draft.items.some(item=>object(item)&&item.unitPriceCents!=null))return {code:'VALIDATION_ERROR',message:'Preisangaben benötigen das Recht Geld.'};
  const intent=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  try{
    return await withPrivilegedTenantTransaction(auth,async tx=>{
      // Same lock/order as booking: a lost prospect response cannot create a second customer.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:order-intake:'||${auth.tenantId}||':'||${auth.userId}||':'||${input.clientKey},0))`);
      const prior=await readIntakeProspectReference(tx,auth,input.clientKey);
      if(prior){
        if(prior.intent!==intent)throw new Rejected({code:'CONFLICT',message:'Diese Interessenten-Speicherung wurde bereits anders verwendet.'});
        const customer=await readCustomer(tx,auth.tenantId,prior.customerId);
        if(!customer?.customerNumber)throw Error('INTAKE_PROSPECT_CUSTOMER_READBACK_INVALID');
        return {code:'OK' as const,customerId:prior.customerId,customerNumber:customer.customerNumber,intakeItemId:prior.itemId,draftId:prior.draftId,replayed:true};
      }
      if(await hasOwnOrderIntakeReceipt(tx,auth,input.clientKey))throw new Rejected({code:'CONFLICT',message:'Diese Erfassung wurde bereits als Auftrag gebucht.'});
      const created=await createCustomer(tx,{tenantId:auth.tenantId,userId:auth.userId,capabilities:{canCreateCustomer:true,canManageMoney:hasAuthorizationArea(auth,'geld'),canDecide:hasAuthorizationArea(auth,'entscheiden')}},{...input.customer,clientEventId:randomUUID()});
      if(created.code!=='OK')throw new Rejected(created);
      const itemId=randomUUID(),text=originalText(input,created.receipt.name);
      if(text.length>20_000)throw new Rejected({code:'VALIDATION_ERROR',message:'Die Angaben für den Verlauf sind zu lang.'});
      const note=await writeIntakeNoteInTransaction(tx,auth,{itemId,textstand:randomUUID(),text,context:{customerId:created.receipt.customerId},concerns:[]},readCustomer);
      if(note)throw new Rejected(note);
      const draftId=input.activeDraft?.id??randomUUID(),draftClientKey=randomUUID();
      const draft=await writeIntakeDraftInTransaction(tx,auth,{id:draftId,clientEventId:randomUUID(),art:'eingang',
        payload:{...input.draft,clientKey:draftClientKey,customerMode:'EXISTING',customerId:created.receipt.customerId,customerName:created.receipt.name,
          documents:[...new Set([...(Array.isArray(input.draft.documents)?input.draft.documents:[]),itemId])]},
        lastField:null,expectedVersion:input.activeDraft?.version??null});
      if(draft)throw new Rejected(draft);
      await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
        VALUES(${auth.tenantId},${itemId}::uuid,'zugeordnet',${input.clientKey}::uuid,${auth.userId},
          ${JSON.stringify({befehlsart:'interessent',intent,draftId,version:1})}::jsonb)`);
      return {code:'OK' as const,customerId:created.receipt.customerId,customerNumber:created.receipt.customerNumber,intakeItemId:itemId,draftId,replayed:false};
    });
  }catch(cause){
    console.error('[INTAKE_PROSPECT_WRITE_FAILED]',cause instanceof Rejected?{code:cause.result.code}:cause);
    return cause instanceof Rejected?cause.result:{code:'UNAVAILABLE',message:'Speichern fehlgeschlagen · alle Eingaben sind noch da. Code: INTAKE_PROSPECT_WRITE_FAILED.'};
  }
}
