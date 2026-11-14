import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,withTenantSavepoint,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';
import type {CustomerCreditResult,CustomerCreditPayoutReceipt} from './customerCreditContract';
type CustomerSource=(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<{id:string}|null>;

/** The one balance reader. An absent customer is not an invented zero balance. */
export async function readCustomerCreditInTransaction(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string,readCustomer:CustomerSource):Promise<CustomerCreditResult>{
 const customer=await readCustomer(tx,tenantId,customerId);
 if(!customer)return {code:'NOT_FOUND',message:CUSTOMER_CREDIT_COPY.notFound};
 const rows=await tx.execute<{balance_cents:string;entry_count:string}>(sql`
  SELECT coalesce(sum(entry.amount_cents),0)::text AS balance_cents,
    count(entry.id)::text AS entry_count
  FROM public.customer_credit_entries entry
  WHERE entry.tenant_id=${tenantId} AND entry.customer_id=${customerId}
 `);
 const row=rows[0];
 if(rows.length!==1||!row||!/^\d+$/.test(row.balance_cents)||!/^\d+$/.test(row.entry_count))throw Error('CUSTOMER_CREDIT_SOURCE_INVALID');
 const balanceCents=Number(row.balance_cents),version=Number(row.entry_count);
 if(!Number.isSafeInteger(balanceCents)||!Number.isSafeInteger(version))throw Error('CUSTOMER_CREDIT_SOURCE_RANGE_INVALID');
 return {code:'OK',credit:{customerId,balanceCents,version}};
}

export async function readCustomerCredit(authorization:AuthorizationSnapshot,customerId:unknown,readCustomer:CustomerSource,readPayouts?:(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<CustomerCreditPayoutReceipt[]>):Promise<CustomerCreditResult>{
 if(!hasAuthorizationArea(authorization,'geld'))return {code:'FORBIDDEN',message:CUSTOMER_CREDIT_COPY.forbidden};
 if(typeof customerId!=='string'||customerId.length<1||customerId.length>128||customerId.trim()!==customerId)return {code:'VALIDATION_ERROR',message:CUSTOMER_CREDIT_COPY.invalid};
 try{return await withPrivilegedTenantTransaction(authorization,async tx=>{
  const source=await readCustomerCreditInTransaction(tx,authorization.tenantId,customerId,readCustomer);
  if(source.code!=='OK'||!readPayouts)return source;
  try{
   const entries=await withTenantSavepoint(tx,async nested=>{
    return readPayouts(nested,authorization.tenantId,customerId);
   });
   return {...source,payoutHistory:{code:'OK' as const,entries}};
  }catch{return {...source,payoutHistory:{code:'SOURCE_INCOMPLETE' as const}};}
 });}
 catch{return {code:'UNAVAILABLE',message:CUSTOMER_CREDIT_COPY.unavailable};}
}
