import 'server-only';
import {sql} from 'drizzle-orm';
import {withPageReadPhase} from '@/db/readBudget';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import {TODAY_PROJECTOR_VERSION} from './todayProjectionSchedule';

export type TodayModelSourceRow={
 kind:string;sourceId:string;status:string;listed:boolean;sourceVersion:number|null;
 currentVersion:number|null;fresh:boolean;payload:unknown;errorCode:string|null;
 builtAt:string|null;needsRebuild:boolean;
};
/** The caller owns the one settings/model/actor transaction. Stale payloads
 * never cross this SQL boundary, even if a caller later mishandles freshness.
 * Original field facts and actor masks are composed by their existing readers. */
export async function readTodayModelInTransaction(tx:PrivilegedTenantTransaction,context:{tenantId:string},today:string){
 return withPageReadPhase('today.model.read',async()=>{
  const fresh=sql`source.status='OK' AND source.source_seq=source.built_seq
   AND source.built_tenant_seq=tenant.tenant_seq AND source.built_day=${today}::date
   AND source.projector_version=${TODAY_PROJECTOR_VERSION}
   AND (source.kind<>'order' OR source.listed AND orders.version=source.source_version)`;
  const rows=await tx.execute<TodayModelSourceRow>(sql`SELECT source.kind,source.source_id AS "sourceId",source.status,source.listed,
   source.source_version AS "sourceVersion",orders.version AS "currentVersion",${fresh} AS fresh,
   CASE WHEN ${fresh} THEN source.payload ELSE NULL END AS payload,source.error_code AS "errorCode",source.built_at::text AS "builtAt",
   source.built_tenant_seq<>tenant.tenant_seq OR source.built_day IS DISTINCT FROM ${today}::date
    OR source.projector_version<>${TODAY_PROJECTOR_VERSION} AS "needsRebuild"
   FROM private.today_tenant_v1 tenant JOIN private.today_source_v1 source ON source.tenant_id=tenant.tenant_id
   LEFT JOIN public.orders orders ON source.kind='order' AND orders.tenant_id=source.tenant_id AND orders.id=source.source_id
   WHERE tenant.tenant_id=${context.tenantId} AND (source.source_id='*' OR source.kind='order' AND source.listed)
   ORDER BY source.kind,source.source_id`);
  if(!rows.some(row=>row.builtAt!==null))return {code:'EMPTY' as const,rows:[] as TodayModelSourceRow[],needsRebuild:true};
  return {code:'OK' as const,rows:[...rows],needsRebuild:rows.some(row=>row.needsRebuild)};
 },result=>({rows:result.rows.length,fresh:result.rows.filter(row=>row.fresh===true).length,stale:result.rows.filter(row=>row.fresh!==true).length}));
}
