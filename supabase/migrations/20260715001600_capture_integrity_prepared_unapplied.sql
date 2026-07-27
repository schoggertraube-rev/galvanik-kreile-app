-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Makes operational time/material capture tenant-bound, atomic and idempotent.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $required_contracts$
BEGIN
  IF to_regclass('public.inventory_items') IS NULL
     OR to_regclass('public.stock_movements') IS NULL
     OR to_regclass('public.arbeitszeit_buchung') IS NULL
     OR to_regclass('public.audit_log') IS NULL
     OR to_regclass('public.vorlage_zeit') IS NULL
     OR to_regclass('public.vorlage_verbrauch') IS NULL
     OR to_regclass('public.kostensatz_default') IS NULL
     OR to_regclass('public.teile_klassifikator') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.app_users') IS NULL THEN
    RAISE EXCEPTION 'The reconciled inventory, capture, order and actor relations are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items'
      AND column_name = 'tenant_id' AND data_type = 'text' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items'
      AND column_name = 'current_stock' AND data_type = 'numeric'
      AND numeric_precision = 14 AND numeric_scale = 4 AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventory_items'::regclass
      AND conname = 'inventory_items_current_stock_nonnegative' AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.stock_movements'::regclass
      AND conname = 'stock_movements_tenant_inventory_fk' AND convalidated
  ) THEN
    RAISE EXCEPTION 'Apply and verify the inventory contract reconciliation before capture integrity';
  END IF;
END
$required_contracts$;

ALTER TABLE public.arbeitszeit_buchung
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

DO $audit_tenant_source_consistency$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.audit_log audit
    JOIN public.app_users actor ON actor.id = audit.actor_id
    WHERE actor.tenant_id IS NULL
       OR btrim(actor.tenant_id) = ''
       OR (
         audit.tenant_id IS NOT NULL
         AND btrim(audit.tenant_id) <> ''
         AND audit.tenant_id <> actor.tenant_id
       )
       OR (
         audit.payload->>'tenant_id' IS NOT NULL
         AND btrim(audit.payload->>'tenant_id') <> ''
         AND audit.payload->>'tenant_id' <> actor.tenant_id
       )
  ) THEN
    RAISE EXCEPTION 'Legacy audit tenant sources conflict with their actor';
  END IF;
END
$audit_tenant_source_consistency$;

-- An actor is a relational tenant proof: app_users.id is unique and the later
-- composite FK validates the inferred tenant/actor pair.
UPDATE public.audit_log audit
SET tenant_id = actor.tenant_id
FROM public.app_users actor
WHERE audit.actor_id = actor.id
  AND actor.tenant_id IS NOT NULL
  AND btrim(actor.tenant_id) <> ''
  AND (audit.tenant_id IS NULL OR btrim(audit.tenant_id) = '');

DO $audit_tenant_truth$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
  ) THEN
    RAISE EXCEPTION 'Legacy audit rows need a proven tenant before capture integrity';
  END IF;
END
$audit_tenant_truth$;

ALTER TABLE public.audit_log
  ALTER COLUMN tenant_id DROP DEFAULT,
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

