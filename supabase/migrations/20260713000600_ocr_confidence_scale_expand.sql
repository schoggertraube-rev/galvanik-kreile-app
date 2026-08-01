-- REMOTE WAVE 1: explicitly approved 2026-07-26; expand-only, no value conversion.
-- Expand-only OCR confidence provenance. The verified legacy cohort is
-- fractional; its numeric values stay unchanged until the bridge application
-- is deployed and all old writers are drained.

SET lock_timeout = '5s'

SET statement_timeout = '5min'

SET search_path = pg_catalog, public, pg_temp

DO $migration$
BEGIN
  IF pg_catalog.to_regclass('public.beleg') IS NULL THEN
    RAISE EXCEPTION 'Required table public.beleg is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.beleg'::regclass
      AND attname = 'ocr_confidence_scale'
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_RECONCILIATION_REQUIRED: ocr_confidence_scale already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.beleg'::regclass
      AND conname IN (
        'beleg_ocr_confidence_percent',
        'beleg_ocr_confidence_range_chk',
        'beleg_ocr_confidence_scale_chk',
        'beleg_ocr_confidence_scale_value_chk'
      )
  ) THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_RECONCILIATION_REQUIRED: target constraint name already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.beleg
    WHERE ocr_confidence IS NOT NULL
      AND status IN ('festgeschrieben', 'storniert')
  ) THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_RECONCILIATION_REQUIRED: immutable receipt has unclassified confidence';
  END IF;
END
$migration$

ALTER TABLE public.beleg
  ADD COLUMN ocr_confidence_scale text

-- The preceding ALTER TABLE retains its stronger ACCESS EXCLUSIVE lock until
-- the Supabase CLI's implicit migration batch (including the ledger insert)
-- commits. A separate LOCK TABLE would require an explicit transaction block
-- and would split or strand the runner-owned ledger transaction.

DO $legacy_provenance$
DECLARE
  before_count bigint;
  after_count bigint;
  classified_count bigint;
  updated_count bigint;
  before_digest text;
  after_digest text;
BEGIN
  SELECT
    count(*),
    pg_catalog.md5(coalesce(pg_catalog.string_agg(
      pg_catalog.concat_ws('|', id::text, ocr_confidence::text),
      E'\n'
      ORDER BY id::text
    ), ''))
  INTO before_count, before_digest
  FROM public.beleg
  WHERE ocr_confidence IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM public.beleg
    WHERE ocr_confidence IS NOT NULL
      AND (
        ocr_confidence < 0
        OR ocr_confidence > 1
        OR ocr_confidence::text IN ('NaN', 'Infinity', '-Infinity')
      )
  ) THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_RECONCILIATION_REQUIRED: an unclassified legacy value is not a fraction';
  END IF;

  UPDATE public.beleg
  SET ocr_confidence_scale = 'fraction'
  WHERE ocr_confidence IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  SELECT
    count(*),
    pg_catalog.md5(coalesce(pg_catalog.string_agg(
      pg_catalog.concat_ws('|', id::text, ocr_confidence::text),
      E'\n'
      ORDER BY id::text
    ), ''))
  INTO after_count, after_digest
  FROM public.beleg
  WHERE ocr_confidence IS NOT NULL;

  SELECT count(*)
  INTO classified_count
  FROM public.beleg
  WHERE ocr_confidence IS NOT NULL
    AND ocr_confidence_scale = 'fraction';

  IF updated_count <> before_count
     OR after_count <> before_count
     OR classified_count <> before_count
     OR after_digest IS DISTINCT FROM before_digest THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_RECONCILIATION_REQUIRED: value preservation or cohort classification failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.beleg
    WHERE (ocr_confidence IS NULL AND ocr_confidence_scale IS NOT NULL)
       OR ocr_confidence_scale NOT IN ('fraction', 'percent')
       OR (
         ocr_confidence IS NOT NULL
         AND (
           ocr_confidence < 0
           OR ocr_confidence > 100
           OR ocr_confidence::text IN ('NaN', 'Infinity', '-Infinity')
         )
       )
       OR (
         ocr_confidence_scale = 'fraction'
         AND ocr_confidence > 1
       )
  ) THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_RECONCILIATION_REQUIRED: stored value and scale disagree';
  END IF;
