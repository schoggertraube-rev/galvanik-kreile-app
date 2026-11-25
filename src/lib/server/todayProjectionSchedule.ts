import 'server-only';
import {sql} from 'drizzle-orm';
import {withPageReadBudget} from '@/db/readBudget';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {withPrivilegedTenantTransaction} from './privilegedDb';

export const TODAY_PROJECTOR_VERSION=1;
export const TODAY_MODEL_LIST_KINDS=['orders','messages','money','complaints','quote_followups','quotes','tasks','company'] as const;

/** One ordered tenant source for the central Takt and the Today core. */
export async function listeTodayMandanten():Promise<string[]>{
 const {db}=await import('@/db');
 return db.transaction(async tx=>{
  await tx.execute(sql`SET TRANSACTION READ ONLY`);
  const rows=await tx.execute<{tenant_id:string}>(sql`SELECT tenant_id FROM private.today_tenant_v1 ORDER BY tenant_id`);
  if(rows.some(row=>!row.tenant_id))throw Error('TODAY_TENANT_LIST_INCOMPLETE');
  return rows.map(row=>row.tenant_id);
 });
}

/** Reuse the qualified Today model predicate for the five-minute Takt refresh. */
export async function liesTodayModellVeraltet(tenantId:string,jetzt:Date):Promise<boolean>{
 const {readTodayModelInTransaction}=await import('./todayDashboard');
 return withPageReadBudget(()=>withPrivilegedTenantTransaction({tenantId},async tx=>{
  const result=await readTodayModelInTransaction(tx,{tenantId},berlinCalendarDay(jetzt),true);
  return result.needsRebuild||result.rows.some(row=>row.kind==='order'&&row.listed&&row.status!=='SOURCE_INCOMPLETE'
   &&(row.status==='PENDING'||row.sourceSeq!==row.builtSeq));
 }),5000);
}

/** The manual refresh reports an occupied lease without altering the model. */
export async function liesTodayModellBesetzt(tenantId:string):Promise<boolean>{
 return withPrivilegedTenantTransaction({tenantId},async tx=>{
  const [row]=await tx.execute<{besetzt:boolean}>(sql`SELECT EXISTS(
   SELECT 1 FROM private.today_tenant_v1 WHERE tenant_id=${tenantId} AND refresh_lease_until>statement_timestamp()
  ) AS besetzt`);
  return row.besetzt;
 });
}