DO $capture_writer_shape$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('arbeitszeit_buchung', 'id', 'uuid', 'NO'),
      ('arbeitszeit_buchung', 'tenant_id', 'text', 'NO'),
      ('arbeitszeit_buchung', 'auftrag_id', 'text', 'NO'),
      ('arbeitszeit_buchung', 'employee_id', 'uuid', 'NO'),
      ('arbeitszeit_buchung', 'kostenstelle_kuerzel', 'text', 'NO'),
      ('arbeitszeit_buchung', 'station_kuerzel', 'text', 'NO'),
      ('arbeitszeit_buchung', 'start_zeit', 'timestamp with time zone', 'NO'),
      ('arbeitszeit_buchung', 'end_zeit', 'timestamp with time zone', 'YES'),
      ('arbeitszeit_buchung', 'dauer_minuten', 'integer', 'NO'),
      ('arbeitszeit_buchung', 'kostensatz_eur_pro_stunde', 'numeric', 'NO'),
      ('arbeitszeit_buchung', 'erfasst_modus', 'text', 'NO'),
      ('arbeitszeit_buchung', 'war_aus_vorlage', 'boolean', 'YES'),
      ('arbeitszeit_buchung', 'vorlage_id', 'uuid', 'YES'),
      ('arbeitszeit_buchung', 'bemerkung', 'text', 'YES'),
      ('arbeitszeit_buchung', 'erstellt_am', 'timestamp with time zone', 'YES'),
      ('arbeitszeit_buchung', 'aktualisiert_am', 'timestamp with time zone', 'YES'),
      ('arbeitszeit_buchung', 'client_request_id', 'uuid', 'YES'),
      ('audit_log', 'id', 'text', 'NO'),
      ('audit_log', 'tenant_id', 'text', 'NO'),
      ('audit_log', 'client_request_id', 'uuid', 'YES'),
      ('audit_log', 'action', 'text', 'NO'),
      ('audit_log', 'table_name', 'text', 'YES'),
      ('audit_log', 'record_id', 'text', 'YES'),
      ('audit_log', 'actor_id', 'uuid', 'YES'),
      ('audit_log', 'payload', 'jsonb', 'YES'),
      ('audit_log', 'created_at', 'timestamp with time zone', 'NO'),
      ('vorlage_zeit', 'id', 'uuid', 'NO'),
      ('vorlage_zeit', 'tenant_id', 'text', 'NO'),
      ('vorlage_zeit', 'schluessel', 'text', 'NO'),
      ('vorlage_zeit', 'teilekategorie', 'text', 'YES'),
      ('vorlage_zeit', 'oberflaeche', 'text', 'YES'),
      ('vorlage_zeit', 'station_kuerzel', 'text', 'NO'),
      ('vorlage_zeit', 'median_minuten', 'numeric', 'NO'),
      ('vorlage_zeit', 'p25_minuten', 'numeric', 'YES'),
      ('vorlage_zeit', 'p75_minuten', 'numeric', 'YES'),
      ('vorlage_zeit', 'n_referenzauftraege', 'integer', 'NO'),
      ('vorlage_zeit', 'letzte_aktualisierung', 'timestamp with time zone', 'YES'),
      ('vorlage_verbrauch', 'id', 'uuid', 'NO'),
      ('vorlage_verbrauch', 'tenant_id', 'text', 'NO'),
      ('vorlage_verbrauch', 'schluessel', 'text', 'NO'),
      ('vorlage_verbrauch', 'teilekategorie', 'text', 'YES'),
      ('vorlage_verbrauch', 'oberflaeche', 'text', 'YES'),
      ('vorlage_verbrauch', 'station_kuerzel', 'text', 'NO'),
      ('vorlage_verbrauch', 'inventory_item_id', 'text', 'NO'),
      ('vorlage_verbrauch', 'einheit_normiert', 'text', 'NO'),
      ('vorlage_verbrauch', 'median_menge', 'numeric', 'NO'),
      ('vorlage_verbrauch', 'p25_menge', 'numeric', 'YES'),
      ('vorlage_verbrauch', 'p75_menge', 'numeric', 'YES'),
      ('vorlage_verbrauch', 'n_referenzauftraege', 'integer', 'NO'),
      ('vorlage_verbrauch', 'haeufigkeit_prozent', 'numeric', 'YES'),
      ('vorlage_verbrauch', 'letzte_aktualisierung', 'timestamp with time zone', 'YES'),
      ('kostensatz_default', 'tenant_id', 'text', 'NO'),
      ('kostensatz_default', 'station_kuerzel', 'text', 'NO'),
      ('kostensatz_default', 'eur_pro_stunde', 'numeric', 'NO'),
      ('kostensatz_default', 'gilt_ab', 'date', 'NO'),
      ('kostensatz_default', 'bemerkung', 'text', 'YES'),
      ('teile_klassifikator', 'id', 'uuid', 'NO'),
      ('teile_klassifikator', 'tenant_id', 'text', 'NO'),
      ('teile_klassifikator', 'klasse', 'text', 'NO'),
      ('teile_klassifikator', 'keywords', 'ARRAY', 'NO'),
      ('teile_klassifikator', 'beispiel_oberflaechen', 'ARRAY', 'YES'),
      ('capture_request_receipts', 'id', 'uuid', 'NO'),
      ('capture_request_receipts', 'tenant_id', 'text', 'NO'),
      ('capture_request_receipts', 'client_request_id', 'uuid', 'NO'),
      ('capture_request_receipts', 'kind', 'text', 'NO'),
      ('capture_request_receipts', 'actor_id', 'uuid', 'NO'),
      ('capture_request_receipts', 'order_id', 'text', 'NO'),
      ('capture_request_receipts', 'station_kuerzel', 'text', 'YES'),
      ('capture_request_receipts', 'request_hash', 'text', 'NO'),
      ('capture_request_receipts', 'result', 'jsonb', 'YES'),
      ('capture_request_receipts', 'created_at', 'timestamp with time zone', 'NO'),
      ('capture_request_receipts', 'completed_at', 'timestamp with time zone', 'YES')
    ) AS required(table_name, column_name, data_type, nullable)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns column_value
      WHERE column_value.table_schema = 'public'
        AND column_value.table_name = required.table_name
        AND column_value.column_name = required.column_name
        AND column_value.data_type = required.data_type
        AND column_value.is_nullable = required.nullable
        AND CASE
          WHEN required.column_name IN (
            'kostensatz_eur_pro_stunde', 'eur_pro_stunde',
            'median_minuten', 'p25_minuten', 'p75_minuten'
          ) THEN column_value.numeric_precision = 8 AND column_value.numeric_scale = 2
          WHEN required.column_name IN ('median_menge', 'p25_menge', 'p75_menge')
            THEN column_value.numeric_precision = 10 AND column_value.numeric_scale = 4
          WHEN required.column_name = 'haeufigkeit_prozent'
            THEN column_value.numeric_precision = 5 AND column_value.numeric_scale = 2
          ELSE TRUE
        END
    )
  ) THEN
    RAISE EXCEPTION 'Capture writer columns do not match the canonical write contract';
  END IF;

	  IF EXISTS (
	    SELECT 1 FROM pg_constraint
	    WHERE conrelid = 'public.arbeitszeit_buchung'::regclass AND contype = 'p'
      AND conkey <> ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.arbeitszeit_buchung'::regclass AND attname = 'id')
      ]::smallint[]
	  ) OR EXISTS (
	    SELECT 1 FROM pg_constraint
	    WHERE conrelid = 'public.audit_log'::regclass AND contype = 'p'
	      AND conkey <> ARRAY[
	        (SELECT attnum FROM pg_attribute
	         WHERE attrelid = 'public.audit_log'::regclass AND attname = 'id')
	      ]::smallint[]
	  ) OR EXISTS (
	    SELECT 1 FROM pg_constraint
	    WHERE conrelid = 'public.capture_request_receipts'::regclass AND contype = 'p'
      AND conkey <> ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.capture_request_receipts'::regclass AND attname = 'id')
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Capture writer tables contain a conflicting primary key';
  END IF;
END
$capture_writer_shape$;

ALTER TABLE public.arbeitszeit_buchung
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN erstellt_am SET DEFAULT now(),
  ALTER COLUMN aktualisiert_am SET DEFAULT now();
ALTER TABLE public.audit_log
  ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text,
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.capture_request_receipts
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

DO $capture_writer_primary_keys$
BEGIN
	  IF NOT EXISTS (
	    SELECT 1 FROM pg_constraint
	    WHERE conrelid = 'public.arbeitszeit_buchung'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.arbeitszeit_buchung
	      ADD CONSTRAINT arbeitszeit_buchung_pkey PRIMARY KEY (id);
	  END IF;
	  IF NOT EXISTS (
	    SELECT 1 FROM pg_constraint
	    WHERE conrelid = 'public.audit_log'::regclass AND contype = 'p'
	  ) THEN
	    ALTER TABLE public.audit_log
	      ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
	  END IF;
	  IF NOT EXISTS (
	    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.capture_request_receipts'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.capture_request_receipts
      ADD CONSTRAINT capture_request_receipts_pkey PRIMARY KEY (id);
  END IF;
END
$capture_writer_primary_keys$;

CREATE UNIQUE INDEX IF NOT EXISTS capture_request_receipts_tenant_request_kind_uidx
  ON public.capture_request_receipts (tenant_id, client_request_id, kind);
CREATE INDEX IF NOT EXISTS capture_request_receipts_tenant_order_created_idx
  ON public.capture_request_receipts (tenant_id, order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS arbeitszeit_buchung_tenant_order_idx
  ON public.arbeitszeit_buchung (tenant_id, auftrag_id, erstellt_am DESC);
CREATE INDEX IF NOT EXISTS arbeitszeit_buchung_tenant_request_idx
  ON public.arbeitszeit_buchung (tenant_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audit_log_tenant_request_action_uidx
  ON public.audit_log (tenant_id, client_request_id, action)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON public.audit_log (tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS vorlage_zeit_tenant_id_uidx
  ON public.vorlage_zeit (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS vorlage_verbrauch_tenant_id_uidx
  ON public.vorlage_verbrauch (tenant_id, id);

DO $relation_truth$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.arbeitszeit_buchung
    WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
       OR kostensatz_eur_pro_stunde::text IN ('NaN', 'Infinity', '-Infinity')
       OR kostensatz_eur_pro_stunde < 0 OR dauer_minuten < 0
       OR NOT (
         (vorlage_id IS NULL AND war_aus_vorlage IS DISTINCT FROM TRUE)
         OR (vorlage_id IS NOT NULL AND war_aus_vorlage IS TRUE)
       )
  ) OR EXISTS (
    SELECT 1 FROM public.vorlage_zeit
    WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
  ) OR EXISTS (
    SELECT 1 FROM public.vorlage_verbrauch
    WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
  ) OR EXISTS (
    SELECT 1 FROM public.kostensatz_default
    WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
       OR eur_pro_stunde::text IN ('NaN', 'Infinity', '-Infinity')
       OR eur_pro_stunde < 0
  ) OR EXISTS (
    SELECT 1 FROM public.teile_klassifikator
    WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
  ) THEN
    RAISE EXCEPTION 'Capture reference rows contain missing tenants or invalid numeric truth';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.arbeitszeit_buchung row_value
    LEFT JOIN public.orders parent
      ON parent.tenant_id = row_value.tenant_id AND parent.id = row_value.auftrag_id
    WHERE parent.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.arbeitszeit_buchung row_value
    LEFT JOIN public.app_users parent
      ON parent.tenant_id = row_value.tenant_id AND parent.id = row_value.employee_id
    WHERE parent.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.arbeitszeit_buchung row_value
    LEFT JOIN public.vorlage_zeit parent
      ON parent.tenant_id = row_value.tenant_id AND parent.id = row_value.vorlage_id
    WHERE row_value.vorlage_id IS NOT NULL AND parent.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.vorlage_verbrauch row_value
    LEFT JOIN public.inventory_items parent
      ON parent.tenant_id = row_value.tenant_id AND parent.id = row_value.inventory_item_id
    WHERE parent.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.stock_movements row_value
    LEFT JOIN public.vorlage_verbrauch parent
      ON parent.tenant_id = row_value.tenant_id AND parent.id = row_value.vorlage_id
    WHERE row_value.vorlage_id IS NOT NULL AND parent.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.capture_request_receipts row_value
    LEFT JOIN public.orders parent
      ON parent.tenant_id = row_value.tenant_id AND parent.id = row_value.order_id
    WHERE parent.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.capture_request_receipts row_value
    LEFT JOIN public.app_users parent
      ON parent.tenant_id = row_value.tenant_id AND parent.id = row_value.actor_id
    WHERE parent.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.audit_log row_value
    LEFT JOIN public.app_users parent
      ON parent.tenant_id = row_value.tenant_id AND parent.id = row_value.actor_id
    WHERE row_value.actor_id IS NOT NULL AND parent.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Capture relations contain dangling or cross-tenant references';
  END IF;
END
$relation_truth$;

DO $drop_capture_foreign_keys$
DECLARE
  relation_name text;
  constraint_name text;
BEGIN
  FOR relation_name, constraint_name IN
    SELECT DISTINCT relation.relname, constraint_row.conname
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN LATERAL unnest(constraint_row.conkey) key(attnum) ON true
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_row.conrelid AND attribute.attnum = key.attnum
    WHERE namespace.nspname = 'public'
      AND constraint_row.contype = 'f'
      AND (
        (relation.relname = 'arbeitszeit_buchung'
          AND attribute.attname IN ('auftrag_id', 'employee_id', 'vorlage_id'))
        OR (relation.relname = 'vorlage_verbrauch' AND attribute.attname = 'inventory_item_id')
        OR (relation.relname = 'capture_request_receipts'
          AND attribute.attname IN ('actor_id', 'order_id'))
        OR (relation.relname = 'audit_log' AND attribute.attname = 'actor_id')
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', relation_name, constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT DISTINCT constraint_row.conname
    FROM pg_constraint constraint_row
    JOIN LATERAL unnest(constraint_row.conkey) key(attnum) ON true
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_row.conrelid AND attribute.attnum = key.attnum
    WHERE constraint_row.conrelid = 'public.stock_movements'::regclass
      AND constraint_row.contype = 'f'
      AND attribute.attname = 'vorlage_id'
  LOOP
    EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END
$drop_capture_foreign_keys$;

ALTER TABLE public.arbeitszeit_buchung
  ADD CONSTRAINT arbeitszeit_buchung_tenant_order_fk
    FOREIGN KEY (tenant_id, auftrag_id)
    REFERENCES public.orders(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT arbeitszeit_buchung_tenant_employee_fk
    FOREIGN KEY (tenant_id, employee_id)
    REFERENCES public.app_users(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT arbeitszeit_buchung_tenant_template_fk
    FOREIGN KEY (tenant_id, vorlage_id)
    REFERENCES public.vorlage_zeit(tenant_id, id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.vorlage_verbrauch
  ADD CONSTRAINT vorlage_verbrauch_tenant_inventory_fk
    FOREIGN KEY (tenant_id, inventory_item_id)
    REFERENCES public.inventory_items(tenant_id, id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_tenant_template_fk
    FOREIGN KEY (tenant_id, vorlage_id)
    REFERENCES public.vorlage_verbrauch(tenant_id, id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.capture_request_receipts
  ADD CONSTRAINT capture_request_receipts_tenant_actor_fk
    FOREIGN KEY (tenant_id, actor_id)
    REFERENCES public.app_users(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT capture_request_receipts_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders(tenant_id, id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_tenant_actor_fk
    FOREIGN KEY (tenant_id, actor_id)
    REFERENCES public.app_users(tenant_id, id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_tenant_order_fk;
ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_tenant_employee_fk;
ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_tenant_template_fk;
ALTER TABLE public.vorlage_verbrauch VALIDATE CONSTRAINT vorlage_verbrauch_tenant_inventory_fk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_tenant_template_fk;
ALTER TABLE public.capture_request_receipts VALIDATE CONSTRAINT capture_request_receipts_tenant_actor_fk;
ALTER TABLE public.capture_request_receipts VALIDATE CONSTRAINT capture_request_receipts_tenant_order_fk;
ALTER TABLE public.audit_log VALIDATE CONSTRAINT audit_log_tenant_actor_fk;

ALTER TABLE public.arbeitszeit_buchung
  DROP CONSTRAINT IF EXISTS arbeitszeit_buchung_duration_nonnegative,
  DROP CONSTRAINT IF EXISTS arbeitszeit_buchung_rate_nonnegative,
  DROP CONSTRAINT IF EXISTS arbeitszeit_buchung_template_provenance_chk,
  DROP CONSTRAINT IF EXISTS arbeitszeit_buchung_tenant_nonblank_chk;
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_tenant_nonblank_chk;
ALTER TABLE public.vorlage_zeit
  DROP CONSTRAINT IF EXISTS vorlage_zeit_tenant_nonblank_chk;
ALTER TABLE public.vorlage_verbrauch
  DROP CONSTRAINT IF EXISTS vorlage_verbrauch_tenant_nonblank_chk;
ALTER TABLE public.kostensatz_default
  DROP CONSTRAINT IF EXISTS kostensatz_default_tenant_nonblank_chk,
  DROP CONSTRAINT IF EXISTS kostensatz_default_rate_valid_chk;
ALTER TABLE public.teile_klassifikator
  DROP CONSTRAINT IF EXISTS teile_klassifikator_tenant_nonblank_chk;
ALTER TABLE public.capture_request_receipts
  DROP CONSTRAINT IF EXISTS capture_request_receipts_kind_check,
  DROP CONSTRAINT IF EXISTS capture_request_receipts_hash_check,
  DROP CONSTRAINT IF EXISTS capture_request_receipts_completion_chk,
  DROP CONSTRAINT IF EXISTS capture_request_receipts_tenant_nonblank_chk;

ALTER TABLE public.arbeitszeit_buchung
  ADD CONSTRAINT arbeitszeit_buchung_duration_nonnegative
    CHECK (dauer_minuten >= 0) NOT VALID,
  ADD CONSTRAINT arbeitszeit_buchung_rate_nonnegative
    CHECK (
      kostensatz_eur_pro_stunde::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND kostensatz_eur_pro_stunde >= 0
    ) NOT VALID,
  ADD CONSTRAINT arbeitszeit_buchung_template_provenance_chk
    CHECK (
      (vorlage_id IS NULL AND war_aus_vorlage IS DISTINCT FROM TRUE)
      OR (vorlage_id IS NOT NULL AND war_aus_vorlage IS TRUE)
    ) NOT VALID,
  ADD CONSTRAINT arbeitszeit_buchung_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID;
ALTER TABLE public.vorlage_zeit
  ADD CONSTRAINT vorlage_zeit_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID;
ALTER TABLE public.vorlage_verbrauch
  ADD CONSTRAINT vorlage_verbrauch_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID;
ALTER TABLE public.kostensatz_default
  ADD CONSTRAINT kostensatz_default_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID,
  ADD CONSTRAINT kostensatz_default_rate_valid_chk
    CHECK (
      eur_pro_stunde::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND eur_pro_stunde >= 0
    ) NOT VALID;
ALTER TABLE public.teile_klassifikator
  ADD CONSTRAINT teile_klassifikator_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID;
ALTER TABLE public.capture_request_receipts
  ADD CONSTRAINT capture_request_receipts_kind_check
    CHECK (kind IN ('time', 'material', 'template', 'station_completion')) NOT VALID,
  ADD CONSTRAINT capture_request_receipts_hash_check
    CHECK (request_hash ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT capture_request_receipts_completion_chk
    CHECK (
      isfinite(created_at)
      AND (result IS NULL) = (completed_at IS NULL)
      AND (completed_at IS NULL OR (isfinite(completed_at) AND completed_at >= created_at))
    ) NOT VALID,
  ADD CONSTRAINT capture_request_receipts_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID;

ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_duration_nonnegative;
ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_rate_nonnegative;
ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_template_provenance_chk;
ALTER TABLE public.arbeitszeit_buchung VALIDATE CONSTRAINT arbeitszeit_buchung_tenant_nonblank_chk;
ALTER TABLE public.audit_log VALIDATE CONSTRAINT audit_log_tenant_nonblank_chk;
ALTER TABLE public.vorlage_zeit VALIDATE CONSTRAINT vorlage_zeit_tenant_nonblank_chk;
ALTER TABLE public.vorlage_verbrauch VALIDATE CONSTRAINT vorlage_verbrauch_tenant_nonblank_chk;
ALTER TABLE public.kostensatz_default VALIDATE CONSTRAINT kostensatz_default_tenant_nonblank_chk;
ALTER TABLE public.kostensatz_default VALIDATE CONSTRAINT kostensatz_default_rate_valid_chk;
ALTER TABLE public.teile_klassifikator VALIDATE CONSTRAINT teile_klassifikator_tenant_nonblank_chk;
ALTER TABLE public.capture_request_receipts VALIDATE CONSTRAINT capture_request_receipts_kind_check;
ALTER TABLE public.capture_request_receipts VALIDATE CONSTRAINT capture_request_receipts_hash_check;
ALTER TABLE public.capture_request_receipts VALIDATE CONSTRAINT capture_request_receipts_completion_chk;
ALTER TABLE public.capture_request_receipts VALIDATE CONSTRAINT capture_request_receipts_tenant_nonblank_chk;

CREATE OR REPLACE FUNCTION public.enforce_capture_request_receipt_write_once()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.result IS NOT NULL OR NEW.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Capture receipts must be inserted pending';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.result IS NOT NULL OR OLD.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Completed capture receipts are immutable';
  END IF;
  IF NEW.result IS NULL OR NEW.completed_at IS NULL
     OR NOT isfinite(NEW.created_at) OR NOT isfinite(NEW.completed_at)
     OR NEW.completed_at < NEW.created_at THEN
    RAISE EXCEPTION 'Capture receipts may only transition from pending to completed';
  END IF;
  IF NEW.result->>'requestId' IS DISTINCT FROM NEW.client_request_id::text
     OR NEW.result->>'kind' IS DISTINCT FROM NEW.kind
     OR NEW.result->>'orderId' IS DISTINCT FROM NEW.order_id THEN
    RAISE EXCEPTION 'Capture receipt result identity does not match its ledger row';
  END IF;
  IF jsonb_typeof(NEW.result) IS DISTINCT FROM 'object'
     OR jsonb_typeof(NEW.result->'timeBookingIds') IS DISTINCT FROM 'array'
     OR jsonb_typeof(NEW.result->'movementIds') IS DISTINCT FROM 'array'
     OR jsonb_typeof(NEW.result->'timeCostEur') IS DISTINCT FROM 'number'
     OR jsonb_typeof(NEW.result->'materialCostEur') IS DISTINCT FROM 'number'
     OR jsonb_typeof(NEW.result->'createdAt') IS DISTINCT FROM 'string'
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(NEW.result->'timeBookingIds') item
       WHERE jsonb_typeof(item) IS DISTINCT FROM 'string'
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(NEW.result->'movementIds') item
       WHERE jsonb_typeof(item) IS DISTINCT FROM 'string'
     ) THEN
    RAISE EXCEPTION 'Capture receipt result shape is invalid';
  END IF;
  IF (NEW.result->>'timeCostEur')::numeric < 0
     OR (NEW.result->>'timeCostEur')::numeric > 1000000000
     OR (NEW.result->>'materialCostEur')::numeric < 0
     OR (NEW.result->>'materialCostEur')::numeric > 1000000000 THEN
    RAISE EXCEPTION 'Capture receipt costs must be finite and nonnegative';
  END IF;
  IF NOT isfinite((NEW.result->>'createdAt')::timestamptz) THEN
    RAISE EXCEPTION 'Capture receipt result time must be finite';
  END IF;
  IF (NEW.result->>'createdAt')::timestamptz < NEW.created_at - interval '5 minutes'
     OR (NEW.result->>'createdAt')::timestamptz > NEW.completed_at + interval '5 minutes' THEN
    RAISE EXCEPTION 'Capture receipt result time is outside the completion window';
  END IF;
  IF NEW.kind = 'station_completion' AND (
    jsonb_typeof(NEW.result->'completedStation') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW.result->'newStation') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW.result->'newStatus') IS DISTINCT FROM 'string'
    OR jsonb_typeof(NEW.result->'eventId') IS DISTINCT FROM 'string'
  ) THEN
    RAISE EXCEPTION 'Station completion receipt is incomplete';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.station_kuerzel IS DISTINCT FROM OLD.station_kuerzel
     OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Capture receipt identity is immutable';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.enforce_capture_request_receipt_write_once() FROM PUBLIC;
DO $receipt_function_boundary$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF to_regrole(role_name) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION public.enforce_capture_request_receipt_write_once() FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$receipt_function_boundary$;
DROP TRIGGER IF EXISTS capture_request_receipts_write_once_trg
  ON public.capture_request_receipts;
CREATE TRIGGER capture_request_receipts_write_once_trg
  BEFORE INSERT OR UPDATE ON public.capture_request_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_capture_request_receipt_write_once();

DO $boundary$
DECLARE
  relation_name text;
  client_role text;
  policy_name text;
  column_name text;
  privilege_name text;
  protected_relations constant text[] := ARRAY[
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
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', relation_name);
      FOR policy_name IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = relation_name
      LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', policy_name, relation_name);
      END LOOP;
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', relation_name);
      FOREACH column_name IN ARRAY ARRAY(
        SELECT attribute.attname::text
        FROM pg_attribute attribute
        WHERE attribute.attrelid = format('public.%I', relation_name)::regclass
          AND attribute.attnum > 0 AND NOT attribute.attisdropped
      ) LOOP
        FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
          EXECUTE format(
            'REVOKE %s (%I) ON TABLE public.%I FROM PUBLIC',
            privilege_name, column_name, relation_name
          );
        END LOOP;
      END LOOP;
      FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF to_regrole(client_role) IS NOT NULL THEN
          EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', relation_name, client_role);
          FOREACH column_name IN ARRAY ARRAY(
            SELECT attribute.attname::text
            FROM pg_attribute attribute
            WHERE attribute.attrelid = format('public.%I', relation_name)::regclass
              AND attribute.attnum > 0 AND NOT attribute.attisdropped
          ) LOOP
            FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
              EXECUTE format(
                'REVOKE %s (%I) ON TABLE public.%I FROM %I',
                privilege_name, column_name, relation_name, client_role
              );
            END LOOP;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'service_role' AND rolbypassrls AND NOT rolsuper
  ) THEN
    RAISE EXCEPTION 'A non-superuser service_role with BYPASSRLS is required';
  END IF;
  GRANT SELECT, INSERT ON TABLE public.arbeitszeit_buchung TO service_role;
	  GRANT INSERT (
	    tenant_id, client_request_id, action, table_name, record_id, actor_id, payload
	  ) ON TABLE public.audit_log TO service_role;
  GRANT SELECT ON TABLE public.vorlage_zeit TO service_role;
  GRANT SELECT ON TABLE public.vorlage_verbrauch TO service_role;
  GRANT SELECT ON TABLE public.kostensatz_default TO service_role;
  GRANT SELECT ON TABLE public.teile_klassifikator TO service_role;
  GRANT SELECT ON TABLE public.capture_request_receipts TO service_role;
  GRANT INSERT (
    tenant_id, client_request_id, kind, actor_id, order_id, station_kuerzel, request_hash
  ) ON TABLE public.capture_request_receipts TO service_role;
  GRANT UPDATE (result, completed_at) ON TABLE public.capture_request_receipts TO service_role;
END
$boundary$;

DO $verification$
DECLARE
  relation_name text;
  client_role text;
  privilege_name text;
  protected_relations constant text[] := ARRAY[
    'arbeitszeit_buchung', 'audit_log', 'vorlage_zeit', 'vorlage_verbrauch',
    'kostensatz_default', 'teile_klassifikator', 'capture_request_receipts'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.arbeitszeit_buchung'::regclass
      AND constraint_row.contype = 'p' AND constraint_row.convalidated
      AND constraint_row.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.arbeitszeit_buchung'::regclass AND attname = 'id')
      ]::smallint[]
	  ) OR NOT EXISTS (
	    SELECT 1 FROM pg_constraint constraint_row
	    WHERE constraint_row.conrelid = 'public.audit_log'::regclass
	      AND constraint_row.contype = 'p' AND constraint_row.convalidated
	      AND constraint_row.conkey = ARRAY[
	        (SELECT attnum FROM pg_attribute
	         WHERE attrelid = 'public.audit_log'::regclass AND attname = 'id')
	      ]::smallint[]
	  ) OR NOT EXISTS (
	    SELECT 1 FROM pg_constraint constraint_row
	    WHERE constraint_row.conrelid = 'public.capture_request_receipts'::regclass
      AND constraint_row.contype = 'p' AND constraint_row.convalidated
      AND constraint_row.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.capture_request_receipts'::regclass AND attname = 'id')
      ]::smallint[]
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'arbeitszeit_buchung'
      AND column_name = 'id' AND column_default ILIKE '%gen_random_uuid()%'
	  ) OR NOT EXISTS (
	    SELECT 1 FROM information_schema.columns
	    WHERE table_schema = 'public' AND table_name = 'audit_log'
	      AND column_name = 'id' AND column_default ILIKE '%gen_random_uuid()%'
	  ) OR NOT EXISTS (
	    SELECT 1 FROM information_schema.columns
	    WHERE table_schema = 'public' AND table_name = 'audit_log'
	      AND column_name = 'created_at' AND column_default ILIKE '%now()%'
	  ) OR NOT EXISTS (
	    SELECT 1 FROM information_schema.columns
	    WHERE table_schema = 'public' AND table_name = 'capture_request_receipts'
      AND column_name = 'id' AND column_default ILIKE '%gen_random_uuid()%'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'capture_request_receipts'
      AND column_name = 'created_at' AND column_default ILIKE '%now()%'
  ) THEN
    RAISE EXCEPTION 'Capture writer identities or defaults are incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger_value
    JOIN pg_class relation ON relation.oid = trigger_value.tgrelid
    JOIN pg_proc function_value ON function_value.oid = trigger_value.tgfoid
    JOIN pg_namespace function_namespace ON function_namespace.oid = function_value.pronamespace
    WHERE relation.oid = 'public.capture_request_receipts'::regclass
      AND trigger_value.tgname = 'capture_request_receipts_write_once_trg'
      AND NOT trigger_value.tgisinternal AND trigger_value.tgenabled = 'O'
      AND pg_get_triggerdef(trigger_value.oid) ILIKE '%BEFORE INSERT OR UPDATE ON public.capture_request_receipts%'
      AND function_namespace.nspname = 'public'
      AND function_value.proname = 'enforce_capture_request_receipt_write_once'
      AND NOT function_value.prosecdef
      AND array_to_string(function_value.proconfig, ',') ILIKE '%search_path%pg_catalog%public%'
      AND pg_get_functiondef(function_value.oid) ILIKE '%OLD.result IS NOT NULL%'
      AND pg_get_functiondef(function_value.oid) ILIKE '%NEW.result IS NULL%'
      AND pg_get_functiondef(function_value.oid) ILIKE '%NEW.request_hash IS DISTINCT FROM OLD.request_hash%'
      AND regexp_replace(pg_get_functiondef(function_value.oid), '[[:space:]]+', '', 'g')
        ILIKE '%NEW.result->>''requestId''%'
      AND pg_get_functiondef(function_value.oid) ILIKE '%jsonb_typeof%timeCostEur%'
      AND NOT EXISTS (
        SELECT 1
        FROM aclexplode(coalesce(function_value.proacl, acldefault('f', function_value.proowner))) acl
        WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_roles role
        WHERE role.rolname IN ('anon', 'authenticated', 'service_role')
          AND has_function_privilege(role.oid, function_value.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'Capture receipt write-once guard is missing or incomplete';
  END IF;

  FOREACH relation_name IN ARRAY protected_relations LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = relation_name
    ) THEN
      RAISE EXCEPTION '% must have zero browser-callable RLS policies', relation_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public' AND relation.relname = relation_name
        AND relation.relrowsecurity AND relation.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION '% requires forced RLS', relation_name;
    END IF;
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF to_regrole(client_role) IS NOT NULL THEN
        FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
          IF has_table_privilege(client_role, format('public.%I', relation_name), privilege_name) THEN
            RAISE EXCEPTION '% still exposes effective % to %', relation_name, privilege_name, client_role;
          END IF;
        END LOOP;
        FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
          IF has_any_column_privilege(client_role, format('public.%I', relation_name), privilege_name) THEN
            RAISE EXCEPTION '% still exposes effective column % to %', relation_name, privilege_name, client_role;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT has_table_privilege('service_role', 'public.arbeitszeit_buchung', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.arbeitszeit_buchung', 'INSERT')
     OR has_table_privilege('service_role', 'public.arbeitszeit_buchung', 'UPDATE')
	     OR has_table_privilege('service_role', 'public.audit_log', 'INSERT')
	     OR has_table_privilege('service_role', 'public.audit_log', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.capture_request_receipts', 'SELECT')
     OR has_table_privilege('service_role', 'public.capture_request_receipts', 'INSERT')
     OR has_table_privilege('service_role', 'public.capture_request_receipts', 'UPDATE')
     OR NOT has_column_privilege('service_role', 'public.capture_request_receipts', 'result', 'UPDATE')
     OR NOT has_column_privilege('service_role', 'public.capture_request_receipts', 'completed_at', 'UPDATE') THEN
    RAISE EXCEPTION 'Capture service-role grants are missing or overprivileged';
  END IF;

  FOREACH relation_name IN ARRAY protected_relations LOOP
    FOREACH privilege_name IN ARRAY ARRAY['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege('service_role', format('public.%I', relation_name), privilege_name) THEN
        RAISE EXCEPTION 'Capture relation % exposes unexpected service-role %', relation_name, privilege_name;
      END IF;
    END LOOP;
    IF has_any_column_privilege('service_role', format('public.%I', relation_name), 'REFERENCES') THEN
      RAISE EXCEPTION 'Capture relation % exposes unexpected service-role column REFERENCES', relation_name;
    END IF;
  END LOOP;

	  IF EXISTS (
	    SELECT 1
	    FROM pg_attribute attribute
	    WHERE attribute.attrelid = 'public.audit_log'::regclass
	      AND attribute.attnum > 0 AND NOT attribute.attisdropped
	      AND attribute.attname NOT IN (
	        'tenant_id', 'client_request_id', 'action', 'table_name',
	        'record_id', 'actor_id', 'payload'
	      )
	      AND has_column_privilege(
	        'service_role', 'public.audit_log', attribute.attnum, 'INSERT'
	      )
	  ) OR EXISTS (
	    SELECT 1
	    FROM unnest(ARRAY[
	      'tenant_id', 'client_request_id', 'action', 'table_name',
	      'record_id', 'actor_id', 'payload'
	    ]) column_name
	    WHERE NOT has_column_privilege(
	      'service_role', 'public.audit_log', column_name, 'INSERT'
	    )
	  ) THEN
	    RAISE EXCEPTION 'Audit INSERT columns are missing or overprivileged';
	  END IF;

	  IF EXISTS (
	    SELECT 1
	    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.capture_request_receipts'::regclass
      AND attribute.attnum > 0 AND NOT attribute.attisdropped
      AND attribute.attname NOT IN ('result', 'completed_at')
      AND has_column_privilege(
        'service_role', 'public.capture_request_receipts', attribute.attnum, 'UPDATE'
      )
  ) OR EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'arbeitszeit_buchung', 'audit_log', 'vorlage_zeit', 'vorlage_verbrauch',
      'kostensatz_default', 'teile_klassifikator'
    ]) relation_value
    JOIN pg_class relation ON relation.oid = format('public.%I', relation_value)::regclass
    JOIN pg_attribute attribute
      ON attribute.attrelid = relation.oid
      AND attribute.attnum > 0 AND NOT attribute.attisdropped
    WHERE has_column_privilege('service_role', relation.oid, attribute.attnum, 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'Capture service-role has an inherited or direct column overgrant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.audit_log'::regclass
      AND attribute.attnum > 0 AND NOT attribute.attisdropped
      AND has_column_privilege('service_role', 'public.audit_log', attribute.attnum, 'SELECT')
  ) OR EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'vorlage_zeit', 'vorlage_verbrauch', 'kostensatz_default', 'teile_klassifikator'
    ]) relation_value
    JOIN pg_class relation ON relation.oid = format('public.%I', relation_value)::regclass
    JOIN pg_attribute attribute
      ON attribute.attrelid = relation.oid
      AND attribute.attnum > 0 AND NOT attribute.attisdropped
    WHERE has_column_privilege('service_role', relation.oid, attribute.attnum, 'INSERT')
       OR has_column_privilege('service_role', relation.oid, attribute.attnum, 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'Capture reference/audit columns have inherited or direct overgrants';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.capture_request_receipts'::regclass
      AND attribute.attnum > 0 AND NOT attribute.attisdropped
      AND attribute.attname NOT IN (
        'tenant_id', 'client_request_id', 'kind', 'actor_id',
        'order_id', 'station_kuerzel', 'request_hash'
      )
      AND has_column_privilege(
        'service_role', 'public.capture_request_receipts', attribute.attnum, 'INSERT'
      )
  ) OR EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'tenant_id', 'client_request_id', 'kind', 'actor_id',
      'order_id', 'station_kuerzel', 'request_hash'
    ]) column_name
    WHERE NOT has_column_privilege(
      'service_role', 'public.capture_request_receipts', column_name, 'INSERT'
    )
  ) THEN
    RAISE EXCEPTION 'Capture receipt INSERT columns are missing or overprivileged';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['vorlage_zeit', 'vorlage_verbrauch', 'kostensatz_default', 'teile_klassifikator']) relation_value
    WHERE NOT has_table_privilege('service_role', format('public.%I', relation_value), 'SELECT')
       OR has_table_privilege('service_role', format('public.%I', relation_value), 'INSERT')
       OR has_table_privilege('service_role', format('public.%I', relation_value), 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'Capture reference tables do not have the exact read-only service-role boundary';
  END IF;

  -- The capture migration must not widen the inventory ledger boundary owned by
  -- the preceding reconciliation.
  IF has_table_privilege('service_role', 'public.inventory_items', 'INSERT')
     OR has_table_privilege('service_role', 'public.inventory_items', 'UPDATE')
     OR NOT has_column_privilege('service_role', 'public.inventory_items', 'current_stock', 'UPDATE')
     OR has_table_privilege('service_role', 'public.stock_movements', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.stock_movements', 'INSERT') THEN
    RAISE EXCEPTION 'Capture integrity widened or broke the inventory service-role boundary';
  END IF;
END
$verification$;
