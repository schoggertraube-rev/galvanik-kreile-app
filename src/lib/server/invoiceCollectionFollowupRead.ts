import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import type {PrivilegedTenantTransaction} from './privilegedDb';

export const COLLECTION_PENDING_EVENT='ORDER_COLLECTION_ATTACH_PENDING_V1';
export const COLLECTION_REPAIRED_EVENT='ORDER_COLLECTION_ATTACH_REPAIRED_V1';
export type CollectionFollowupReceipt={eventId:string;goodsOutEventId:string;orderId:string;customerId:string;actorId:string;clientEventId:string;correlationId:string;expectedVersion:number;orderVersion:number;freezeId:string;agreementId:string;agreementVersion:number;targetDays:number;month:string;occurredAt:string};
export const collectionFollowupDigest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
/** One immutable source, shared by physical retry and the existing task reader. */
export async function readCollectionFollowup(tx:PrivilegedTenantTransaction,tenantId:string,input:{markerId:string}|{goodsOutEventId:string}){
 const rows=await tx.execute<{payload:{receipt:CollectionFollowupReceipt;receiptSha256:string};valid:boolean;repairs:number;repairsValid:boolean}>(sql`SELECT marker.payload,
  private.collection_followup_source_valid(marker,physical) AS valid,
  (SELECT count(*)::integer FROM public.events repair WHERE repair.tenant_id=marker.tenant_id AND repair.event_type=${COLLECTION_REPAIRED_EVENT} AND repair.payload->>'markerId'=marker.id) AS repairs,
  NOT EXISTS(SELECT 1 FROM public.events repair WHERE repair.tenant_id=marker.tenant_id AND repair.event_type=${COLLECTION_REPAIRED_EVENT} AND repair.payload->>'markerId'=marker.id AND NOT private.collection_followup_repair_valid(repair,false)) AS "repairsValid"
  FROM public.events marker LEFT JOIN public.events physical ON physical.tenant_id=marker.tenant_id AND physical.id=marker.payload#>>'{receipt,goodsOutEventId}'
  WHERE marker.tenant_id=${tenantId} AND marker.event_type=${COLLECTION_PENDING_EVENT}
   AND ${'markerId'in input?sql`marker.id=${input.markerId}`:sql`marker.payload#>>'{receipt,goodsOutEventId}'=${input.goodsOutEventId}`}`);
 if(!rows.length)return null;
 const row=rows[0];
 if(rows.length!==1||row.valid!==true||row.repairsValid!==true||![0,1].includes(row.repairs)||!row.payload?.receipt||collectionFollowupDigest(row.payload.receipt)!==row.payload.receiptSha256)throw Error('COLLECTION_FOLLOWUP_SOURCE_INVALID');
 return {...row.payload.receipt,pending:row.repairs===0};
}
