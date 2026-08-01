-- Migration: 20260622000003_seed_analyse.sql

DO $$
DECLARE
  v_customer_id text;
  v_order_id text;
  v_item_id text;
  v_tenant_id text := 'galvanik-kreile';
BEGIN
  -- Create dummy customer if not exists
  SELECT id INTO v_customer_id FROM customers WHERE name = 'Seed Kunde Analyse' LIMIT 1;
  IF v_customer_id IS NULL THEN
    v_customer_id := gen_random_uuid()::text;
    INSERT INTO customers (id, name, type, company_name)
    VALUES (v_customer_id, 'Seed Kunde Analyse', 'business', 'Seed Corp');
  END IF;

  -- Create completed on-time order
  v_order_id := gen_random_uuid()::text;
  v_item_id := gen_random_uuid()::text;
  INSERT INTO orders (id, tenant_id, order_number, customer_id, title, status, created_at, promised_due_date, completed_date)
  VALUES (v_order_id, v_tenant_id, 'A-SEED-101', v_customer_id, 'On-time Order', 'completed', now() - interval '14 days', now() - interval '2 days', now() - interval '3 days');

  INSERT INTO items (id, tenant_id, order_id, customer_id, name, quantity, current_station_id)
  VALUES (v_item_id, v_tenant_id, v_order_id, v_customer_id, 'Part A', 10, 'qk_versand');

  INSERT INTO events (id, tenant_id, order_id, item_id, event_type, station, created_at)
  VALUES
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_EINGANG', 'wareneingang', now() - interval '14 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_AUSGANG', 'wareneingang', now() - interval '13 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_EINGANG', 'schleifen', now() - interval '12 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_AUSGANG', 'schleifen', now() - interval '8 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_EINGANG', 'galvanik', now() - interval '7 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_AUSGANG', 'galvanik', now() - interval '4 days');

  -- Create delayed completed order
  v_order_id := gen_random_uuid()::text;
  v_item_id := gen_random_uuid()::text;
  INSERT INTO orders (id, tenant_id, order_number, customer_id, title, status, created_at, promised_due_date, completed_date)
  VALUES (v_order_id, v_tenant_id, 'A-SEED-102', v_customer_id, 'Delayed Order', 'completed', now() - interval '20 days', now() - interval '10 days', now() - interval '2 days');

  INSERT INTO items (id, tenant_id, order_id, customer_id, name, quantity, current_station_id)
  VALUES (v_item_id, v_tenant_id, v_order_id, v_customer_id, 'Part B', 5, 'qk_versand');

  INSERT INTO events (id, tenant_id, order_id, item_id, event_type, station, created_at)
  VALUES
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_EINGANG', 'wareneingang', now() - interval '20 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_AUSGANG', 'wareneingang', now() - interval '18 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_EINGANG', 'entmetallisierung', now() - interval '18 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_AUSGANG', 'entmetallisierung', now() - interval '10 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_EINGANG', 'galvanik', now() - interval '9 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_AUSGANG', 'galvanik', now() - interval '3 days');

  -- Create order currently stuck in galvanik
  v_order_id := gen_random_uuid()::text;
  v_item_id := gen_random_uuid()::text;
  INSERT INTO orders (id, tenant_id, order_number, customer_id, title, status, created_at, promised_due_date)
  VALUES (v_order_id, v_tenant_id, 'A-SEED-103', v_customer_id, 'In Progress Order', 'in_progress', now() - interval '10 days', now() + interval '5 days');

  INSERT INTO items (id, tenant_id, order_id, customer_id, name, quantity, current_station_id)
  VALUES (v_item_id, v_tenant_id, v_order_id, v_customer_id, 'Part C', 20, 'galvanik');

  INSERT INTO events (id, tenant_id, order_id, item_id, event_type, station, created_at)
  VALUES
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_EINGANG', 'wareneingang', now() - interval '10 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_AUSGANG', 'wareneingang', now() - interval '9 days'),
    (gen_random_uuid()::text, v_tenant_id, v_order_id, v_item_id, 'STATION_EINGANG', 'galvanik', now() - interval '9 days');

END $$
