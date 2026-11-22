import {readTodayHomeRevision,readTodayHomePart} from '@/app/actions/orders.actions';
import {readCacheLoginScope} from '@/lib/server/authBootstrap';
import {resolveAuthorization,hasAnyAuthorizationArea} from '@/lib/server/authorization';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {withPageReadBudget} from '@/db/readBudget';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const responseHeaders={'Cache-Control':'private, no-store','Vary':'Cookie'};

/** Ordinary authorized home read after the first image. No Action queue, actor
 * claim or new write route; only the existing derived single-flight worker. */
export async function GET(request:Request){
 const query=new URL(request.url).searchParams;
 const part=query.get('bereich');
 if(query.get('nur')!=='veraltet'||[...query.keys()].some(key=>key!=='nur'&&key!=='bereich')||query.getAll('nur').length!==1||query.getAll('bereich').length>1||part!==null&&!['week','stock','notices','counts'].includes(part))return new Response(null,{status:400,headers:responseHeaders});
 try{return await withPageReadBudget(async()=>{
  const auth=await resolveAuthorization();
  if(!auth.ok)return new Response(null,{status:401,headers:responseHeaders});
  if(!hasAnyAuthorizationArea(auth.data))return new Response(null,{status:403,headers:responseHeaders});
  const conditional=request.headers.get('If-None-Match');
  if(conditional&&/^"[a-f0-9]{64}"$/.test(conditional)&&request.headers.get('X-Kreile-Login-Scope')===await readCacheLoginScope()){
   const current=await readTodayHomeRevision();
   if(current&&!current.pending&&conditional==='"'+(part?current.revisions[part as keyof typeof current.revisions]:current.revision)+'"')return new Response(null,{status:304,headers:{...responseHeaders,ETag:conditional}});
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
  if(before.modelRead?.source==='live'||!before.modelRead?.pending)return Response.json({code:'OK',model:before},{headers:{...responseHeaders,...(before.modelRead?.revision?{ETag:'"'+before.modelRead.revision+'"'}:{})}});
  // loadOfficeHome has already scheduled the coalesced projector. A model
  // refresh can take longer than an HTTP request and must never hold this GET
  // (or its database slot) open until the platform's runtime limit.
  return Response.json({code:'OK',model:before},{headers:{...responseHeaders,...(before.modelRead.revision?{ETag:'"'+before.modelRead.revision+'"'}:{})}});
 },5_000);}catch{
  console.error('[TODAY_MODEL_READ_FAILED]',{code:'SOURCE_INCOMPLETE'});
  return Response.json({code:'SOURCE_INCOMPLETE'},{status:503,headers:responseHeaders});
 }
}