END
$legacy_provenance$

ALTER TABLE public.beleg
  ADD CONSTRAINT beleg_ocr_confidence_range_chk
    CHECK (
      ocr_confidence IS NULL
      OR (
        ocr_confidence >= 0
        AND ocr_confidence <= 100
        AND ocr_confidence::text NOT IN ('NaN', 'Infinity', '-Infinity')
      )
    ) NOT VALID,
  ADD CONSTRAINT beleg_ocr_confidence_scale_chk
    CHECK (
      ocr_confidence_scale IS NULL
      OR ocr_confidence_scale IN ('fraction', 'percent')
    ) NOT VALID,
  ADD CONSTRAINT beleg_ocr_confidence_scale_value_chk
    CHECK (
      (ocr_confidence_scale IS NULL OR ocr_confidence IS NOT NULL)
      AND (
        ocr_confidence_scale IS DISTINCT FROM 'fraction'
        OR ocr_confidence BETWEEN 0 AND 1
      )
    ) NOT VALID

ALTER TABLE public.beleg
  VALIDATE CONSTRAINT beleg_ocr_confidence_range_chk

ALTER TABLE public.beleg
  VALIDATE CONSTRAINT beleg_ocr_confidence_scale_chk

ALTER TABLE public.beleg
  VALIDATE CONSTRAINT beleg_ocr_confidence_scale_value_chk

COMMENT ON COLUMN public.beleg.ocr_confidence IS
  'Provider confidence. Interpret only together with ocr_confidence_scale; this is not an accounting approval.'

COMMENT ON COLUMN public.beleg.ocr_confidence_scale IS
  'Explicit magnitude provenance: fraction or percent. NULL means the stored non-NULL value is not safely interpretable.'

-- This is an exact preservation receipt for the pre-existing receipt boundary,
-- including its current RLS/policy/ACL state. It must not be described as a
-- security remediation of public.beleg.
DO $postflight$
DECLARE
  object_count bigint;
  receipt text;
