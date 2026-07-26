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
     has_table_privilege('service_role', 'public.events', 'DELETE') OR
     has_table_privilege('service_role', 'public.events', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Events are not append-only';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.events', 'SELECT') OR
     NOT has_table_privilege('service_role', 'public.events', 'INSERT') THEN
    RAISE EXCEPTION 'Server event capability is incomplete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
      AND column_name IN ('tenant_id', 'order_id', 'status')
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Required event columns remain nullable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = 'event-legacy'
      AND client_event_id IS NULL
      AND event_type = 'ORDER_CREATED'
  ) THEN
    RAISE EXCEPTION 'Legacy event history was lost or fabricated';
  END IF;

  BEGIN
    INSERT INTO public.events (id, tenant_id, client_event_id, order_id, event_type, status)
    VALUES ('event-invalid-type', 'galvanik-kreile', gen_random_uuid(), 'order-a', 'ARBITRARY_EVENT', 'success');
    RAISE EXCEPTION 'Expected event allowlist rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.events (id, tenant_id, client_event_id, order_id, event_type, payload, status)
    VALUES ('event-invalid-payload', 'galvanik-kreile', gen_random_uuid(), 'order-a', 'NOTE_ADDED', jsonb_build_object('raw', repeat('x', 9000)), 'success');
    RAISE EXCEPTION 'Expected payload size rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.events (id, tenant_id, client_event_id, order_id, event_type, payload, status)
    VALUES ('event-invalid-payload-shape', 'galvanik-kreile', gen_random_uuid(), 'order-a', 'NOTE_ADDED', '[]'::jsonb, 'success');
    RAISE EXCEPTION 'Expected payload object rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.events (id, tenant_id, client_event_id, order_id, event_type, status)
    VALUES ('event-invalid-status', 'galvanik-kreile', gen_random_uuid(), 'order-a', 'NOTE_ADDED', 'error');
    RAISE EXCEPTION 'Expected event status rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.events (id, tenant_id, client_event_id, order_id, event_type, status)
    VALUES ('event-other-order', 'galvanik-kreile', gen_random_uuid(), 'missing-order', 'NOTE_ADDED', 'success');
    RAISE EXCEPTION 'Expected tenant/order foreign-key rejection';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  INSERT INTO public.events (
    id, tenant_id, order_id, event_type, payload, status
  ) VALUES (
    'event-payment-review', 'galvanik-kreile', 'order-a',
    'PAYMENT_REVIEW_REQUIRED', '{"paymentId":"payment-a"}'::jsonb, 'warning'
  );

  BEGIN
    DELETE FROM public.orders WHERE id = 'order-legacy';
    RAISE EXCEPTION 'Expected append-only evidence retention';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class view_record
    WHERE view_record.oid = 'public.v_analyse_station_durchlauf'::regclass
      AND view_record.reloptions @> ARRAY['security_invoker=true', 'security_barrier=true']
  ) THEN
    RAISE EXCEPTION 'Station duration compatibility view is not hardened';
  END IF;
END
$validation$;

SELECT 'operational_events_ok' AS result;
