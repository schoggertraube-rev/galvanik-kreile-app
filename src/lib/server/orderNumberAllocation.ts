import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';

/** PL15Nov15:38 / K13K-9: the existing global UNIQUE/lock/MAX contract.
 * Both writers reserve and insert inside their current transaction. This is
 * neither a tenant-local sequence nor a second number source. */
export async function allocateOrderNumber(tx:PrivilegedTenantTransaction,invalidSource:'ORDER_INTAKE_NUMBER_INVALID'|'REWORK_ORDER_NUMBER_INVALID'):Promise<string>{
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('f1:order-number', 0))`);
 const rows=await tx.execute<{current_year:number|string;next_number:number|string}>(sql`
   WITH current_clock AS (
     SELECT extract(year FROM statement_timestamp() AT TIME ZONE 'Europe/Berlin')::int AS current_year
   )
   SELECT
     clock.current_year,
     coalesce(max(substring(orders.order_number FROM '[0-9]+$')::int), 0) + 1 AS next_number
   FROM current_clock clock
   LEFT JOIN public.orders orders
     ON orders.order_number ~ ('^A-' || clock.current_year::text || '-[0-9]{4,}$')
   GROUP BY clock.current_year
 `);
 const year=Number(rows[0]?.current_year),next=Number(rows[0]?.next_number);
 if(rows.length!==1||!Number.isSafeInteger(year)||year<2000||year>9999||!Number.isSafeInteger(next)||next<1)throw Error(invalidSource);
 return `A-${year}-${String(next).padStart(4,'0')}`;
}
