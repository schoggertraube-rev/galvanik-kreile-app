import { sql } from "drizzle-orm";
import { db } from "@/db";
import { databaseRuntimeIdentityPredicate } from "@/lib/server/databaseRuntimeIdentity";

type CapabilityRow = { available: boolean };

/**
 * Proves the complete server-only inventory write boundary. A partially applied
 * migration must never make either capture or the direct inventory writer look
 * available.
 */
export const inventoryWriteCapabilityQuery = sql<CapabilityRow>`
  with protected_relations as (
    select rel.oid, rel.relname, rel.relowner, rel.relacl,
      rel.relrowsecurity, rel.relforcerowsecurity
    from pg_class rel
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relkind in ('r', 'p')
      and rel.relname in ('inventory_items', 'stock_movements')
  ),
  required_columns(table_name, column_name, allowed_types, nullable, precision, scale) as (
    values
      ('inventory_items', 'id', ARRAY['text'], false, null::integer, null::integer),
      ('inventory_items', 'tenant_id', ARRAY['text'], false, null::integer, null::integer),
      ('inventory_items', 'name', ARRAY['text'], false, null::integer, null::integer),
      ('inventory_items', 'category', ARRAY['text'], true, null::integer, null::integer),
      ('inventory_items', 'current_stock', ARRAY['numeric'], false, 14, 4),
      ('inventory_items', 'min_stock', ARRAY['numeric'], true, 14, 4),
      ('inventory_items', 'unit', ARRAY['text'], false, null::integer, null::integer),
      ('inventory_items', 'einkaufspreis_eur', ARRAY['numeric'], true, 10, 4),
      ('inventory_items', 'einheit_normiert', ARRAY['text'], true, null::integer, null::integer),
      ('stock_movements', 'id', ARRAY['uuid'], false, null::integer, null::integer),
      ('stock_movements', 'tenant_id', ARRAY['text'], false, null::integer, null::integer),
      ('stock_movements', 'inventory_item_id', ARRAY['text'], false, null::integer, null::integer),
      ('stock_movements', 'movement_type', ARRAY['text'], false, null::integer, null::integer),
      ('stock_movements', 'quantity', ARRAY['numeric'], false, 14, 4),
      ('stock_movements', 'unit', ARRAY['text'], false, null::integer, null::integer),
      ('stock_movements', 'reason', ARRAY['text'], true, null::integer, null::integer),
      ('stock_movements', 'order_id', ARRAY['text'], true, null::integer, null::integer),
      ('stock_movements', 'created_by', ARRAY['uuid'], false, null::integer, null::integer),
      ('stock_movements', 'erfasst_von', ARRAY['uuid'], false, null::integer, null::integer),
      ('stock_movements', 'created_at', ARRAY['timestamp with time zone'], false, null::integer, null::integer),
      ('stock_movements', 'kostenstelle_kuerzel', ARRAY['text'], true, null::integer, null::integer),
      ('stock_movements', 'station_kuerzel', ARRAY['text'], true, null::integer, null::integer),
      ('stock_movements', 'war_aus_vorlage', ARRAY['boolean'], true, null::integer, null::integer),
      ('stock_movements', 'vorlage_id', ARRAY['uuid'], true, null::integer, null::integer),
      ('stock_movements', 'snapshot_einkaufspreis_eur', ARRAY['numeric'], true, 10, 4),
      ('stock_movements', 'client_request_id', ARRAY['uuid'], true, null::integer, null::integer),
      ('orders', 'id', ARRAY['text'], false, null::integer, null::integer),
      ('orders', 'tenant_id', ARRAY['text', 'character varying'], false, null::integer, null::integer),
      ('app_users', 'id', ARRAY['uuid'], false, null::integer, null::integer),
      ('app_users', 'tenant_id', ARRAY['text', 'character varying'], false, null::integer, null::integer)
  ),
  required_checks(table_name, constraint_name, fragments) as (
    values
      ('inventory_items', 'inventory_items_current_stock_nonnegative', ARRAY['CHECK', 'current_stock', '::text', 'NaN', 'Infinity', '>=', '0']),
      ('inventory_items', 'inventory_items_min_stock_valid_chk', ARRAY['CHECK', 'min_stock', 'IS NULL', '::text', 'NaN', 'Infinity', '>=', '0']),
      ('inventory_items', 'inventory_items_purchase_price_valid_chk', ARRAY['CHECK', 'einkaufspreis_eur', 'IS NULL', '::text', 'NaN', 'Infinity', '>=', '0']),
      ('inventory_items', 'inventory_items_tenant_nonblank_chk', ARRAY['CHECK', 'btrim', 'tenant_id', '<>', '''''']),
      ('inventory_items', 'inventory_items_unit_nonblank_chk', ARRAY['CHECK', 'btrim', 'unit', '<>', '''''']),
      ('stock_movements', 'stock_movements_quantity_nonzero', ARRAY['CHECK', 'quantity', '::text', 'NaN', 'Infinity', '<>', '0']),
      ('stock_movements', 'stock_movements_type_chk', ARRAY['CHECK', 'movement_type', 'stock_in', 'stock_out', 'consumption', 'verbrauch', 'correction', 'waste']),
      ('stock_movements', 'stock_movements_quantity_direction_chk', ARRAY['CHECK', 'movement_type', 'stock_in', 'quantity', '>', '0', 'stock_out', 'consumption', 'verbrauch', 'waste', '<', 'correction', '<>']),
      ('stock_movements', 'stock_movements_reason_required_chk', ARRAY['CHECK', 'movement_type', 'correction', 'waste', 'reason', 'IS NOT NULL', 'btrim', '<>', '''''']),
      ('stock_movements', 'stock_movements_template_provenance_chk', ARRAY['CHECK', 'vorlage_id', 'IS NULL', 'war_aus_vorlage', 'IS DISTINCT FROM', 'true', 'IS NOT NULL', 'IS TRUE']),
      ('stock_movements', 'stock_movements_snapshot_price_valid_chk', ARRAY['CHECK', 'snapshot_einkaufspreis_eur', 'IS NULL', '::text', 'NaN', 'Infinity', '>=', '0']),
      ('stock_movements', 'stock_movements_actor_consistency_chk', ARRAY['CHECK', 'created_by', '=', 'erfasst_von']),
      ('stock_movements', 'stock_movements_tenant_nonblank_chk', ARRAY['CHECK', 'btrim', 'tenant_id', '<>', '''''']),
      ('stock_movements', 'stock_movements_unit_nonblank_chk', ARRAY['CHECK', 'btrim', 'unit', '<>', ''''''])
  ),
  required_primary_keys(table_name, columns) as (
    values
      ('inventory_items', ARRAY['id']),
      ('stock_movements', ARRAY['id'])
  ),
  required_unique_indexes(table_name, index_name, columns) as (
    values
      ('inventory_items', 'inventory_items_tenant_id_uidx', ARRAY['tenant_id', 'id']),
      ('orders', 'orders_tenant_id_uidx', ARRAY['tenant_id', 'id']),
      ('app_users', 'app_users_tenant_id_uidx', ARRAY['tenant_id', 'id'])
  ),
  required_indexes(table_name, index_name, columns) as (
    values
      ('stock_movements', 'stock_movements_tenant_inventory_created_id_idx', ARRAY['tenant_id', 'inventory_item_id', 'created_at', 'id']),
      ('stock_movements', 'stock_movements_tenant_request_idx', ARRAY['tenant_id', 'client_request_id']),
      ('stock_movements', 'stock_movements_tenant_order_created_idx', ARRAY['tenant_id', 'order_id', 'created_at'])
  ),
  required_foreign_keys(constraint_name, source_table, target_table, source_columns, target_columns) as (
    values
      ('stock_movements_tenant_inventory_fk', 'stock_movements', 'inventory_items', ARRAY['tenant_id', 'inventory_item_id'], ARRAY['tenant_id', 'id']),
      ('stock_movements_tenant_order_fk', 'stock_movements', 'orders', ARRAY['tenant_id', 'order_id'], ARRAY['tenant_id', 'id']),
      ('stock_movements_tenant_created_by_fk', 'stock_movements', 'app_users', ARRAY['tenant_id', 'created_by'], ARRAY['tenant_id', 'id']),
      ('stock_movements_tenant_erfasst_von_fk', 'stock_movements', 'app_users', ARRAY['tenant_id', 'erfasst_von'], ARRAY['tenant_id', 'id'])
  )
  select (
    (select count(*) from protected_relations) = 2
    and ${databaseRuntimeIdentityPredicate}
    and not exists (
      select 1
      from required_columns required
      where not exists (
        select 1
        from information_schema.columns col
        where col.table_schema = 'public'
          and col.table_name = required.table_name
          and col.column_name = required.column_name
          and col.data_type = any(required.allowed_types)
          and (col.is_nullable = 'YES') = required.nullable
          and (required.precision is null or col.numeric_precision = required.precision)
          and (required.scale is null or col.numeric_scale = required.scale)
      )
    )
    and exists (
      select 1
      from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = 'stock_movements'
        and col.column_name = 'id'
        and col.column_default like '%gen_random_uuid()%'
    )
    and exists (
      select 1
      from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = 'stock_movements'
        and col.column_name = 'created_at'
        and col.column_default like '%now()%'
    )
    and not exists (
      select 1
      from required_checks required
      where not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = required.table_name
          and con.conname = required.constraint_name
          and con.contype = 'c'
          and con.convalidated
          and not exists (
            select 1
            from unnest(required.fragments) fragment
            where pg_get_constraintdef(con.oid) not ilike ('%' || fragment || '%')
          )
      )
    )
    and not exists (
      select 1
      from required_primary_keys required
      where not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = required.table_name
          and con.contype = 'p'
          and con.convalidated
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(con.conkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key.attnum
          ) = required.columns
      )
    )
    and not exists (
      select 1
      from required_unique_indexes required
      where not exists (
        select 1
        from pg_index idx
        join pg_class rel on rel.oid = idx.indrelid
        join pg_class index_rel on index_rel.oid = idx.indexrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = required.table_name
          and index_rel.relname = required.index_name
          and idx.indisunique
          and idx.indisvalid
          and idx.indisready
          and idx.indpred is null
          and idx.indexprs is null
          and idx.indnkeyatts = cardinality(required.columns)
          and idx.indnatts = cardinality(required.columns)
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(idx.indkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = idx.indrelid and att.attnum = key.attnum
          ) = required.columns
      )
    )
    and not exists (
      select 1
      from required_foreign_keys required
      where not exists (
        select 1
        from pg_constraint con
        join pg_class source_rel on source_rel.oid = con.conrelid
        join pg_namespace source_ns on source_ns.oid = source_rel.relnamespace
        join pg_class target_rel on target_rel.oid = con.confrelid
        join pg_namespace target_ns on target_ns.oid = target_rel.relnamespace
        where source_ns.nspname = 'public'
          and target_ns.nspname = 'public'
          and source_rel.relname = required.source_table
          and target_rel.relname = required.target_table
          and con.conname = required.constraint_name
          and con.contype = 'f'
          and con.convalidated
          and not con.condeferrable
          and con.confdeltype = 'r'
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(con.conkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key.attnum
          ) = required.source_columns
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(con.confkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = con.confrelid and att.attnum = key.attnum
          ) = required.target_columns
      )
    )
    and not exists (
      select 1
      from required_indexes required
      where not exists (
        select 1
        from pg_index idx
        join pg_class rel on rel.oid = idx.indrelid
        join pg_class index_rel on index_rel.oid = idx.indexrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = required.table_name
          and index_rel.relname = required.index_name
          and not idx.indisunique
          and idx.indisvalid
          and idx.indisready
          and idx.indpred is null
          and idx.indexprs is null
          and idx.indnkeyatts = cardinality(required.columns)
          and idx.indnatts = cardinality(required.columns)
          and (
            select array_agg(att.attname::text order by key.ordinality)
            from unnest(idx.indkey) with ordinality as key(attnum, ordinality)
            join pg_attribute att on att.attrelid = idx.indrelid and att.attnum = key.attnum
          ) = required.columns
      )
    )
    and not exists (
      select 1 from protected_relations
      where not relrowsecurity or not relforcerowsecurity
    )
    and not exists (
      select 1 from pg_policy policy
      join protected_relations protected on protected.oid = policy.polrelid
    )
    and not exists (
      select 1
      from protected_relations protected
      cross join lateral aclexplode(coalesce(protected.relacl, acldefault('r', protected.relowner))) acl
      where acl.grantee = 0
        and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    )
    and not exists (
      select 1
      from protected_relations protected
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      cross join lateral aclexplode(att.attacl) acl
      where acl.grantee = 0
        and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
    )
    and not exists (
      select 1
      from pg_roles role
      cross join protected_relations protected
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privilege(name)
      where role.rolname in ('anon', 'authenticated')
        and has_table_privilege(role.oid, protected.oid, privilege.name)
    )
    and not exists (
      select 1
      from pg_roles role
      cross join protected_relations protected
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) privilege(name)
      where role.rolname in ('anon', 'authenticated')
        and has_any_column_privilege(role.oid, protected.oid, privilege.name)
    )
    and exists (
      select 1 from pg_roles
      where rolname = 'service_role' and rolbypassrls and not rolsuper
    )
    and current_user = 'service_role'
    and exists (
      select 1 from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      where protected.relname = 'inventory_items'
        and has_table_privilege(role.oid, protected.oid, 'SELECT')
        and has_column_privilege(role.oid, protected.oid, 'current_stock', 'UPDATE')
        and not has_table_privilege(role.oid, protected.oid, 'INSERT')
        and not has_table_privilege(role.oid, protected.oid, 'UPDATE')
        and not has_table_privilege(role.oid, protected.oid, 'DELETE')
        and not has_table_privilege(role.oid, protected.oid, 'TRUNCATE')
        and not has_table_privilege(role.oid, protected.oid, 'REFERENCES')
        and not has_table_privilege(role.oid, protected.oid, 'TRIGGER')
    )
    and not exists (
      select 1
      from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      cross join (values ('INSERT'), ('REFERENCES')) privilege(name)
      where protected.relname = 'inventory_items'
        and has_column_privilege(role.oid, protected.oid, att.attnum, privilege.name)
    )
    and not exists (
      select 1
      from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where protected.relname = 'stock_movements'
        and has_column_privilege(role.oid, protected.oid, att.attnum, 'UPDATE')
    )
    and not exists (
      select 1
      from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where protected.relname = 'stock_movements'
        and has_column_privilege(role.oid, protected.oid, att.attnum, 'REFERENCES')
    )
    and not exists (
      select 1
      from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      join pg_attribute att on att.attrelid = protected.oid and att.attnum > 0 and not att.attisdropped
      where protected.relname = 'inventory_items'
        and att.attname <> 'current_stock'
        and has_column_privilege(role.oid, protected.oid, att.attnum, 'UPDATE')
    )
    and exists (
      select 1 from protected_relations protected
      join pg_roles role on role.rolname = 'service_role'
      where protected.relname = 'stock_movements'
        and has_table_privilege(role.oid, protected.oid, 'SELECT')
        and has_table_privilege(role.oid, protected.oid, 'INSERT')
        and not has_table_privilege(role.oid, protected.oid, 'UPDATE')
        and not has_table_privilege(role.oid, protected.oid, 'DELETE')
        and not has_table_privilege(role.oid, protected.oid, 'TRUNCATE')
        and not has_table_privilege(role.oid, protected.oid, 'REFERENCES')
        and not has_table_privilege(role.oid, protected.oid, 'TRIGGER')
    )
  ) as available
`;

export function inventoryWriteCapabilityAvailable(row: Record<string, unknown> | undefined): boolean {
  if (!row || typeof row.available !== "boolean") {
    throw new Error("INVENTORY_WRITE_CAPABILITY_UNAVAILABLE");
  }
  return row.available;
}

export async function readInventoryWriteCapability(): Promise<boolean> {
  try {
    const rows = await db.execute(inventoryWriteCapabilityQuery);
    return inventoryWriteCapabilityAvailable(rows[0]);
  } catch (error) {
    console.error("Inventory write capability preflight failed", error);
    return false;
  }
}
