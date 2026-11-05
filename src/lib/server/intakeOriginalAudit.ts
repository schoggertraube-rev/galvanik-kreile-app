import "server-only";
import{sql}from"drizzle-orm";
import{withPrivilegedTenantTransaction}from"./privilegedDb";
import type{AuthorizationSnapshot}from"./authorization";
export async function recordIntakeFileBlocked(auth:AuthorizationSnapshot,fileId:string,clientEventId:string,reason:string){
 await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('file-blocked:'||${auth.tenantId}||':'||${clientEventId},0))`);
  const prior=await tx.execute(sql`SELECT id FROM public.audit_log WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid AND action='FILE_BLOCKED' AND client_request_id=${clientEventId}::uuid AND record_id=${fileId}`);
  if(prior.length)return;
  await tx.execute(sql`INSERT INTO public.audit_log(tenant_id,action,table_name,record_id,actor_id,client_request_id,payload)
   VALUES(${auth.tenantId},'FILE_BLOCKED','intake_file',${fileId},${auth.userId}::uuid,${clientEventId}::uuid,${JSON.stringify({fileId,code:'FILE_BLOCKED',reason})}::jsonb)`);
 });
}
