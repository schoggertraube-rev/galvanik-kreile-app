import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {SystemSettingsContext,CompanyDocumentContext} from './systemSettingsPort';
import {readQuoteJournal,appendQuoteJournal,readQuoteCurrentRate} from '@/lib/server/quoteJournalPort';

export type QuoteCalculationSettings={
  hourlyRateCents:number|null;setupCents:number|null;materialCents:number|null;
  followupDays:number|null;validityDays:number|null;updatedAt:string;
};
export async function readQuoteSettingsInTransaction(tx:PrivilegedTenantTransaction,tenantId:string):Promise<QuoteCalculationSettings|null> {
  const rows=await tx.execute<Omit<QuoteCalculationSettings,'hourlyRateCents'>>(sql`SELECT kv_ruest_cents::float8 AS "setupCents",kv_material_cents::float8 AS "materialCents",kv_nachfass_tage AS "followupDays",kv_gueltigkeit_tage AS "validityDays",to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
    FROM public.company_settings WHERE tenant_id=${tenantId} ORDER BY updated_at DESC,id LIMIT 2`);
  if (!rows.length) return null;
  if (rows.length!==1||!Number.isFinite(Date.parse(rows[0].updatedAt))) throw Error('QUOTE_SETTINGS_AMBIGUOUS');
  const settings={...rows[0],hourlyRateCents:await readQuoteCurrentRate(tx,tenantId)};
  for (const key of ['setupCents','materialCents','followupDays','validityDays'] as const) {
    const value=settings[key];
    if (value!==null&&(!Number.isSafeInteger(value)||value<0||key.endsWith('Days')&&value<1)) throw Error('QUOTE_SETTINGS_INVALID');
  }
  return settings;
}
export async function readQuoteSettings(context:CompanyDocumentContext) {
  if (!context.canRead) return {code:'FORBIDDEN' as const,message:'KV-Ansätze sind nicht freigegeben.'};
  try {
    const settings=await withPrivilegedTenantTransaction(context,tx=>readQuoteSettingsInTransaction(tx,context.tenantId));
    return settings?{code:'OK' as const,settings}:{code:'NOT_FOUND' as const,message:'Firmeneinstellungen fehlen · KV-Ansätze in Einstellungen ergänzen.'};
  } catch (error) {
    console.error('[QUOTE_SETTINGS_READ_FAILED]',error instanceof Error?error.name:'UnknownError');
    return {code:'UNAVAILABLE' as const,message:'KV-Ansätze konnten nicht sicher gelesen werden.'};
  }
}
export async function saveQuoteSettings(context:SystemSettingsContext,input:unknown) {
  if (!context.canManageCompany) return {code:'FORBIDDEN' as const,message:'KV-Ansätze benötigen das Recht Einstellungen.'};
  if (!input||typeof input!=='object'||Array.isArray(input)) return {code:'VALIDATION_ERROR' as const,message:'KV-Ansätze fehlen.'};
  const row=input as Record<string,unknown>;
  const fields=['setupCents','materialCents','followupDays','validityDays'] as const;
  if (Object.keys(row).sort().join('|')!==['clientEventId','expectedUpdatedAt',...fields].sort().join('|')
    ||typeof row.clientEventId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.clientEventId)
    ||typeof row.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(row.expectedUpdatedAt))
    ||fields.some(key=>row[key]!==null&&(!Number.isSafeInteger(row[key])||Number(row[key])<0||Number(row[key])>(key.endsWith('Days')?3650:999999999999)||key.endsWith('Days')&&Number(row[key])<1))) return {code:'VALIDATION_ERROR' as const,message:'KV-Ansätze oder Speicherkennung sind ungültig.'};
  const value={clientEventId:row.clientEventId,expectedUpdatedAt:row.expectedUpdatedAt,...Object.fromEntries(fields.map(key=>[key,row[key]]))} as {clientEventId:string;expectedUpdatedAt:string}&Pick<QuoteCalculationSettings,typeof fields[number]>;
  const intent=createHash('sha256').update(JSON.stringify(value)).digest('hex');
  try {
    return await withPrivilegedTenantTransaction(context,async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('quote-settings:'||${context.tenantId},0))`);
      const actor={tenantId:context.tenantId,userId:context.actorId};
      const events=await readQuoteJournal<{intent:string;after:QuoteCalculationSettings}>(tx,actor,value.clientEventId);
      if (events.length) return events.length===1&&events[0].eventType==='QUOTE_SETTINGS_UPDATED_V04'&&events[0].payload.intent===intent
        ?{code:'OK' as const,settings:events[0].payload.after,replayed:true}:{code:'CONFLICT' as const,message:'Diese Speicherkennung wurde bereits anders verwendet.'};
      const before=await readQuoteSettingsInTransaction(tx,context.tenantId);
      if (!before) return {code:'NOT_FOUND' as const,message:'Firmendaten müssen zuerst angelegt werden.'};
      if (before.updatedAt!==value.expectedUpdatedAt) return {code:'CONFLICT' as const,message:'Einstellungen wurden inzwischen geändert. Neu lesen und abgleichen.'};
      const changed=await tx.execute(sql`UPDATE public.company_settings SET kv_ruest_cents=${value.setupCents},kv_material_cents=${value.materialCents},kv_nachfass_tage=${value.followupDays},kv_gueltigkeit_tage=${value.validityDays},updated_at=statement_timestamp()
        WHERE tenant_id=${context.tenantId} AND updated_at=${value.expectedUpdatedAt}::timestamptz RETURNING id`);
      if (changed.length!==1) throw Error('QUOTE_SETTINGS_WRITE_CONFLICT');
      const after=await readQuoteSettingsInTransaction(tx,context.tenantId);
      if (!after) throw Error('QUOTE_SETTINGS_READBACK_MISSING');
      await appendQuoteJournal(tx,actor,{id:randomUUID(),type:'QUOTE_SETTINGS_UPDATED_V04',clientEventId:value.clientEventId,correlationId:randomUUID(),version:null,description:'KV-Ansätze geändert',payload:{intent,before,after}});
      return {code:'OK' as const,settings:after,replayed:false};
    });
  } catch (error) {
    console.error('[QUOTE_SETTINGS_WRITE_FAILED]',error instanceof Error?error.name:'UnknownError');
    return {code:'UNAVAILABLE' as const,message:'KV-Ansätze konnten nicht sicher gespeichert werden. Kennung und Eingaben behalten.'};
  }
}
