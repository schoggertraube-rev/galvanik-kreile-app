import { sql } from "drizzle-orm";
import { db } from "@/db";
import { databaseRuntimeIdentityPredicate } from "@/lib/server/databaseRuntimeIdentity";

type CapabilityRow = { available: boolean };

/**
 * Proves the exact PostgreSQL privileges needed by authorization, customer,
 * order and item flows. The runtime uses `SET ROLE service_role`, so a green
 * schema-only check without this ACL proof would be a false capability.
 */
export const operationalCoreCapabilityQuery = sql<CapabilityRow>`
  with protected_relations as (
    select relation.oid, relation.relname, relation.relowner, relation.relacl,
      relation.relrowsecurity, relation.relforcerowsecurity
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relname in ('app_users', 'orders', 'items', 'customers')
  ),
  allowed_column_privileges(table_name, privilege_name, columns) as (
    values
      ('app_users', 'INSERT', ARRAY['id','tenant_id','email','full_name','role','location','language','pin_hash','active']),
      ('app_users', 'UPDATE', ARRAY['role','pin_hash','active']),
      ('orders', 'INSERT', ARRAY['id','tenant_id','order_number','customer_id','title','task','station','current_station_id','status','risk','priority','priority_computed','due_date','promised_due_date','source','source_ref','freetext_original','is_quote','quote_status']),
      ('orders', 'UPDATE', ARRAY['priority_computed','title','task','due_date','promised_due_date','current_station_id','station','status','completed_date']),
      ('items', 'INSERT', ARRAY['id','tenant_id','order_id','customer_id','name','quantity','current_station_id','material','surface_requested','photo_ids','station_sequence','current_step']),
      ('items', 'UPDATE', ARRAY['current_station_id','current_step']),
      ('customers', 'INSERT', ARRAY['id','tenant_id','customer_number','name','company_name','type','address','street','city','zip_code','country','image_urls','contact_person','email','phone','notes','behavior_notes','source','source_ref','is_lead']),
      ('customers', 'UPDATE', ARRAY['name','company_name','type','address','street','city','zip_code','country','contact_person','email','phone','notes','image_urls','trust_level','internal_warning','tags','credit_rating','behavior_notes','shipping_preference','payment_preference','classification','internal_notes','updated_at'])
  )
  select (
    (select count(*) from protected_relations) = 4
    and ${databaseRuntimeIdentityPredicate}
    and current_user = 'service_role'
    and exists (
      select 1 from pg_roles
      where rolname = 'service_role' and rolbypassrls and not rolsuper
    )
    and has_schema_privilege('service_role', 'public', 'USAGE')
    and not has_schema_privilege('service_role', 'public', 'CREATE')
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
      join pg_attribute attribute on attribute.attrelid = protected.oid
        and attribute.attnum > 0 and not attribute.attisdropped
      cross join lateral aclexplode(attribute.attacl) acl
      where acl.grantee = 0
        and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
    )
    and not exists (
      select 1
      from pg_roles role
      cross join protected_relations protected
      cross join (values
        ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
        ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
      ) privilege(name)
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
    and not exists (
      select 1
      from protected_relations protected
      where not has_table_privilege('service_role', protected.oid, 'SELECT')
        or has_table_privilege('service_role', protected.oid, 'INSERT')
        or has_table_privilege('service_role', protected.oid, 'UPDATE')
        or has_table_privilege('service_role', protected.oid, 'DELETE')
        or has_table_privilege('service_role', protected.oid, 'TRUNCATE')
        or has_table_privilege('service_role', protected.oid, 'REFERENCES')
        or has_table_privilege('service_role', protected.oid, 'TRIGGER')
        or has_any_column_privilege('service_role', protected.oid, 'REFERENCES')
    )
    and not exists (
      select 1
      from allowed_column_privileges allowed
      cross join lateral unnest(allowed.columns) column_name
      where not has_column_privilege(
        'service_role', format('public.%I', allowed.table_name),
        column_name, allowed.privilege_name
      )
    )
    and not exists (
      select 1
      from allowed_column_privileges allowed
      join protected_relations protected on protected.relname = allowed.table_name
      join pg_attribute attribute on attribute.attrelid = protected.oid
        and attribute.attnum > 0 and not attribute.attisdropped
      where attribute.attname <> all(allowed.columns)
        and has_column_privilege(
          'service_role', protected.oid, attribute.attnum, allowed.privilege_name
        )
    )
  ) as available
`;

export function operationalCoreCapabilityAvailable(row: Record<string, unknown> | undefined): boolean {
  if (!row || typeof row.available !== "boolean") {
    throw new Error("OPERATIONAL_CORE_CAPABILITY_UNAVAILABLE");
  }
  return row.available;
}

export async function readOperationalCoreCapability(): Promise<boolean> {
  try {
    const rows = await db.execute(operationalCoreCapabilityQuery);
    return operationalCoreCapabilityAvailable(rows[0]);
  } catch (error) {
    console.error("Operational core capability preflight failed", error);
    return false;
  }
}
