import {resolveAuthorization,hasAnyAuthorizationArea} from '@/lib/server/authorization';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';
import {refreshTodayModel,rebuildTodayModel} from '@/lib/server/todayProjection';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const responseHeaders={'Cache-Control':'private, no-store','Vary':'Cookie'};

/** Ordinary authorized home read after the first image. No Action queue, actor
 * claim or new write route; only the existing derived single-flight worker. */
export async function GET(request:Request){
 const query=new URL(request.url).searchParams;
 if(query.get('nur')!=='veraltet'||[...query.keys()].some(key=>key!=='nur')||query.getAll('nur').length!==1)return new Response(null,{status:400,headers:responseHeaders});
 try{
  const auth=await resolveAuthorization();
  if(!auth.ok)return new Response(null,{status:401,headers:responseHeaders});
  if(!hasAnyAuthorizationArea(auth.data))return new Response(null,{status:403,headers:responseHeaders});
  const before=await loadOfficeHome(auth.data);
  if(!('dashboard'in before))return Response.json({code:'SOURCE_INCOMPLETE'},{status:503,headers:responseHeaders});
  if(before.modelRead?.source==='live'||!before.modelRead?.pending)return Response.json({code:'OK',model:before},{headers:responseHeaders});
  const refreshed=await (before.modelRead.rebuild?rebuildTodayModel(auth.data.tenantId):refreshTodayModel(auth.data.tenantId));
  // BUSY returns the current qualified partial view immediately. The client's
  // configured poll interval is the upper bound, without holding a DB slot.
  const model=refreshed.code==='BUSY'?before:await loadOfficeHome(auth.data);
  return Response.json({code:'OK',model},{headers:responseHeaders});
 }catch{
  console.error('[TODAY_MODEL_READ_FAILED]',{code:'SOURCE_INCOMPLETE'});
  return Response.json({code:'SOURCE_INCOMPLETE'},{status:503,headers:responseHeaders});
 }
}
