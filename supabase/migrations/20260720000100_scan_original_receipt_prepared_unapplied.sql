-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Reconciles the legacy scan/photo table with a typed, server-only original
-- receipt. Existing rows remain `legacy`; only explicit `capture_scan` rows
-- may drive OCR or create an order.
BEGIN;

DO $required_relations$
BEGIN
  IF to_regclass('public.scan_uploads') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.customers') IS NULL
     OR to_regclass('public.app_users') IS NULL THEN
    RAISE EXCEPTION 'scan_uploads, orders, customers and app_users are required before scan hardening';
  END IF;
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Supabase storage.buckets and storage.objects are required before scan hardening';
  END IF;
END
$required_relations$;

ALTER TABLE public.scan_uploads
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS record_kind text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS content_sha256 varchar(64),
  ADD COLUMN IF NOT EXISTS file_size_bytes integer,
  ADD COLUMN IF NOT EXISTS processing_attempt_count integer,
  ADD COLUMN IF NOT EXISTS processing_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_processing_error text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS detected_type text,
  ADD COLUMN IF NOT EXISTS detection_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS linked_invoice_id text,
  ADD COLUMN IF NOT EXISTS ocr_provider text;

DO $relation_columns$
DECLARE
  target_type_oid oid;
  target_type text;
  current_type_oid oid;
  current_type text;
BEGIN
  SELECT a.atttypid, format_type(a.atttypid, a.atttypmod)
    INTO target_type_oid, target_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.orders'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT a.atttypid, format_type(a.atttypid, a.atttypmod)
    INTO current_type_oid, current_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.scan_uploads'::regclass
    AND a.attname = 'linked_order_id' AND NOT a.attisdropped;
  IF current_type_oid IS NULL THEN
    EXECUTE format('ALTER TABLE public.scan_uploads ADD COLUMN linked_order_id %s', target_type);
  ELSIF current_type_oid <> target_type_oid THEN
    RAISE EXCEPTION 'scan_uploads.linked_order_id type % does not match orders.id type %', current_type, target_type;
  END IF;

  SELECT a.atttypid, format_type(a.atttypid, a.atttypmod)
    INTO target_type_oid, target_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.customers'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT a.atttypid, format_type(a.atttypid, a.atttypmod)
    INTO current_type_oid, current_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.scan_uploads'::regclass
    AND a.attname = 'linked_customer_id' AND NOT a.attisdropped;
  IF current_type_oid IS NULL THEN
    EXECUTE format('ALTER TABLE public.scan_uploads ADD COLUMN linked_customer_id %s', target_type);
  ELSIF current_type_oid <> target_type_oid THEN
    RAISE EXCEPTION 'scan_uploads.linked_customer_id type % does not match customers.id type %', current_type, target_type;
  END IF;
END
$relation_columns$;

UPDATE public.scan_uploads
SET tenant_id = 'galvanik-kreile'
WHERE tenant_id IS NULL OR btrim(tenant_id) = '';

