import "server-only";
import { hasOwnOrderIntakeReceipt } from "@/lib/server/intakeDraftEvents";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { OrderIntakeTransactionBinding } from "@/lib/server/commands/orderIntakeCommand";
import { queueIntakeConfirmation } from "./intakeConfirmation";
import { hasAuthorizationArea, type AuthorizationSnapshot } from "@/lib/server/authorization";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {readIntakeProspectReference,type IntakeProspectReference} from './intakeProspect';
import {mayUseContinuationSources} from "./intakeContinuationAccess";
import {quoteHasCreatedOrder} from '@/lib/server/quoteGoodsContextPort';

export type IntakeOrderSource = { id: string; version: number };
type Row = { id:string; kanal:string; fortsetzung_von:string|null; kunde_id:string|null; vorgang_art:string|null; vorgang_id:string|null; version:number; kennzeichen:string[]; erstellt_von:string; text:string|null };

/** U252: one immutable imported mail is the authority for this order instruction. */
export async function readIntakeHandoverMail(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;lock?:boolean}){
  if(!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:'Diese Mail benötigt den Bereich Mails.'};
  const [row]=await tx.execute<Row&{absender_adresse:string|null;empfangen_am:Date|string|null;graph_message_id:string|null;anliegen_offen:string[];einsatz:string}>(sql`SELECT id::text,kanal,fortsetzung_von::text,kunde_id,vorgang_art,vorgang_id,version,kennzeichen,erstellt_von::text,text,absender_adresse,empfangen_am,graph_message_id,anliegen_offen,einsatz FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid ${input.lock===false?sql``:sql`FOR UPDATE`}`);
  if(!row)return {code:'NOT_FOUND' as const,message:'Original-Mail ist nicht verfügbar.'};
  if(row.version!==input.version||row.einsatz!=='offen'||!row.anliegen_offen.includes('abholung'))return {code:'CONFLICT' as const,message:'Mail oder Übergabe-Anliegen wurde geändert. Neu lesen.'};
  if(row.kanal!=='mail'||!row.kunde_id||!row.absender_adresse||!row.empfangen_am||!row.graph_message_id||row.kennzeichen.includes('in_erfassung_verworfen'))return {code:'VALIDATION_ERROR' as const,message:'Eine gespeicherte zugeordnete Original-Mail ist erforderlich.'};
  const originals=await tx.execute<{sha256:string}>(sql`SELECT file.sha256 FROM public.intake_file file WHERE file.tenant_id=${auth.tenantId} AND file.item_id=${row.id}::uuid AND file.art='mime'
    AND EXISTS(SELECT 1 FROM public.intake_event secured WHERE secured.tenant_id=file.tenant_id AND secured.item_id=file.item_id AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=file.id::text AND secured.nachher->>'sha256'=file.sha256)
    AND EXISTS(SELECT 1 FROM public.intake_event imported WHERE imported.tenant_id=file.tenant_id AND imported.item_id=file.item_id AND imported.nachher->>'action'='mail_import_complete' AND imported.nachher->'fileIds' ? file.id::text) FOR SHARE`);
  if(originals.length!==1)return {code:'VALIDATION_ERROR' as const,message:'Der unveränderte Original-Mailbeleg fehlt oder ist mehrdeutig.'};
  return {code:'OK' as const,mail:{id:row.id,version:row.version,customerId:row.kunde_id,orderId:row.vorgang_art==='auftrag'?row.vorgang_id:null,otherReference:Boolean(row.vorgang_id&&row.vorgang_art!=='auftrag'),sender:row.absender_adresse,text:row.text??'',receivedAt:new Date(row.empfangen_am).toISOString(),graphMessageId:row.graph_message_id,originalSha256:originals[0].sha256}};
}

