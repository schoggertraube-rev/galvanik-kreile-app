import 'server-only';
import { sql } from 'drizzle-orm';
import { hasAuthorizationArea, type AuthorizationSnapshot } from '@/lib/server/authorization';
import type { PrivilegedTenantTransaction } from '@/lib/server/privilegedDb';

/** The complaint command calls this existing-module effect in its own transaction. */
export async function recordIntakeComplaintEffect(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{itemId:string;version:number;clientKey:string;complaintId:string;number:string;customerId:string;orderId:string}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('intake:'||${auth.tenantId}||':'||${input.itemId},0))`);
  const rows=await tx.execute<{version:number;kanal:string;erstellt_von:string;kunde_id:string|null;vorgang_id:string|null;vorgang_art:string|null;einsatz:string;anliegen_offen:string[]}>(sql`SELECT version,kanal,erstellt_von::text,kunde_id,vorgang_id,vorgang_art,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid FOR UPDATE`);
  const row=rows[0];
  if(rows.length!==1)throw Error('COMPLAINT_SOURCE_NOT_FOUND');
  if(!hasAuthorizationArea(auth,'mails')&&(row.kanal==='mail'||row.erstellt_von!==auth.userId||!hasAuthorizationArea(auth,'eingang')))throw Error('COMPLAINT_SOURCE_FORBIDDEN');
  if(row.version!==input.version||row.einsatz!=='offen'||!row.anliegen_offen.includes('reklamation'))throw Error('COMPLAINT_SOURCE_CHANGED');
  if(row.kunde_id&&row.kunde_id!==input.customerId||row.vorgang_id&&(row.vorgang_art!=='auftrag'||row.vorgang_id!==input.orderId))throw Error('COMPLAINT_SOURCE_TARGET_MISMATCH');
  const concerns=row.anliegen_offen.filter(value=>value!=='reklamation');
  const waiting=await tx.execute(sql`SELECT id FROM public.intake_item WHERE tenant_id=${auth.tenantId} AND antwort_auf_item=${input.itemId}::uuid AND sendestatus IN ('entwurf','sendet','unklar','fehler') LIMIT 1`);
  const usage=concerns.length||waiting.length?'offen':'erledigt';
  await tx.execute(sql`UPDATE public.intake_item SET anliegen_offen=ARRAY[${sql.join(concerns.map(value=>sql`${value}`),sql`, `)}]::text[],einsatz=${usage},
    kunde_id=${input.customerId},vorgang_art='auftrag',vorgang_id=${input.orderId},zuordnung='hand',geaendert_von=${auth.userId}::uuid,geaendert_am=statement_timestamp(),updated_at=statement_timestamp(),version=version+1
    WHERE tenant_id=${auth.tenantId} AND id=${input.itemId}::uuid AND version=${input.version}`);
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,vorher,nachher)
    VALUES(${auth.tenantId},${input.itemId}::uuid,'anliegen',${input.clientKey}::uuid,${auth.userId},${JSON.stringify(row)}::jsonb,
    ${JSON.stringify({action:'reklamation.aufgenommen',complaintId:input.complaintId,number:input.number,anliegenOffen:concerns,einsatz:usage})}::jsonb)`);
}