BEGIN
  WITH columns_catalog AS (
    SELECT
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
    WHERE attribute_record.attrelid = 'public.beleg'::regclass
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
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
      ORDER BY attnum
    ))
  INTO object_count, receipt
  FROM columns_catalog;

  IF object_count <> 34
     OR receipt IS DISTINCT FROM 'e1ce1f9549c3130798a292eca4276606' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: column contract drifted';
  END IF;

  WITH constraints_catalog AS (
    SELECT
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
    WHERE constraint_record.conrelid = 'public.beleg'::regclass
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        conname,
        constraint_type,
        convalidated,
        condeferrable,
        condeferred,
        definition,
        constraint_comment
      ),
      E'\x1e'
      ORDER BY conname
    ))
  INTO object_count, receipt
  FROM constraints_catalog;

  IF object_count <> 7
     OR receipt IS DISTINCT FROM '2ae7b4d3d17e8986cbf230b9df57fd3f' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: constraint contract drifted';
  END IF;

  WITH database_owner AS (
    SELECT datdba
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
  ),
  index_catalog AS (
    SELECT
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
    WHERE index_record.indrelid = 'public.beleg'::regclass
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
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
      ORDER BY relname
    ))
  INTO object_count, receipt
  FROM index_catalog;

  IF object_count <> 5
     OR receipt IS DISTINCT FROM '37b0e28d06f9693323a71024dc1a06cb' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: index contract drifted';
  END IF;

  WITH trigger_catalog AS (
    SELECT
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
    WHERE trigger_record.tgrelid = 'public.beleg'::regclass
      AND NOT trigger_record.tgisinternal
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
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
      ORDER BY tgname
    ))
  INTO object_count, receipt
  FROM trigger_catalog;

  IF object_count <> 3
     OR receipt IS DISTINCT FROM '3cd259a63d093d843a1e68ab9c3f8c6b' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: trigger contract drifted';
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
    WHERE procedure_record.oid IN (
      'public.log_beleg_insert()'::regprocedure,
      'public.prevent_beleg_mutation()'::regprocedure,
      'public.prevent_beleg_delete()'::regprocedure
    )
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

  IF object_count <> 3
     OR receipt IS DISTINCT FROM '8c674f85936453808811bc40a992f211' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: function contract drifted';
  END IF;

  WITH database_owner AS (
    SELECT datdba
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
  ),
  relation_catalog AS (
    SELECT
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
    WHERE relation_record.oid = 'public.beleg'::regclass
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
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
    ))
  INTO object_count, receipt
  FROM relation_catalog;

  IF object_count <> 1
     OR receipt IS DISTINCT FROM '0e9a4610918f7a4aee62e23dadf75b2d' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: relation contract drifted';
  END IF;

  WITH database_owner AS (
    SELECT datdba
    FROM pg_catalog.pg_database
    WHERE datname = pg_catalog.current_database()
  ),
  table_acl_catalog AS (
    SELECT
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
    WHERE relation_record.oid = 'public.beleg'::regclass
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        grantee_name,
        grantor_name,
        privilege_type,
        is_grantable
      ),
      E'\x1e'
      ORDER BY grantee_name, privilege_type, grantor_name
    ))
  INTO object_count, receipt
  FROM table_acl_catalog;

  IF object_count <> 32
     OR receipt IS DISTINCT FROM '8e04edddbc6cc2e130bdc5bf21675890' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: table ACL contract drifted';
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
    WHERE procedure_record.oid IN (
      'public.log_beleg_insert()'::regprocedure,
      'public.prevent_beleg_mutation()'::regprocedure,
      'public.prevent_beleg_delete()'::regprocedure
    )
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

  IF object_count <> 15
     OR receipt IS DISTINCT FROM '927d5dd065d18f1570171726a1447612' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: function ACL contract drifted';
  END IF;

  WITH policy_catalog AS (
    SELECT
      policy_record.polname,
      policy_record.polcmd::text AS command,
      policy_record.polpermissive,
      pg_catalog.array_to_string(ARRAY(
        SELECT role_record.rolname
        FROM pg_catalog.pg_roles role_record
        WHERE role_record.oid = ANY(policy_record.polroles)
        ORDER BY role_record.rolname
      ), ',') AS roles,
      coalesce(
        pg_catalog.pg_get_expr(
          policy_record.polqual,
          policy_record.polrelid,
          true
        ),
        '<none>'
      ) AS qualifier,
      coalesce(
        pg_catalog.pg_get_expr(
          policy_record.polwithcheck,
          policy_record.polrelid,
          true
        ),
        '<none>'
      ) AS check_expression,
      coalesce(
        pg_catalog.obj_description(policy_record.oid, 'pg_policy'),
        '<none>'
      ) AS policy_comment
    FROM pg_catalog.pg_policy policy_record
    WHERE policy_record.polrelid = 'public.beleg'::regclass
  )
  SELECT
    count(*),
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        E'\x1f',
        polname,
        command,
        polpermissive,
        roles,
        qualifier,
        check_expression,
        policy_comment
      ),
      E'\x1e'
      ORDER BY polname
    ))
  INTO object_count, receipt
  FROM policy_catalog;

  IF object_count <> 1
     OR receipt IS DISTINCT FROM '469b62cb8155ea5efea07167cea07843' THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: policy contract drifted';
  END IF;

  SELECT count(*)
  INTO object_count
  FROM pg_catalog.pg_attribute attribute_record
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute_record.attacl) acl_entry
  WHERE attribute_record.attrelid = 'public.beleg'::regclass
    AND attribute_record.attnum > 0
    AND NOT attribute_record.attisdropped;

  IF object_count <> 0 THEN
    RAISE EXCEPTION 'OCR_CONFIDENCE_POSTFLIGHT_FAILED: column ACL contract drifted';
  END IF;
END
$postflight$
