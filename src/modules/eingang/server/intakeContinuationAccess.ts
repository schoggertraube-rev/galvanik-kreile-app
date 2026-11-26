import "server-only";
import { sql } from "drizzle-orm";
import {hasAuthorizationArea} from "@/lib/auth/authorizationContract";
import {type AuthorizationSnapshot,type AuthorizedReadContext} from "@/lib/server/authorization";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {qualifySavedMailReplyBinding,type SavedMailReplyBinding} from "@/lib/server/dispatchResponsePort";

export async function readIntakeAssignmentAuthority(
 tx:PrivilegedTenantTransaction,tenantId:string,row:{id:string;kunde_id:string|null;zuordnung:string;version:number},
) {
 if(!row.kunde_id)return false;
 if(row.zuordnung==='bestaetigt'||row.zuordnung==='hand')return true;
 if(row.zuordnung!=='automatisch')return false;
 const rows=await tx.execute<{action:{customerId:string;zuordnung:string;version:number;mailThreadBinding:SavedMailReplyBinding}}>(sql`
  SELECT nachher AS action FROM public.intake_event WHERE tenant_id=${tenantId} AND item_id=${row.id}::uuid
   AND art='zugeordnet' AND nachher ? 'mailThreadBinding' LIMIT 2`);
 const action=rows[0]?.action,binding=action?.mailThreadBinding;
 return rows.length===1&&!!action&&action.zuordnung===row.zuordnung&&action.customerId===row.kunde_id
  &&Number.isSafeInteger(action.version)&&action.version<=row.version
  &&binding?.proof?.itemId===row.id&&binding?.target?.customerId===row.kunde_id
  &&await qualifySavedMailReplyBinding(tx,tenantId,binding);
}

export function readIntakeSourceRelations(tx:PrivilegedTenantTransaction,tenantId:string,itemIds:readonly string[]){
 return tx.execute<{id:string;channel:string;actor:string;source_id:string|null;source_channel:string|null;source_actor:string|null;has_parent:boolean}>(sql`
  WITH RECURSIVE chain AS (
    SELECT id,tenant_id,fortsetzung_von,kanal,erstellt_von FROM public.intake_item
      WHERE tenant_id=${tenantId} AND id=ANY(ARRAY[${sql.join(itemIds.map(id=>sql`${id}`),sql`, `)}]::uuid[])
    UNION
    SELECT parent.id,parent.tenant_id,parent.fortsetzung_von,parent.kanal,parent.erstellt_von
      FROM public.intake_item parent JOIN chain child ON parent.tenant_id=child.tenant_id AND parent.id=child.fortsetzung_von
  )
  SELECT chain.id::text,chain.kanal AS channel,chain.erstellt_von::text AS actor,chain.fortsetzung_von IS NOT NULL AS has_parent,
    source.id::text AS source_id,source.kanal AS source_channel,source.erstellt_von::text AS source_actor
  FROM chain
  LEFT JOIN LATERAL (SELECT created.nachher->>'textSourceId' AS id FROM public.intake_event created
    WHERE created.tenant_id=chain.tenant_id AND created.item_id=chain.id AND created.art='angelegt'
    ORDER BY created.zeit,created.id LIMIT 1) original ON chain.fortsetzung_von IS NOT NULL
  LEFT JOIN public.intake_item source ON source.tenant_id=chain.tenant_id AND source.id::text=original.id`);
}

/** A continuation never grants broader access than either original source. */
export async function mayUseContinuationSources(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot|AuthorizedReadContext,itemId:string):Promise<boolean>{
 const rows=await readIntakeSourceRelations(tx,auth.tenantId,[itemId]);
 if(!rows.length)return false;
 const hasMailAccess='canReadArea'in auth?auth.canReadArea('mails'):hasAuthorizationArea(auth,"mails");
 const actorId='canReadArea'in auth?null:auth.userId;
 return rows.every(row=>(!row.has_parent||row.source_actor!==null)
   &&(hasMailAccess||actorId!==null&&row.channel!=="mail"&&row.actor===actorId
     &&(!row.has_parent||row.source_channel!=="mail"&&row.source_actor===actorId)));
}
