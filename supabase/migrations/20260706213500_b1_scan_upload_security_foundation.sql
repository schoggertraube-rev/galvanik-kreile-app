-- B1 foundation: align scan_uploads, events.order_id, and scans bucket policies.
-- Service-role access remains a documented bypass and must stay behind app-layer
-- role and tenant validation. Authenticated users do not receive DELETE rights.

ALTER TABLE public.events
  ALTER COLUMN order_id DROP NOT NULL

ALTER TABLE public.scan_uploads
  ADD COLUMN IF NOT EXISTS original_hash text,
  ADD COLUMN IF NOT EXISTS original_storage_path text,
  ADD COLUMN IF NOT EXISTS original_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS original_secured_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_idempotency_key text,
  ADD COLUMN IF NOT EXISTS field_confidence jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS review_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_order_id text,
  ADD COLUMN IF NOT EXISTS conversion_event_id text

ALTER TABLE public.scan_uploads
  ALTER COLUMN review_required SET DEFAULT false

UPDATE public.scan_uploads
SET field_confidence = '{}'::jsonb
WHERE field_confidence IS NULL

UPDATE public.scan_uploads
SET review_required = false
WHERE review_required IS NULL

ALTER TABLE public.scan_uploads
  ALTER COLUMN review_required SET NOT NULL

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_scan_uploads_reviewed_by'
      AND conrelid = 'public.scan_uploads'::regclass
  ) THEN
    ALTER TABLE public.scan_uploads
      ADD CONSTRAINT fk_scan_uploads_reviewed_by
      FOREIGN KEY (reviewed_by) REFERENCES public.app_users(id);
  END IF;
END $$

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_scan_uploads_conversion_order'
      AND conrelid = 'public.scan_uploads'::regclass
  ) THEN
    ALTER TABLE public.scan_uploads
      ADD CONSTRAINT fk_scan_uploads_conversion_order
      FOREIGN KEY (conversion_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
END $$

CREATE UNIQUE INDEX IF NOT EXISTS scan_uploads_tenant_client_idempotency_key_uidx
  ON public.scan_uploads (tenant_id, client_idempotency_key)

ALTER TABLE public.scan_uploads ENABLE ROW LEVEL SECURITY

DROP POLICY IF EXISTS allow_tenant_all_scan_uploads ON public.scan_uploads

DROP POLICY IF EXISTS auth_read_scan_uploads ON public.scan_uploads

DROP POLICY IF EXISTS tenant_isolation_scan_uploads ON public.scan_uploads

DROP POLICY IF EXISTS service_role_all_scan_uploads ON public.scan_uploads

CREATE POLICY scan_uploads_select_authenticated
ON public.scan_uploads
FOR SELECT
TO authenticated
USING (
  tenant_id = current_setting('app.tenant_id', true)
)

CREATE POLICY scan_uploads_insert_authenticated
ON public.scan_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)
)

CREATE POLICY scan_uploads_update_authenticated
ON public.scan_uploads
FOR UPDATE
TO authenticated
USING (
  tenant_id = current_setting('app.tenant_id', true)
)
WITH CHECK (
  tenant_id = current_setting('app.tenant_id', true)
)

-- Documented privileged DB path. App code must enforce role and path checks before use.
CREATE POLICY scan_uploads_service_role_all
ON public.scan_uploads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)

DROP POLICY IF EXISTS scan_objects_select_authenticated ON storage.objects

DROP POLICY IF EXISTS scan_objects_insert_authenticated ON storage.objects

DROP POLICY IF EXISTS scan_objects_update_authenticated ON storage.objects

DROP POLICY IF EXISTS scan_objects_service_role_all ON storage.objects

CREATE POLICY scan_objects_select_authenticated
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'scans'
  AND EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.id = auth.uid()
      AND au.active IS TRUE
      AND au.tenant_id = (storage.foldername(name))[1]
  )
)

CREATE POLICY scan_objects_insert_authenticated
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scans'
  AND EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.id = auth.uid()
      AND au.active IS TRUE
      AND au.tenant_id = (storage.foldername(name))[1]
      AND au.role IN ('werkstatt', 'meister', 'buero', 'admin')
  )
)

CREATE POLICY scan_objects_update_authenticated
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'scans'
  AND EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.id = auth.uid()
      AND au.active IS TRUE
      AND au.tenant_id = (storage.foldername(name))[1]
      AND au.role IN ('werkstatt', 'meister', 'buero', 'admin')
  )
)
WITH CHECK (
  bucket_id = 'scans'
  AND EXISTS (
    SELECT 1
    FROM public.app_users au
    WHERE au.id = auth.uid()
      AND au.active IS TRUE
      AND au.tenant_id = (storage.foldername(name))[1]
      AND au.role IN ('werkstatt', 'meister', 'buero', 'admin')
  )
)

-- Documented privileged storage path. App code must validate tenant/path before bypassing RLS.
CREATE POLICY scan_objects_service_role_all
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'scans')
WITH CHECK (bucket_id = 'scans')
