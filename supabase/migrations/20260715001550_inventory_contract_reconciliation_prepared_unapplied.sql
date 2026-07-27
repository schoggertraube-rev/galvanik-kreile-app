-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Reconciles the canonical inventory ledger without inventing historical stock,
-- units or actors. Ambiguous legacy rows intentionally abort this migration.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $required_relations$
BEGIN
  IF to_regclass('public.inventory_items') IS NULL
     OR to_regclass('public.stock_movements') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.app_users') IS NULL THEN
    RAISE EXCEPTION 'inventory_items, stock_movements, orders and app_users are required';
  END IF;
END
$required_relations$;

DO $identity_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'id'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id'
      AND data_type = 'text' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'id'
      AND data_type = 'uuid' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'id'
      AND data_type = 'uuid' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Inventory identity types require the foundation identity reconciliation first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'inventory_item_id'
      AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'order_id'
      AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'created_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'Inventory relation and timestamp types are not canonical';
  END IF;
END
$identity_contract$;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS einkaufspreis_eur numeric(10,4),
  ADD COLUMN IF NOT EXISTS einheit_normiert text;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS erfasst_von uuid,
  ADD COLUMN IF NOT EXISTS client_request_id uuid,
  ADD COLUMN IF NOT EXISTS kostenstelle_kuerzel text,
  ADD COLUMN IF NOT EXISTS station_kuerzel text,
  ADD COLUMN IF NOT EXISTS war_aus_vorlage boolean,
  ADD COLUMN IF NOT EXISTS vorlage_id uuid,
  ADD COLUMN IF NOT EXISTS snapshot_einkaufspreis_eur numeric(10,4);

UPDATE public.stock_movements movement
SET tenant_id = item.tenant_id
FROM public.inventory_items item
WHERE movement.inventory_item_id = item.id
  AND item.tenant_id IS NOT NULL
  AND btrim(item.tenant_id) <> ''
  AND (movement.tenant_id IS NULL OR btrim(movement.tenant_id) = '');

UPDATE public.stock_movements
SET created_by = erfasst_von
WHERE created_by IS NULL AND erfasst_von IS NOT NULL;

UPDATE public.stock_movements
SET erfasst_von = created_by
WHERE erfasst_von IS NULL AND created_by IS NOT NULL;

