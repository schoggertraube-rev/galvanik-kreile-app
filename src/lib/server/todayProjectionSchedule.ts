import 'server-only';
import {after} from 'next/server';
import {headers} from 'next/headers';
import {outsidePageReadBudget} from '@/db/readBudget';

/** One bounded command follow-up per real request. Page reads never schedule it. */
export const TODAY_PROJECTOR_VERSION=1;
export const TODAY_MODEL_LIST_KINDS=['orders','messages','money','complaints','quote_followups','quotes','tasks','company'] as const;
type Jobs={scheduled:boolean;tenants:Set<string>};
const requests=new WeakMap<object,Jobs>();

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