export async function recordIntakeHandoverEffect(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;orderId:string;clientEventId:string;taskId:string|null;mode:'pickup'|'shipping';requestedMode:'pickup'|'shipping'}){
  const [before]=await tx.execute<{anliegen_offen:string[];version:number;kunde_id:string|null}>(sql`SELECT anliegen_offen,version,kunde_id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid AND version=${input.version} FOR UPDATE`);
  if(!before?.anliegen_offen.includes('abholung'))throw Error('HANDOVER_SOURCE_VERSION_CONFLICT');
  const concerns=before.anliegen_offen.filter(value=>value!=='abholung');
  const waiting=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND antwort_auf_item=${input.itemId}::uuid AND sendestatus IN ('entwurf','sendet','unklar','fehler') LIMIT 1`);
  const usage=concerns.length||waiting.length?'offen':'erledigt';
  const changed=await tx.execute(sql`UPDATE public.intake_item SET vorgang_art='auftrag',vorgang_id=${input.orderId},zuordnung='hand',anliegen_haupt=${concerns[0]??null},anliegen_offen=ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[],einsatz=${usage},version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid AND version=${input.version} RETURNING id`);
  if(changed.length!==1)throw Error('HANDOVER_SOURCE_WRITE_CONFLICT');
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES(${auth.tenantId},${input.itemId}::uuid,'anliegen',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify(before)}::jsonb,${JSON.stringify({customerId:before.kunde_id,action:input.taskId?'auftrag.uebergabe_klaeren':'auftrag.uebergabe_geaendert',orderId:input.orderId,taskId:input.taskId,handoverMode:input.mode,requestedHandoverMode:input.requestedMode,anliegenOffen:concerns,einsatz:usage})}::jsonb)`);
}

/** Shared association writer for booking and the receipt of an existing order. */
export async function bindIntakeOriginalToOrder(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;orderId:string;customerId:string;clientEventId:string;complete:boolean;quoteId?:string}){
  const rows=await tx.execute<Row&{einsatz:string;anliegen_offen:string[]}>(sql`SELECT id::text,kanal,fortsetzung_von::text,kunde_id,vorgang_art,vorgang_id,version,kennzeichen,erstellt_von::text,text,einsatz,anliegen_offen
    FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
  if(rows.length!==1)throw Error("INTAKE_CAPTURE_NOT_FOUND");
  const row=rows[0];
  const quoteTransfer=Boolean(input.quoteId&&row.vorgang_art==='kv'&&row.vorgang_id===input.quoteId&&await quoteHasCreatedOrder(tx,auth.tenantId,input.quoteId,input.orderId));
  if((row.kanal==='mail'||row.erstellt_von!==auth.userId)&&!hasAuthorizationArea(auth,'mails')&&!quoteTransfer)throw Error('INTAKE_CAPTURE_FORBIDDEN');
  if(row.fortsetzung_von&&!await mayUseContinuationSources(tx,auth,row.id))throw Error('INTAKE_CAPTURE_FORBIDDEN');
  if(row.kennzeichen.includes('in_erfassung_verworfen')||row.kunde_id&&row.kunde_id!==input.customerId)throw Error('INTAKE_CAPTURE_CUSTOMER_CONFLICT');
  if(row.vorgang_id&&(row.vorgang_art!=='auftrag'||row.vorgang_id!==input.orderId)
    &&!(row.vorgang_art==='kv'&&await quoteHasCreatedOrder(tx,auth.tenantId,row.vorgang_id,input.orderId)))throw Error('INTAKE_CAPTURE_ALREADY_ASSIGNED');
  const usage=input.complete&&row.anliegen_offen.length===0?'erledigt':row.einsatz;
  if(row.vorgang_art==='auftrag'&&row.vorgang_id===input.orderId&&usage===row.einsatz)return;
  const changed=await tx.execute(sql`UPDATE public.intake_item SET kunde_id=${input.customerId},vorgang_art='auftrag',vorgang_id=${input.orderId},zuordnung='hand',einsatz=${usage},
    geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1
    WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid AND version=${row.version} RETURNING id`);
  if(changed.length!==1)throw Error('INTAKE_CAPTURE_ASSIGNMENT_CONFLICT');
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
    VALUES(${auth.tenantId},${input.itemId}::uuid,${row.vorgang_id?'einsatz':'zugeordnet'},${input.clientEventId}::uuid,${auth.userId},${JSON.stringify(row)}::jsonb,
      ${JSON.stringify({kundeId:input.customerId,vorgangArt:'auftrag',vorgangId:input.orderId,einsatz:usage})}::jsonb)`);
}

