-- Executable post-migration proof for the finance RLS/grant boundary.
-- This test changes role labels only inside a transaction and always rolls back.

BEGIN;

DO $assert_catalog$
BEGIN
  IF has_table_privilege('anon', 'public.orders', 'SELECT')
     OR has_table_privilege('anon', 'public.payments', 'SELECT')
     OR has_table_privilege('anon', 'public.price_lines', 'SELECT') THEN
    RAISE EXCEPTION 'anon retains finance SELECT';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.orders', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.payments', 'SELECT')
     OR has_table_privilege('authenticated', 'public.price_lines', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated SELECT matrix is wrong';
  END IF;

  IF has_table_privilege('authenticated', 'public.orders', 'INSERT')
     OR has_table_privilege('authenticated', 'public.orders', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.orders', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated retains order DML';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.orders', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.payments', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.price_lines', 'SELECT') THEN
    RAISE EXCEPTION 'service role grants changed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication AS publication
    JOIN pg_publication_rel AS publication_relation
      ON publication_relation.prpubid = publication.oid
    WHERE publication.pubname = 'supabase_realtime'
      AND publication_relation.prrelid = 'public.orders'::regclass
  ) THEN
    RAISE EXCEPTION 'orders remains in supabase_realtime';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('orders', 'payments', 'price_lines')
      AND roles @> ARRAY['public']::name[]
      AND (qual = 'true' OR with_check = 'true')
  ) THEN
    RAISE EXCEPTION 'public true policy remains';
  END IF;
END
$assert_catalog$;

SELECT set_config(
  'app.test_finance_uid',
  (
    SELECT auth_user.id::text
    FROM auth.users AS auth_user
    JOIN public.app_users AS app_user ON app_user.id = auth_user.id
    WHERE app_user.active IS TRUE
      AND lower(app_user.role) IN ('developer', 'admin', 'buero')
    LIMIT 1
  ),
  true
);

SELECT set_config(
  'app.test_nonfinance_uid',
  (
    SELECT auth_user.id::text
    FROM auth.users AS auth_user
    JOIN public.app_users AS app_user ON app_user.id = auth_user.id
    WHERE app_user.active IS TRUE
      AND lower(app_user.role) IN ('meister', 'werkstatt', 'readonly')
    LIMIT 1
  ),
  true
);

DO $assert_role_contract$
DECLARE
  finance_uid uuid := current_setting('app.test_finance_uid')::uuid;
  nonfinance_uid uuid := current_setting('app.test_nonfinance_uid')::uuid;
  original_finance_role text;
  original_nonfinance_role text;
  role_name text;
BEGIN
  IF finance_uid IS NULL OR nonfinance_uid IS NULL THEN
    RAISE EXCEPTION 'missing auth-linked positive or negative fixture';
  END IF;

  SELECT role INTO original_finance_role
  FROM public.app_users
  WHERE id = finance_uid;

  SELECT role INTO original_nonfinance_role
  FROM public.app_users
  WHERE id = nonfinance_uid;

  PERFORM set_config('request.jwt.claim.sub', finance_uid::text, true);
  FOREACH role_name IN ARRAY ARRAY['developer', 'admin', 'buero'] LOOP
    UPDATE public.app_users SET role = role_name WHERE id = finance_uid;
    IF NOT private.current_user_can_view_finance('galvanik-kreile') THEN
      RAISE EXCEPTION 'finance role % was denied', role_name;
    END IF;
  END LOOP;
  UPDATE public.app_users SET role = original_finance_role WHERE id = finance_uid;

  PERFORM set_config('request.jwt.claim.sub', nonfinance_uid::text, true);
  FOREACH role_name IN ARRAY ARRAY['meister', 'werkstatt', 'readonly'] LOOP
    UPDATE public.app_users SET role = role_name WHERE id = nonfinance_uid;
    IF private.current_user_can_view_finance('galvanik-kreile') THEN
      RAISE EXCEPTION 'non-finance role % was allowed', role_name;
    END IF;
  END LOOP;
  UPDATE public.app_users SET role = original_nonfinance_role WHERE id = nonfinance_uid;
END
$assert_role_contract$;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('app.test_finance_uid'),
  true
);
SET LOCAL ROLE authenticated;
DO $assert_finance_query$
BEGIN
  IF NOT private.current_user_can_view_finance('galvanik-kreile') THEN
    RAISE EXCEPTION 'finance helper denied authenticated fixture';
  END IF;
  PERFORM 1 FROM public.orders LIMIT 1;
  PERFORM 1 FROM public.payments LIMIT 1;
  BEGIN
    PERFORM 1 FROM public.price_lines LIMIT 1;
    RAISE EXCEPTION 'authenticated unexpectedly read price_lines';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$assert_finance_query$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('app.test_nonfinance_uid'),
  true
);
SET LOCAL ROLE authenticated;
DO $assert_nonfinance_query$
BEGIN
  IF private.current_user_can_view_finance('galvanik-kreile') THEN
    RAISE EXCEPTION 'non-finance helper allowed authenticated fixture';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders LIMIT 1) THEN
    RAISE EXCEPTION 'non-finance fixture can read orders';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments LIMIT 1) THEN
    RAISE EXCEPTION 'non-finance fixture can read payments';
  END IF;
END
$assert_nonfinance_query$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $assert_anon$
BEGIN
  BEGIN
    PERFORM 1 FROM public.orders LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly read orders';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.payments LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly read payments';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.price_lines LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly read price_lines';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.v_analyse_termintreue LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly read order-backed analysis view';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.v_auftrag_db LIMIT 1;
    RAISE EXCEPTION 'anon unexpectedly read order-backed cockpit view';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$assert_anon$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $assert_service_role$
BEGIN
  PERFORM 1 FROM public.orders LIMIT 1;
  PERFORM 1 FROM public.payments LIMIT 1;
  PERFORM 1 FROM public.price_lines LIMIT 1;
  PERFORM 1 FROM public.v_analyse_termintreue LIMIT 1;
  PERFORM 1 FROM public.v_auftrag_db LIMIT 1;
END
$assert_service_role$;
RESET ROLE;

ROLLBACK;

SELECT 'PASS: finance RLS/grant/realtime boundary' AS result;
