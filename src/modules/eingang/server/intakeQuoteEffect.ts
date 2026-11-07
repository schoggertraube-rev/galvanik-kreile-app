import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

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