DO $truth_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tenant_id'
      AND data_type IN ('text', 'character varying')
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'tenant_id'
      AND data_type IN ('text', 'character varying')
  ) THEN
    RAISE EXCEPTION 'Tenant columns on orders and app_users are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'current_stock'
      AND data_type IN ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision')
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'min_stock'
      AND data_type IN ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision')
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'quantity'
      AND data_type IN ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision')
  ) THEN
    RAISE EXCEPTION 'Inventory numeric columns are missing or non-numeric';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.inventory_items
    WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
       OR name IS NULL OR btrim(name) = ''
       OR current_stock IS NULL
       OR current_stock::text IN ('NaN', 'Infinity', '-Infinity')
       OR current_stock::numeric < 0
       OR current_stock::numeric <> round(current_stock::numeric, 4)
       OR (min_stock IS NOT NULL AND (
         min_stock::text IN ('NaN', 'Infinity', '-Infinity')
         OR min_stock::numeric < 0
         OR min_stock::numeric <> round(min_stock::numeric, 4)
       ))
       OR (einkaufspreis_eur IS NOT NULL AND (
         einkaufspreis_eur::text IN ('NaN', 'Infinity', '-Infinity')
         OR einkaufspreis_eur::numeric < 0
       ))
       OR unit IS NULL OR btrim(unit) = ''
  ) THEN
    RAISE EXCEPTION 'Inventory master contains missing or ambiguous stock/unit data';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
       OR inventory_item_id IS NULL OR btrim(inventory_item_id) = ''
       OR movement_type IS NULL OR btrim(movement_type) = ''
       OR movement_type NOT IN ('stock_in', 'stock_out', 'consumption', 'verbrauch', 'correction', 'waste')
       OR quantity IS NULL
       OR quantity::text IN ('NaN', 'Infinity', '-Infinity')
       OR quantity::numeric = 0
       OR quantity::numeric <> round(quantity::numeric, 4)
       OR abs(quantity::numeric) >= 10000000000
       OR (movement_type = 'stock_in' AND quantity::numeric <= 0)
       OR (movement_type IN ('stock_out', 'consumption', 'verbrauch', 'waste') AND quantity::numeric >= 0)
       OR (movement_type IN ('correction', 'waste') AND (reason IS NULL OR btrim(reason) = ''))
       OR NOT (
         (vorlage_id IS NULL AND war_aus_vorlage IS DISTINCT FROM TRUE)
         OR (vorlage_id IS NOT NULL AND war_aus_vorlage IS TRUE)
       )
       OR unit IS NULL OR btrim(unit) = ''
       OR created_by IS NULL OR erfasst_von IS NULL
       OR created_by <> erfasst_von
       OR created_at IS NULL
       OR (snapshot_einkaufspreis_eur IS NOT NULL AND (
         snapshot_einkaufspreis_eur::text IN ('NaN', 'Infinity', '-Infinity')
         OR snapshot_einkaufspreis_eur::numeric < 0
       ))
  ) THEN
    RAISE EXCEPTION 'Historical movements need proven tenant, unit, actor, quantity and time';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
  ) OR EXISTS (
    SELECT 1 FROM public.app_users WHERE tenant_id IS NULL OR btrim(tenant_id) = ''
  ) THEN
    RAISE EXCEPTION 'Orders and app users need complete tenant assignments';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_movements movement
    LEFT JOIN public.inventory_items item
      ON item.id = movement.inventory_item_id AND item.tenant_id = movement.tenant_id
    WHERE item.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.stock_movements movement
    LEFT JOIN public.orders parent
      ON parent.id = movement.order_id AND parent.tenant_id = movement.tenant_id
    WHERE movement.order_id IS NOT NULL AND parent.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.stock_movements movement
    LEFT JOIN public.app_users actor
      ON actor.id = movement.created_by AND actor.tenant_id = movement.tenant_id
    WHERE actor.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.stock_movements movement
    LEFT JOIN public.app_users actor
      ON actor.id = movement.erfasst_von AND actor.tenant_id = movement.tenant_id
    WHERE actor.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Inventory ledger contains dangling or cross-tenant relations';
  END IF;
END
$truth_preflight$;

DO $drop_conflicting_fks$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT DISTINCT constraint_row.conname
    FROM pg_constraint constraint_row
    JOIN LATERAL unnest(constraint_row.conkey) key(attnum) ON true
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_row.conrelid AND attribute.attnum = key.attnum
    WHERE constraint_row.conrelid = 'public.stock_movements'::regclass
      AND constraint_row.contype = 'f'
      AND attribute.attname IN ('inventory_item_id', 'order_id', 'created_by', 'erfasst_von')
  LOOP
    EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END
$drop_conflicting_fks$;

-- ALTER TYPE acquires a dependency-sensitive rewrite even when the source and
-- target types are already identical. Production's v_auftrag_db references the
-- legacy unconstrained quantity column and has two downstream evidence views.
-- CREATE OR REPLACE keeps the view OID and its dependants intact while a
-- transaction-local, empty bridge temporarily removes only the base-column
-- dependency. All captured metadata is verified before commit.
DO $type_reconciliation$
DECLARE
  change_record record;
  actual_type text;
  quantity_attribute_number smallint;
  quantity_type text;
  bridge_required boolean := false;
  original_view_oid oid;
  original_view_definition text;
  original_view_owner oid;
  original_view_acl aclitem[];
  original_view_options text[];
  original_view_signature text[];
  restored_view_signature text[];
