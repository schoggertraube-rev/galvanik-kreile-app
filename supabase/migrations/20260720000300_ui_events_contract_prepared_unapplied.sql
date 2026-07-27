-- PREPARED ONLY: apply after the PIN-reset request bridge is deployed and
-- executable code no longer reads or writes the legacy arbitrary-JSON sink.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $legacy$
DECLARE
  policy_name text;
  relation_owner oid;
  grantee_record record;
  grantee_sql text;
BEGIN
  IF to_regclass('public.ui_events') IS NULL THEN
    RAISE EXCEPTION 'UI_EVENTS_CONTRACT_FAILED: public.ui_events is missing';
  END IF;

  ALTER TABLE public.ui_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.ui_events FORCE ROW LEVEL SECURITY;

  SELECT relowner
  INTO relation_owner
  FROM pg_class
  WHERE oid = 'public.ui_events'::regclass;

  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ui_events'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.ui_events', policy_name);
  END LOOP;

  FOR grantee_record IN
    SELECT DISTINCT grantee
    FROM (
      SELECT acl_entry.grantee
      FROM pg_class relation_record,
           LATERAL aclexplode(relation_record.relacl) acl_entry
      WHERE relation_record.oid = 'public.ui_events'::regclass
      UNION
      SELECT acl_entry.grantee
      FROM pg_attribute attribute_record,
           LATERAL aclexplode(attribute_record.attacl) acl_entry
      WHERE attribute_record.attrelid = 'public.ui_events'::regclass
        AND attribute_record.attnum > 0
        AND NOT attribute_record.attisdropped
    ) explicit_grantees
    WHERE grantee <> relation_owner
  LOOP
    grantee_sql := CASE
      WHEN grantee_record.grantee = 0 THEN 'PUBLIC'
      ELSE quote_ident((
        SELECT rolname
        FROM pg_roles
        WHERE oid = grantee_record.grantee
      ))
    END;
    IF grantee_sql IS NULL THEN
      RAISE EXCEPTION
        'UI_EVENTS_CONTRACT_FAILED: unknown grantee %',
        grantee_record.grantee;
    END IF;
    EXECUTE
      'REVOKE ALL PRIVILEGES ON TABLE public.ui_events FROM '
      || grantee_sql
      || ' CASCADE';
  END LOOP;
END
$legacy$;

DO $verification$
DECLARE
  relation_owner oid;
BEGIN
  SELECT relowner
  INTO relation_owner
  FROM pg_class
  WHERE oid = 'public.ui_events'::regclass;

  IF EXISTS (
    SELECT 1
    FROM pg_class relation_record,
         LATERAL aclexplode(relation_record.relacl) acl_entry
    WHERE relation_record.oid = 'public.ui_events'::regclass
      AND acl_entry.grantee <> relation_owner
  ) OR EXISTS (
    SELECT 1
    FROM pg_attribute attribute_record,
         LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = 'public.ui_events'::regclass
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
      AND acl_entry.grantee <> relation_owner
  ) THEN
    RAISE EXCEPTION 'UI_EVENTS_CONTRACT_FAILED: unexpected legacy grants remain';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ui_events'
  ) THEN
    RAISE EXCEPTION 'UI_EVENTS_CONTRACT_FAILED: legacy policies remain';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'ui_events'
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'UI_EVENTS_CONTRACT_FAILED: forced RLS is missing';
  END IF;
END
$verification$;
