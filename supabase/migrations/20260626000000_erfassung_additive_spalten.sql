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
  file_type text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  detected_type text,
  detection_confidence numeric(3,2),
  extracted_data jsonb,
  status text NOT NULL DEFAULT 'new',
  linked_order_id text,
  linked_customer_id text,
  linked_invoice_id text
);

-- RLS for scan_uploads
ALTER TABLE scan_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_scan_uploads" ON scan_uploads FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_scan_uploads" ON scan_uploads FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_tenant_all_scan_uploads" ON scan_uploads FOR ALL TO authenticated USING (tenant_id = 'galvanik-kreile');

-- 6. PostgREST reload
NOTIFY pgrst, 'reload schema';
