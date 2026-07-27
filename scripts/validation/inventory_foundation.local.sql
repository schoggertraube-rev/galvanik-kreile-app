\set ON_ERROR_STOP on

BEGIN;

DO $inventory_contract$
DECLARE
  item_row record;
  actor_id uuid;
  invalid_was_rejected boolean;
  quantity_type text;
  canonicalized_quantity numeric;
BEGIN
  SELECT item.id, item.tenant_id, item.unit
  INTO item_row
  FROM public.inventory_items item
  ORDER BY item.id
  LIMIT 1;

  IF item_row.id IS NULL THEN
    RAISE EXCEPTION 'Inventory validation requires one existing inventory item';
  END IF;

  SELECT app_user.id
  INTO actor_id
  FROM public.app_users app_user
  WHERE app_user.tenant_id = item_row.tenant_id
  ORDER BY app_user.id
  LIMIT 1;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Inventory validation requires one tenant-matched app user';
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
  INTO quantity_type
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'public.stock_movements'::regclass
    AND attribute.attname = 'quantity'
    AND NOT attribute.attisdropped;

  IF quantity_type IS DISTINCT FROM 'numeric(14,4)' THEN
    RAISE EXCEPTION 'Unexpected stock_movements.quantity type: %', quantity_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'public.stock_movements'::regclass
      AND constraint_row.conname = 'stock_movements_quantity_domain_chk'
      AND constraint_row.contype = 'c'
      AND constraint_row.convalidated
      AND pg_get_constraintdef(constraint_row.oid) ILIKE '%abs(quantity)%'
      AND pg_get_constraintdef(constraint_row.oid) ILIKE '%10000000000%'
      AND pg_get_constraintdef(constraint_row.oid) ILIKE '%round(quantity, 4)%'
  ) THEN
    RAISE EXCEPTION 'Validated stock movement quantity domain is missing';
  END IF;

  INSERT INTO public.stock_movements (
    tenant_id,
    inventory_item_id,
    movement_type,
    quantity,
    unit,
    created_by,
    erfasst_von
  ) VALUES (
    item_row.tenant_id,
    item_row.id,
    'stock_in',
    1.2345,
    item_row.unit,
    actor_id,
    actor_id
  );

  -- The server action rejects over-precision before writing. PostgreSQL's
  -- canonical numeric(14,4) storage additionally normalizes direct writes.
  INSERT INTO public.stock_movements (
    tenant_id,
    inventory_item_id,
    movement_type,
    quantity,
    unit,
    created_by,
    erfasst_von
  ) VALUES (
    item_row.tenant_id,
    item_row.id,
    'stock_in',
    1.23456,
    item_row.unit,
    actor_id,
    actor_id
  )
  RETURNING quantity INTO canonicalized_quantity;

  IF canonicalized_quantity IS DISTINCT FROM 1.2346 THEN
    RAISE EXCEPTION 'Movement quantity was not canonicalized to four decimals';
  END IF;

  invalid_was_rejected := false;
  BEGIN
    INSERT INTO public.stock_movements (
      tenant_id,
      inventory_item_id,
      movement_type,
      quantity,
      unit,
      created_by,
      erfasst_von
    ) VALUES (
      item_row.tenant_id,
      item_row.id,
      'stock_in',
      10000000000,
      item_row.unit,
      actor_id,
      actor_id
    );
  EXCEPTION
    WHEN check_violation OR numeric_value_out_of_range THEN
      invalid_was_rejected := true;
  END;

  IF NOT invalid_was_rejected THEN
    RAISE EXCEPTION 'Out-of-domain movement quantity was accepted';
  END IF;
END
$inventory_contract$;

DO $view_contract$
BEGIN
  IF to_regclass('public.v_auftrag_db') IS NULL
     OR to_regclass('public.v_analyse_werkstatt_puls_economics') IS NULL
     OR to_regclass('public.v_kunde_clv') IS NULL THEN
    RAISE EXCEPTION 'Inventory reconciliation removed an analytics evidence view';
  END IF;
END
$view_contract$;

ROLLBACK;

SELECT 'inventory_foundation_ok' AS result;
