-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Makes operational time/material capture tenant-bound, atomic and idempotent.

BEGIN;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS tenant_id text;

UPDATE public.inventory_items
SET tenant_id = 'galvanik-kreile'
WHERE tenant_id IS NULL OR btrim(tenant_id) = '';

UPDATE public.inventory_items
SET current_stock = 0
WHERE current_stock IS NULL;

ALTER TABLE public.inventory_items
  ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile',
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN current_stock TYPE numeric(14,4) USING current_stock::numeric,
  ALTER COLUMN current_stock SET DEFAULT 0,
  ALTER COLUMN current_stock SET NOT NULL;

ALTER TABLE public.arbeitszeit_buchung
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

UPDATE public.audit_log
SET tenant_id = COALESCE(NULLIF(payload->>'tenant_id', ''), 'galvanik-kreile')
WHERE tenant_id IS NULL OR btrim(tenant_id) = '';

ALTER TABLE public.audit_log
  ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile',
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.capture_request_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  client_request_id uuid NOT NULL,
  kind text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  station_kuerzel text,
  request_hash text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT capture_request_receipts_kind_check CHECK (kind IN ('time', 'material', 'template', 'station_completion')),
  CONSTRAINT capture_request_receipts_hash_check CHECK (request_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS capture_request_receipts_tenant_request_kind_uidx
  ON public.capture_request_receipts (tenant_id, client_request_id, kind);
CREATE INDEX IF NOT EXISTS capture_request_receipts_tenant_order_created_idx
  ON public.capture_request_receipts (tenant_id, order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS arbeitszeit_buchung_tenant_order_idx
  ON public.arbeitszeit_buchung (tenant_id, auftrag_id, erstellt_am DESC);
CREATE INDEX IF NOT EXISTS arbeitszeit_buchung_tenant_request_idx
  ON public.arbeitszeit_buchung (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_tenant_order_created_idx
  ON public.stock_movements (tenant_id, order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_tenant_request_idx
  ON public.stock_movements (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audit_log_tenant_request_action_uidx
  ON public.audit_log (tenant_id, client_request_id, action)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON public.audit_log (tenant_id, created_at DESC);

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_current_stock_nonnegative') THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_current_stock_nonnegative CHECK (current_stock >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arbeitszeit_buchung_duration_nonnegative') THEN
    ALTER TABLE public.arbeitszeit_buchung
      ADD CONSTRAINT arbeitszeit_buchung_duration_nonnegative CHECK (dauer_minuten >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arbeitszeit_buchung_rate_nonnegative') THEN
    ALTER TABLE public.arbeitszeit_buchung
      ADD CONSTRAINT arbeitszeit_buchung_rate_nonnegative CHECK (kostensatz_eur_pro_stunde >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_quantity_nonzero') THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_quantity_nonzero CHECK (quantity <> 0) NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE public.inventory_items VALIDATE CONSTRAINT inventory_items_current_stock_nonnegative;
ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_duration_nonnegative;
ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_rate_nonnegative;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_quantity_nonzero;

DO $boundary$
DECLARE
  relation_name text;
  client_role text;
  protected_relations constant text[] := ARRAY[
    'inventory_items',
    'stock_movements',
    'arbeitszeit_buchung',
    'audit_log',
    'vorlage_zeit',
    'vorlage_verbrauch',
    'kostensatz_default',
    'teile_klassifikator',
    'capture_request_receipts'
  ];
BEGIN
  FOREACH relation_name IN ARRAY protected_relations LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', relation_name);
      FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
          EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', relation_name, client_role);
        END IF;
      END LOOP;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO service_role', relation_name);
      END IF;
    END IF;
  END LOOP;
END
$boundary$;

COMMIT;
