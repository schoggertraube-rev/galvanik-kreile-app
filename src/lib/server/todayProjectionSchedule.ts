import 'server-only';
import {after} from 'next/server';
import {headers} from 'next/headers';
import {outsidePageReadBudget} from '@/db/readBudget';

/** Shared background-model contract: worker, freshness checks and scheduler. */
export const TODAY_PROJECTOR_VERSION=1;
export const TODAY_MODEL_LIST_KINDS=['orders','messages','money','complaints','quote_followups','quotes','tasks','company'] as const;

type Mode='refresh'|'rebuild';
type Jobs={scheduled:boolean;tenants:Map<string,Mode>};
// Keyed only by Next's actual request-local headers object. No header value is
// read, no authorization is cached, and the weak entry dies with that request.
const requests=new WeakMap<object,Jobs>();

/** One native after job per request; a later stale-day shadow read upgrades an
 * already registered bounded refresh to rebuild instead of competing for its lease. */
export async function scheduleTodayProjection(tenantIds:readonly string[],mode:Mode){
 try{
  const request=await headers();
  let jobs=requests.get(request);
  if(!jobs){jobs={scheduled:false,tenants:new Map()};requests.set(request,jobs);}
  for(const tenantId of tenantIds)if(mode==='rebuild'||!jobs.tenants.has(tenantId))jobs.tenants.set(tenantId,mode);
  if(jobs.scheduled)return;
  const pending=jobs;
  after(()=>outsidePageReadBudget(async()=>{
   const {refreshTodayModel,rebuildTodayModel}=await import('./todayProjection');
   for(const [tenantId,requested] of pending.tenants){
    try{await (requested==='rebuild'?rebuildTodayModel(tenantId):refreshTodayModel(tenantId));}
    catch{console.error('[TODAY_PROJECTOR_REFRESH_FAILED]',{code:'SOURCE_INCOMPLETE'});}
   }
  }));
  jobs.scheduled=true;
 }catch{console.error('[TODAY_PROJECTOR_SCHEDULE_FAILED]',{code:'SOURCE_INCOMPLETE'});}
}
