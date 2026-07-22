import { sql } from "drizzle-orm";
import { db } from "@/db";

const SCHEMA_REQUIRED = "Der Scan-Originalbeleg ist in dieser Datenbank noch nicht sicher ausgerollt.";
const STORAGE_REQUIRED = "Der private Scan-Speicher ist serverseitig noch nicht sicher konfiguriert.";

export type ScanCaptureCapability = {
  available: boolean;
  reason: string | null;
};

const scanSchemaCapabilityQuery = sql<{ available: boolean }>`
  select (
    to_regclass('public.scan_uploads') is not null
    and not exists (
      select 1
      from (values
        ('id', array['text']::text[], true),
        ('tenant_id', array['text', 'varchar']::text[], true),
        ('file_url', array['text', 'varchar']::text[], true),
        ('record_kind', array['text', 'varchar']::text[], true),
        ('file_type', array['text', 'varchar']::text[], false),
        ('content_sha256', array['text', 'varchar']::text[], false),
        ('file_size_bytes', array['int4']::text[], false),
        ('processing_attempt_count', array['int4']::text[], true),
        ('processing_claimed_at', array['timestamptz']::text[], false),
        ('last_processing_error', array['text', 'varchar']::text[], false),
        ('uploaded_by', array['uuid']::text[], false),
        ('uploaded_at', array['timestamptz']::text[], true),
        ('extracted_data', array['jsonb']::text[], false),
        ('status', array['text', 'varchar']::text[], true),
        ('linked_order_id', array['text', 'varchar', 'uuid']::text[], false),
        ('linked_customer_id', array['text', 'varchar', 'uuid']::text[], false)
      ) as expected(column_name, allowed_types, must_be_not_null)
      where not exists (
        select 1 from information_schema.columns column_row
        where column_row.table_schema = 'public'
          and column_row.table_name = 'scan_uploads'
          and column_row.column_name = expected.column_name
          and column_row.udt_name = any(expected.allowed_types)
          and (not expected.must_be_not_null or column_row.is_nullable = 'NO')
      )
    )
    and not exists (
      select 1
      from (values
        ('scan_uploads_record_kind_chk', array['record_kind', 'capture_scan', 'order_photo', 'legacy']::text[]),
        ('scan_uploads_capture_id_chk', array['record_kind', 'capture_scan', 'id', '[0-9a-f]']::text[]),
        ('scan_uploads_content_sha256_chk', array['record_kind', 'capture_scan', 'content_sha256', 'IS NOT NULL', '64']::text[]),
        ('scan_uploads_file_size_bytes_chk', array['file_size_bytes', 'IS NOT NULL', '14680064']::text[]),
        ('scan_uploads_processing_attempt_count_chk', array['processing_attempt_count', '3']::text[]),
        ('scan_uploads_file_type_chk', array['file_type', 'IS NOT NULL', 'image/jpeg', 'image/png', 'application/pdf']::text[]),
        ('scan_uploads_status_chk', array['storage_unconfirmed', 'integrity_error', 'processed', 'review_required']::text[]),
        ('scan_uploads_processing_claim_chk', array['processing_claimed_at', 'processing', 'processing_attempt_count', '1', '3']::text[]),
        ('scan_uploads_secured_original_chk', array['uploaded_by', 'content_sha256', 'file_size_bytes']::text[]),
        ('scan_uploads_processed_payload_chk', array['processed', 'extracted_data']::text[]),
        ('scan_uploads_capture_storage_path_chk', array['file_type', 'IS NOT NULL', 'file_url', 'tenant_id', 'original.']::text[]),
        ('scan_uploads_capture_relation_chk', array['linked_order_id', 'linked_customer_id']::text[])
      ) as expected(constraint_name, required_fragments)
      where not exists (
        select 1
        from pg_constraint constraint_row
        where constraint_row.conrelid = 'public.scan_uploads'::regclass
          and constraint_row.conname = expected.constraint_name
          and constraint_row.contype = 'c'
          and constraint_row.convalidated
          and (
            select bool_and(strpos(lower(pg_get_constraintdef(constraint_row.oid)), lower(fragment)) > 0)
            from unnest(expected.required_fragments) fragment
          )
      )
    )
    and exists (
      select 1
      from pg_index index_row
      join pg_class relation on relation.oid = index_row.indrelid
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      join pg_attribute id_column on id_column.attrelid = relation.oid and id_column.attname = 'id'
      where namespace.nspname = 'public' and relation.relname = 'scan_uploads'
        and index_row.indisunique and index_row.indisvalid and index_row.indisready
        and index_row.indpred is null and index_row.indexprs is null
        and index_row.indnkeyatts = 1
        and id_column.attnum = any(index_row.indkey::smallint[])
    )
    and exists (
      select 1
      from pg_attribute scan_column
      join pg_class scan_relation on scan_relation.oid = scan_column.attrelid
      join pg_namespace scan_namespace on scan_namespace.oid = scan_relation.relnamespace
      join pg_class parent_relation on parent_relation.relname = 'orders'
      join pg_namespace parent_namespace on parent_namespace.oid = parent_relation.relnamespace and parent_namespace.nspname = 'public'
      join pg_attribute parent_column on parent_column.attrelid = parent_relation.oid and parent_column.attname = 'id'
      where scan_namespace.nspname = 'public' and scan_relation.relname = 'scan_uploads'
        and scan_column.attname = 'linked_order_id'
        and scan_column.atttypid = parent_column.atttypid
    )
    and exists (
      select 1
      from pg_attribute scan_column
      join pg_class scan_relation on scan_relation.oid = scan_column.attrelid
      join pg_namespace scan_namespace on scan_namespace.oid = scan_relation.relnamespace
      join pg_class parent_relation on parent_relation.relname = 'customers'
      join pg_namespace parent_namespace on parent_namespace.oid = parent_relation.relnamespace and parent_namespace.nspname = 'public'
      join pg_attribute parent_column on parent_column.attrelid = parent_relation.oid and parent_column.attname = 'id'
      where scan_namespace.nspname = 'public' and scan_relation.relname = 'scan_uploads'
        and scan_column.attname = 'linked_customer_id'
        and scan_column.atttypid = parent_column.atttypid
    )
    and not exists (
      select 1
      from (values
        ('scan_uploads_record_kind_chk'),
        ('scan_uploads_capture_id_chk'),
        ('scan_uploads_content_sha256_chk'),
        ('scan_uploads_file_size_bytes_chk'),
        ('scan_uploads_processing_attempt_count_chk'),
        ('scan_uploads_file_type_chk'),
        ('scan_uploads_status_chk'),
        ('scan_uploads_processing_claim_chk'),
        ('scan_uploads_secured_original_chk'),
        ('scan_uploads_processed_payload_chk'),
        ('scan_uploads_capture_storage_path_chk'),
        ('scan_uploads_capture_relation_chk')
      ) as expected(constraint_name)
      where not exists (
        select 1
        from pg_constraint constraint_row
        where constraint_row.conrelid = 'public.scan_uploads'::regclass
          and constraint_row.conname = expected.constraint_name
          and constraint_row.contype = 'c'
          and constraint_row.convalidated
      )
    )
    and exists (
      select 1 from pg_constraint constraint_row
      where constraint_row.conrelid = 'public.scan_uploads'::regclass
        and constraint_row.conname = 'fk_scan_uploads_order'
        and constraint_row.contype = 'f' and constraint_row.convalidated
        and constraint_row.confrelid = 'public.orders'::regclass
        and constraint_row.confdeltype = 'r'
        and constraint_row.conkey = array[
          (select attnum from pg_attribute where attrelid = 'public.scan_uploads'::regclass and attname = 'tenant_id'),
          (select attnum from pg_attribute where attrelid = 'public.scan_uploads'::regclass and attname = 'linked_order_id')
        ]::smallint[]
        and constraint_row.confkey = array[
          (select attnum from pg_attribute where attrelid = 'public.orders'::regclass and attname = 'tenant_id'),
          (select attnum from pg_attribute where attrelid = 'public.orders'::regclass and attname = 'id')
        ]::smallint[]
    )
    and not exists (
      select 1
      from (values
        ('scan_uploads_tenant_actor_uploaded_idx', array['tenant_id', 'uploaded_by', 'uploaded_at']::text[]),
        ('scan_uploads_tenant_uploaded_idx', array['tenant_id', 'uploaded_at']::text[])
      ) as expected(index_name, columns)
      where not exists (
        select 1
        from pg_index index_row
        join pg_class index_relation on index_relation.oid = index_row.indexrelid
        where index_row.indrelid = 'public.scan_uploads'::regclass
          and index_relation.relname = expected.index_name
          and index_row.indisvalid and index_row.indisready
          and not index_row.indisunique
          and index_row.indpred is null and index_row.indexprs is null
          and index_row.indnkeyatts = cardinality(expected.columns)
          and index_row.indnatts = cardinality(expected.columns)
          and (
            select array_agg(attribute.attname::text order by key.ordinality)
            from unnest(index_row.indkey) with ordinality as key(attnum, ordinality)
            join pg_attribute attribute
              on attribute.attrelid = index_row.indrelid and attribute.attnum = key.attnum
          ) = expected.columns
      )
    )
    and exists (
      select 1 from pg_constraint constraint_row
      where constraint_row.conrelid = 'public.scan_uploads'::regclass
        and constraint_row.conname = 'fk_scan_uploads_customer'
        and constraint_row.contype = 'f' and constraint_row.convalidated
        and constraint_row.confrelid = 'public.customers'::regclass
        and constraint_row.confdeltype = 'r'
        and constraint_row.conkey = array[
          (select attnum from pg_attribute where attrelid = 'public.scan_uploads'::regclass and attname = 'tenant_id'),
          (select attnum from pg_attribute where attrelid = 'public.scan_uploads'::regclass and attname = 'linked_customer_id')
        ]::smallint[]
        and constraint_row.confkey = array[
          (select attnum from pg_attribute where attrelid = 'public.customers'::regclass and attname = 'tenant_id'),
          (select attnum from pg_attribute where attrelid = 'public.customers'::regclass and attname = 'id')
        ]::smallint[]
    )
    and exists (
      select 1 from pg_constraint constraint_row
      where constraint_row.conrelid = 'public.scan_uploads'::regclass
        and constraint_row.conname = 'scan_uploads_uploaded_by_fk'
        and constraint_row.contype = 'f' and constraint_row.convalidated
        and constraint_row.confrelid = 'public.app_users'::regclass
        and constraint_row.confdeltype = 'r'
        and constraint_row.conkey = array[
          (select attnum from pg_attribute where attrelid = 'public.scan_uploads'::regclass and attname = 'tenant_id'),
          (select attnum from pg_attribute where attrelid = 'public.scan_uploads'::regclass and attname = 'uploaded_by')
        ]::smallint[]
        and constraint_row.confkey = array[
          (select attnum from pg_attribute where attrelid = 'public.app_users'::regclass and attname = 'tenant_id'),
          (select attnum from pg_attribute where attrelid = 'public.app_users'::regclass and attname = 'id')
        ]::smallint[]
    )
    and exists (
      select 1
      from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public' and relation.relname = 'scan_uploads'
        and relation.relrowsecurity and relation.relforcerowsecurity
    )
    and not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'scan_uploads'
    )
    and not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) acl
      where namespace.nspname = 'public' and relation.relname = 'scan_uploads' and acl.grantee = 0
    )
    and not exists (
      select 1
      from pg_attribute column_row
      cross join lateral aclexplode(column_row.attacl) acl
      where column_row.attrelid = 'public.scan_uploads'::regclass
        and column_row.attnum > 0 and not column_row.attisdropped
        and acl.grantee = 0
    )
    and not exists (
      select 1
      from (values ('anon'), ('authenticated')) browser(role_name)
      cross join lateral (select to_regrole(browser.role_name) role_oid) role_ref
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privilege(privilege_name)
      where role_ref.role_oid is not null
        and has_table_privilege(role_ref.role_oid, 'public.scan_uploads', privilege.privilege_name)
    )
    and not exists (
      select 1
      from (values ('anon'), ('authenticated')) browser(role_name)
      cross join lateral (select to_regrole(browser.role_name) role_oid) role_ref
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) privilege(privilege_name)
      where role_ref.role_oid is not null
        and has_any_column_privilege(role_ref.role_oid, 'public.scan_uploads', privilege.privilege_name)
    )
    and exists (
      select 1 from pg_roles role_row
      where role_row.rolname = 'service_role' and role_row.rolbypassrls
        and has_table_privilege(role_row.oid, 'public.scan_uploads', 'SELECT')
        and has_table_privilege(role_row.oid, 'public.scan_uploads', 'INSERT')
        and has_table_privilege(role_row.oid, 'public.scan_uploads', 'UPDATE')
        and not has_table_privilege(role_row.oid, 'public.scan_uploads', 'DELETE')
        and not has_table_privilege(role_row.oid, 'public.scan_uploads', 'TRUNCATE')
        and not has_table_privilege(role_row.oid, 'public.scan_uploads', 'REFERENCES')
        and not has_table_privilege(role_row.oid, 'public.scan_uploads', 'TRIGGER')
    )
    and current_user = 'service_role'
  ) as available
`;

