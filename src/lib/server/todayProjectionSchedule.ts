import 'server-only';
import {sql} from 'drizzle-orm';
import {after} from 'next/server';
import {headers} from 'next/headers';
import {outsidePageReadBudget,withPageReadBudget} from '@/db/readBudget';
import {berlinCalendarDay} from '@/lib/domain/workingDays';
import {withPrivilegedTenantTransaction} from './privilegedDb';

/** One bounded command follow-up per real request. Page reads never schedule it. */
export const TODAY_PROJECTOR_VERSION=1;
export const TODAY_MODEL_LIST_KINDS=['orders','messages','money','complaints','quote_followups','quotes','tasks','company'] as const;
type Jobs={scheduled:boolean;tenants:Set<string>};
const requests=new WeakMap<object,Jobs>();

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
  return result.needsRebuild;
 }),5000);
}

export async function scheduleTodayCommandFollowup(tenantIds:readonly string[]){
 if(!tenantIds.length)return;
 try{
  const request=await headers();
  let jobs=requests.get(request);
  if(!jobs){jobs={scheduled:false,tenants:new Set()};requests.set(request,jobs);}
  for(const tenantId of tenantIds)jobs.tenants.add(tenantId);
  if(jobs.scheduled)return;
  const pending=jobs;
  after(()=>outsidePageReadBudget(async()=>{
   const {refreshTodayModel}=await import('./todayProjection');
   for(const tenantId of pending.tenants){
    try{
     await refreshTodayModel(tenantId,undefined,{bounded:true});
    }catch{console.error('[TODAY_COMMAND_FOLLOWUP_FAILED]',{code:'SOURCE_INCOMPLETE'});}
   }
  }));
  jobs.scheduled=true;
 }catch{console.error('[TODAY_COMMAND_FOLLOWUP_SCHEDULE_FAILED]',{code:'SOURCE_INCOMPLETE'});}
}
