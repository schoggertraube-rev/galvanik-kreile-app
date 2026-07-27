\set ON_ERROR_STOP on

DO $legacy_contract$
DECLARE
  relation_owner oid;
BEGIN
  SELECT relowner
  INTO relation_owner
  FROM pg_class
  WHERE oid = 'public.ui_events'::regclass;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ui_events'
  ) OR EXISTS (
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
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_class relation_record
    WHERE relation_record.oid = 'public.ui_events'::regclass
      AND relation_record.relrowsecurity
      AND relation_record.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'UI_EVENTS_CONTRACT_VALIDATION_FAILED';
  END IF;
END
$legacy_contract$;

SELECT 'usage_telemetry_contract_ok' AS result;