UPDATE public.scan_uploads
SET processing_attempt_count = 0
WHERE processing_attempt_count IS NULL;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tenant_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'tenant_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'Tenant columns on orders, customers and app_users are required before scan hardening';
  END IF;

  IF EXISTS (
    SELECT id FROM public.scan_uploads
    GROUP BY id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM public.scan_uploads WHERE id IS NULL OR btrim(id::text) = ''
  ) THEN
    RAISE EXCEPTION 'scan_uploads.id must be present and unique before scan hardening';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.scan_uploads
    WHERE file_url IS NULL OR btrim(file_url) = ''
       OR uploaded_at IS NULL
       OR status IS NULL OR btrim(status) = ''
  ) THEN
    RAISE EXCEPTION 'Legacy scan rows need a storage locator, timestamp and status before scan hardening';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.scan_uploads
    WHERE processing_attempt_count < 0 OR processing_attempt_count > 3
  ) THEN
    RAISE EXCEPTION 'Invalid scan processing attempt counts must be investigated before scan hardening';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.scan_uploads scan
    JOIN public.orders parent ON parent.id = scan.linked_order_id
    WHERE scan.linked_order_id IS NOT NULL AND parent.tenant_id IS DISTINCT FROM scan.tenant_id
  ) OR EXISTS (
    SELECT 1
    FROM public.scan_uploads scan
    LEFT JOIN public.orders parent ON parent.id = scan.linked_order_id
    WHERE scan.linked_order_id IS NOT NULL AND parent.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Dangling or cross-tenant scan order links must be resolved before scan hardening';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.scan_uploads scan
    JOIN public.customers parent ON parent.id = scan.linked_customer_id
    WHERE scan.linked_customer_id IS NOT NULL AND parent.tenant_id IS DISTINCT FROM scan.tenant_id
  ) OR EXISTS (
    SELECT 1
    FROM public.scan_uploads scan
    LEFT JOIN public.customers parent ON parent.id = scan.linked_customer_id
    WHERE scan.linked_customer_id IS NOT NULL AND parent.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Dangling or cross-tenant scan customer links must be resolved before scan hardening';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.scan_uploads scan
    JOIN public.app_users actor ON actor.id = scan.uploaded_by
    WHERE scan.uploaded_by IS NOT NULL AND actor.tenant_id IS DISTINCT FROM scan.tenant_id
  ) OR EXISTS (
    SELECT 1
    FROM public.scan_uploads scan
    LEFT JOIN public.app_users actor ON actor.id = scan.uploaded_by
    WHERE scan.uploaded_by IS NOT NULL AND actor.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Dangling or cross-tenant scan upload actors must be resolved before scan hardening';
  END IF;
END
$preflight$;

ALTER TABLE public.scan_uploads
  ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile',
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN file_url SET NOT NULL,
  ALTER COLUMN record_kind SET DEFAULT 'legacy',
  ALTER COLUMN record_kind SET NOT NULL,
  ALTER COLUMN uploaded_at SET DEFAULT now(),
  ALTER COLUMN uploaded_at SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'new',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN processing_attempt_count SET DEFAULT 0,
  ALTER COLUMN processing_attempt_count SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS scan_uploads_id_uidx
  ON public.scan_uploads (id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_id_uidx
  ON public.orders (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_id_uidx
  ON public.customers (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_tenant_id_id_uidx
  ON public.app_users (tenant_id, id);

ALTER TABLE public.scan_uploads
  DROP CONSTRAINT IF EXISTS fk_scan_uploads_order,
  DROP CONSTRAINT IF EXISTS fk_scan_uploads_customer,
  DROP CONSTRAINT IF EXISTS scan_uploads_uploaded_by_fk,
  DROP CONSTRAINT IF EXISTS scan_uploads_record_kind_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_capture_id_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_content_sha256_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_file_size_bytes_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_processing_attempt_count_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_file_type_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_status_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_processing_claim_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_secured_original_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_processed_payload_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_capture_storage_path_chk,
  DROP CONSTRAINT IF EXISTS scan_uploads_capture_relation_chk;

ALTER TABLE public.scan_uploads
  ADD CONSTRAINT fk_scan_uploads_order
    FOREIGN KEY (tenant_id, linked_order_id)
    REFERENCES public.orders(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT fk_scan_uploads_customer
    FOREIGN KEY (tenant_id, linked_customer_id)
    REFERENCES public.customers(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT scan_uploads_uploaded_by_fk
    FOREIGN KEY (tenant_id, uploaded_by)
    REFERENCES public.app_users(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT scan_uploads_record_kind_chk
    CHECK (record_kind IN ('capture_scan', 'order_photo', 'legacy')) NOT VALID,
  ADD CONSTRAINT scan_uploads_capture_id_chk CHECK (
    record_kind <> 'capture_scan'
    OR id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_content_sha256_chk CHECK (
    record_kind <> 'capture_scan'
    OR (content_sha256 IS NOT NULL AND content_sha256 ~ '^[0-9a-f]{64}$')
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_file_size_bytes_chk CHECK (
    record_kind <> 'capture_scan'
    OR (file_size_bytes IS NOT NULL AND file_size_bytes BETWEEN 1 AND 14680064)
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_processing_attempt_count_chk
    CHECK (processing_attempt_count BETWEEN 0 AND 3) NOT VALID,
  ADD CONSTRAINT scan_uploads_file_type_chk CHECK (
    record_kind <> 'capture_scan'
    OR (file_type IS NOT NULL AND file_type IN ('image/jpeg', 'image/png', 'application/pdf'))
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_status_chk CHECK (
    record_kind <> 'capture_scan'
    OR status IN (
      'uploading', 'storage_unconfirmed', 'storage_error', 'integrity_error',
      'secured', 'processing', 'processed', 'review_required'
    )
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_processing_claim_chk CHECK (
    record_kind <> 'capture_scan'
    OR (
      (status = 'processing') = (processing_claimed_at IS NOT NULL)
      AND (status <> 'processing' OR processing_attempt_count BETWEEN 1 AND 3)
    )
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_secured_original_chk CHECK (
    record_kind <> 'capture_scan'
    OR (
      uploaded_by IS NOT NULL
      AND content_sha256 IS NOT NULL
      AND content_sha256 ~ '^[0-9a-f]{64}$'
      AND file_size_bytes IS NOT NULL
      AND file_size_bytes BETWEEN 1 AND 14680064
      AND file_type IS NOT NULL
      AND file_type IN ('image/jpeg', 'image/png', 'application/pdf')
    )
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_processed_payload_chk CHECK (
    record_kind <> 'capture_scan' OR status <> 'processed' OR extracted_data IS NOT NULL
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_capture_storage_path_chk CHECK (
    record_kind <> 'capture_scan'
    OR (
      file_type IS NOT NULL
      AND file_url = tenant_id || '/' || id || '/original.' || CASE file_type
        WHEN 'image/jpeg' THEN 'jpg'
        WHEN 'image/png' THEN 'png'
        WHEN 'application/pdf' THEN 'pdf'
        ELSE ''
      END
    )
  ) NOT VALID,
  ADD CONSTRAINT scan_uploads_capture_relation_chk CHECK (
    record_kind <> 'capture_scan'
    OR linked_order_id IS NULL
    OR linked_customer_id IS NOT NULL
  ) NOT VALID;

ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT fk_scan_uploads_order;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT fk_scan_uploads_customer;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_uploaded_by_fk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_record_kind_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_capture_id_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_content_sha256_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_file_size_bytes_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_processing_attempt_count_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_file_type_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_status_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_processing_claim_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_secured_original_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_processed_payload_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_capture_storage_path_chk;
ALTER TABLE public.scan_uploads VALIDATE CONSTRAINT scan_uploads_capture_relation_chk;

CREATE INDEX IF NOT EXISTS scan_uploads_tenant_status_uploaded_idx
  ON public.scan_uploads (tenant_id, status, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS scan_uploads_tenant_order_idx
  ON public.scan_uploads (tenant_id, linked_order_id)
  WHERE linked_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS scan_uploads_tenant_actor_uploaded_idx
  ON public.scan_uploads (tenant_id, uploaded_by, uploaded_at);
CREATE INDEX IF NOT EXISTS scan_uploads_tenant_uploaded_idx
  ON public.scan_uploads (tenant_id, uploaded_at);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scans', 'scans', false, 14680064,
  array['image/jpeg', 'image/png', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- This restrictive policy composes with current and future permissive browser
-- policies for other buckets. Even if such a policy is added later, browser
-- roles can neither read nor mutate objects in the private scans bucket.
DROP POLICY IF EXISTS scans_server_only_boundary ON storage.objects;
CREATE POLICY scans_server_only_boundary
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (bucket_id <> 'scans')
  WITH CHECK (bucket_id <> 'scans');

ALTER TABLE public.scan_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_uploads FORCE ROW LEVEL SECURITY;

DO $boundary$
DECLARE
  policy_name text;
  client_role text;
  column_name text;
  privilege_name text;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_uploads'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.scan_uploads', policy_name);
  END LOOP;

  REVOKE ALL PRIVILEGES ON TABLE public.scan_uploads FROM PUBLIC;
  FOREACH column_name IN ARRAY ARRAY(
    SELECT attname::text FROM pg_attribute
    WHERE attrelid = 'public.scan_uploads'::regclass AND attnum > 0 AND NOT attisdropped
  ) LOOP
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
      EXECUTE format('REVOKE %s (%I) ON TABLE public.scan_uploads FROM PUBLIC', privilege_name, column_name);
    END LOOP;
  END LOOP;
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF to_regrole(client_role) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.scan_uploads FROM %I', client_role);
      FOREACH column_name IN ARRAY ARRAY(
        SELECT attname::text FROM pg_attribute
        WHERE attrelid = 'public.scan_uploads'::regclass AND attnum > 0 AND NOT attisdropped
      ) LOOP
        FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
          EXECUTE format(
            'REVOKE %s (%I) ON TABLE public.scan_uploads FROM %I',
            privilege_name, column_name, client_role
          );
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.scan_uploads TO service_role;
  END IF;
END
$boundary$;

DO $verification$
DECLARE
  client_role text;
  privilege_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_uploads'
  ) THEN
    RAISE EXCEPTION 'scan_uploads must not expose any RLS policies';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_class rel
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(rel.relacl, acldefault('r', rel.relowner))) acl
    WHERE ns.nspname = 'public' AND rel.relname = 'scan_uploads' AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'scan_uploads still grants privileges to PUBLIC';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_attribute column_row
    CROSS JOIN LATERAL aclexplode(column_row.attacl) acl
    WHERE column_row.attrelid = 'public.scan_uploads'::regclass
      AND column_row.attnum > 0 AND NOT column_row.attisdropped
      AND acl.grantee = 0
  ) THEN
    RAISE EXCEPTION 'scan_uploads still grants column privileges to PUBLIC';
  END IF;

  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(client_role, 'public.scan_uploads', privilege_name) THEN
          RAISE EXCEPTION 'scan_uploads still exposes effective % to %', privilege_name, client_role;
        END IF;
      END LOOP;
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        IF has_any_column_privilege(client_role, 'public.scan_uploads', privilege_name) THEN
          RAISE EXCEPTION 'scan_uploads still exposes effective column % to %', privilege_name, client_role;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class rel JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public' AND rel.relname = 'scan_uploads'
      AND rel.relrowsecurity AND rel.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'scan_uploads must use forced RLS';
  END IF;
  IF to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'The service_role database role is required for scan hardening';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls)
     OR NOT has_table_privilege('service_role', 'public.scan_uploads', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.scan_uploads', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.scan_uploads', 'UPDATE')
     OR has_table_privilege('service_role', 'public.scan_uploads', 'DELETE')
     OR has_table_privilege('service_role', 'public.scan_uploads', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.scan_uploads', 'REFERENCES')
     OR has_table_privilege('service_role', 'public.scan_uploads', 'TRIGGER') THEN
    RAISE EXCEPTION 'scan_uploads service-role boundary is incomplete or overprivileged';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'scans' AND public = false AND file_size_limit = 14680064
      AND allowed_mime_types @> array['image/jpeg', 'image/png', 'application/pdf']::text[]
      AND allowed_mime_types <@ array['image/jpeg', 'image/png', 'application/pdf']::text[]
  ) THEN
    RAISE EXCEPTION 'The scans bucket is not private and constrained';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'storage.objects'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'storage.objects must have row-level security enabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy policy
    WHERE policy.polrelid = 'storage.objects'::regclass
      AND policy.polname = 'scans_server_only_boundary'
      AND NOT policy.polpermissive
      AND policy.polcmd = '*'
      AND policy.polroles @> ARRAY[to_regrole('anon')::oid, to_regrole('authenticated')::oid]
      AND policy.polroles <@ ARRAY[to_regrole('anon')::oid, to_regrole('authenticated')::oid]
      AND lower(pg_get_expr(policy.polqual, policy.polrelid)) LIKE '%bucket_id%<>%scans%'
      AND lower(pg_get_expr(policy.polwithcheck, policy.polrelid)) LIKE '%bucket_id%<>%scans%'
  ) THEN
    RAISE EXCEPTION 'storage.objects lacks the restrictive scans server-only boundary';
  END IF;
END
$verification$;

COMMIT;
