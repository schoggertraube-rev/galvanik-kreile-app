-- REMOTE WAVE 1: explicitly approved 2026-07-26; data-minimized append-only telemetry.
-- Expand only: the legacy sink is sealed by the later ui_events contract after
-- every executable dependency has moved to a typed, truthful server ledger.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL search_path = pg_catalog, public, pg_temp;

CREATE TABLE public.app_usage_events (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  tenant_id text NOT NULL,
  client_event_id uuid NOT NULL,
  actor_pseudonym varchar(64) NOT NULL,
  actor_role varchar(50) NOT NULL,
  session_id uuid NOT NULL,
  event_type varchar(50) NOT NULL,
  route varchar(200) NOT NULL,
  target varchar(100),
  device_class varchar(20) NOT NULL,
  outcome varchar(20),
  duration_ms integer,
  result_count integer,
  query_length integer,
  click_count integer,
  build_id varchar(100),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT app_usage_events_tenant_client_uidx UNIQUE (tenant_id, client_event_id),
  CONSTRAINT app_usage_events_tenant_fixed CHECK (tenant_id = 'galvanik-kreile'),
  CONSTRAINT app_usage_events_actor_pseudonym_chk CHECK (actor_pseudonym ~ '^[0-9a-f]{64}$'),
  CONSTRAINT app_usage_events_actor_role_chk CHECK (actor_role IN ('developer', 'admin', 'meister', 'buero', 'werkstatt', 'readonly')),
  CONSTRAINT app_usage_events_type_chk CHECK (event_type IN (
    'nav_click', 'overlay_open', 'overlay_close_backdrop', 'overlay_close_esc',
    'page_view', 'detail_open', 'search', 'action', 'tool_usage',
    'workflow_started', 'workflow_step', 'workflow_completed', 'workflow_abandoned', 'error'
  )),
  CONSTRAINT app_usage_events_route_chk CHECK (route ~ '^/(?:[a-z][a-z-]{0,39}|:id)?(?:/(?:[a-z][a-z-]{0,39}|:id)){0,4}$'),
  CONSTRAINT app_usage_events_target_chk CHECK (
    target IS NULL OR target ~ '^(?:[a-z][a-z0-9._:-]{0,79}|/(?:[a-z][a-z-]{0,39})(?:/[a-z][a-z-]{0,39})?)$'
  ),
  CONSTRAINT app_usage_events_device_chk CHECK (device_class IN ('desktop', 'tablet', 'mobile', 'unknown')),
  CONSTRAINT app_usage_events_outcome_chk CHECK (outcome IS NULL OR outcome IN ('success', 'failure', 'cancelled', 'empty', 'unknown')),
  CONSTRAINT app_usage_events_duration_chk CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 3600000),
  CONSTRAINT app_usage_events_result_count_chk CHECK (result_count IS NULL OR result_count BETWEEN 0 AND 100000),
  CONSTRAINT app_usage_events_query_length_chk CHECK (query_length IS NULL OR query_length BETWEEN 0 AND 500),
  CONSTRAINT app_usage_events_click_count_chk CHECK (click_count IS NULL OR click_count BETWEEN 0 AND 10000),
  CONSTRAINT app_usage_events_time_window_chk CHECK (
    occurred_at >= received_at - interval '7 days' AND occurred_at <= received_at + interval '5 minutes'
  )
);

CREATE INDEX app_usage_events_tenant_occurred_idx
  ON public.app_usage_events (tenant_id, occurred_at DESC);
CREATE INDEX app_usage_events_tenant_type_idx
  ON public.app_usage_events (tenant_id, event_type, occurred_at DESC);

ALTER TABLE public.app_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_usage_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_usage_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.app_usage_events TO service_role;
GRANT INSERT (
  tenant_id,
  client_event_id,
  actor_pseudonym,
  actor_role,
  session_id,
  event_type,
  route,
  target,
  device_class,
  outcome,
  duration_ms,
  result_count,
  query_length,
  click_count,
  build_id,
  occurred_at
) ON public.app_usage_events TO service_role;

DO $verification$
DECLARE
  relation_oid constant oid := 'public.app_usage_events'::regclass;
  migration_owner constant oid := (
    SELECT datdba FROM pg_database WHERE datname = current_database()
  );
  service_role_oid constant oid := (
    SELECT oid FROM pg_roles WHERE rolname = 'service_role'
  );
