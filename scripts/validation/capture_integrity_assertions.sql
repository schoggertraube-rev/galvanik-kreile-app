\set ON_ERROR_STOP on

DO $assertions$
DECLARE
  value_text text;
  value_bool boolean;
  stock numeric;
  request_id constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
BEGIN
  SELECT data_type INTO value_text
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'current_stock';
  IF value_text <> 'numeric' THEN RAISE EXCEPTION 'current_stock type is %, expected numeric', value_text; END IF;

  SELECT is_nullable INTO value_text
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'tenant_id';
  IF value_text <> 'NO' THEN RAISE EXCEPTION 'inventory tenant_id remains nullable'; END IF;

  SELECT tenant_id = 'galvanik-kreile' INTO value_bool
  FROM public.inventory_items WHERE id = 'material-local-1';
  IF value_bool IS DISTINCT FROM true THEN RAISE EXCEPTION 'inventory tenant backfill failed'; END IF;

  SELECT relrowsecurity INTO value_bool FROM pg_class WHERE oid = 'public.capture_request_receipts'::regclass;
  IF value_bool IS DISTINCT FROM true THEN RAISE EXCEPTION 'capture receipt RLS is not enabled'; END IF;
  SELECT relrowsecurity INTO value_bool FROM pg_class WHERE oid = 'public.inventory_items'::regclass;
  IF value_bool IS DISTINCT FROM true THEN RAISE EXCEPTION 'inventory RLS is not enabled'; END IF;

  IF has_table_privilege('authenticated', 'public.inventory_items', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated retained direct inventory SELECT';
  END IF;
  IF has_table_privilege('authenticated', 'public.capture_request_receipts', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated retained direct receipt INSERT';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.capture_request_receipts', 'INSERT') THEN
    RAISE EXCEPTION 'service_role lacks receipt INSERT';
  END IF;

  INSERT INTO public.capture_request_receipts (
    tenant_id, client_request_id, kind, actor_id, order_id, station_kuerzel, request_hash
  ) VALUES (
    'galvanik-kreile', request_id, 'material',
    '11111111-1111-4111-8111-111111111111', 'order-local-1', 'galvanik', repeat('a', 64)
  );

  BEGIN
    INSERT INTO public.capture_request_receipts (
      tenant_id, client_request_id, kind, actor_id, order_id, station_kuerzel, request_hash
    ) VALUES (
      'galvanik-kreile', request_id, 'material',
      '11111111-1111-4111-8111-111111111111', 'order-local-1', 'galvanik', repeat('a', 64)
    );
    RAISE EXCEPTION 'duplicate receipt was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  UPDATE public.inventory_items
  SET current_stock = current_stock - 2
  WHERE id = 'material-local-1' AND tenant_id = 'galvanik-kreile';
  INSERT INTO public.stock_movements (
    tenant_id, inventory_item_id, movement_type, quantity, order_id,
    station_kuerzel, erfasst_von, snapshot_einkaufspreis_eur, client_request_id
  ) VALUES (
    'galvanik-kreile', 'material-local-1', 'consumption', -2, 'order-local-1',
    'galvanik', '11111111-1111-4111-8111-111111111111', 2.5000, request_id
  );
  INSERT INTO public.audit_log (
    id, tenant_id, client_request_id, action, table_name, record_id, actor_id, payload
  ) VALUES (
    'capture-material-local', 'galvanik-kreile', request_id, 'capture_material',
    'capture_request_receipts', request_id::text,
    '11111111-1111-4111-8111-111111111111', '{"confirmed":true}'::jsonb
  );
  UPDATE public.capture_request_receipts
  SET result = '{"confirmed":true}'::jsonb, completed_at = now()
  WHERE tenant_id = 'galvanik-kreile' AND client_request_id = request_id AND kind = 'material';

  SELECT current_stock INTO stock FROM public.inventory_items WHERE id = 'material-local-1';
  IF stock <> 3 THEN RAISE EXCEPTION 'atomic happy-path stock is %, expected 3', stock; END IF;

  BEGIN
    UPDATE public.inventory_items SET current_stock = current_stock - 99 WHERE id = 'material-local-1';
    RAISE EXCEPTION 'negative stock update was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  SELECT current_stock INTO stock FROM public.inventory_items WHERE id = 'material-local-1';
  IF stock <> 3 THEN RAISE EXCEPTION 'failed subtransaction changed stock to %', stock; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.capture_request_receipts
    WHERE tenant_id = 'galvanik-kreile' AND client_request_id = request_id
      AND kind = 'material' AND result = '{"confirmed":true}'::jsonb
  ) THEN RAISE EXCEPTION 'durable capture receipt missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE tenant_id = 'galvanik-kreile' AND client_request_id = request_id AND action = 'capture_material'
  ) THEN RAISE EXCEPTION 'capture audit missing'; END IF;
END
$assertions$;

SELECT 'capture_integrity_validation_ok' AS result;
