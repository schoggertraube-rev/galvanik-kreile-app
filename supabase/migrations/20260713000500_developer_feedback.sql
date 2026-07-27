-- REMOTE WAVE 1: explicitly approved 2026-07-26; use only the reviewed atomic runner.
-- Explicit user feedback for the future operator control plane; separate from usage telemetry and marketing feedback.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL search_path = pg_catalog, public, pg_temp;

CREATE TABLE public.developer_feedback (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  tenant_id varchar(50) NOT NULL,
  client_request_id uuid NOT NULL,
  actor_pseudonym varchar(64) NOT NULL,
  actor_role varchar(50) NOT NULL,
  route varchar(200) NOT NULL,
  message text NOT NULL,
  build_id varchar(100),
  status varchar(20) NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT developer_feedback_actor_request_uidx UNIQUE (tenant_id, actor_pseudonym, client_request_id),
  CONSTRAINT developer_feedback_tenant_fixed CHECK (tenant_id = 'galvanik-kreile'),
  CONSTRAINT developer_feedback_actor_chk CHECK (actor_pseudonym ~ '^[0-9a-f]{64}$'),
  CONSTRAINT developer_feedback_role_chk CHECK (actor_role IN ('developer', 'admin', 'meister', 'buero', 'werkstatt', 'readonly')),
  CONSTRAINT developer_feedback_route_chk CHECK (route ~ '^/(?:[a-z][a-z-]{0,39}|:id)?(?:/(?:[a-z][a-z-]{0,39}|:id)){0,4}$'),
  CONSTRAINT developer_feedback_message_chk CHECK (char_length(message) BETWEEN 3 AND 2000),
  CONSTRAINT developer_feedback_status_chk CHECK (status = 'new')
);

CREATE INDEX developer_feedback_tenant_created_idx
  ON public.developer_feedback (tenant_id, created_at DESC);
CREATE INDEX developer_feedback_tenant_status_idx
  ON public.developer_feedback (tenant_id, status, created_at DESC);

ALTER TABLE public.developer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_feedback FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.developer_feedback FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.developer_feedback TO service_role;
GRANT INSERT (
  tenant_id,
  client_request_id,
  actor_pseudonym,
  actor_role,
  route,
  message,
  build_id
) ON public.developer_feedback TO service_role;

DO $verification$
DECLARE
  relation_oid constant oid := 'public.developer_feedback'::regclass;
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
      AND relation_record.relname = 'developer_feedback'
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
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_VERIFICATION_FAILED: relation contract drifted';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_attribute
    WHERE attrelid = relation_oid
      AND attnum > 0
      AND NOT attisdropped
  ) <> 10 OR (
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
  ) IS DISTINCT FROM 'efc1a0101adfdb474aad32b1db6abfd2' THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_VERIFICATION_FAILED: column contract drifted';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = relation_oid
  ) <> 8 OR (
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
  ) IS DISTINCT FROM '5763760744112d926281c051452277df' THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_VERIFICATION_FAILED: constraint contract drifted';
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
  ) IS DISTINCT FROM '31c9c745b6a5afec113c873c75917d6a' THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_VERIFICATION_FAILED: index contract drifted';
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
  ) <> 7 OR EXISTS (
    SELECT 1
    FROM pg_attribute attribute_record
    CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = relation_oid
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
      AND NOT (
        attribute_record.attname IN (
          'tenant_id',
          'client_request_id',
          'actor_pseudonym',
          'actor_role',
          'route',
          'message',
          'build_id'
        )
        AND acl_entry.grantee = service_role_oid
        AND acl_entry.grantor = migration_owner
        AND acl_entry.privilege_type = 'INSERT'
        AND NOT acl_entry.is_grantable
      )
  ) THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_VERIFICATION_FAILED: RLS or ACL contract drifted';
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
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_VERIFICATION_FAILED: unexpected effective role access detected';
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
     OR has_column_privilege(service_role_oid, relation_oid, 'status', 'INSERT')
     OR has_column_privilege(service_role_oid, relation_oid, 'created_at', 'INSERT')
     OR NOT has_column_privilege(service_role_oid, relation_oid, 'message', 'INSERT') THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_VERIFICATION_FAILED: service role access drifted';
  END IF;
END
$verification$;
