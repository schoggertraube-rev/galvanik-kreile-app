import {after} from 'next/server';
import {readTodayHomeRevision,readTodayHomePart} from '@/app/actions/orders.actions';
import {holeTaktNach} from '@/modules/takt/server-public';
import {TAKT_READ_BUDGET_MS} from '@/modules/takt/public';
import {readCacheLoginScope} from '@/lib/server/authBootstrap';
import {resolveAuthorization,hasAnyAuthorizationArea} from '@/lib/server/authorization';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {outsidePageReadBudget,withPageReadBudget} from '@/db/readBudget';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const responseHeaders={'Cache-Control':'private, no-store','Vary':'Cookie'};

function planeNachholen(tenantId:string){
 try{after(()=>outsidePageReadBudget(()=>holeTaktNach(tenantId)).catch(()=>{
  console.error('[TAKT_CATCHUP_FAILED]',{code:'SOURCE_INCOMPLETE'});
 }));}
 catch{console.error('[TAKT_CATCHUP_SCHEDULE_FAILED]',{code:'SOURCE_INCOMPLETE'});}
}

/** Model rebuilding runs only in the Takt job; this read schedules a throttled
 * catch-up after the response without changing the model or its ETag. */
export async function GET(request:Request){
 const query=new URL(request.url).searchParams;
 const part=query.get('bereich');
 if(query.get('nur')!=='veraltet'||[...query.keys()].some(key=>key!=='nur'&&key!=='bereich')||query.getAll('nur').length!==1||query.getAll('bereich').length>1||part!==null&&!['week','notices','counts'].includes(part))return new Response(null,{status:400,headers:responseHeaders});
 try{return await withPageReadBudget(async()=>{
  const auth=await resolveAuthorization();
  if(!auth.ok)return new Response(null,{status:401,headers:responseHeaders});
  if(!hasAnyAuthorizationArea(auth.data))return new Response(null,{status:403,headers:responseHeaders});
  const conditional=request.headers.get('If-None-Match');
  if(conditional&&/^"[a-f0-9]{64}"$/.test(conditional)&&request.headers.get('X-Kreile-Login-Scope')===await readCacheLoginScope()){
   const current=await readTodayHomeRevision();
   if(current&&conditional==='"'+(part?current.revisions[part as keyof typeof current.revisions]:current.revision)+'"'){
    if(!part&&current.needsRebuild)planeNachholen(auth.data.tenantId);
    return new Response(null,{status:304,headers:{...responseHeaders,ETag:conditional}});
   }
  }
  if(part){
   const before=await readTodayHomeRevision();
   const selected=part as import('@/components/home/OfficeHomeClient').TodayHomePart;
   const read=await readTodayHomePart(selected);
   const current=await readTodayHomeRevision(),revision=current?.revisions[part as keyof typeof current.revisions];
   // The supplementary value cannot claim a newer source revision than the
   // snapshot read. A concurrent command leaves only this region unknown.
   const stable=before?.revisions[part as keyof typeof before.revisions]===revision;
   const result=stable?read:{code:'SOURCE_INCOMPLETE' as const,part:selected};
   return Response.json({code:'OK',result,scope:await readCacheLoginScope(),...(stable?{revision}:{})},{headers:{...responseHeaders,...(stable&&revision?{ETag:'"'+revision+'"'}:{})}});
  }
  const before=await loadOfficeHome(auth.data);
  if(!('dashboard'in before))return Response.json({code:'SOURCE_INCOMPLETE'},{status:503,headers:responseHeaders});
  const response=Response.json({code:'OK',model:before},{headers:{...responseHeaders,...(before.modelRead?.revision?{ETag:'"'+before.modelRead.revision+'"'}:{})}});
  planeNachholen(auth.data.tenantId);
  return response;
 },TAKT_READ_BUDGET_MS);}catch{
  console.error('[TODAY_MODEL_READ_FAILED]',{code:'SOURCE_INCOMPLETE'});
  return Response.json({code:'SOURCE_INCOMPLETE'},{status:503,headers:responseHeaders});
 }
}
