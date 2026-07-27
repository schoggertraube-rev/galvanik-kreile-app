-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- Establishes the canonical source table that the later 01200 event boundary
-- previously assumed out-of-band. Applying only this migration leaves event
-- access closed; 01200 grants the exact service_role read/append contract.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL search_path = pg_catalog, pg_temp;

DO $preflight$
DECLARE
  migration_owner oid := (SELECT oid FROM pg_roles WHERE rolname = current_user);
  relation_oid oid := to_regclass('public.events');
  invalid_rows boolean := false;
BEGIN
  IF migration_owner IS NULL
     OR migration_owner IS DISTINCT FROM (
       SELECT datdba FROM pg_database WHERE datname = current_database()
     )
     OR current_user IN ('anon', 'authenticated', 'service_role', 'authenticator') THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_PREFLIGHT_FAILED: database owner required';
  END IF;

  IF to_regclass('public.orders') IS NULL OR to_regclass('public.app_users') IS NULL THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_PREFLIGHT_FAILED: orders and app_users are required';
  END IF;

  IF relation_oid IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_class relation_record
    JOIN pg_namespace namespace_record ON namespace_record.oid = relation_record.relnamespace
    WHERE relation_record.oid = relation_oid
      AND namespace_record.nspname = 'public'
      AND relation_record.relname = 'events'
      AND relation_record.relkind IN ('r', 'p')
      AND relation_record.relowner = migration_owner
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_PREFLIGHT_FAILED: existing events relation has an unsafe kind or owner';
  END IF;

  IF relation_oid IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM pg_class relation_record
      CROSS JOIN LATERAL aclexplode(relation_record.relacl) acl_entry
      WHERE relation_record.oid = relation_oid
        AND acl_entry.grantor <> migration_owner
    )
    OR EXISTS (
      SELECT 1
      FROM pg_attribute attribute_record
      CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
      WHERE attribute_record.attrelid = relation_oid
        AND attribute_record.attnum > 0
        AND NOT attribute_record.attisdropped
        AND acl_entry.grantor <> migration_owner
    )
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_PREFLIGHT_FAILED: foreign ACL grantor must revoke events access first';
  END IF;

  IF relation_oid IS NOT NULL AND EXISTS (
    SELECT required.column_name
    FROM (VALUES
      ('id'),
      ('tenant_id'),
      ('order_id'),
      ('item_id'),
      ('event_type'),
      ('description'),
      ('notes'),
      ('user_id'),
      ('worker_id'),
      ('created_at'),
      ('payload'),
      ('status'),
      ('station')
    ) required(column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_attribute attribute_record
      WHERE attribute_record.attrelid = relation_oid
        AND attribute_record.attname = required.column_name
        AND attribute_record.attnum > 0
        AND NOT attribute_record.attisdropped
    )
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_PREFLIGHT_FAILED: existing 13-column events source is incomplete';
  END IF;

  IF relation_oid IS NOT NULL AND EXISTS (
    SELECT 1
    FROM (VALUES
      ('id', 'text'),
      ('tenant_id', 'character varying(50)'),
      ('order_id', 'text'),
      ('item_id', 'text'),
      ('event_type', 'character varying(100)'),
      ('description', 'text'),
      ('notes', 'text'),
      ('user_id', 'uuid'),
      ('worker_id', 'character varying(100)'),
      ('created_at', 'timestamp without time zone'),
      ('payload', 'jsonb'),
      ('status', 'character varying(50)'),
      ('station', 'text')
    ) expected(column_name, formatted_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_attribute attribute_record
      WHERE attribute_record.attrelid = relation_oid
        AND attribute_record.attname = expected.column_name
        AND attribute_record.attnum > 0
        AND NOT attribute_record.attisdropped
        AND format_type(attribute_record.atttypid, attribute_record.atttypmod) = expected.formatted_type
    )
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_PREFLIGHT_FAILED: existing events column types are incompatible';
  END IF;

  IF relation_oid IS NOT NULL THEN
    EXECUTE $query$
      SELECT EXISTS (
        SELECT 1 FROM public.events event_record
        WHERE event_record.id IS NULL
           OR event_record.tenant_id IS NULL
           OR btrim(event_record.tenant_id::text) = ''
           OR event_record.order_id IS NULL
           OR event_record.event_type IS NULL
           OR event_record.status IS NULL
           OR btrim(event_record.status::text) = ''
           OR event_record.created_at IS NULL
      )
    $query$ INTO invalid_rows;
    IF invalid_rows THEN
      RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_PREFLIGHT_FAILED: existing events contain invalid required values';
    END IF;
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.events (
  id text PRIMARY KEY,
  tenant_id varchar(50) NOT NULL DEFAULT 'galvanik-kreile',
  client_event_id uuid,
  order_id text NOT NULL,
  item_id text,
  event_type varchar(100) NOT NULL,
  description text,
  notes text,
  payload jsonb,
  status varchar(50) NOT NULL DEFAULT 'success',
  user_id uuid,
  worker_id varchar(100),
  station text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT,
  CONSTRAINT events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS client_event_id uuid,
  ADD COLUMN IF NOT EXISTS item_id text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS status varchar(50) DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS worker_id varchar(100),
  ADD COLUMN IF NOT EXISTS station text;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_source_tenant_not_null_chk,
  ADD CONSTRAINT events_source_tenant_not_null_chk
    CHECK (tenant_id IS NOT NULL) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_source_order_not_null_chk,
  ADD CONSTRAINT events_source_order_not_null_chk
    CHECK (order_id IS NOT NULL) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_source_status_not_null_chk,
  ADD CONSTRAINT events_source_status_not_null_chk
    CHECK (status IS NOT NULL) NOT VALID;

ALTER TABLE public.events
  VALIDATE CONSTRAINT events_source_tenant_not_null_chk,
  VALIDATE CONSTRAINT events_source_order_not_null_chk,
  VALIDATE CONSTRAINT events_source_status_not_null_chk;

ALTER TABLE public.events
  ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile',
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'success',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.events
  DROP CONSTRAINT events_source_tenant_not_null_chk,
  DROP CONSTRAINT events_source_order_not_null_chk,
  DROP CONSTRAINT events_source_status_not_null_chk;

DO $constraints$
DECLARE
  constraint_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.events'::regclass
      AND constraint_record.contype = 'p'
      AND constraint_record.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.events'::regclass AND attname = 'id')
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_FAILED: events.id primary key is missing or drifted';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.events event_record
    LEFT JOIN public.orders order_record ON order_record.id = event_record.order_id
    WHERE order_record.id IS NULL
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_FAILED: orphan order reference';
  END IF;

  FOR constraint_name IN
    SELECT constraint_record.conname
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.events'::regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confrelid = 'public.orders'::regclass
      AND constraint_record.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.events'::regclass AND attname = 'order_id')
      ]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE public.events
    ADD CONSTRAINT events_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

  IF EXISTS (
    SELECT 1
    FROM public.events event_record
    LEFT JOIN public.app_users user_record ON user_record.id = event_record.user_id
    WHERE event_record.user_id IS NOT NULL AND user_record.id IS NULL
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_FAILED: orphan app user reference';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.events'::regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confrelid = 'public.app_users'::regclass
      AND constraint_record.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.events'::regclass AND attname = 'user_id')
      ]::smallint[]
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.app_users(id);
  END IF;
END;
$constraints$;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;

DO $policies$
DECLARE
  policy_name text;
  grantee_sql text;
  column_list text;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.events', policy_name);
  END LOOP;

  FOR grantee_sql IN
    SELECT DISTINCT CASE
      WHEN acl_entry.grantee = 0 THEN 'PUBLIC'
      ELSE quote_ident(pg_get_userbyid(acl_entry.grantee))
    END
    FROM pg_class relation_record
    CROSS JOIN LATERAL aclexplode(relation_record.relacl) acl_entry
    WHERE relation_record.oid = 'public.events'::regclass
      AND acl_entry.grantee <> relation_record.relowner
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.events FROM %s', grantee_sql);
  END LOOP;

  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO column_list
  FROM pg_attribute
  WHERE attrelid = 'public.events'::regclass
    AND attnum > 0
    AND NOT attisdropped;

  FOR grantee_sql IN
    SELECT DISTINCT CASE
      WHEN acl_entry.grantee = 0 THEN 'PUBLIC'
      ELSE quote_ident(pg_get_userbyid(acl_entry.grantee))
    END
    FROM pg_attribute attribute_record
    CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = 'public.events'::regclass
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
      AND acl_entry.grantee <> (
        SELECT relowner FROM pg_class WHERE oid = 'public.events'::regclass
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES (%s) ON TABLE public.events FROM %s',
      column_list,
      grantee_sql
    );
  END LOOP;
END;
$policies$;

DO $verification$
DECLARE
  migration_owner oid := (SELECT oid FROM pg_roles WHERE rolname = current_user);
BEGIN
  IF 14 <> (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
  ) OR EXISTS (
    SELECT 1
    FROM (VALUES
      ('id', 'text', false),
      ('tenant_id', 'character varying', false),
      ('client_event_id', 'uuid', true),
      ('order_id', 'text', false),
      ('item_id', 'text', true),
      ('event_type', 'character varying', false),
      ('description', 'text', true),
      ('notes', 'text', true),
      ('payload', 'jsonb', true),
      ('status', 'character varying', false),
      ('user_id', 'uuid', true),
      ('worker_id', 'character varying', true),
      ('station', 'text', true),
      ('created_at', 'timestamp without time zone', false)
    ) expected(column_name, data_type, nullable)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns actual
      WHERE actual.table_schema = 'public'
        AND actual.table_name = 'events'
        AND actual.column_name = expected.column_name
        AND actual.data_type = expected.data_type
        AND (actual.is_nullable = 'YES') = expected.nullable
    )
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_VERIFICATION_FAILED: column contract drifted';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('tenant_id', 'character varying(50)'),
      ('event_type', 'character varying(100)'),
      ('status', 'character varying(50)'),
      ('worker_id', 'character varying(100)')
    ) expected(column_name, formatted_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_attribute attribute_record
      WHERE attribute_record.attrelid = 'public.events'::regclass
        AND attribute_record.attname = expected.column_name
        AND attribute_record.attnum > 0
        AND NOT attribute_record.attisdropped
        AND format_type(attribute_record.atttypid, attribute_record.atttypmod) = expected.formatted_type
    )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.events'::regclass
      AND constraint_record.contype = 'f'
      AND constraint_record.confrelid = 'public.orders'::regclass
      AND constraint_record.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.events'::regclass AND attname = 'order_id')
      ]::smallint[]
      AND constraint_record.confdeltype = 'r'
      AND constraint_record.convalidated
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_VERIFICATION_FAILED: typmod or evidence-retention FK drifted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute attribute_record
    JOIN pg_attrdef default_record
      ON default_record.adrelid = attribute_record.attrelid
     AND default_record.adnum = attribute_record.attnum
    WHERE attribute_record.attrelid = 'public.events'::regclass
      AND attribute_record.attname = 'tenant_id'
      AND pg_get_expr(default_record.adbin, default_record.adrelid) = '''galvanik-kreile''::character varying'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_attribute attribute_record
    JOIN pg_attrdef default_record
      ON default_record.adrelid = attribute_record.attrelid
     AND default_record.adnum = attribute_record.attnum
    WHERE attribute_record.attrelid = 'public.events'::regclass
      AND attribute_record.attname = 'status'
      AND pg_get_expr(default_record.adbin, default_record.adrelid) = '''success''::character varying'
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_VERIFICATION_FAILED: defaults drifted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class relation_record
    WHERE relation_record.oid = 'public.events'::regclass
      AND relation_record.relowner = migration_owner
      AND relation_record.relrowsecurity
      AND relation_record.relforcerowsecurity
  ) OR EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.events'::regclass
  ) OR EXISTS (
    SELECT 1
    FROM pg_class relation_record
    CROSS JOIN LATERAL aclexplode(
      coalesce(relation_record.relacl, acldefault('r', relation_record.relowner))
    ) acl_entry
    WHERE relation_record.oid = 'public.events'::regclass
      AND acl_entry.grantee <> migration_owner
  ) OR EXISTS (
    SELECT 1
    FROM pg_attribute attribute_record
    CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = 'public.events'::regclass
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
      AND acl_entry.grantee <> migration_owner
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_EVENTS_SOURCE_VERIFICATION_FAILED: server-only ACL boundary drifted';
  END IF;
END;
$verification$;