BEGIN
  SELECT
    attribute.attnum,
    format_type(attribute.atttypid, attribute.atttypmod)
  INTO quantity_attribute_number, quantity_type
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'public.stock_movements'::regclass
    AND attribute.attname = 'quantity'
    AND NOT attribute.attisdropped;

  bridge_required := quantity_type IS DISTINCT FROM 'numeric(14,4)';

  IF bridge_required THEN
    IF to_regclass('public.v_auftrag_db') IS NULL THEN
      RAISE EXCEPTION
        'v_auftrag_db is required to reconcile stock_movements.quantity without evidence-view loss';
    END IF;

    IF to_regclass('public.__inventory_quantity_view_bridge_01550') IS NOT NULL THEN
      RAISE EXCEPTION 'Reserved inventory quantity view bridge relation already exists';
    END IF;

    SELECT
      relation.oid,
      pg_get_viewdef(relation.oid, false),
      relation.relowner,
      relation.relacl,
      relation.reloptions,
      ARRAY(
        SELECT format(
          '%s:%s:%s:%s',
          attribute.attnum,
          attribute.attname,
          format_type(attribute.atttypid, attribute.atttypmod),
          attribute.attcollation
        )
        FROM pg_attribute attribute
        WHERE attribute.attrelid = relation.oid
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
        ORDER BY attribute.attnum
      )
    INTO
      original_view_oid,
      original_view_definition,
      original_view_owner,
      original_view_acl,
      original_view_options,
      original_view_signature
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'v_auftrag_db'
      AND relation.relkind = 'v';

    IF original_view_oid IS NULL THEN
      RAISE EXCEPTION 'v_auftrag_db is not a regular view';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_depend dependency
      JOIN pg_rewrite rewrite_rule ON rewrite_rule.oid = dependency.objid
      WHERE dependency.refobjid = 'public.stock_movements'::regclass
        AND dependency.refobjsubid = quantity_attribute_number
        AND rewrite_rule.ev_class = original_view_oid
    ) OR EXISTS (
      SELECT 1
      FROM pg_depend dependency
      JOIN pg_rewrite rewrite_rule ON rewrite_rule.oid = dependency.objid
      WHERE dependency.refobjid = 'public.stock_movements'::regclass
        AND dependency.refobjsubid = quantity_attribute_number
        AND rewrite_rule.ev_class <> original_view_oid
    ) THEN
      RAISE EXCEPTION
        'Unexpected direct view dependency on stock_movements.quantity';
    END IF;

    EXECUTE
      'CREATE TABLE public.__inventory_quantity_view_bridge_01550 AS '
      'SELECT * FROM public.v_auftrag_db WITH NO DATA';
    EXECUTE
      'CREATE OR REPLACE VIEW public.v_auftrag_db AS '
      'SELECT * FROM public.__inventory_quantity_view_bridge_01550';
  END IF;

  FOR change_record IN
    SELECT * FROM (VALUES
      ('inventory_items', 'tenant_id', 'text', 'tenant_id::text'),
      ('inventory_items', 'category', 'text', 'category::text'),
      ('inventory_items', 'current_stock', 'numeric(14,4)', 'current_stock::numeric'),
      ('inventory_items', 'min_stock', 'numeric(14,4)', 'min_stock::numeric'),
      ('inventory_items', 'unit', 'text', 'unit::text'),
      ('inventory_items', 'einkaufspreis_eur', 'numeric(10,4)', 'einkaufspreis_eur::numeric'),
      ('stock_movements', 'tenant_id', 'text', 'tenant_id::text'),
      ('stock_movements', 'inventory_item_id', 'text', 'inventory_item_id::text'),
      ('stock_movements', 'movement_type', 'text', 'movement_type::text'),
      ('stock_movements', 'quantity', 'numeric(14,4)', 'quantity::numeric'),
      ('stock_movements', 'unit', 'text', 'unit::text'),
      ('stock_movements', 'order_id', 'text', 'order_id::text'),
      ('stock_movements', 'snapshot_einkaufspreis_eur', 'numeric(10,4)', 'snapshot_einkaufspreis_eur::numeric')
    ) AS changes(table_name, column_name, target_type, using_expression)
  LOOP
    SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO actual_type
    FROM pg_attribute attribute
    WHERE attribute.attrelid = format(
      'public.%I', change_record.table_name
    )::regclass
      AND attribute.attname = change_record.column_name
      AND NOT attribute.attisdropped;

    IF actual_type IS DISTINCT FROM change_record.target_type THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE %s USING %s',
        change_record.table_name,
        change_record.column_name,
        change_record.target_type,
        change_record.using_expression
      );
    END IF;
  END LOOP;

  IF bridge_required THEN
    EXECUTE format(
      'CREATE OR REPLACE VIEW public.v_auftrag_db AS %s',
      original_view_definition
    );
    EXECUTE 'DROP TABLE public.__inventory_quantity_view_bridge_01550 RESTRICT';

    SELECT ARRAY(
      SELECT format(
        '%s:%s:%s:%s',
        attribute.attnum,
        attribute.attname,
        format_type(attribute.atttypid, attribute.atttypmod),
        attribute.attcollation
      )
      FROM pg_attribute attribute
      WHERE attribute.attrelid = original_view_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum
    )
    INTO restored_view_signature;

    IF to_regclass('public.__inventory_quantity_view_bridge_01550') IS NOT NULL
       OR (SELECT relation.oid FROM pg_class relation WHERE relation.oid = original_view_oid) IS NULL
       OR pg_get_viewdef(original_view_oid, false) IS DISTINCT FROM original_view_definition
       OR (SELECT relation.relowner FROM pg_class relation WHERE relation.oid = original_view_oid)
         IS DISTINCT FROM original_view_owner
       OR (SELECT relation.relacl FROM pg_class relation WHERE relation.oid = original_view_oid)
         IS DISTINCT FROM original_view_acl
       OR (SELECT relation.reloptions FROM pg_class relation WHERE relation.oid = original_view_oid)
         IS DISTINCT FROM original_view_options
       OR restored_view_signature IS DISTINCT FROM original_view_signature THEN
      RAISE EXCEPTION
        'v_auftrag_db metadata changed during inventory quantity reconciliation';
    END IF;
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO quantity_type
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'public.stock_movements'::regclass
    AND attribute.attname = 'quantity'
    AND NOT attribute.attisdropped;

  IF quantity_type IS DISTINCT FROM 'numeric(14,4)' THEN
    RAISE EXCEPTION
      'stock_movements.quantity type reconciliation failed; found %',
      quantity_type;
  END IF;
