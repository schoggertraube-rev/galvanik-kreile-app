import "server-only";

// Read ports deliberately stay separate at the module boundary. Their query
// implementation shares the validated row decoder with the command boundary;
// callers still consume only server-public.ts.
export { listOpenQuotesCommand, readQuoteCommand } from "./quoteCommands";

import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readCaseActorTraces} from '@/lib/server/quoteJournalPort';
import type {QuoteCommandContext} from './types';
export async function readQuoteActors(auth:QuoteCommandContext,input:{quoteId:string;version:number}){
 if(!auth.capabilities.canReadQuote)return {code:'FORBIDDEN' as const,message:'KV-Akteure sind nicht freigegeben.'};
 if(typeof input?.quoteId!=='string'||!Number.isSafeInteger(input.version)||input.version<1)return {code:'VALIDATION_ERROR' as const,message:'KV-Kennung oder Stand fehlt.'};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const [quote]=await tx.execute<{version:number}>(sql`SELECT version FROM private.quotes WHERE tenant_id=${auth.tenantId} AND id::text=${input.quoteId}`);
  if(!quote)return {code:'NOT_FOUND' as const,message:'KV ist nicht vorhanden.'};
  if(quote.version!==input.version)return {code:'CONFLICT' as const,message:'KV wurde inzwischen geändert. Neu lesen.'};
  const trace=(await readCaseActorTraces(tx,auth,[{kind:'quote',id:input.quoteId,version:input.version}])).get('quote:'+input.quoteId)!;
  return {code:'OK' as const,trace};
 });}catch(error){console.error('[QUOTE_ACTORS_READ_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'KV-Akteure konnten nicht sicher gelesen werden.'};}
}

import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PackageCustomerHistory} from '@/lib/server/packageIntakeContextPort';
/** Price-free history owned by quotes; closed quotes are included, never inferred into an assignment. */
export async function readPackageQuoteHistory(auth:AuthorizationSnapshot,text:string):Promise<PackageCustomerHistory[]>{
 const {hasAuthorizationArea}=await import('@/lib/server/authorization');
 const {packagePartWords}=await import('@/lib/domain/packagePartWords');
 if(!['eingang','kunden','auftraege'].every(area=>hasAuthorizationArea(auth,area as 'eingang'|'kunden'|'auftraege')))return [];
 const words=packagePartWords(text);if(!words.length)return [];
 return withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{customerId:string;customerName:string;lastAt:string;integrity:boolean}>(sql`SELECT quote.customer_id AS "customerId",quote.customer_display_name AS "customerName",max(quote.created_at)::text AS "lastAt",bool_and(quote.integrity_ok) AS integrity
  FROM private.v_quotes_v1 quote WHERE quote.tenant_id=${auth.tenantId} AND EXISTS(SELECT 1 FROM jsonb_array_elements(quote.positions) position WHERE regexp_split_to_array(lower(position->>'name'),'[^[:alnum:]]+') && ARRAY[${sql.join(words.map(word=>sql`${word}`),sql`, `)}]::text[])
  GROUP BY quote.customer_id,quote.customer_display_name ORDER BY max(quote.created_at) DESC,quote.customer_id LIMIT 3`);
  if(rows.some(row=>row.integrity!==true))throw Error('PACKAGE_QUOTE_HISTORY_INTEGRITY_INVALID');
  return rows.map(row=>({customerId:row.customerId,customerName:row.customerName,lastAt:row.lastAt,source:'quote' as const}));
 });
}
