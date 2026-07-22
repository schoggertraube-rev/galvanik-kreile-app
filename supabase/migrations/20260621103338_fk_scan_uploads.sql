-- scan_uploads must exist before its foreign keys are declared.  The parent
-- key type differs between the historical UUID baseline and the preserved
-- text/CUID delivery schema, so link columns inherit their target type.
BEGIN;

CREATE TABLE IF NOT EXISTS public.scan_uploads (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  file_url text NOT NULL,
  record_kind text NOT NULL DEFAULT 'legacy',
  file_type text,
  uploaded_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  detected_type text,
  detection_confidence numeric(3,2),
  extracted_data jsonb,
  status text NOT NULL DEFAULT 'new',
  linked_invoice_id text
);

DO $relations$
DECLARE
  target_type text;
  current_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO target_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.orders'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;
  IF target_type IS NULL THEN RAISE EXCEPTION 'orders.id is required before scan_uploads'; END IF;

  SELECT format_type(a.atttypid, a.atttypmod) INTO current_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.scan_uploads'::regclass
    AND a.attname = 'linked_order_id' AND NOT a.attisdropped;
  IF current_type IS NULL THEN
    EXECUTE format('ALTER TABLE public.scan_uploads ADD COLUMN linked_order_id %s', target_type);
  ELSIF current_type <> target_type THEN
    RAISE EXCEPTION 'scan_uploads.linked_order_id type % does not match orders.id type %', current_type, target_type;
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod) INTO target_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.customers'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;
  IF target_type IS NULL THEN RAISE EXCEPTION 'customers.id is required before scan_uploads'; END IF;

  SELECT format_type(a.atttypid, a.atttypmod) INTO current_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.scan_uploads'::regclass
    AND a.attname = 'linked_customer_id' AND NOT a.attisdropped;
  IF current_type IS NULL THEN
    EXECUTE format('ALTER TABLE public.scan_uploads ADD COLUMN linked_customer_id %s', target_type);
  ELSIF current_type <> target_type THEN
    RAISE EXCEPTION 'scan_uploads.linked_customer_id type % does not match customers.id type %', current_type, target_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.scan_uploads'::regclass AND conname = 'fk_scan_uploads_order'
  ) THEN
    ALTER TABLE public.scan_uploads ADD CONSTRAINT fk_scan_uploads_order
      FOREIGN KEY (linked_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.scan_uploads'::regclass AND conname = 'fk_scan_uploads_customer'
  ) THEN
    ALTER TABLE public.scan_uploads ADD CONSTRAINT fk_scan_uploads_customer
      FOREIGN KEY (linked_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END
$relations$;

COMMIT;
