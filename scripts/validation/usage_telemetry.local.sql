\set ON_ERROR_STOP on

BEGIN;

DO $validation$
BEGIN
  IF has_table_privilege('anon', 'public.app_usage_events', 'SELECT') OR
     has_table_privilege('authenticated', 'public.app_usage_events', 'INSERT') THEN
    RAISE EXCEPTION 'Browser roles unexpectedly access usage telemetry';
  END IF;
  IF has_table_privilege('service_role', 'public.app_usage_events', 'UPDATE') OR
     has_table_privilege('service_role', 'public.app_usage_events', 'DELETE') THEN
    RAISE EXCEPTION 'Service role unexpectedly mutates usage telemetry';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.app_usage_events', 'SELECT') OR
     has_column_privilege('service_role', 'public.app_usage_events', 'received_at', 'INSERT') OR
     has_column_privilege('service_role', 'public.app_usage_events', 'id', 'INSERT') OR
     NOT has_column_privilege('service_role', 'public.app_usage_events', 'occurred_at', 'INSERT') THEN
    RAISE EXCEPTION 'Service role telemetry column contract is invalid';
  END IF;
END
$validation$;

SET LOCAL ROLE service_role;

INSERT INTO public.app_usage_events (
  tenant_id, client_event_id, actor_pseudonym, actor_role, session_id,
  event_type, route, target, device_class, outcome, duration_ms,
  result_count, query_length, occurred_at
) VALUES (
  'galvanik-kreile', gen_random_uuid(), repeat('a', 64), 'admin', gen_random_uuid(),
  'search', '/orders', 'orders', 'desktop', 'success', 250, 3, 8, now()
);

DO $received_at_server_authored$
BEGIN
  BEGIN
    INSERT INTO public.app_usage_events (
      tenant_id,
      client_event_id,
      actor_pseudonym,
      actor_role,
      session_id,
      event_type,
      route,
      device_class,
      occurred_at,
      received_at
    ) VALUES (
      'galvanik-kreile',
      gen_random_uuid(),
      repeat('d', 64),
      'admin',
      gen_random_uuid(),
      'page_view',
      '/orders',
      'desktop',
      now(),
      now() - interval '1 day'
    );
    RAISE EXCEPTION 'Expected client-authored received_at to fail';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$received_at_server_authored$;

RESET ROLE;

DO $constraints$
DECLARE
  existing_client_id uuid;
BEGIN
  SELECT client_event_id INTO existing_client_id FROM public.app_usage_events LIMIT 1;
  BEGIN
    INSERT INTO public.app_usage_events (
      tenant_id, client_event_id, actor_pseudonym, actor_role, session_id,
      event_type, route, device_class, occurred_at
    ) VALUES (
      'galvanik-kreile', existing_client_id, repeat('b', 64), 'admin', gen_random_uuid(),
      'page_view', '/orders', 'desktop', now()
    );
    RAISE EXCEPTION 'Expected duplicate client event to fail';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.app_usage_events (
      tenant_id, client_event_id, actor_pseudonym, actor_role, session_id,
      event_type, route, target, device_class, occurred_at
    ) VALUES (
      'galvanik-kreile', gen_random_uuid(), repeat('c', 64), 'admin', gen_random_uuid(),
      'search', '/orders', 'raw customer text with spaces', 'desktop', now()
    );
    RAISE EXCEPTION 'Expected raw target text to fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.app_usage_events (
      tenant_id, client_event_id, actor_pseudonym, actor_role, session_id,
      event_type, route, device_class, occurred_at
    ) VALUES (
      'other-tenant', gen_random_uuid(), repeat('e', 64), 'admin', gen_random_uuid(),
      'page_view', '/orders', 'desktop', now()
    );
    RAISE EXCEPTION 'Expected non-canonical tenant to fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$constraints$;

SELECT 'usage_telemetry_ok' AS result;

ROLLBACK;
