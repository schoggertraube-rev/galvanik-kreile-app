import 'server-only';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {parseProtocolSettings} from '../protocolSettings';

/** Internal settings source. Authorization of the view belongs to readLog. */
export async function readLoggingSettings(context:{tenantId:string}) {
 return withPrivilegedTenantTransaction(context,async tx=>{
  const rows=await tx.execute<{retentionDays:number|null;slowMs:number;hangMs:number;enabled:boolean|null}>(sql`
   SELECT protokoll_aufbewahrung_tage AS "retentionDays",protokoll_langsam_ms AS "slowMs",
    protokoll_haenger_ms AS "hangMs",(SELECT enabled FROM public.feature_flags WHERE id='logging') AS enabled
   FROM public.company_settings WHERE tenant_id=${context.tenantId} ORDER BY id LIMIT 2`);
  if(rows.length!==1)return null;
  const row=rows[0];
  const settings=parseProtocolSettings({retentionDays:row.retentionDays,slowMs:row.slowMs,hangMs:row.hangMs});
  if(!settings||typeof row.enabled!=='boolean')return null;
  return {...settings,enabled:row.enabled};
 });
}