const scanStorageCapabilityQuery = sql<{ available: boolean }>`
  select (
    exists (
      select 1 from storage.buckets
      where id = 'scans'
        and public = false
        and file_size_limit = 14680064
        and allowed_mime_types @> array['image/jpeg', 'image/png', 'application/pdf']::text[]
        and allowed_mime_types <@ array['image/jpeg', 'image/png', 'application/pdf']::text[]
    )
    and to_regclass('storage.objects') is not null
    and exists (
      select 1
      from pg_class relation
      where relation.oid = 'storage.objects'::regclass
        and relation.relrowsecurity
    )
    and exists (
      select 1
      from pg_policy policy
      where policy.polrelid = 'storage.objects'::regclass
        and policy.polname = 'scans_server_only_boundary'
        and not policy.polpermissive
        and policy.polcmd = '*'
        and policy.polroles @> array[to_regrole('anon')::oid, to_regrole('authenticated')::oid]
        and policy.polroles <@ array[to_regrole('anon')::oid, to_regrole('authenticated')::oid]
        and lower(pg_get_expr(policy.polqual, policy.polrelid)) like '%bucket_id%<>%scans%'
        and lower(pg_get_expr(policy.polwithcheck, policy.polrelid)) like '%bucket_id%<>%scans%'
    )
  ) as available
`;

function storageEnvironmentConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

async function evaluateCapability(
  query: typeof scanSchemaCapabilityQuery | typeof scanStorageCapabilityQuery,
  reason: string,
): Promise<ScanCaptureCapability> {
  try {
    const rows = await db.execute(query);
    return rows[0]?.available === true
      ? { available: true, reason: null }
      : { available: false, reason };
  } catch (error) {
    console.error("Scan capability check failed", error);
    return { available: false, reason };
  }
}

export async function readScanSchemaCapability(): Promise<ScanCaptureCapability> {
  return evaluateCapability(scanSchemaCapabilityQuery, SCHEMA_REQUIRED);
}

export async function readScanCaptureCapability(): Promise<ScanCaptureCapability> {
  const schema = await readScanSchemaCapability();
  if (!schema.available) return schema;
  if (!storageEnvironmentConfigured()) return { available: false, reason: STORAGE_REQUIRED };
  return evaluateCapability(scanStorageCapabilityQuery, STORAGE_REQUIRED);
}