BEGIN
  IF service_role_oid IS NULL OR EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE oid = service_role_oid
      AND (rolsuper OR NOT rolbypassrls OR rolcanlogin)
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_class relation_record
    JOIN pg_namespace namespace_record
      ON namespace_record.oid = relation_record.relnamespace
    JOIN pg_am access_method
      ON access_method.oid = relation_record.relam
    WHERE relation_record.oid = relation_oid
      AND namespace_record.nspname = 'public'
      AND relation_record.relname = 'app_usage_events'
      AND relation_record.relkind = 'r'
      AND relation_record.relpersistence = 'p'
      AND NOT relation_record.relispartition
      AND relation_record.relowner = migration_owner
      AND relation_record.relrowsecurity
      AND relation_record.relforcerowsecurity
      AND relation_record.reloptions IS NULL
      AND relation_record.relreplident = 'd'
      AND NOT relation_record.relhasrules
      AND NOT relation_record.relhastriggers
      AND access_method.amname = 'heap'
  ) THEN
    RAISE EXCEPTION 'USAGE_TELEMETRY_VERIFICATION_FAILED: relation contract drifted';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_attribute
    WHERE attrelid = relation_oid
      AND attnum > 0
      AND NOT attisdropped
  ) <> 18 OR (
    SELECT md5(string_agg(
      concat_ws(
        '|',
        attribute_record.attnum,
        attribute_record.attname,
        format_type(attribute_record.atttypid, attribute_record.atttypmod),
        attribute_record.attnotnull,
        attribute_record.attidentity,
        attribute_record.attgenerated,
        coalesce(pg_get_expr(
          default_record.adbin,
          default_record.adrelid,
          false
        ), '<null>')
      ),
      chr(10)
      ORDER BY attribute_record.attnum
    ))
    FROM pg_attribute attribute_record
    LEFT JOIN pg_attrdef default_record
      ON default_record.adrelid = attribute_record.attrelid
     AND default_record.adnum = attribute_record.attnum
    WHERE attribute_record.attrelid = relation_oid
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) IS DISTINCT FROM '96329a27f16c1bbbac9763e7079f39e2' THEN
    RAISE EXCEPTION 'USAGE_TELEMETRY_VERIFICATION_FAILED: column contract drifted';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = relation_oid
  ) <> 15 OR (
    SELECT md5(string_agg(
      concat_ws(
        '|',
        constraint_record.conname,
        constraint_record.contype,
        constraint_record.convalidated,
        constraint_record.condeferrable,
        constraint_record.condeferred,
        constraint_record.conislocal,
        constraint_record.coninhcount,
        constraint_record.connoinherit,
        constraint_record.conparentid,
        constraint_record.conkey::text,
        coalesce(constraint_index.relname, '<null>'),
        pg_get_constraintdef(constraint_record.oid, false)
      ),
      chr(10)
      ORDER BY constraint_record.conname
    ))
    FROM pg_constraint constraint_record
    LEFT JOIN pg_class constraint_index
      ON constraint_index.oid = constraint_record.conindid
    WHERE constraint_record.conrelid = relation_oid
  ) IS DISTINCT FROM '44fb44262bab6f001fea45c5921c3988' THEN
    RAISE EXCEPTION 'USAGE_TELEMETRY_VERIFICATION_FAILED: constraint contract drifted';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_index
    WHERE indrelid = relation_oid
  ) <> 4 OR (
    WITH index_catalog AS (
      SELECT
        index_relation.relname AS index_name,
        index_relation.relkind::text AS index_kind,
        index_relation.relpersistence::text AS persistence,
        (index_relation.relowner = migration_owner)::text AS owner_ok,
        coalesce(index_relation.reloptions::text, '<null>') AS relation_options,
        index_relation.reltablespace::text AS tablespace,
        access_method.amname,
        index_record.indisunique::text,
        index_record.indisprimary::text,
        index_record.indisexclusion::text,
        index_record.indimmediate::text,
        index_record.indisclustered::text,
        index_record.indisvalid::text,
        index_record.indcheckxmin::text,
        index_record.indisready::text,
        index_record.indislive::text,
        index_record.indisreplident::text,
        index_record.indnkeyatts::text,
        index_record.indnatts::text,
        index_record.indnullsnotdistinct::text,
        ARRAY(
          SELECT pg_get_indexdef(index_record.indexrelid, position, true)
          FROM generate_series(1, index_record.indnkeyatts) position
          ORDER BY position
        )::text AS key_expressions,
        ARRAY(
          SELECT option_value
          FROM unnest(index_record.indoption)
            WITH ORDINALITY AS option_record(option_value, position)
          ORDER BY position
        )::text AS key_options,
        ARRAY(
          SELECT namespace_record.nspname || '.' || opclass_record.opcname
          FROM unnest(index_record.indclass)
            WITH ORDINALITY AS class_record(opclass_oid, position)
          JOIN pg_opclass opclass_record
            ON opclass_record.oid = class_record.opclass_oid
          JOIN pg_namespace namespace_record
            ON namespace_record.oid = opclass_record.opcnamespace
          ORDER BY position
        )::text AS opclasses,
        ARRAY(
          SELECT CASE
            WHEN collation_oid = 0 THEN '<none>'
            ELSE (
              SELECT namespace_record.nspname || '.' || collation_record.collname
              FROM pg_collation collation_record
              JOIN pg_namespace namespace_record
                ON namespace_record.oid = collation_record.collnamespace
              WHERE collation_record.oid = collation_oid
            )
          END
          FROM unnest(index_record.indcollation)
            WITH ORDINALITY AS collation_entry(collation_oid, position)
          ORDER BY position
        )::text AS collations,
        coalesce(
          pg_get_expr(index_record.indexprs, index_record.indrelid, false),
          '<null>'
        ) AS expressions,
        coalesce(
          pg_get_expr(index_record.indpred, index_record.indrelid, false),
          '<null>'
        ) AS predicate
      FROM pg_index index_record
      JOIN pg_class index_relation
        ON index_relation.oid = index_record.indexrelid
      JOIN pg_am access_method
        ON access_method.oid = index_relation.relam
      WHERE index_record.indrelid = relation_oid
    )
    SELECT md5(string_agg(
      concat_ws(
        '|',
        index_name, index_kind, persistence, owner_ok,
        relation_options, tablespace, amname,
        indisunique, indisprimary, indisexclusion, indimmediate,
        indisclustered, indisvalid, indcheckxmin, indisready,
        indislive, indisreplident, indnkeyatts, indnatts,
        indnullsnotdistinct, key_expressions, key_options,
        opclasses, collations, expressions, predicate
      ),
      chr(10)
      ORDER BY index_name
    ))
    FROM index_catalog
  ) IS DISTINCT FROM '0d21423c3153c809e951c2a93b44287d' THEN
    RAISE EXCEPTION 'USAGE_TELEMETRY_VERIFICATION_FAILED: index contract drifted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = relation_oid
  ) OR (
    SELECT count(*)
    FROM pg_class relation_record
    CROSS JOIN LATERAL aclexplode(
      coalesce(relation_record.relacl, acldefault('r', relation_record.relowner))
    ) acl_entry
    WHERE relation_record.oid = relation_oid
  ) <> 9 OR EXISTS (
    SELECT 1
    FROM pg_class relation_record
    CROSS JOIN LATERAL aclexplode(
      coalesce(relation_record.relacl, acldefault('r', relation_record.relowner))
    ) acl_entry
    WHERE relation_record.oid = relation_oid
      AND NOT (
        (
          acl_entry.grantee = migration_owner
          AND acl_entry.grantor = migration_owner
          AND acl_entry.privilege_type IN (
            'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
          )
          AND NOT acl_entry.is_grantable
        )
        OR (
          acl_entry.grantee = service_role_oid
          AND acl_entry.grantor = migration_owner
          AND acl_entry.privilege_type = 'SELECT'
          AND NOT acl_entry.is_grantable
        )
      )
  ) OR (
    SELECT count(*)
    FROM pg_attribute attribute_record
    CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = relation_oid
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  ) <> 16 OR EXISTS (
    SELECT 1
    FROM pg_attribute attribute_record
    CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = relation_oid
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
      AND NOT (
        attribute_record.attname IN (
          'tenant_id',
          'client_event_id',
          'actor_pseudonym',
          'actor_role',
          'session_id',
          'event_type',
          'route',
          'target',
          'device_class',
          'outcome',
          'duration_ms',
          'result_count',
          'query_length',
          'click_count',
          'build_id',
          'occurred_at'
        )
        AND acl_entry.grantee = service_role_oid
        AND acl_entry.grantor = migration_owner
        AND acl_entry.privilege_type = 'INSERT'
        AND NOT acl_entry.is_grantable
      )
  ) THEN
    RAISE EXCEPTION 'USAGE_TELEMETRY_VERIFICATION_FAILED: RLS or ACL contract drifted';
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
    RAISE EXCEPTION 'USAGE_TELEMETRY_VERIFICATION_FAILED: unexpected effective role access detected';
  END IF;

  IF NOT has_table_privilege(service_role_oid, relation_oid, 'SELECT')
     OR has_table_privilege(service_role_oid, relation_oid, 'INSERT')
     OR has_table_privilege(service_role_oid, relation_oid, 'UPDATE')
     OR has_table_privilege(service_role_oid, relation_oid, 'DELETE')
     OR has_table_privilege(service_role_oid, relation_oid, 'TRUNCATE')
     OR has_table_privilege(service_role_oid, relation_oid, 'REFERENCES')
     OR has_table_privilege(service_role_oid, relation_oid, 'TRIGGER')
     OR has_table_privilege(service_role_oid, relation_oid, 'MAINTAIN')
     OR NOT has_any_column_privilege(service_role_oid, relation_oid, 'INSERT')
     OR has_any_column_privilege(service_role_oid, relation_oid, 'UPDATE')
     OR has_any_column_privilege(service_role_oid, relation_oid, 'REFERENCES')
     OR has_column_privilege(service_role_oid, relation_oid, 'id', 'INSERT')
     OR has_column_privilege(service_role_oid, relation_oid, 'received_at', 'INSERT')
     OR NOT has_column_privilege(service_role_oid, relation_oid, 'occurred_at', 'INSERT') THEN
    RAISE EXCEPTION 'USAGE_TELEMETRY_VERIFICATION_FAILED: service role access drifted';
  END IF;
END
$verification$;
