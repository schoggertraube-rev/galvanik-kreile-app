\set ON_ERROR_STOP on

INSERT INTO public.orders (id, tenant_id) VALUES ('order-a', 'galvanik-kreile');
INSERT INTO public.items (id, tenant_id, order_id) VALUES ('item-a', 'galvanik-kreile', 'order-a');
INSERT INTO public.events (id, tenant_id, client_event_id, order_id, item_id, event_type, payload, status)
VALUES ('event-a', 'galvanik-kreile', gen_random_uuid(), 'order-a', 'item-a', 'STATION_STARTED', '{"stationId":"galvanik"}', 'success');

DO $validation$
BEGIN
  IF has_table_privilege('anon', 'public.events', 'SELECT') OR
     has_table_privilege('authenticated', 'public.events', 'INSERT') THEN
    RAISE EXCEPTION 'Browser roles unexpectedly access events';
  END IF;
  IF has_table_privilege('service_role', 'public.events', 'UPDATE') OR
     has_table_privilege('service_role', 'public.events', 'DELETE') THEN
    RAISE EXCEPTION 'Events are not append-only';
  END IF;

  BEGIN
    INSERT INTO public.events (id, tenant_id, client_event_id, order_id, event_type, status)
    VALUES ('event-invalid-type', 'galvanik-kreile', gen_random_uuid(), 'order-a', 'ARBITRARY_EVENT', 'success');
    RAISE EXCEPTION 'Expected event allowlist rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.events (id, tenant_id, client_event_id, order_id, event_type, payload, status)
    VALUES ('event-invalid-payload', 'galvanik-kreile', gen_random_uuid(), 'order-a', 'NOTE_ADDED', jsonb_build_object('raw', repeat('x', 3000)), 'success');
    RAISE EXCEPTION 'Expected payload size rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.events (id, tenant_id, client_event_id, order_id, event_type, status)
    VALUES ('event-other-order', 'galvanik-kreile', gen_random_uuid(), 'missing-order', 'NOTE_ADDED', 'success');
    RAISE EXCEPTION 'Expected tenant/order foreign-key rejection';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END
$validation$;

SELECT 'operational_events_ok' AS result;
