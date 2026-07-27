-- REMOTE WAVE 1: explicitly approved 2026-07-26; use only the reviewed atomic runner.
-- Signed, transparent tenant control state. No remote code execution and no covert slowdown mode.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL search_path = pg_catalog, public, pg_temp;

CREATE TABLE public.tenant_operator_controls (
  tenant_id text PRIMARY KEY,
  plan varchar(20) NOT NULL,
  mode varchar(20) NOT NULL,
  reason varchar(40) NOT NULL,
  notice varchar(500),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  issued_at timestamptz NOT NULL,
  policy_version bigint NOT NULL,
  canonical_payload text NOT NULL,
  signature varchar(100) NOT NULL,
  request_digest varchar(64) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT tenant_operator_controls_tenant_chk CHECK (tenant_id = 'galvanik-kreile'),
  CONSTRAINT tenant_operator_controls_plan_chk CHECK (plan IN ('basis', 'pro', 'premium', 'enterprise')),
  CONSTRAINT tenant_operator_controls_mode_chk CHECK (mode IN ('active', 'grace', 'suspended', 'maintenance')),
  CONSTRAINT tenant_operator_controls_reason_chk CHECK (reason IN (
    'payment_overdue', 'contract_ended', 'maintenance', 'security_incident', 'manual_review', 'restored'
  )),
  CONSTRAINT tenant_operator_controls_semantics_chk CHECK (
    (mode = 'active' AND reason = 'restored') OR
    (mode = 'grace' AND reason IN ('payment_overdue', 'manual_review')) OR
    (mode = 'suspended' AND reason IN ('payment_overdue', 'contract_ended', 'security_incident', 'manual_review')) OR
    (mode = 'maintenance' AND reason IN ('maintenance', 'security_incident'))
  ),
  CONSTRAINT tenant_operator_controls_notice_chk CHECK (mode = 'active' OR notice IS NOT NULL),
  CONSTRAINT tenant_operator_controls_window_chk CHECK (expires_at IS NULL OR expires_at > effective_at),
  CONSTRAINT tenant_operator_controls_grace_expiry_chk CHECK (mode <> 'grace' OR expires_at IS NOT NULL),
  CONSTRAINT tenant_operator_controls_version_chk CHECK (policy_version > 0),
  CONSTRAINT tenant_operator_controls_signature_chk CHECK (signature ~ '^[A-Za-z0-9_-]{86}$'),
  CONSTRAINT tenant_operator_controls_digest_chk CHECK (request_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX tenant_operator_controls_mode_idx
  ON public.tenant_operator_controls (mode, effective_at);

CREATE TABLE public.operator_control_events (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  tenant_id text NOT NULL,
  policy_version bigint NOT NULL,
  plan varchar(20) NOT NULL,
  mode varchar(20) NOT NULL,
  reason varchar(40) NOT NULL,
  notice varchar(500),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  issued_at timestamptz NOT NULL,
  canonical_payload text NOT NULL,
  signature varchar(100) NOT NULL,
  request_digest varchar(64) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT operator_control_events_tenant_version_uidx UNIQUE (tenant_id, policy_version),
  CONSTRAINT operator_control_events_tenant_chk CHECK (tenant_id = 'galvanik-kreile'),
  CONSTRAINT operator_control_events_plan_chk CHECK (plan IN ('basis', 'pro', 'premium', 'enterprise')),
  CONSTRAINT operator_control_events_mode_chk CHECK (mode IN ('active', 'grace', 'suspended', 'maintenance')),
  CONSTRAINT operator_control_events_reason_chk CHECK (reason IN (
    'payment_overdue', 'contract_ended', 'maintenance', 'security_incident', 'manual_review', 'restored'
  )),
  CONSTRAINT operator_control_events_semantics_chk CHECK (
    (mode = 'active' AND reason = 'restored') OR
    (mode = 'grace' AND reason IN ('payment_overdue', 'manual_review')) OR
    (mode = 'suspended' AND reason IN ('payment_overdue', 'contract_ended', 'security_incident', 'manual_review')) OR
    (mode = 'maintenance' AND reason IN ('maintenance', 'security_incident'))
  ),
  CONSTRAINT operator_control_events_notice_chk CHECK (mode = 'active' OR notice IS NOT NULL),
  CONSTRAINT operator_control_events_window_chk CHECK (expires_at IS NULL OR expires_at > effective_at),
  CONSTRAINT operator_control_events_grace_expiry_chk CHECK (mode <> 'grace' OR expires_at IS NOT NULL),
  CONSTRAINT operator_control_events_version_chk CHECK (policy_version > 0),
  CONSTRAINT operator_control_events_signature_chk CHECK (signature ~ '^[A-Za-z0-9_-]{86}$'),
  CONSTRAINT operator_control_events_digest_chk CHECK (request_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX operator_control_events_tenant_received_idx
  ON public.operator_control_events (tenant_id, received_at DESC);

CREATE FUNCTION public.enforce_operator_control_monotonic_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.policy_version <= OLD.policy_version THEN
    RAISE EXCEPTION 'operator control policy_version must increase (% <= %)', NEW.policy_version, OLD.policy_version
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER tenant_operator_controls_monotonic_version_trg
BEFORE UPDATE ON public.tenant_operator_controls
FOR EACH ROW EXECUTE FUNCTION public.enforce_operator_control_monotonic_version();

REVOKE ALL ON FUNCTION public.enforce_operator_control_monotonic_version() FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.tenant_operator_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_operator_controls FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operator_control_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_control_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tenant_operator_controls FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.operator_control_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tenant_operator_controls TO service_role;
GRANT SELECT, INSERT ON TABLE public.operator_control_events TO service_role;

DO $verification$
DECLARE
  browser_grants integer;
  forbidden_grants integer;
BEGIN
  SELECT count(*) INTO browser_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('tenant_operator_controls', 'operator_control_events')
    AND grantee IN ('anon', 'authenticated');
  IF browser_grants <> 0 THEN RAISE EXCEPTION 'Operator control tables expose % browser grants', browser_grants; END IF;

  SELECT count(*) INTO forbidden_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('tenant_operator_controls', 'operator_control_events')
    AND grantee = 'service_role'
    AND privilege_type IN ('DELETE', 'TRUNCATE');
  IF forbidden_grants <> 0 THEN RAISE EXCEPTION 'Operator control state must not be deletable'; END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'operator_control_events'
      AND grantee = 'service_role' AND privilege_type = 'UPDATE'
  ) THEN RAISE EXCEPTION 'Operator control event history must be append-only'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.tenant_operator_controls'::regclass
      AND tgname = 'tenant_operator_controls_monotonic_version_trg'
      AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'Operator control current state must reject version regressions'; END IF;

  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('tenant_operator_controls', 'operator_control_events')
        AND c.relrowsecurity AND c.relforcerowsecurity) <> 2
  THEN RAISE EXCEPTION 'Operator control tables must use forced RLS'; END IF;
END
$verification$;

DO $access_verification$
DECLARE
  migration_owner constant oid := (
    SELECT datdba FROM pg_database WHERE datname = current_database()
  );
  service_role_oid constant oid := (
    SELECT oid FROM pg_roles WHERE rolname = 'service_role'
  );
  relation_oid oid;
  relation_name text;
BEGIN
  IF service_role_oid IS NULL OR EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE oid = service_role_oid
      AND (rolsuper OR NOT rolbypassrls OR rolcanlogin)
  ) THEN
    RAISE EXCEPTION
      'OPERATOR_CONTROL_VERIFICATION_FAILED: service_role must be NOLOGIN, NOSUPERUSER and BYPASSRLS';
  END IF;

  FOR relation_oid, relation_name IN
    SELECT *
    FROM (VALUES
      ('public.tenant_operator_controls'::regclass::oid, 'tenant_operator_controls'),
      ('public.operator_control_events'::regclass::oid, 'operator_control_events')
    ) AS expected(relation_oid, relation_name)
  LOOP
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
      RAISE EXCEPTION
        'OPERATOR_CONTROL_VERIFICATION_FAILED: unexpected effective role access on %',
        relation_name;
    END IF;

    IF NOT has_table_privilege(service_role_oid, relation_oid, 'SELECT')
       OR NOT has_table_privilege(service_role_oid, relation_oid, 'INSERT')
       OR has_table_privilege(service_role_oid, relation_oid, 'DELETE')
       OR has_table_privilege(service_role_oid, relation_oid, 'TRUNCATE')
       OR has_table_privilege(service_role_oid, relation_oid, 'REFERENCES')
       OR has_table_privilege(service_role_oid, relation_oid, 'TRIGGER')
       OR has_table_privilege(service_role_oid, relation_oid, 'MAINTAIN')
       OR has_any_column_privilege(service_role_oid, relation_oid, 'REFERENCES')
       OR (
         relation_name = 'tenant_operator_controls'
         AND NOT has_table_privilege(service_role_oid, relation_oid, 'UPDATE')
       )
       OR (
         relation_name = 'operator_control_events'
         AND (
           has_table_privilege(service_role_oid, relation_oid, 'UPDATE')
           OR has_any_column_privilege(service_role_oid, relation_oid, 'UPDATE')
         )
       ) THEN
      RAISE EXCEPTION
        'OPERATOR_CONTROL_VERIFICATION_FAILED: service_role access drifted on %',
        relation_name;
    END IF;
  END LOOP;
END
$access_verification$;

DO $catalog_receipt$
DECLARE
  object_count bigint;
  receipt text;
BEGIN
  WITH columns_catalog AS (
    SELECT
      attribute_record.attrelid::regclass::text AS relation_name,
      attribute_record.attnum,
      attribute_record.attname,
      pg_catalog.format_type(
        attribute_record.atttypid,
        attribute_record.atttypmod
      ) AS data_type,
      attribute_record.attnotnull,
      coalesce(
        pg_catalog.pg_get_expr(default_record.adbin, default_record.adrelid),
        '<none>'
      ) AS default_expression,
      coalesce(nullif(attribute_record.attidentity, ''), '<none>') AS identity_kind,
      coalesce(nullif(attribute_record.attgenerated, ''), '<none>') AS generated_kind,
      attribute_record.attstorage::text AS storage_kind,
      coalesce(nullif(attribute_record.attcompression, ''), '<none>') AS compression_kind,
      CASE
        WHEN attribute_record.attcollation = 0 THEN '<none>'
        ELSE attribute_record.attcollation::regcollation::text
      END AS collation_name,
      coalesce(attribute_record.attacl::text, '<none>') AS column_acl,
      coalesce(
        pg_catalog.col_description(
          attribute_record.attrelid,
          attribute_record.attnum
        ),
        '<none>'
      ) AS column_comment
    FROM pg_catalog.pg_attribute attribute_record
    LEFT JOIN pg_catalog.pg_attrdef default_record
      ON default_record.adrelid = attribute_record.attrelid
     AND default_record.adnum = attribute_record.attnum
    WHERE attribute_record.attrelid IN (
      'public.tenant_operator_controls'::regclass,
      'public.operator_control_events'::regclass
    )
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        relation_name,
        attnum,
        attname,
        data_type,
        attnotnull,
        default_expression,
        identity_kind,
        generated_kind,
        storage_kind,
        compression_kind,
        collation_name,
        column_acl,
        column_comment
      ),
      E'\x1e'
      ORDER BY relation_name, attnum
    ))
  INTO object_count, receipt
  FROM columns_catalog;

  IF object_count <> 28
     OR receipt IS DISTINCT FROM '299b7dd18a794ce08ca2d9818032bfd2' THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: column contract drifted';
  END IF;

  WITH constraints_catalog AS (
    SELECT
      constraint_record.conrelid::regclass::text AS relation_name,
      constraint_record.conname,
      constraint_record.contype::text AS constraint_type,
      constraint_record.convalidated,
      constraint_record.condeferrable,
      constraint_record.condeferred,
      pg_catalog.pg_get_constraintdef(constraint_record.oid, true) AS definition,
      coalesce(
        pg_catalog.obj_description(constraint_record.oid, 'pg_constraint'),
        '<none>'
      ) AS constraint_comment
    FROM pg_catalog.pg_constraint constraint_record
    WHERE constraint_record.conrelid IN (
      'public.tenant_operator_controls'::regclass,
      'public.operator_control_events'::regclass
    )
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        relation_name,
        conname,
        constraint_type,
        convalidated,
        condeferrable,
        condeferred,
        definition,
        constraint_comment
      ),
      E'\x1e'
      ORDER BY relation_name, conname
    ))
  INTO object_count, receipt
  FROM constraints_catalog;

  IF object_count <> 25
     OR receipt IS DISTINCT FROM '958ab189d71bcc00044bb0c74d0cbfbf' THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: constraint contract drifted';
  END IF;

  WITH database_owner AS (
    SELECT datdba
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
  ),
  index_catalog AS (
    SELECT
      index_record.indrelid::regclass::text AS relation_name,
      index_relation.relname,
      access_method.amname,
      CASE
        WHEN index_relation.relowner = database_owner.datdba
          THEN '<database_owner>'
        ELSE owner_role.rolname
      END AS owner_name,
      index_record.indisprimary,
      index_record.indisunique,
      index_record.indisvalid,
      index_record.indisready,
      index_record.indisclustered,
      index_record.indisreplident,
      index_record.indnullsnotdistinct,
      index_record.indnkeyatts,
      index_record.indnatts,
      index_record.indoption::text AS index_options,
      coalesce(
        pg_catalog.pg_get_expr(index_record.indpred, index_record.indrelid, true),
        '<none>'
      ) AS predicate,
      coalesce(
        pg_catalog.pg_get_expr(index_record.indexprs, index_record.indrelid, true),
        '<none>'
      ) AS expressions,
      coalesce(index_relation.reloptions::text, '<none>') AS relation_options,
      index_relation.reltablespace,
      pg_catalog.pg_get_indexdef(index_record.indexrelid) AS definition,
      coalesce(
        pg_catalog.obj_description(index_relation.oid, 'pg_class'),
        '<none>'
      ) AS index_comment
    FROM pg_catalog.pg_index index_record
    JOIN pg_catalog.pg_class index_relation
      ON index_relation.oid = index_record.indexrelid
    JOIN pg_catalog.pg_am access_method
      ON access_method.oid = index_relation.relam
    JOIN pg_catalog.pg_roles owner_role
      ON owner_role.oid = index_relation.relowner
    CROSS JOIN database_owner
    WHERE index_record.indrelid IN (
      'public.tenant_operator_controls'::regclass,
      'public.operator_control_events'::regclass
    )
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        relation_name,
        relname,
        amname,
        owner_name,
        indisprimary,
        indisunique,
        indisvalid,
        indisready,
        indisclustered,
        indisreplident,
        indnullsnotdistinct,
        indnkeyatts,
        indnatts,
        index_options,
        predicate,
        expressions,
        relation_options,
        reltablespace,
        definition,
        index_comment
      ),
      E'\x1e'
      ORDER BY relation_name, relname
    ))
  INTO object_count, receipt
  FROM index_catalog;

  IF object_count <> 5
     OR receipt IS DISTINCT FROM '8a072395b8c468a1dca4cfef4249df60' THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: index contract drifted';
  END IF;

  WITH trigger_catalog AS (
    SELECT
      trigger_record.tgrelid::regclass::text AS relation_name,
      trigger_record.tgname,
      trigger_record.tgenabled::text AS enabled_state,
      trigger_record.tgtype::text AS trigger_type,
      trigger_record.tgfoid::regprocedure::text AS function_signature,
      coalesce(
        pg_catalog.pg_get_expr(
          trigger_record.tgqual,
          trigger_record.tgrelid,
          true
        ),
        '<none>'
      ) AS qualifier,
      pg_catalog.encode(trigger_record.tgargs, 'hex') AS arguments,
      coalesce(trigger_record.tgoldtable, '<none>') AS old_table,
      coalesce(trigger_record.tgnewtable, '<none>') AS new_table,
      pg_catalog.pg_get_triggerdef(trigger_record.oid, true) AS definition,
      coalesce(
        pg_catalog.obj_description(trigger_record.oid, 'pg_trigger'),
        '<none>'
      ) AS trigger_comment
    FROM pg_catalog.pg_trigger trigger_record
    WHERE trigger_record.tgrelid IN (
      'public.tenant_operator_controls'::regclass,
      'public.operator_control_events'::regclass
    )
      AND NOT trigger_record.tgisinternal
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        relation_name,
        tgname,
        enabled_state,
        trigger_type,
        function_signature,
        qualifier,
        arguments,
        old_table,
        new_table,
        definition,
        trigger_comment
      ),
      E'\x1e'
      ORDER BY relation_name, tgname
    ))
  INTO object_count, receipt
  FROM trigger_catalog;

  IF object_count <> 1
     OR receipt IS DISTINCT FROM '78093fcd916891d1e26a872cd0315c2f' THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: trigger contract drifted';
  END IF;

  WITH database_owner AS (
    SELECT datdba
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
  ),
  function_catalog AS (
    SELECT
      procedure_record.oid::regprocedure::text AS function_signature,
      CASE
        WHEN procedure_record.proowner = database_owner.datdba
          THEN '<database_owner>'
        ELSE owner_role.rolname
      END AS owner_name,
      language_record.lanname,
      procedure_record.prokind::text AS function_kind,
      procedure_record.provolatile::text AS volatility,
      procedure_record.proparallel::text AS parallel_safety,
      procedure_record.proisstrict,
      procedure_record.prosecdef,
      procedure_record.proleakproof,
      procedure_record.proretset,
      procedure_record.prorettype::regtype::text AS return_type,
      procedure_record.pronargs,
      procedure_record.pronargdefaults,
      procedure_record.procost,
      procedure_record.prorows,
      procedure_record.provariadic::text AS variadic_type,
      procedure_record.prosupport::text AS support_function,
      coalesce(procedure_record.proargtypes::text, '<none>') AS argument_types,
      coalesce(procedure_record.proallargtypes::text, '<none>') AS all_argument_types,
      coalesce(procedure_record.proargmodes::text, '<none>') AS argument_modes,
      coalesce(procedure_record.proargnames::text, '<none>') AS argument_names,
      coalesce(procedure_record.proargdefaults::text, '<none>') AS argument_defaults,
      coalesce(procedure_record.protrftypes::text, '<none>') AS transform_types,
      coalesce(procedure_record.proconfig::text, '<none>') AS function_config,
      procedure_record.prosrc,
      coalesce(procedure_record.probin, '<none>') AS binary_source,
      coalesce(procedure_record.prosqlbody::text, '<none>') AS sql_body,
      coalesce(
        pg_catalog.obj_description(procedure_record.oid, 'pg_proc'),
        '<none>'
      ) AS function_comment
    FROM pg_catalog.pg_proc procedure_record
    JOIN pg_catalog.pg_roles owner_role
      ON owner_role.oid = procedure_record.proowner
    JOIN pg_catalog.pg_language language_record
      ON language_record.oid = procedure_record.prolang
    CROSS JOIN database_owner
    WHERE procedure_record.oid =
      'public.enforce_operator_control_monotonic_version()'::regprocedure
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        function_signature,
        owner_name,
        lanname,
        function_kind,
        volatility,
        parallel_safety,
        proisstrict,
        prosecdef,
        proleakproof,
        proretset,
        return_type,
        pronargs,
        pronargdefaults,
        procost,
        prorows,
        variadic_type,
        support_function,
        argument_types,
        all_argument_types,
        argument_modes,
        argument_names,
        argument_defaults,
        transform_types,
        function_config,
        prosrc,
        binary_source,
        sql_body,
        function_comment
      ),
      E'\x1e'
      ORDER BY function_signature
    ))
  INTO object_count, receipt
  FROM function_catalog;

  IF object_count <> 1
     OR receipt IS DISTINCT FROM '0191f22e4e868bea23b3c127bb49d4c9' THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: function contract drifted';
  END IF;

  WITH database_owner AS (
    SELECT datdba
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
  ),
  relation_catalog AS (
    SELECT
      relation_record.relname,
      relation_record.relkind::text AS relation_kind,
      relation_record.relpersistence::text AS persistence,
      CASE
        WHEN relation_record.relowner = database_owner.datdba
          THEN '<database_owner>'
        ELSE owner_role.rolname
      END AS owner_name,
      relation_record.relrowsecurity,
      relation_record.relforcerowsecurity,
      relation_record.relreplident::text AS replica_identity,
      coalesce(relation_record.reloptions::text, '<none>') AS relation_options,
      relation_record.reltablespace,
      coalesce(
        pg_catalog.obj_description(relation_record.oid, 'pg_class'),
        '<none>'
      ) AS relation_comment
    FROM pg_catalog.pg_class relation_record
    JOIN pg_catalog.pg_roles owner_role
      ON owner_role.oid = relation_record.relowner
    CROSS JOIN database_owner
    WHERE relation_record.oid IN (
      'public.tenant_operator_controls'::regclass,
      'public.operator_control_events'::regclass
    )
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        relname,
        relation_kind,
        persistence,
        owner_name,
        relrowsecurity,
        relforcerowsecurity,
        replica_identity,
        relation_options,
        reltablespace,
        relation_comment
      ),
      E'\x1e'
      ORDER BY relname
    ))
  INTO object_count, receipt
  FROM relation_catalog;

  IF object_count <> 2
     OR receipt IS DISTINCT FROM '079cc5eca0dff3b1b69beb4d1523e9a2' THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: relation contract drifted';
  END IF;

  WITH database_owner AS (
    SELECT datdba
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
  ),
  table_acl_catalog AS (
    SELECT
      relation_record.relname,
      CASE
        WHEN acl_entry.grantee = database_owner.datdba
          THEN '<database_owner>'
        ELSE coalesce(grantee_role.rolname, 'PUBLIC')
      END AS grantee_name,
      CASE
        WHEN acl_entry.grantor = database_owner.datdba
          THEN '<database_owner>'
        ELSE grantor_role.rolname
      END AS grantor_name,
      acl_entry.privilege_type,
      acl_entry.is_grantable
    FROM pg_catalog.pg_class relation_record
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      coalesce(
        relation_record.relacl,
        pg_catalog.acldefault('r', relation_record.relowner)
      )
    ) acl_entry
    LEFT JOIN pg_catalog.pg_roles grantee_role
      ON grantee_role.oid = acl_entry.grantee
    JOIN pg_catalog.pg_roles grantor_role
      ON grantor_role.oid = acl_entry.grantor
    CROSS JOIN database_owner
    WHERE relation_record.oid IN (
      'public.tenant_operator_controls'::regclass,
      'public.operator_control_events'::regclass
    )
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        relname,
        grantee_name,
        grantor_name,
        privilege_type,
        is_grantable
      ),
      E'\x1e'
      ORDER BY relname, grantee_name, privilege_type, grantor_name
    ))
  INTO object_count, receipt
  FROM table_acl_catalog;

  IF object_count <> 21
     OR receipt IS DISTINCT FROM 'e84bab4e53053faa40def221a2c62037' THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: table ACL contract drifted';
  END IF;

  WITH database_owner AS (
    SELECT datdba
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
  ),
  function_acl_catalog AS (
    SELECT
      procedure_record.oid::regprocedure::text AS function_signature,
      CASE
        WHEN acl_entry.grantee = database_owner.datdba
          THEN '<database_owner>'
        ELSE coalesce(grantee_role.rolname, 'PUBLIC')
      END AS grantee_name,
      CASE
        WHEN acl_entry.grantor = database_owner.datdba
          THEN '<database_owner>'
        ELSE grantor_role.rolname
      END AS grantor_name,
      acl_entry.privilege_type,
      acl_entry.is_grantable
    FROM pg_catalog.pg_proc procedure_record
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      coalesce(
        procedure_record.proacl,
        pg_catalog.acldefault('f', procedure_record.proowner)
      )
    ) acl_entry
    LEFT JOIN pg_catalog.pg_roles grantee_role
      ON grantee_role.oid = acl_entry.grantee
    JOIN pg_catalog.pg_roles grantor_role
      ON grantor_role.oid = acl_entry.grantor
    CROSS JOIN database_owner
    WHERE procedure_record.oid =
      'public.enforce_operator_control_monotonic_version()'::regprocedure
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        function_signature,
        grantee_name,
        grantor_name,
        privilege_type,
        is_grantable
      ),
      E'\x1e'
      ORDER BY function_signature, grantee_name, privilege_type, grantor_name
    ))
  INTO object_count, receipt
  FROM function_acl_catalog;

  IF object_count <> 1
     OR receipt IS DISTINCT FROM 'a1bdc34c3f63252273d0cd232293fe2c' THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: function ACL contract drifted';
  END IF;

  SELECT count(*)
  INTO object_count
  FROM pg_catalog.pg_policy policy_record
  WHERE policy_record.polrelid IN (
    'public.tenant_operator_controls'::regclass,
    'public.operator_control_events'::regclass
  );

  IF object_count <> 0 THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: policy contract drifted';
  END IF;

  SELECT count(*)
  INTO object_count
  FROM pg_catalog.pg_attribute attribute_record
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute_record.attacl) acl_entry
  WHERE attribute_record.attrelid IN (
    'public.tenant_operator_controls'::regclass,
    'public.operator_control_events'::regclass
  )
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  IF object_count <> 0 THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: column ACL contract drifted';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenant_operator_controls)
     OR EXISTS (SELECT 1 FROM public.operator_control_events) THEN
    RAISE EXCEPTION 'OPERATOR_CONTROL_POSTFLIGHT_FAILED: migration created control state';
  END IF;
END
$catalog_receipt$;
