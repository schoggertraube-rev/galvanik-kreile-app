-- PREPARED, NOT REMOTELY APPLIED.
-- Reconciles source columns and the quality relation required by the
-- operational server boundary. Existing rows are only backfilled from their
-- already-proven parent order; ambiguous attribution aborts.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS pref_comm text,
  ADD COLUMN IF NOT EXISTS risk text DEFAULT 'Niedrig',
  ADD COLUMN IF NOT EXISTS risk_note text,
  ADD COLUMN IF NOT EXISTS marketing_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_reactivated_at timestamp without time zone;

DO $customer_image_contract$
DECLARE
  image_type text;
BEGIN
  SELECT format_type(attribute_record.atttypid, attribute_record.atttypmod)
  INTO image_type
  FROM pg_attribute attribute_record
  WHERE attribute_record.attrelid = 'public.customers'::regclass
    AND attribute_record.attname = 'image_urls'
    AND NOT attribute_record.attisdropped;

  IF image_type IS NULL THEN
    ALTER TABLE public.customers
      ADD COLUMN image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
  ELSIF image_type = 'text[]' THEN
    ALTER TABLE public.customers
      ALTER COLUMN image_urls DROP DEFAULT,
      ALTER COLUMN image_urls TYPE jsonb USING to_jsonb(image_urls);
    UPDATE public.customers SET image_urls = '[]'::jsonb WHERE image_urls IS NULL;
    ALTER TABLE public.customers
      ALTER COLUMN image_urls SET DEFAULT '[]'::jsonb;
  ELSIF image_type <> 'jsonb' THEN
    RAISE EXCEPTION
      'CUSTOMER_SOURCE_RECONCILIATION_REQUIRED: unsupported customers.image_urls type %',
      image_type;
  END IF;
END
$customer_image_contract$;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS converted_to_order_id text,
  ADD COLUMN IF NOT EXISTS converted_to_customer_id text;

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS photo_ids jsonb,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolved_at timestamp without time zone;

UPDATE public.complaints
SET description = ''
WHERE description IS NULL;

ALTER TABLE public.complaints
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN description SET NOT NULL;

ALTER TABLE public.price_agreements
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS rate text,
  ADD COLUMN IF NOT EXISTS date timestamp with time zone;

DO $price_agreement_contract$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'price_agreements' AND column_name = 'title'
  ) THEN
    EXECUTE 'UPDATE public.price_agreements
      SET scope = COALESCE(scope, title)
      WHERE scope IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'price_agreements' AND column_name = 'price'
  ) THEN
    EXECUTE 'UPDATE public.price_agreements
      SET rate = COALESCE(rate, price::text)
      WHERE rate IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'price_agreements' AND column_name = 'valid_from'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'price_agreements' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'UPDATE public.price_agreements
      SET date = COALESCE(date, valid_from, created_at)
      WHERE date IS NULL';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'price_agreements' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'UPDATE public.price_agreements
      SET date = COALESCE(date, created_at)
      WHERE date IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.price_agreements
    WHERE scope IS NULL OR btrim(scope) = ''
       OR rate IS NULL OR btrim(rate) = ''
       OR date IS NULL
  ) THEN
    RAISE EXCEPTION
      'PRICE_AGREEMENT_RECONCILIATION_REQUIRED: canonical scope/rate/date cannot be proven';
  END IF;
END
$price_agreement_contract$;

ALTER TABLE public.price_agreements
  ALTER COLUMN scope SET NOT NULL,
  ALTER COLUMN rate SET NOT NULL,
  ALTER COLUMN date SET NOT NULL,
  ALTER COLUMN date SET DEFAULT now();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS task text,
  ADD COLUMN IF NOT EXISTS station text,
  ADD COLUMN IF NOT EXISTS current_station_id text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS priority_computed text DEFAULT 'green';

UPDATE public.orders
SET station = COALESCE(NULLIF(btrim(station), ''), current_station, 'wareneingang');

ALTER TABLE public.orders
  ALTER COLUMN station SET DEFAULT 'wareneingang',
  ALTER COLUMN station SET NOT NULL;

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS current_station_id text DEFAULT 'wareneingang',
  ADD COLUMN IF NOT EXISTS station_sequence jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 0;

UPDATE public.items item
SET tenant_id = parent.tenant_id,
    customer_id = parent.customer_id
FROM public.orders parent
WHERE parent.id = item.order_id
  AND (
    item.tenant_id IS NULL
    OR btrim(item.tenant_id) = ''
    OR item.customer_id IS NULL
  );

DO $item_truth$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.items item
    LEFT JOIN public.orders parent
      ON parent.id = item.order_id
     AND parent.tenant_id = item.tenant_id
     AND parent.customer_id = item.customer_id
    WHERE parent.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'OPERATIONAL_SOURCE_RECONCILIATION_REQUIRED: item tenant/customer attribution is ambiguous';
  END IF;
END
$item_truth$;

ALTER TABLE public.items
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN customer_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_id_uidx
  ON public.customers (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_id_uidx
  ON public.orders (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS items_tenant_order_id_uidx
  ON public.items (tenant_id, order_id, id);

DO $app_user_email_contract$
DECLARE
  constraint_record record;
  email_attribute smallint;
BEGIN
  SELECT attnum::smallint
  INTO email_attribute
  FROM pg_attribute
  WHERE attrelid = 'public.app_users'::regclass
    AND attname = 'email'
    AND NOT attisdropped;

  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.app_users'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[email_attribute]::smallint[]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.app_users DROP CONSTRAINT %I',
      constraint_record.conname
    );
  END LOOP;

  IF EXISTS (
    SELECT tenant_id, email
    FROM public.app_users
    GROUP BY tenant_id, email
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'APP_USER_RECONCILIATION_REQUIRED: duplicate tenant/email identities exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.app_users'::regclass
      AND conname = 'app_users_tenant_email_unique'
  ) THEN
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_tenant_email_unique UNIQUE (tenant_id, email);
  END IF;
END
$app_user_email_contract$;

DO $item_relations$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.items'::regclass
      AND conname = 'items_tenant_customer_fk'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_tenant_customer_fk
      FOREIGN KEY (tenant_id, customer_id)
      REFERENCES public.customers (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;
END
$item_relations$;

CREATE TABLE IF NOT EXISTS public.qs (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  tenant_id varchar(50) NOT NULL DEFAULT 'galvanik-kreile',
  order_id text NOT NULL,
  ergebnis varchar(50) NOT NULL,
  pruefer text,
  datum timestamp without time zone NOT NULL DEFAULT now(),
  bemerkung text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT qs_tenant_order_fkey
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS qs_tenant_order_date_idx
  ON public.qs (tenant_id, order_id, datum DESC);

ALTER TABLE public.qs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qs FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.qs
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.qs TO service_role;
