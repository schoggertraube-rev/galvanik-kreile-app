import "server-only";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, type AuthorizationSnapshot } from "@/lib/server/authorization";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

/** A continuation never grants broader access than either original source. */
export async function mayUseContinuationSources(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string):Promise<boolean>{
 const rows=await tx.execute<{channel:string;actor:string;source_channel:string|null;source_actor:string|null;has_parent:boolean}>(sql`
  WITH RECURSIVE chain AS (
    SELECT id,tenant_id,fortsetzung_von,kanal,erstellt_von FROM public.intake_item
      WHERE tenant_id=${auth.tenantId} AND id=${itemId}::uuid
    UNION ALL
    SELECT parent.id,parent.tenant_id,parent.fortsetzung_von,parent.kanal,parent.erstellt_von
      FROM public.intake_item parent JOIN chain child ON parent.tenant_id=child.tenant_id AND parent.id=child.fortsetzung_von
  )
  SELECT chain.kanal AS channel,chain.erstellt_von::text AS actor,chain.fortsetzung_von IS NOT NULL AS has_parent,
    source.kanal AS source_channel,source.erstellt_von::text AS source_actor
  FROM chain
  LEFT JOIN LATERAL (SELECT created.nachher->>'textSourceId' AS id FROM public.intake_event created
    WHERE created.tenant_id=chain.tenant_id AND created.item_id=chain.id AND created.art='angelegt'
    ORDER BY created.zeit,created.id LIMIT 1) original ON chain.fortsetzung_von IS NOT NULL
  LEFT JOIN public.intake_item source ON source.tenant_id=chain.tenant_id AND source.id::text=original.id`);
 if(!rows.length)return false;
 const hasMailAccess=hasAuthorizationArea(auth,"mails");
 return rows.every(row=>(!row.has_parent||row.source_actor!==null)
   &&(hasMailAccess||row.channel!=="mail"&&row.actor===auth.userId
     &&(!row.has_parent||row.source_channel!=="mail"&&row.source_actor===auth.userId)));
}
