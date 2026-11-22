import {createHash,timingSafeEqual} from 'node:crypto';
import {outsidePageReadBudget} from '@/db/readBudget';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {resolveAuthorization} from '@/lib/server/authorization';
import {rebuildTodayModel} from '@/lib/server/todayProjection';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/** PL22.11.01:47: runtime proof, never a claimed Cron header/user agent.
 * No credential is read from a file, logged, returned or persisted. */
export async function GET(request:Request){
 const configured=process.env.CRON_SECRET;
 let tenantId:string;
 if(configured){
  const supplied=request.headers.get('authorization');
  if(!supplied||!timingSafeEqual(createHash('sha256').update(supplied).digest(),createHash('sha256').update('Bearer '+configured).digest()))return new Response(null,{status:401});
  tenantId=KREILE_TENANT_SLUG;
 }else{
  try{
   const result=await resolveAuthorization();
   if(!result.ok)return new Response(null,{status:401});
   if(!result.data.permissions.includes('perm_sys_diag'))return new Response(null,{status:403});
   tenantId=result.data.tenantId;
  }catch{return new Response(null,{status:401});}
 }
 try{
  const result=await outsidePageReadBudget(()=>rebuildTodayModel(tenantId));
  return Response.json(result,{status:result.code==='BUSY'?202:200,headers:{'Cache-Control':'private, no-store'}});
 }catch{
  console.error('[TODAY_PROJECTOR_REBUILD_FAILED]',{code:'SOURCE_INCOMPLETE'});
  return new Response(null,{status:503,headers:{'Cache-Control':'private, no-store'}});
 }
}