END
$type_reconciliation$;

ALTER TABLE public.inventory_items
  ALTER COLUMN tenant_id DROP DEFAULT,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN current_stock SET DEFAULT 0,
  ALTER COLUMN current_stock SET NOT NULL,
  ALTER COLUMN min_stock SET DEFAULT 0,
  ALTER COLUMN unit SET NOT NULL;

-- The preflight above proved these parent tenant values. Making the columns
-- mandatory is therefore a constraint reconciliation, not a tenant backfill.
ALTER TABLE public.orders
  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.app_users
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.stock_movements
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN tenant_id DROP DEFAULT,
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN inventory_item_id SET NOT NULL,
  ALTER COLUMN movement_type SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN unit SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL,
  ALTER COLUMN erfasst_von SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_tenant_id_uidx
  ON public.inventory_items (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_id_uidx
  ON public.orders (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_tenant_id_uidx
  ON public.app_users (tenant_id, id);

DROP INDEX IF EXISTS public.stock_movements_tenant_inventory_created_id_idx;
DROP INDEX IF EXISTS public.stock_movements_tenant_request_idx;
DROP INDEX IF EXISTS public.stock_movements_tenant_order_created_idx;
CREATE INDEX stock_movements_tenant_inventory_created_id_idx
  ON public.stock_movements (tenant_id, inventory_item_id, created_at, id);
CREATE INDEX stock_movements_tenant_request_idx
  ON public.stock_movements (tenant_id, client_request_id);
CREATE INDEX stock_movements_tenant_order_created_idx
  ON public.stock_movements (tenant_id, order_id, created_at);

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_current_stock_nonnegative,
  DROP CONSTRAINT IF EXISTS inventory_items_min_stock_valid_chk,
  DROP CONSTRAINT IF EXISTS inventory_items_purchase_price_valid_chk,
  DROP CONSTRAINT IF EXISTS inventory_items_tenant_nonblank_chk,
  DROP CONSTRAINT IF EXISTS inventory_items_unit_nonblank_chk;

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_quantity_nonzero,
  DROP CONSTRAINT IF EXISTS stock_movements_quantity_domain_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_type_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_quantity_direction_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_reason_required_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_template_provenance_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_snapshot_price_valid_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_actor_consistency_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_tenant_nonblank_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_unit_nonblank_chk,
  DROP CONSTRAINT IF EXISTS stock_movements_tenant_inventory_fk,
  DROP CONSTRAINT IF EXISTS stock_movements_tenant_order_fk,
  DROP CONSTRAINT IF EXISTS stock_movements_tenant_created_by_fk,
  DROP CONSTRAINT IF EXISTS stock_movements_tenant_erfasst_von_fk;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_current_stock_nonnegative
    CHECK (current_stock::text NOT IN ('NaN', 'Infinity', '-Infinity') AND current_stock >= 0) NOT VALID,
  ADD CONSTRAINT inventory_items_min_stock_valid_chk
    CHECK (min_stock IS NULL OR (
      min_stock::text NOT IN ('NaN', 'Infinity', '-Infinity') AND min_stock >= 0
    )) NOT VALID,
  ADD CONSTRAINT inventory_items_purchase_price_valid_chk
    CHECK (einkaufspreis_eur IS NULL OR (
      einkaufspreis_eur::text NOT IN ('NaN', 'Infinity', '-Infinity') AND einkaufspreis_eur >= 0
    )) NOT VALID,
  ADD CONSTRAINT inventory_items_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID,
  ADD CONSTRAINT inventory_items_unit_nonblank_chk
    CHECK (btrim(unit) <> '') NOT VALID;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_quantity_nonzero
    CHECK (quantity::text NOT IN ('NaN', 'Infinity', '-Infinity') AND quantity <> 0) NOT VALID,
  ADD CONSTRAINT stock_movements_quantity_domain_chk
    CHECK (
      quantity::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND abs(quantity) < 10000000000
      AND quantity = round(quantity, 4)
    ) NOT VALID,
  ADD CONSTRAINT stock_movements_type_chk
    CHECK (movement_type IN ('stock_in', 'stock_out', 'consumption', 'verbrauch', 'correction', 'waste')) NOT VALID,
  ADD CONSTRAINT stock_movements_quantity_direction_chk
    CHECK (
      (movement_type = 'stock_in' AND quantity > 0)
      OR (movement_type IN ('stock_out', 'consumption', 'verbrauch', 'waste') AND quantity < 0)
      OR (movement_type = 'correction' AND quantity <> 0)
    ) NOT VALID,
  ADD CONSTRAINT stock_movements_reason_required_chk
    CHECK (
      movement_type NOT IN ('correction', 'waste')
      OR (reason IS NOT NULL AND btrim(reason) <> '')
    ) NOT VALID,
  ADD CONSTRAINT stock_movements_template_provenance_chk
    CHECK (
      (vorlage_id IS NULL AND war_aus_vorlage IS DISTINCT FROM TRUE)
      OR (vorlage_id IS NOT NULL AND war_aus_vorlage IS TRUE)
    ) NOT VALID,
  ADD CONSTRAINT stock_movements_snapshot_price_valid_chk
    CHECK (snapshot_einkaufspreis_eur IS NULL OR (
      snapshot_einkaufspreis_eur::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND snapshot_einkaufspreis_eur >= 0
    )) NOT VALID,
  ADD CONSTRAINT stock_movements_actor_consistency_chk
    CHECK (created_by = erfasst_von) NOT VALID,
  ADD CONSTRAINT stock_movements_tenant_nonblank_chk
    CHECK (btrim(tenant_id) <> '') NOT VALID,
  ADD CONSTRAINT stock_movements_unit_nonblank_chk
    CHECK (btrim(unit) <> '') NOT VALID,
  ADD CONSTRAINT stock_movements_tenant_inventory_fk
    FOREIGN KEY (tenant_id, inventory_item_id)
    REFERENCES public.inventory_items(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT stock_movements_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT stock_movements_tenant_created_by_fk
    FOREIGN KEY (tenant_id, created_by)
    REFERENCES public.app_users(tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT stock_movements_tenant_erfasst_von_fk
    FOREIGN KEY (tenant_id, erfasst_von)
    REFERENCES public.app_users(tenant_id, id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.inventory_items VALIDATE CONSTRAINT inventory_items_current_stock_nonnegative;
ALTER TABLE public.inventory_items VALIDATE CONSTRAINT inventory_items_min_stock_valid_chk;
ALTER TABLE public.inventory_items VALIDATE CONSTRAINT inventory_items_purchase_price_valid_chk;
ALTER TABLE public.inventory_items VALIDATE CONSTRAINT inventory_items_tenant_nonblank_chk;
ALTER TABLE public.inventory_items VALIDATE CONSTRAINT inventory_items_unit_nonblank_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_quantity_nonzero;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_quantity_domain_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_type_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_quantity_direction_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_reason_required_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_template_provenance_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_snapshot_price_valid_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_actor_consistency_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_tenant_nonblank_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_unit_nonblank_chk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_tenant_inventory_fk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_tenant_order_fk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_tenant_created_by_fk;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_tenant_erfasst_von_fk;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements FORCE ROW LEVEL SECURITY;

DO $server_boundary$
DECLARE
  relation_name text;
  role_name text;
  policy_name text;
  column_name text;
  privilege_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['inventory_items', 'stock_movements'] LOOP
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

    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF to_regrole(role_name) IS NOT NULL THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', relation_name, role_name);
        FOREACH column_name IN ARRAY ARRAY(
          SELECT attribute.attname::text
          FROM pg_attribute attribute
          WHERE attribute.attrelid = format('public.%I', relation_name)::regclass
            AND attribute.attnum > 0 AND NOT attribute.attisdropped
        ) LOOP
          FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
            EXECUTE format(
              'REVOKE %s (%I) ON TABLE public.%I FROM %I',
              privilege_name, column_name, relation_name, role_name
            );
          END LOOP;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  IF to_regrole('service_role') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls AND NOT rolsuper) THEN
    RAISE EXCEPTION 'A non-superuser service_role with BYPASSRLS is required';
  END IF;
  GRANT SELECT ON TABLE public.inventory_items TO service_role;
  GRANT UPDATE (current_stock) ON TABLE public.inventory_items TO service_role;
  GRANT SELECT, INSERT ON TABLE public.stock_movements TO service_role;
END
$server_boundary$;

DO $verification$
DECLARE
  role_name text;
  privilege_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('inventory_items', 'stock_movements')
  ) THEN
    RAISE EXCEPTION 'Inventory server tables must have zero RLS policies';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('inventory_items', 'stock_movements')
      AND (NOT relation.relrowsecurity OR NOT relation.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'Inventory server tables require forced RLS';
  END IF;

  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF to_regrole(role_name) IS NOT NULL THEN
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
        IF has_table_privilege(role_name, 'public.inventory_items', privilege_name)
           OR has_table_privilege(role_name, 'public.stock_movements', privilege_name) THEN
          RAISE EXCEPTION 'Inventory tables still expose effective % to %', privilege_name, role_name;
        END IF;
      END LOOP;
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        IF has_any_column_privilege(role_name, 'public.inventory_items', privilege_name)
           OR has_any_column_privilege(role_name, 'public.stock_movements', privilege_name) THEN
          RAISE EXCEPTION 'Inventory columns still expose effective % to %', privilege_name, role_name;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('service_role', 'public.inventory_items', 'SELECT')
     OR has_table_privilege('service_role', 'public.inventory_items', 'INSERT')
     OR has_table_privilege('service_role', 'public.inventory_items', 'UPDATE')
     OR NOT has_column_privilege('service_role', 'public.inventory_items', 'current_stock', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.stock_movements', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.stock_movements', 'INSERT')
     OR has_table_privilege('service_role', 'public.stock_movements', 'UPDATE')
     OR has_table_privilege('service_role', 'public.inventory_items', 'DELETE')
     OR has_table_privilege('service_role', 'public.stock_movements', 'DELETE')
     OR has_table_privilege('service_role', 'public.inventory_items', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.stock_movements', 'TRUNCATE')
     OR has_table_privilege('service_role', 'public.inventory_items', 'REFERENCES')
     OR has_table_privilege('service_role', 'public.stock_movements', 'REFERENCES')
     OR has_table_privilege('service_role', 'public.inventory_items', 'TRIGGER')
     OR has_table_privilege('service_role', 'public.stock_movements', 'TRIGGER')
     OR has_any_column_privilege('service_role', 'public.inventory_items', 'INSERT')
     OR has_any_column_privilege('service_role', 'public.inventory_items', 'REFERENCES')
     OR has_any_column_privilege('service_role', 'public.stock_movements', 'UPDATE')
     OR has_any_column_privilege('service_role', 'public.stock_movements', 'REFERENCES')
     OR EXISTS (
       SELECT 1
       FROM pg_attribute attribute
       WHERE attribute.attrelid = 'public.inventory_items'::regclass
         AND attribute.attnum > 0 AND NOT attribute.attisdropped
         AND attribute.attname <> 'current_stock'
         AND has_column_privilege('service_role', 'public.inventory_items', attribute.attnum, 'UPDATE')
     ) THEN
    RAISE EXCEPTION 'Inventory service-role grants are missing or overprivileged';
  END IF;
END
$verification$;
