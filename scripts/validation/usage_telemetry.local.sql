\set ON_ERROR_STOP on

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
  IF NOT has_table_privilege('service_role', 'public.app_usage_events', 'SELECT,INSERT') THEN
    RAISE EXCEPTION 'Service role lacks append/read telemetry privileges';
  END IF;
  IF has_table_privilege('anon', 'public.ui_events', 'SELECT') THEN
    RAISE EXCEPTION 'Legacy ui_events remains browser-readable';
  END IF;
END
$validation$;

INSERT INTO public.app_usage_events (
  tenant_id, client_event_id, actor_pseudonym, actor_role, session_id,
  event_type, route, target, device_class, outcome, duration_ms,
  result_count, query_length, occurred_at
) VALUES (
  'galvanik-kreile', gen_random_uuid(), repeat('a', 64), 'admin', gen_random_uuid(),
  'search', '/orders', 'orders', 'desktop', 'success', 250, 3, 8, now()
);

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
END
$constraints$;

SELECT 'usage_telemetry_ok' AS result;
