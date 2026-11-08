import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

/** Called only inside the existing quote writer's transaction; no separate capture. */
export async function recordIntakeQuoteEffect(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{source:{itemId:string;version:number;message:boolean};quoteId:string;customerId:string;clientEventId:string;effect?:'ware'|'accept'|'reject'|'conditional'|'amend'}) {
  const rows=await tx.execute<{version:number;kanal:string;erstellt_von:string;kunde_id:string|null;vorgang_art:string|null;vorgang_id:string|null;einsatz:string;anliegen_offen:string[]}>(sql`SELECT version,kanal,erstellt_von::text,kunde_id,vorgang_art,vorgang_id,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.source.itemId}::uuid FOR UPDATE`);
  if (rows.length!==1) return {code:'NOT_FOUND' as const,message:'Auslösender Eingang ist nicht verfügbar.'};
  const source=rows[0];
  if (source.kanal==='mail'?!hasAuthorizationArea(auth,'mails'):!hasAuthorizationArea(auth,'mails')&&(!hasAuthorizationArea(auth,'eingang')||source.erstellt_von!==auth.userId)) return {code:'FORBIDDEN' as const,message:'Das Original ist für diesen Login nicht freigegeben.'};
  if(input.effect!=='ware'&&input.source.message!==(source.kanal==='mail'))return {code:'VALIDATION_ERROR' as const,message:'Der angegebene Originalkanal passt nicht zur Nachricht.'};
  const required=input.effect==='amend'?'aenderung':input.effect==='accept'?'kv_annahme':input.effect==='reject'?'kv_ablehnung':input.effect==='conditional'?source.anliegen_offen.find(concern=>['kv_annahme','preis_einwand','aenderung'].includes(concern)):'kv_anfrage';
  if (source.version!==input.source.version||(input.effect!=='ware'&&(source.einsatz!=='offen'||!required||!source.anliegen_offen.includes(required)))) return {code:'CONFLICT' as const,message:'Eingang oder KV-Anliegen wurde inzwischen geändert. Neu lesen.'};
  if (source.kunde_id&&source.kunde_id!==input.customerId||source.vorgang_id&&(source.vorgang_art!=='kv'||source.vorgang_id!==input.quoteId)) return {code:'CONFLICT' as const,message:'Das Original gehört bereits zu einem anderen Kunden oder Vorgang.'};
  const concerns=input.effect==='ware'?source.anliegen_offen:source.anliegen_offen.filter(concern=>concern!==required);
  if(input.effect==='conditional'&&!concerns.includes('aenderung'))concerns.push('aenderung');
  const pending=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND antwort_auf_item=${input.source.itemId}::uuid AND sendestatus IN ('entwurf','sendet','unklar','fehler') LIMIT 1`);
  const usage=concerns.length||pending.length?'offen':'erledigt';
  const updated=await tx.execute(sql`UPDATE public.intake_item SET kunde_id=${input.customerId},vorgang_art='kv',vorgang_id=${input.quoteId},zuordnung='hand',anliegen=CASE WHEN ${input.effect==='conditional'} THEN array_append(array_remove(anliegen,'aenderung'),'aenderung') ELSE anliegen END,anliegen_haupt=${concerns[0]??null},anliegen_offen=ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[],einsatz=${usage},version=version+1,geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${input.source.itemId}::uuid AND version=${source.version} RETURNING id`);
  if (updated.length!==1) throw Error('QUOTE_SOURCE_WRITE_CONFLICT');
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES(${auth.tenantId},${input.source.itemId}::uuid,${input.effect==='ware'?'zugeordnet':'anliegen'},${input.clientEventId}::uuid,${auth.userId},${JSON.stringify(source)}::jsonb,${JSON.stringify({action:input.effect==='amend'?'kv.geaendert':input.effect==='ware'?'kv.ware_angenommen':input.effect==='accept'?'kv.zugesagt':input.effect==='reject'?'kv.abgesagt':input.effect==='conditional'?'kv.anpassen':'kv.angelegt',quoteId:input.quoteId,anliegenOffen:concerns,einsatz:usage})}::jsonb)`);
}

/** Only reply provenance is exposed; the original and its concerns remain owned here. */
export async function readIntakeQuoteReplyReference(auth:AuthorizationSnapshot,input:{itemId:string;version:number;quoteId:string;customerId:string}){
 if(!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:'Der Mailbeleg benötigt Mails.'};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{version:number;kunde_id:string|null;vorgang_art:string|null;vorgang_id:string|null;sender:string;chain:{source?:string;status?:string;originalSha256?:string;inReplyTo?:string[]}|null}>(sql`SELECT source.version,source.kunde_id,source.vorgang_art,source.vorgang_id,source.absender_adresse AS sender,original.nachher->'replyChain' AS chain FROM public.intake_item source
   JOIN LATERAL(SELECT event.nachher FROM public.intake_event event WHERE event.tenant_id=source.tenant_id AND event.item_id=source.id AND event.art='angelegt' ORDER BY event.zeit,event.id LIMIT 1) original ON true
   WHERE source.tenant_id=${auth.tenantId} AND source.id=${input.itemId}::uuid AND source.kanal='mail'
   AND EXISTS(SELECT 1 FROM public.intake_event done WHERE done.tenant_id=source.tenant_id AND done.item_id=source.id AND done.art='einsatz' AND done.nachher->>'action'='mail_import_complete')
   AND EXISTS(SELECT 1 FROM public.intake_file file WHERE file.tenant_id=source.tenant_id AND file.item_id=source.id AND file.mime='message/rfc822' AND file.sha256=original.nachher->'replyChain'->>'originalSha256'
     AND EXISTS(SELECT 1 FROM public.intake_event secured WHERE secured.tenant_id=file.tenant_id AND secured.item_id=file.item_id AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=file.id::text))`);
  const row=rows[0];if(rows.length!==1||!row?.chain||row.chain.source!=='original_mime'||row.chain.status!=='present'||!Array.isArray(row.chain.inReplyTo)||row.chain.inReplyTo.length!==1||typeof row.chain.originalSha256!=='string'||!/^[0-9a-f]{64}$/.test(row.chain.originalSha256))return {code:'VALIDATION_ERROR' as const,message:'Die Mail hat keinen eindeutigen direkten Fassungsbeleg. Aktuelle Fassung bestätigen lassen.'};
  if(row.version!==input.version||row.kunde_id&&row.kunde_id!==input.customerId||row.vorgang_id&&(row.vorgang_art!=='kv'||row.vorgang_id!==input.quoteId))return {code:'CONFLICT' as const,message:'Mailbezug wurde geändert. Original neu lesen.'};
  return {code:'OK' as const,reference:{internetMessageId:row.chain.inReplyTo[0],sender:row.sender,originalSha256:row.chain.originalSha256}};
 });}catch(error){console.error('[QUOTE_REPLY_REFERENCE_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Der originale Antwortbezug konnte nicht sicher gelesen werden.'};}
}
