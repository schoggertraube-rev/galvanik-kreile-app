\set ON_ERROR_STOP on

BEGIN;
SET LOCAL ROLE service_role;

INSERT INTO public.developer_feedback (
  tenant_id, client_request_id, actor_pseudonym, actor_role, route, message, build_id
) VALUES (
  'galvanik-kreile', gen_random_uuid(), repeat('a', 64), 'admin', '/buchhaltung', 'Bitte hier den bestätigten Exportstatus zeigen.', 'local-validation'
);

DO $validation$
BEGIN
  IF has_table_privilege('anon', 'public.developer_feedback', 'SELECT') OR
     has_table_privilege('authenticated', 'public.developer_feedback', 'INSERT') THEN
    RAISE EXCEPTION 'Browser roles unexpectedly access developer feedback';
  END IF;
  IF has_table_privilege('service_role', 'public.developer_feedback', 'UPDATE') OR
     has_table_privilege('service_role', 'public.developer_feedback', 'DELETE') THEN
    RAISE EXCEPTION 'Developer feedback is not append-only';
  END IF;
  IF has_table_privilege('service_role', 'public.developer_feedback', 'INSERT') OR
     has_column_privilege('service_role', 'public.developer_feedback', 'id', 'INSERT') OR
     has_column_privilege('service_role', 'public.developer_feedback', 'status', 'INSERT') OR
     has_column_privilege('service_role', 'public.developer_feedback', 'created_at', 'INSERT') OR
     NOT has_column_privilege('service_role', 'public.developer_feedback', 'message', 'INSERT') THEN
    RAISE EXCEPTION 'Developer feedback server-authored column contract drifted';
  END IF;

  BEGIN
    INSERT INTO public.developer_feedback (
      tenant_id, client_request_id, actor_pseudonym, actor_role, route, message
    ) VALUES ('galvanik-kreile', gen_random_uuid(), repeat('b', 64), 'admin', '/orders', 'x');
    RAISE EXCEPTION 'Expected short message rejection';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.developer_feedback (
      tenant_id,
      client_request_id,
      actor_pseudonym,
      actor_role,
      route,
      message,
      status
    ) VALUES (
      'galvanik-kreile',
      gen_random_uuid(),
      repeat('c', 64),
      'admin',
      '/orders',
      'Status must remain server-authored',
      'new'
    );
    RAISE EXCEPTION 'Expected client-authored status rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.developer_feedback (
      tenant_id, client_request_id, actor_pseudonym, actor_role, route, message
    ) VALUES (
      'other-tenant',
      gen_random_uuid(),
      repeat('d', 64),
      'admin',
      '/orders',
      'Dieser Tenant muss am Datenbankvertrag scheitern.'
    );
    RAISE EXCEPTION 'Expected non-canonical tenant to fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$validation$;

SELECT 'developer_feedback_ok' AS result;

ROLLBACK;
