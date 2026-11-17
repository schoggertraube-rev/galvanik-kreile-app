import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {PACKAGE_SWITCH_COPY} from '@/ui/packageSwitchCopy';
import {PACKAGE_SWITCHES,mapPackageSwitchRows,validatePackageSwitchRow,type PackageSwitchId,type PackageSwitchRow} from '../featureCatalog';

export type PackageSwitchContext={tenantId:string;actorId:string;canManage:boolean};
type FlagRow=PackageSwitchRow;
type Failure={code:'FORBIDDEN'|'VALIDATION_ERROR'|'CONFLICT'|'UNAVAILABLE';message:string};
const ids=new Set<string>(PACKAGE_SWITCHES.map(({id})=>id));
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
async function rows(tx:PrivilegedTenantTransaction):Promise<FlagRow[]>{
 const found=await tx.execute<FlagRow>(sql`SELECT id,enabled,roles_allowed AS roles FROM public.feature_flags
  WHERE id IN (${sql.join(PACKAGE_SWITCHES.map(({id})=>sql`${id}`),sql`,`)}) ORDER BY id`);
 return [...found];
}
export async function readPackageSwitches(context:PackageSwitchContext){
 if(!context.canManage)return {code:'FORBIDDEN' as const,message:PACKAGE_SWITCH_COPY.permission};
 try{return {code:'OK' as const,switches:await withPrivilegedTenantTransaction(context,async tx=>mapPackageSwitchRows(await rows(tx)))};}
 catch(error){console.error('[PACKAGE_SWITCH_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:PACKAGE_SWITCH_COPY.readUnavailable};}
}
/** One N5 intent, row lock and mandatory original audit in the same transaction. */
export async function setPackageSwitch(context:PackageSwitchContext,input:unknown):Promise<Failure|{code:'OK';switch:{id:PackageSwitchId;enabled:boolean};replayed:boolean}>{
 if(!context.canManage)return {code:'FORBIDDEN',message:PACKAGE_SWITCH_COPY.permission};
 if(!record(input)||Object.keys(input).sort().join(',')!=='clientKey,enabled,id'||!uuid(input.clientKey)||typeof input.id!=='string'||!ids.has(input.id)||typeof input.enabled!=='boolean')return {code:'VALIDATION_ERROR',message:PACKAGE_SWITCH_COPY.invalid};
 const value={clientKey:input.clientKey.toLowerCase(),id:input.id as PackageSwitchId,enabled:input.enabled};
 const intent=createHash('sha256').update(JSON.stringify([value.id,value.enabled])).digest('hex');
 try{return await withPrivilegedTenantTransaction(context,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('package-switch:'||${context.tenantId}||':'||${value.clientKey},0))`);
  const prior=await tx.execute<{payload:unknown}>(sql`SELECT payload FROM public.ui_events WHERE tenant_id=${context.tenantId}
   AND event_type='package_switch_updated' AND payload->>'clientKey'=${value.clientKey}`);
  if(prior.length){
   if(prior.length!==1||!record(prior[0].payload))throw Error('PACKAGE_SWITCH_RECEIPT_INVALID');
   const receipt=prior[0].payload;
   if(receipt.actorId!==context.actorId||receipt.intent!==intent)return {code:'CONFLICT' as const,message:PACKAGE_SWITCH_COPY.conflict};
   if(!record(receipt.after)||receipt.after.id!==value.id||receipt.after.enabled!==value.enabled||receipt.source!=='settings')throw Error('PACKAGE_SWITCH_RECEIPT_INVALID');
   return {code:'OK' as const,switch:{id:value.id,enabled:value.enabled},replayed:true};
  }
  const before=await tx.execute<FlagRow>(sql`SELECT id,enabled,roles_allowed AS roles FROM public.feature_flags WHERE id=${value.id} FOR UPDATE`);
  if(before.length!==1)throw Error('PACKAGE_SWITCH_SOURCE_MISSING');validatePackageSwitchRow(before[0]);
  const updated=await tx.execute<{id:string;enabled:boolean}>(sql`UPDATE public.feature_flags SET enabled=${value.enabled},updated_at=statement_timestamp() WHERE id=${value.id} RETURNING id,enabled`);
  if(updated.length!==1||updated[0].id!==value.id||updated[0].enabled!==value.enabled)throw Error('PACKAGE_SWITCH_WRITE_RECEIPT_MISSING');
  const after={id:value.id,enabled:value.enabled};
  const audit=await tx.execute(sql`INSERT INTO public.ui_events(tenant_id,event_type,payload) VALUES(${context.tenantId},'package_switch_updated',
   ${JSON.stringify({actorId:context.actorId,clientKey:value.clientKey,intent,source:'settings',before:{id:before[0].id,enabled:before[0].enabled},after})}::jsonb) RETURNING id`);
  if(audit.length!==1)throw Error('PACKAGE_SWITCH_AUDIT_MISSING');
  return {code:'OK' as const,switch:after,replayed:false};
 });}catch(error){console.error('[PACKAGE_SWITCH_WRITE_FAILED]',error);return {code:'UNAVAILABLE',message:PACKAGE_SWITCH_COPY.unavailable};}
}
