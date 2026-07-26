\set ON_ERROR_STOP on

INSERT INTO public.orders (id, tenant_id)
VALUES ('order-new-source', 'galvanik-kreile');
INSERT INTO public.items (id, tenant_id, order_id, current_station_id)
VALUES ('item-new-source', 'galvanik-kreile', 'order-new-source', 'wareneingang');
INSERT INTO public.events (
  id, tenant_id, client_event_id, order_id, item_id, event_type, payload, status
) VALUES (
  'event-new-source',
  'galvanik-kreile',
  gen_random_uuid(),
  'order-new-source',
  'item-new-source',
  'ORDER_CREATED_FROM_SCAN',
  '{"source":"scan"}'::jsonb,
  'success'
);

DO $validation$
BEGIN
  IF 14 <> (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
  ) THEN
    RAISE EXCEPTION 'Fresh canonical event source does not have 14 columns';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = 'event-new-source'
      AND event_type = 'ORDER_CREATED_FROM_SCAN'
      AND status = 'success'
  ) THEN
    RAISE EXCEPTION 'Fresh canonical event source did not persist a real event';
  END IF;
  IF has_table_privilege('authenticated', 'public.events', 'SELECT')
     OR has_table_privilege('service_role', 'public.events', 'UPDATE')
     OR has_table_privilege('service_role', 'public.events', 'DELETE')
     OR has_table_privilege('service_role', 'public.events', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Fresh canonical event source ACL boundary drifted';
  END IF;
END
$validation$;

SELECT 'operational_events_empty_source_ok' AS result;
