-- REMOTE WAVE 1: explicitly approved 2026-07-26; use only the reviewed atomic runner.
-- Durable atomic security counters. The Supabase migration runner owns the
-- transaction and records the ledger entry in that same transaction.

SET lock_timeout = '5s';
SET statement_timeout = '60s';
SET idle_in_transaction_session_timeout = '60s';
SET search_path = pg_catalog, pg_temp;

DO $preflight$
DECLARE
  migration_owner oid := (SELECT datdba FROM pg_database WHERE datname = current_database());
  service_role_oid oid := (SELECT oid FROM pg_roles WHERE rolname = 'service_role');
BEGIN
  IF migration_owner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname = current_user)
     OR NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE oid = migration_owner AND (rolbypassrls OR rolsuper)
     ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_PREFLIGHT_FAILED: migration must run as the BYPASSRLS database owner';
  END IF;

  IF service_role_oid IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE oid = service_role_oid
      AND rolbypassrls
      AND NOT rolsuper
      AND NOT rolcanlogin
      AND NOT rolcreaterole
      AND NOT rolcreatedb
      AND NOT rolreplication
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_PREFLIGHT_FAILED: service_role contract is unavailable';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_roles
    WHERE rolname IN ('pg_read_all_data', 'pg_write_all_data', 'pg_maintain')
      AND NOT rolcanlogin
      AND NOT rolsuper
      AND rolinherit
      AND NOT rolcreaterole
      AND NOT rolcreatedb
      AND NOT rolbypassrls
      AND NOT rolreplication
      AND rolconfig IS NULL
  ) <> 3 THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_PREFLIGHT_FAILED: built-in data role contract drifted';
  END IF;

  IF EXISTS (
    WITH sensitive_targets AS (
      SELECT role_record.oid AS target_oid, role_record.rolname AS target_name
      FROM pg_roles role_record
      WHERE role_record.rolname IN (
        'service_role',
        'pg_read_all_data',
        'pg_write_all_data',
        'pg_maintain'
      )
      UNION
      SELECT migration_owner, '__database_owner__'::text
    )
    SELECT 1
    FROM pg_roles candidate
    CROSS JOIN sensitive_targets target
    WHERE NOT candidate.rolsuper
      AND candidate.oid <> migration_owner
      AND candidate.oid <> target.target_oid
      AND pg_has_role(candidate.oid, target.target_oid, 'MEMBER')
      AND NOT (
        (
          target.target_name = 'service_role'
          AND candidate.rolname IN ('authenticator', 'kreile_app_runtime')
          AND candidate.rolcanlogin
          AND NOT candidate.rolinherit
          AND NOT candidate.rolsuper
          AND NOT candidate.rolbypassrls
          AND NOT candidate.rolcreaterole
          AND NOT candidate.rolcreatedb
          AND NOT candidate.rolreplication
          AND (
            (
              candidate.rolname = 'authenticator'
              AND pg_catalog.cardinality(candidate.rolconfig) = 3
              AND candidate.rolconfig @> ARRAY[
                'session_preload_libraries=supautils, safeupdate',
                'statement_timeout=8s',
                'lock_timeout=8s'
              ]::text[]
              AND candidate.rolconfig <@ ARRAY[
                'session_preload_libraries=supautils, safeupdate',
                'statement_timeout=8s',
                'lock_timeout=8s'
              ]::text[]
            )
            OR (
              candidate.rolname = 'kreile_app_runtime'
              AND candidate.rolconfig IS NULL
            )
          )
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
            WHERE membership.roleid = service_role_oid
              AND membership.member = candidate.oid
              AND NOT membership.admin_option
              AND NOT membership.inherit_option
              AND membership.set_option
              AND (
                candidate.rolname <> 'authenticator'
                OR grantor_role.rolname = 'supabase_admin'
              )
              AND grantor_role.rolsuper
          )
        )
        OR (
          target.target_name = 'service_role'
          AND candidate.rolname = 'supabase_storage_admin'
          AND candidate.rolcanlogin
          AND NOT candidate.rolinherit
          AND NOT candidate.rolsuper
          AND NOT candidate.rolbypassrls
          AND candidate.rolcreaterole
          AND NOT candidate.rolcreatedb
          AND NOT candidate.rolreplication
          AND pg_catalog.cardinality(candidate.rolconfig) = 2
          AND candidate.rolconfig @> ARRAY[
            'search_path=storage',
            'log_statement=none'
          ]::text[]
          AND candidate.rolconfig <@ ARRAY[
            'search_path=storage',
            'log_statement=none'
          ]::text[]
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            WHERE membership.member = candidate.oid
          )
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles authenticator_role
              ON authenticator_role.oid = membership.roleid
            JOIN pg_roles grantor_role
              ON grantor_role.oid = membership.grantor
            WHERE membership.member = candidate.oid
              AND authenticator_role.rolname = 'authenticator'
              AND authenticator_role.rolcanlogin
              AND NOT authenticator_role.rolinherit
              AND NOT authenticator_role.rolsuper
              AND NOT authenticator_role.rolbypassrls
              AND NOT authenticator_role.rolcreaterole
              AND NOT authenticator_role.rolcreatedb
              AND NOT authenticator_role.rolreplication
              AND pg_catalog.cardinality(authenticator_role.rolconfig) = 3
              AND authenticator_role.rolconfig @> ARRAY[
                'session_preload_libraries=supautils, safeupdate',
                'statement_timeout=8s',
                'lock_timeout=8s'
              ]::text[]
              AND authenticator_role.rolconfig <@ ARRAY[
                'session_preload_libraries=supautils, safeupdate',
                'statement_timeout=8s',
                'lock_timeout=8s'
              ]::text[]
              AND NOT membership.admin_option
              AND NOT membership.inherit_option
              AND membership.set_option
              AND grantor_role.rolname = 'supabase_admin'
              AND grantor_role.rolsuper
          )
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles authenticator_role
              ON authenticator_role.oid = membership.member
            JOIN pg_roles grantor_role
              ON grantor_role.oid = membership.grantor
            WHERE membership.roleid = service_role_oid
              AND authenticator_role.rolname = 'authenticator'
              AND NOT membership.admin_option
              AND NOT membership.inherit_option
              AND membership.set_option
              AND grantor_role.rolname = 'supabase_admin'
              AND grantor_role.rolsuper
          )
        )
        OR (
          target.target_name = 'service_role'
          AND candidate.rolname = 'cli_login_postgres'
          AND candidate.rolcanlogin
          AND NOT candidate.rolinherit
          AND NOT candidate.rolsuper
          AND NOT candidate.rolbypassrls
          AND NOT candidate.rolcreaterole
          AND NOT candidate.rolcreatedb
          AND NOT candidate.rolreplication
          AND candidate.rolconfig IS NULL
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            WHERE membership.member = candidate.oid
          )
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
            WHERE membership.roleid = migration_owner
              AND membership.member = candidate.oid
              AND NOT membership.admin_option
              AND NOT membership.inherit_option
              AND membership.set_option
              AND grantor_role.rolname = 'supabase_admin'
              AND grantor_role.rolsuper
          )
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
            WHERE membership.roleid = service_role_oid
              AND membership.member = migration_owner
              AND membership.admin_option
              AND membership.inherit_option
              AND membership.set_option
              AND grantor_role.rolname = 'supabase_admin'
              AND grantor_role.rolsuper
          )
        )
        OR (
          target.target_name = '__database_owner__'
          AND candidate.rolname = 'cli_login_postgres'
          AND candidate.rolcanlogin
          AND NOT candidate.rolinherit
          AND NOT candidate.rolsuper
          AND NOT candidate.rolbypassrls
          AND NOT candidate.rolcreaterole
          AND NOT candidate.rolcreatedb
          AND NOT candidate.rolreplication
          AND candidate.rolconfig IS NULL
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            WHERE membership.member = candidate.oid
          )
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
            WHERE membership.roleid = migration_owner
              AND membership.member = candidate.oid
              AND NOT membership.admin_option
              AND NOT membership.inherit_option
              AND membership.set_option
              AND grantor_role.rolname = 'supabase_admin'
              AND grantor_role.rolsuper
          )
        )
        OR (
          target.target_name = 'pg_read_all_data'
          AND candidate.rolname = 'cli_login_postgres'
          AND candidate.rolcanlogin
          AND NOT candidate.rolinherit
          AND NOT candidate.rolsuper
          AND NOT candidate.rolbypassrls
          AND NOT candidate.rolcreaterole
          AND NOT candidate.rolcreatedb
          AND NOT candidate.rolreplication
          AND candidate.rolconfig IS NULL
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            WHERE membership.member = candidate.oid
          )
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
            WHERE membership.roleid = migration_owner
              AND membership.member = candidate.oid
              AND NOT membership.admin_option
              AND NOT membership.inherit_option
              AND membership.set_option
              AND grantor_role.rolname = 'supabase_admin'
              AND grantor_role.rolsuper
          )
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
            WHERE membership.roleid = target.target_oid
              AND membership.member = migration_owner
              AND membership.admin_option
              AND membership.inherit_option
              AND membership.set_option
              AND grantor_role.rolname = 'supabase_admin'
              AND grantor_role.rolsuper
          )
          AND NOT pg_has_role(candidate.oid, 'pg_write_all_data', 'MEMBER')
          AND NOT pg_has_role(candidate.oid, 'pg_maintain', 'MEMBER')
        )
        OR (
          target.target_name = 'pg_read_all_data'
          AND (
            (
              candidate.rolname = 'supabase_etl_admin'
              AND candidate.rolcanlogin
              AND candidate.rolinherit
              AND candidate.rolbypassrls
              AND candidate.rolreplication
              AND NOT candidate.rolcreaterole
              AND NOT candidate.rolcreatedb
              AND candidate.rolconfig IS NULL
            )
            OR (
              candidate.rolname = 'supabase_read_only_user'
              AND candidate.rolcanlogin
              AND candidate.rolinherit
              AND candidate.rolbypassrls
              AND NOT candidate.rolreplication
              AND NOT candidate.rolcreaterole
              AND NOT candidate.rolcreatedb
              AND candidate.rolconfig = ARRAY['default_transaction_read_only=on']
            )
          )
          AND NOT pg_has_role(candidate.oid, 'pg_write_all_data', 'MEMBER')
          AND 1 = (
            SELECT count(*)
            FROM pg_auth_members membership
            JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
            WHERE membership.roleid = target.target_oid
              AND membership.member = candidate.oid
              AND NOT membership.admin_option
              AND membership.inherit_option
              AND membership.set_option
              AND grantor_role.rolsuper
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_PREFLIGHT_FAILED: unexpected sensitive role membership detected';
  END IF;

  IF to_regclass('public.security_rate_limit_counters') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class relation_record
       JOIN pg_namespace namespace_record ON namespace_record.oid = relation_record.relnamespace
       WHERE relation_record.oid = to_regclass('public.security_rate_limit_counters')
         AND namespace_record.nspname = 'public'
         AND relation_record.relkind = 'r'
         AND relation_record.relpersistence = 'p'
         AND NOT relation_record.relispartition
         AND relation_record.relowner = migration_owner
     ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_PREFLIGHT_FAILED: existing relation kind, persistence or owner drifted';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
    WHERE namespace_record.nspname = 'public'
      AND function_record.proname IN ('consume_security_rate_limit', 'reset_security_rate_limit')
      AND function_record.oid NOT IN (
        coalesce(to_regprocedure('public.consume_security_rate_limit(text,text,integer,integer)')::oid, 0::oid),
        coalesce(to_regprocedure('public.reset_security_rate_limit(text,text)')::oid, 0::oid)
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_proc function_record
    WHERE function_record.oid IN (
      to_regprocedure('public.consume_security_rate_limit(text,text,integer,integer)'),
      to_regprocedure('public.reset_security_rate_limit(text,text)')
    )
      AND function_record.proowner <> migration_owner
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_PREFLIGHT_FAILED: function overload or owner drift';
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS public.security_rate_limit_counters (
  namespace text NOT NULL,
  subject_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempt_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT security_rate_limit_counters_pkey
    PRIMARY KEY (namespace, subject_hash),
  CONSTRAINT security_rate_limit_counters_attempt_count_check
    CHECK (attempt_count BETWEEN 0 AND 100000),
  CONSTRAINT security_rate_limit_counters_namespace_check
    CHECK (namespace ~ '^[a-z0-9._-]{1,80}$'),
  CONSTRAINT security_rate_limit_counters_subject_hash_check
    CHECK (subject_hash ~ '^[0-9a-f]{64}$')
);

DO $table_contract$
DECLARE
  migration_owner oid := (SELECT datdba FROM pg_database WHERE datname = current_database());
BEGIN
  IF (
    SELECT count(*)
    FROM pg_attribute
    WHERE attrelid = 'public.security_rate_limit_counters'::regclass
      AND attnum > 0 AND NOT attisdropped
  ) <> 5 OR EXISTS (
    SELECT 1
    FROM (VALUES
      ('namespace', 'text', true, NULL::text),
      ('subject_hash', 'text', true, NULL::text),
      ('window_started_at', 'timestamp with time zone', true, 'clock_timestamp()'),
      ('attempt_count', 'integer', true, '0'),
      ('updated_at', 'timestamp with time zone', true, 'clock_timestamp()')
    ) expected(column_name, data_type, not_null, default_expression)
    LEFT JOIN pg_attribute attribute_record
      ON attribute_record.attrelid = 'public.security_rate_limit_counters'::regclass
     AND attribute_record.attname = expected.column_name
     AND attribute_record.attnum > 0
     AND NOT attribute_record.attisdropped
    LEFT JOIN pg_attrdef default_record
      ON default_record.adrelid = attribute_record.attrelid
     AND default_record.adnum = attribute_record.attnum
    WHERE attribute_record.attnum IS NULL
       OR format_type(attribute_record.atttypid, attribute_record.atttypmod) <> expected.data_type
       OR attribute_record.attnotnull IS DISTINCT FROM expected.not_null
       OR pg_get_expr(default_record.adbin, default_record.adrelid, false)
          IS DISTINCT FROM expected.default_expression
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_CONTRACT_FAILED: column shape or defaults drifted';
  END IF;

  IF (
    SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.security_rate_limit_counters'::regclass
  ) <> 4 OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.security_rate_limit_counters'::regclass
      AND conname = 'security_rate_limit_counters_pkey'
      AND contype = 'p' AND convalidated
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.security_rate_limit_counters'::regclass AND attname = 'namespace'),
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.security_rate_limit_counters'::regclass AND attname = 'subject_hash')
      ]::smallint[]
      AND NOT condeferrable AND NOT condeferred
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.security_rate_limit_counters'::regclass
      AND conname = 'security_rate_limit_counters_attempt_count_check'
      AND contype = 'c' AND convalidated
      AND pg_get_expr(conbin, conrelid, false)
        = '((attempt_count >= 0) AND (attempt_count <= 100000))'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.security_rate_limit_counters'::regclass
      AND conname = 'security_rate_limit_counters_namespace_check'
      AND contype = 'c' AND convalidated
      AND pg_get_expr(conbin, conrelid, false)
        = '(namespace ~ ''^[a-z0-9._-]{1,80}$''::text)'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.security_rate_limit_counters'::regclass
      AND conname = 'security_rate_limit_counters_subject_hash_check'
      AND contype = 'c' AND convalidated
      AND pg_get_expr(conbin, conrelid, false)
        = '(subject_hash ~ ''^[0-9a-f]{64}$''::text)'
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_CONTRACT_FAILED: primary key or check contract drifted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.security_rate_limit_counters'::regclass
  ) OR EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.security_rate_limit_counters'::regclass
      AND (relowner <> migration_owner OR reloptions IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_CONTRACT_FAILED: owner, options or policies drifted';
  END IF;
END
$table_contract$;

ALTER TABLE public.security_rate_limit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_rate_limit_counters FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.security_rate_limit_counters
  FROM PUBLIC, anon, authenticated, service_role;

DO $column_acl$
DECLARE
  column_name text;
  client_role text;
  privilege_name text;
BEGIN
  FOREACH column_name IN ARRAY ARRAY[
    'namespace', 'subject_hash', 'window_started_at', 'attempt_count', 'updated_at'
  ] LOOP
    FOREACH client_role IN ARRAY ARRAY['PUBLIC', 'anon', 'authenticated', 'service_role'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        EXECUTE format(
          'REVOKE %s (%I) ON TABLE public.security_rate_limit_counters FROM %s',
          privilege_name,
          column_name,
          CASE WHEN client_role = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(client_role) END
        );
      END LOOP;
    END LOOP;
  END LOOP;
END
$column_acl$;

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(
  p_namespace text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_counter public.security_rate_limit_counters%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_namespace IS NULL
     OR p_namespace !~ '^[a-z0-9._-]{1,80}$'
     OR p_subject_hash IS NULL
     OR p_subject_hash !~ '^[0-9a-f]{64}$'
     OR p_limit IS NULL
     OR p_limit < 1 OR p_limit > 100000
     OR p_window_seconds IS NULL
     OR p_window_seconds < 1 OR p_window_seconds > 2592000 THEN
    RAISE EXCEPTION 'INVALID_SECURITY_RATE_LIMIT_POLICY';
  END IF;

  INSERT INTO public.security_rate_limit_counters (
    namespace, subject_hash, window_started_at, attempt_count, updated_at
  ) VALUES (
    p_namespace, p_subject_hash, v_now, 0, v_now
  ) ON CONFLICT (namespace, subject_hash) DO NOTHING;

  SELECT * INTO STRICT v_counter
  FROM public.security_rate_limit_counters
  WHERE namespace = p_namespace AND subject_hash = p_subject_hash
  FOR UPDATE;

  IF v_counter.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN
    v_counter.window_started_at := v_now;
    v_counter.attempt_count := 0;
  END IF;

  IF v_counter.attempt_count >= p_limit THEN
    UPDATE public.security_rate_limit_counters
    SET updated_at = v_now
    WHERE namespace = p_namespace AND subject_hash = p_subject_hash;

    RETURN QUERY SELECT
      false,
      0,
      greatest(
        1,
        ceil(extract(epoch FROM (
          v_counter.window_started_at + make_interval(secs => p_window_seconds) - v_now
        )))::integer
      );
    RETURN;
  END IF;

  v_counter.attempt_count := v_counter.attempt_count + 1;
  UPDATE public.security_rate_limit_counters
  SET window_started_at = v_counter.window_started_at,
      attempt_count = v_counter.attempt_count,
      updated_at = v_now
  WHERE namespace = p_namespace AND subject_hash = p_subject_hash;

  RETURN QUERY SELECT true, greatest(0, p_limit - v_counter.attempt_count), 0;
END
$function$;

CREATE OR REPLACE FUNCTION public.reset_security_rate_limit(
  p_namespace text,
  p_subject_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_namespace IS NULL
     OR p_namespace !~ '^[a-z0-9._-]{1,80}$'
     OR p_subject_hash IS NULL
     OR p_subject_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_SECURITY_RATE_LIMIT_RESET';
  END IF;

  INSERT INTO public.security_rate_limit_counters (
    namespace, subject_hash, window_started_at, attempt_count, updated_at
  ) VALUES (
    p_namespace, p_subject_hash, v_now, 0, v_now
  )
  ON CONFLICT (namespace, subject_hash) DO UPDATE
  SET window_started_at = EXCLUDED.window_started_at,
      attempt_count = 0,
      updated_at = EXCLUDED.updated_at;

  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION public.consume_security_rate_limit(text,text,integer,integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reset_security_rate_limit(text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit(text,text,integer,integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_security_rate_limit(text,text)
  TO service_role;

DO $verification$
DECLARE
  relation_oid oid := 'public.security_rate_limit_counters'::regclass;
  migration_owner oid := (SELECT datdba FROM pg_database WHERE datname = current_database());
  service_role_oid oid := to_regrole('service_role');
  function_oid oid;
  function_signature text;
  client_role text;
  privilege_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = relation_oid
      AND relkind = 'r'
      AND relpersistence = 'p'
      AND NOT relispartition
      AND relowner = migration_owner
      AND relrowsecurity
      AND relforcerowsecurity
      AND reloptions IS NULL
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_VERIFICATION_FAILED: relation security contract drifted';
  END IF;

  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
    ] LOOP
      IF has_table_privilege(client_role, relation_oid, privilege_name) THEN
        RAISE EXCEPTION 'SECURITY_RATE_LIMIT_VERIFICATION_FAILED: % has table %', client_role, privilege_name;
      END IF;
    END LOOP;
    FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
      IF has_any_column_privilege(client_role, relation_oid, privilege_name) THEN
        RAISE EXCEPTION 'SECURITY_RATE_LIMIT_VERIFICATION_FAILED: % has column %', client_role, privilege_name;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_class relation_record
    CROSS JOIN LATERAL aclexplode(
      coalesce(relation_record.relacl, acldefault('r', relation_record.relowner))
    ) acl_entry
    WHERE relation_record.oid = relation_oid
      AND acl_entry.grantee <> migration_owner
  ) OR EXISTS (
    SELECT 1
    FROM pg_attribute attribute_record
    CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = relation_oid
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_VERIFICATION_FAILED: relation ACL drifted';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles role_record
    WHERE role_record.oid NOT IN (migration_owner, service_role_oid)
      AND NOT role_record.rolsuper
      AND (
        (
          role_record.rolname NOT IN ('pg_write_all_data', 'pg_maintain')
          AND (
            has_table_privilege(role_record.oid, relation_oid, 'INSERT')
            OR has_table_privilege(role_record.oid, relation_oid, 'UPDATE')
            OR has_table_privilege(role_record.oid, relation_oid, 'DELETE')
            OR has_table_privilege(role_record.oid, relation_oid, 'TRUNCATE')
            OR has_table_privilege(role_record.oid, relation_oid, 'REFERENCES')
            OR has_table_privilege(role_record.oid, relation_oid, 'TRIGGER')
            OR has_table_privilege(role_record.oid, relation_oid, 'MAINTAIN')
            OR has_any_column_privilege(role_record.oid, relation_oid, 'INSERT')
            OR has_any_column_privilege(role_record.oid, relation_oid, 'UPDATE')
            OR has_any_column_privilege(role_record.oid, relation_oid, 'REFERENCES')
          )
        )
        OR (
          role_record.rolname <> 'pg_read_all_data'
          AND (
            has_table_privilege(role_record.oid, relation_oid, 'SELECT')
            OR has_any_column_privilege(role_record.oid, relation_oid, 'SELECT')
          )
          AND NOT (
            pg_has_role(role_record.oid, 'pg_read_all_data', 'USAGE')
            AND NOT pg_has_role(role_record.oid, 'pg_write_all_data', 'USAGE')
            AND (
              (
                role_record.rolname = 'supabase_etl_admin'
                AND role_record.rolcanlogin
                AND role_record.rolinherit
                AND role_record.rolbypassrls
                AND role_record.rolreplication
                AND NOT role_record.rolcreaterole
                AND NOT role_record.rolcreatedb
                AND role_record.rolconfig IS NULL
              )
              OR (
                role_record.rolname = 'supabase_read_only_user'
                AND role_record.rolcanlogin
                AND role_record.rolinherit
                AND role_record.rolbypassrls
                AND NOT role_record.rolreplication
                AND NOT role_record.rolcreaterole
                AND NOT role_record.rolcreatedb
                AND role_record.rolconfig = ARRAY['default_transaction_read_only=on']
              )
            )
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'SECURITY_RATE_LIMIT_VERIFICATION_FAILED: unexpected effective role access detected';
  END IF;

  FOREACH function_signature IN ARRAY ARRAY[
    'public.consume_security_rate_limit(text,text,integer,integer)',
    'public.reset_security_rate_limit(text,text)'
  ] LOOP
    function_oid := to_regprocedure(function_signature);
    IF function_oid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM pg_proc function_record
      JOIN pg_language language_record ON language_record.oid = function_record.prolang
      WHERE function_record.oid = function_oid
        AND function_record.proowner = migration_owner
        AND function_record.prokind = 'f'
        AND language_record.lanname = 'plpgsql'
        AND function_record.prosecdef
        AND function_record.proconfig
          = ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        AND function_record.provolatile = 'v'
        AND function_record.proparallel = 'u'
        AND NOT function_record.proisstrict
        AND NOT function_record.proleakproof
        AND function_record.provariadic = 0
        AND function_record.pronargdefaults = 0
        AND function_record.prosupport = 0
        AND function_record.prosqlbody IS NULL
        AND function_record.probin IS NULL
    ) OR 2 <> (
      SELECT count(*)
      FROM pg_proc function_record
      CROSS JOIN LATERAL aclexplode(
        coalesce(function_record.proacl, acldefault('f', function_record.proowner))
      ) acl_entry
      WHERE function_record.oid = function_oid
        AND acl_entry.grantor = migration_owner
        AND (
          (
            acl_entry.grantee = migration_owner
            AND acl_entry.privilege_type = 'EXECUTE'
            AND NOT acl_entry.is_grantable
          )
          OR (
            acl_entry.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
            AND acl_entry.privilege_type = 'EXECUTE'
            AND NOT acl_entry.is_grantable
          )
        )
    ) OR EXISTS (
      SELECT 1
      FROM pg_proc function_record
      CROSS JOIN LATERAL aclexplode(
        coalesce(function_record.proacl, acldefault('f', function_record.proowner))
      ) acl_entry
      WHERE function_record.oid = function_oid
        AND (
          acl_entry.grantor <> migration_owner
          OR acl_entry.grantee NOT IN (
            migration_owner,
            (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
          )
          OR acl_entry.privilege_type <> 'EXECUTE'
          OR acl_entry.is_grantable
        )
    ) THEN
      RAISE EXCEPTION 'SECURITY_RATE_LIMIT_VERIFICATION_FAILED: function contract drifted for %', function_signature;
    END IF;
  END LOOP;
END
$verification$;
