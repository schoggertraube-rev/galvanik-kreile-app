-- 1. customers erweitern
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS behavior_notes text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS enriched_fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_lead boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_since timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- 2. orders erweitern
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS freetext_original text,
  ADD COLUMN IF NOT EXISTS is_quote boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_status text,
  ADD COLUMN IF NOT EXISTS quote_converted_order_id text;

-- 3. items Foto-Spalte sicherstellen
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS photo_ids jsonb DEFAULT '[]'::jsonb;

-- 4. inquiries
CREATE TABLE IF NOT EXISTS inquiries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id text NOT NULL,
  source text NOT NULL,
  raw_subject text,
  raw_body text NOT NULL,
  sender_name text,
  sender_email text,
  sender_phone text,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new',
  extracted_data jsonb,
  converted_to_order_id text,
  converted_to_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status);
CREATE INDEX IF NOT EXISTS inquiries_received_at_idx ON inquiries(received_at DESC);

-- 5. scan_uploads
CREATE TABLE IF NOT EXISTS scan_uploads (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id text NOT NULL,
  file_url text NOT NULL,
  record_kind text NOT NULL DEFAULT 'legacy',
  file_type text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  detected_type text,
  detection_confidence numeric(3,2),
  extracted_data jsonb,
  status text NOT NULL DEFAULT 'new',
  linked_invoice_id text
);

ALTER TABLE public.scan_uploads
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS record_kind text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS detected_type text,
  ADD COLUMN IF NOT EXISTS detection_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS linked_invoice_id text;

DO $scan_relations$
DECLARE
  target_type text;
  current_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO target_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.orders'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO current_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.scan_uploads'::regclass AND a.attname = 'linked_order_id' AND NOT a.attisdropped;
  IF current_type IS NULL THEN
    EXECUTE format('ALTER TABLE public.scan_uploads ADD COLUMN linked_order_id %s', target_type);
  ELSIF current_type <> target_type THEN
    RAISE EXCEPTION 'scan_uploads.linked_order_id type % does not match orders.id type %', current_type, target_type;
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod) INTO target_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.customers'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO current_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.scan_uploads'::regclass AND a.attname = 'linked_customer_id' AND NOT a.attisdropped;
  IF current_type IS NULL THEN
    EXECUTE format('ALTER TABLE public.scan_uploads ADD COLUMN linked_customer_id %s', target_type);
  ELSIF current_type <> target_type THEN
    RAISE EXCEPTION 'scan_uploads.linked_customer_id type % does not match customers.id type %', current_type, target_type;
  END IF;
END
$scan_relations$;

-- scan_uploads is a server-only original-evidence boundary.  A permissive
-- authenticated policy would be OR-combined with tenant policies and expose
-- every tenant's scans, so all browser policies and grants are removed.
ALTER TABLE public.scan_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_uploads FORCE ROW LEVEL SECURITY;

DO $scan_boundary$
DECLARE
  policy_name text;
  client_role text;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_uploads'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.scan_uploads', policy_name);
  END LOOP;

  REVOKE ALL PRIVILEGES ON TABLE public.scan_uploads FROM PUBLIC;
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.scan_uploads FROM %I', client_role);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.scan_uploads TO service_role;
  END IF;
END
$scan_boundary$;

-- 6. PostgREST reload
NOTIFY pgrst, 'reload schema';
