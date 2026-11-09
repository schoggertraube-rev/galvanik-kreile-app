import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readOrderTaskAssignment} from '@/lib/server/orderTaskAssignmentRead';
import {readCaseActorTraces} from '@/lib/server/caseActorRead';
import type {OrderActorSummary} from './types';

type Failure={code:'FORBIDDEN'|'VALIDATION_ERROR'|'NOT_FOUND'|'CONFLICT'|'UNAVAILABLE';message:string};
/** History and responsibility are distinct; only an actual assignment is responsibility. */
export async function readOrderActors(auth:AuthorizationSnapshot,input:{orderId:string;version:number}):Promise<{code:'OK';actors:OrderActorSummary}|Failure>{
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN',message:'Auftragsakteure benötigen Aufträge.'};
 if(!input||typeof input.orderId!=='string'||!input.orderId||input.orderId.length>128||!Number.isSafeInteger(input.version)||input.version<1)return {code:'VALIDATION_ERROR',message:'Auftragskennung oder Stand fehlt.'};
 try{
  const trace=await withPrivilegedTenantTransaction(auth,async tx=>{
   const [order]=await tx.execute<{version:number}>(sql`SELECT version FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${input.orderId}`);
   if(!order)return {code:'NOT_FOUND' as const,message:'Auftrag ist nicht vorhanden.'};
   if(order.version!==input.version)return {code:'CONFLICT' as const,message:'Auftrag wurde inzwischen geändert. Neu lesen.'};
   const trace=(await readCaseActorTraces(tx,auth,[{kind:'order',id:input.orderId,version:input.version}])).get('order:'+input.orderId)!;
   return {code:'OK' as const,...trace};
  });
  if(trace.code!=='OK')return trace;
  const assignment=await readOrderTaskAssignment(auth,{orderId:input.orderId});
  if(assignment.code==='OK'&&assignment.data&&assignment.data.assignmentVersion>input.version)return {code:'CONFLICT',message:'Auftragszuständigkeit wurde inzwischen geändert. Neu lesen.'};
  const active=assignment.code==='OK'&&assignment.data?.active?assignment.data:null;
  const responsible=assignment.code!=='OK'?null:active?{userId:active.assignedTo,name:active.assignedToName,at:active.assignedAt,source:'assignment' as const}:null;
  return {code:'OK',actors:{currentLoginId:auth.userId,createdBy:trace.createdBy,lastActor:trace.lastActor,responsible,assignmentUnavailable:assignment.code!=='OK',...(assignment.code!=='OK'?{assignmentReadError:assignment.code}:{})}};
 }catch(error){console.error('[ORDER_ACTORS_READ_FAILED]',{code:error instanceof Error?error.name:'UNKNOWN'});return {code:'UNAVAILABLE',message:'Auftragsakteure konnten nicht sicher gelesen werden.'};}
}
