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