/** The one intake/order association writer, inside the existing order transaction. */
export function createIntakeOrderBinding(input:{clientEventId:string;customerId:string|null;note:string|null;telefonNotiz?:string|null;sources?:IntakeOrderSource[];draftId?:string}): OrderIntakeTransactionBinding & { itemId:()=>string|null } {
  let sources=[...(input.sources??[])].sort((a,b)=>a.id.localeCompare(b.id));
  let prospect:IntakeProspectReference|null=null;
  let draftId=input.draftId;
  let itemId:string|null=null;
  let locked:Row[]=[];
  return {
    ...(sources.length||input.draftId||input.telefonNotiz?{intentKey:JSON.stringify({sources:sources.map(source=>[source.id,source.version]),draftId:input.draftId??null,...(input.telefonNotiz?{telefonNotiz:input.telefonNotiz}:{})})}:{}),
    itemId:()=>itemId,
    recoverProspectCustomer:()=>prospect?.customerId??null,
    before:async(tx,auth)=>{
      if(input.customerId===null){
        prospect=await readIntakeProspectReference(tx,auth,input.clientEventId);
        if(prospect){
          sources=[...(input.sources??[]).filter(source=>source.id!==prospect!.itemId),{id:prospect.itemId,version:prospect.version}].sort((a,b)=>a.id.localeCompare(b.id));
          draftId=prospect.draftId;
        }
      }
      if(draftId){
        const own=await tx.execute(sql`SELECT id FROM private.intake_drafts WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid AND id=${draftId}::uuid AND status='open' FOR UPDATE`);
        if(own.length!==1){
          if(!await hasOwnOrderIntakeReceipt(tx,auth,input.clientEventId))throw Error("INTAKE_DRAFT_NOT_FOUND");
        }
      }
      for(const key of sources.length?sources.map(source=>source.id):[input.clientEventId])
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${key},0))`);
      locked=await tx.execute<Row>(sql`SELECT id::text,kanal,fortsetzung_von::text,kunde_id,vorgang_art,vorgang_id,version,kennzeichen,erstellt_von::text,text
        FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND ${sources.length?sql`id=ANY(ARRAY[${sql.join(sources.map(source=>sql`${source.id}`),sql`, `)}]::uuid[])`:sql`client_key=${input.clientEventId}`} ORDER BY id FOR UPDATE`);
      if(sources.length?locked.length!==sources.length:locked.length>1)throw Error("INTAKE_CAPTURE_NOT_FOUND");
      itemId=locked[0]?.id??null;
      for(const row of locked){
        if((row.kanal==="mail"||row.erstellt_von!==auth.userId)&&!hasAuthorizationArea(auth,"mails"))throw Error("INTAKE_CAPTURE_FORBIDDEN");
        if(row.fortsetzung_von&&!await mayUseContinuationSources(tx,auth,row.id))throw Error("INTAKE_CAPTURE_FORBIDDEN");
        if(row.kennzeichen.includes("in_erfassung_verworfen"))throw Error("INTAKE_CAPTURE_DISCARDED");
        const ownNewCustomerReplay=input.customerId===null&&Boolean(row.vorgang_id)&&await hasOwnOrderIntakeReceipt(tx,auth,input.clientEventId);
        if(row.kunde_id&&row.kunde_id!==(prospect?.customerId??input.customerId)&&!ownNewCustomerReplay)throw Error("INTAKE_CAPTURE_CUSTOMER_CONFLICT");
        if(sources.length&&!row.vorgang_id&&row.version!==sources.find(source=>source.id===row.id)?.version)throw Error("INTAKE_CAPTURE_VERSION_CONFLICT");
        if(!sources.length&&(row.erstellt_von!==auth.userId||row.text!==(row.kanal==="telefon"?input.telefonNotiz:input.note)))throw Error("INTAKE_CAPTURE_CLIENT_KEY_CONFLICT");
      }
    },
    after:async(tx,auth,receipt)=>{
      if(input.customerId!==null&&receipt.customerId!==input.customerId)throw Error("INTAKE_CAPTURE_RECEIPT_CUSTOMER_CONFLICT");
      if(input.telefonNotiz&&(sources.length>0||locked.length>0&&locked[0].kanal!=="telefon")){
        const phoneKey=input.clientEventId+":telefon";
        const phone=await tx.execute<{id:string}>(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,text,kunde_id,vorgang_art,vorgang_id,zuordnung,einsatz)
          VALUES(${randomUUID()}::uuid,${auth.tenantId},${phoneKey},'telefon','rein','geraet',${auth.userId}::uuid,${input.telefonNotiz},${receipt.customerId},'auftrag',${receipt.orderId},'hand','erledigt')
          ON CONFLICT (tenant_id,client_key) DO NOTHING RETURNING id::text`);
        if(phone.length){
          await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher) VALUES
            (${auth.tenantId},${phone[0].id}::uuid,'angelegt',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify({kanal:'telefon',richtung:'rein'})}::jsonb),
            (${auth.tenantId},${phone[0].id}::uuid,'original_gespeichert',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify({text:input.telefonNotiz})}::jsonb),
            (${auth.tenantId},${phone[0].id}::uuid,'zugeordnet',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify({kundeId:receipt.customerId,vorgangArt:'auftrag',vorgangId:receipt.orderId})}::jsonb)`);
        }else{
          const existing=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND client_key=${phoneKey} AND kanal='telefon' AND text=${input.telefonNotiz} AND kunde_id=${receipt.customerId} AND vorgang_art='auftrag' AND vorgang_id=${receipt.orderId}`);
          if(existing.length!==1)throw Error("INTAKE_PHONE_NOTE_CLIENT_KEY_CONFLICT");
        }
      }
      if(draftId)await tx.execute(sql`DELETE FROM private.intake_drafts WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid AND id=${draftId}::uuid`);
      if(!locked.length){
        itemId=randomUUID();
        const channel=input.telefonNotiz?"telefon":"notiz",direction=input.telefonNotiz?"rein":"intern",original=input.telefonNotiz??input.note;
        await tx.execute(sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,text,kunde_id,zuordnung)
          VALUES(${itemId}::uuid,${auth.tenantId},${input.clientEventId},${channel},${direction},'geraet',${auth.userId}::uuid,${original},${receipt.customerId},'hand')`);
        await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
          VALUES(${auth.tenantId},${itemId}::uuid,'angelegt',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify({kanal:channel,richtung:direction,quelle:'geraet'})}::jsonb)`);
        if(original)await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
          VALUES(${auth.tenantId},${itemId}::uuid,'original_gespeichert',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify({text:original})}::jsonb)`);
      }
      for(const row of locked.length?locked:[null]){
      const id=row?.id??itemId;
      await bindIntakeOriginalToOrder(tx,auth,{itemId:id!,customerId:receipt.customerId,orderId:receipt.orderId,clientEventId:input.clientEventId,complete:true});
      await tx.execute(sql`UPDATE public.intake_suggestion SET order_id=${receipt.orderId} WHERE tenant_id=${auth.tenantId} AND item_id=${id}::uuid AND order_id IS NULL`);
      }
      await queueIntakeConfirmation(tx,auth,receipt);
    },
  };
}
