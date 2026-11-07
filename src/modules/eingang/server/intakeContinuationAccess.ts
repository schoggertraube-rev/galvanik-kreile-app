import "server-only";
import { sql } from "drizzle-orm";
import { hasAuthorizationArea, type AuthorizationSnapshot } from "@/lib/server/authorization";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

/** A continuation never grants broader access than either original source. */
export async function mayUseContinuationSources(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,itemId:string):Promise<boolean>{
 const rows=await tx.execute<{parent_channel:string;parent_actor:string;text_channel:string;text_actor:string}>(sql`
  SELECT parent.kanal AS parent_channel,parent.erstellt_von::text AS parent_actor,
    text_source.kanal AS text_channel,text_source.erstellt_von::text AS text_actor
  FROM public.intake_item child
  JOIN public.intake_item parent ON parent.tenant_id=child.tenant_id AND parent.id=child.fortsetzung_von
  JOIN public.intake_event created ON created.tenant_id=child.tenant_id AND created.item_id=child.id AND created.art='angelegt'
  JOIN public.intake_item text_source ON text_source.tenant_id=child.tenant_id AND text_source.id::text=created.nachher->>'textSourceId'
  WHERE child.tenant_id=${auth.tenantId} AND child.id=${itemId}::uuid ORDER BY created.zeit,created.id LIMIT 1`);
 const row=rows[0];if(!row)return false;
 return hasAuthorizationArea(auth,"mails") || row.parent_channel!=="mail" && row.text_channel!=="mail"
  && row.parent_actor===auth.userId && row.text_actor===auth.userId;
}
