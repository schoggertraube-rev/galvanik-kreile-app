import 'server-only';
import {sql} from 'drizzle-orm';
import type {AuthorizationSnapshot} from './authorization';
import type {PrivilegedTenantTransaction} from './privilegedDb';

/** PL05:02: existing DB setting only, never a browser/localStorage override. */
export async function readOffline24hFlag(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot):Promise<boolean>{
 if(!auth.active)return false;
 const rows=await tx.execute<{enabled:boolean|null;roles_allowed:string[]|null}>(sql`SELECT enabled,roles_allowed FROM public.feature_flags WHERE id='offline_24h'`);
 if(rows.length!==1||rows[0].enabled!==true||!Array.isArray(rows[0].roles_allowed))return false;
 return rows[0].roles_allowed.length===0||rows[0].roles_allowed.includes(auth.role);
}
