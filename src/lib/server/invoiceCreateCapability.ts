import { sql } from "drizzle-orm";
import { db } from "@/db";

const ROLLOUT_REQUIRED = "Der atomare Rechnungsbeleg mit eindeutiger Mandanten-Rechnungsnummer ist in dieser Datenbank noch nicht vollständig ausgerollt.";

export type InvoiceCreateCapability = { available: boolean; reason: string | null };

const capabilityQuery = sql<{ available: boolean }>`
  select (
    not exists (
      select 1
      from (values
        ('ausgangsrechnung', 'id'),
        ('ausgangsrechnung', 'tenant_id'),
        ('ausgangsrechnung', 'nummer'),
        ('ausgangsrechnung', 'kunde_id'),
        ('ausgangsrechnung', 'order_id'),
        ('ausgangsrechnung_position', 'ausgangsrechnung_id'),
        ('bh_audit_log', 'entitaet_id'),
        ('bh_audit_log', 'benutzer'),
        ('bh_audit_log', 'aktion')
      ) as required(table_name, column_name)
      where not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = required.table_name
          and c.column_name = required.column_name
      )
    )
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'ausgangsrechnung'
        and c.column_name = 'id'
        and c.data_type = 'uuid'
    )
    and not exists (
      select 1
      from (values ('ausgangsrechnung'), ('ausgangsrechnung_position'), ('bh_audit_log')) as required(table_name)
      where not exists (
        select 1
        from pg_class rel
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = required.table_name
          and rel.relrowsecurity
          and rel.relforcerowsecurity
      )
    )
    and not exists (
      select 1 from information_schema.role_table_grants grants
      where grants.table_schema = 'public'
        and grants.table_name in ('ausgangsrechnung', 'ausgangsrechnung_position', 'bh_audit_log')
        and grants.grantee in ('anon', 'authenticated')
    )
    and exists (
      select 1
      from pg_index pi
      join pg_class idx on idx.oid = pi.indexrelid
      join pg_am access_method on access_method.oid = idx.relam
      join pg_class rel on rel.oid = pi.indrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'ausgangsrechnung'
        and idx.relname = 'uq_ausgangsrechnung_tenant_nummer'
        and access_method.amname = 'btree'
        and pi.indisunique
        and pi.indisvalid
        and pi.indisready
        and pi.indnkeyatts = 2
        and pi.indnatts = 2
        and pi.indexprs is null
        and not pi.indnullsnotdistinct
        and not exists (
          select 1
          from unnest(pi.indoption) as option_value
          where option_value <> 0
        )
        and pi.indpred is not null
        and pg_catalog.pg_get_expr(pi.indpred, pi.indrelid)
          = '(is_demo IS DISTINCT FROM true)'
        and (
          select array_agg(attribute.attname::text order by key.ordinality)
          from unnest(pi.indkey) with ordinality as key(attnum, ordinality)
          join pg_catalog.pg_attribute attribute
            on attribute.attrelid = pi.indrelid
           and attribute.attnum = key.attnum
        ) = array['tenant_id', 'nummer']::text[]
    )
  ) as available
`;

export async function readInvoiceCreateCapability(): Promise<InvoiceCreateCapability> {
  try {
    const rows = await db.execute(capabilityQuery);
    const available = rows[0]?.available;
    if (typeof available !== "boolean") return { available: false, reason: ROLLOUT_REQUIRED };
    return { available, reason: available ? null : ROLLOUT_REQUIRED };
  } catch (error) {
    console.error("Invoice create capability check failed", error);
    return { available: false, reason: ROLLOUT_REQUIRED };
  }
}
