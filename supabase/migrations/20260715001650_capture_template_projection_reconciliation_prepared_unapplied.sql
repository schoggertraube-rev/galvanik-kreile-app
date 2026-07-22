-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- Reconciles capture templates with the canonical inventory/capture contracts.
-- This migration preserves historical template rows: obsolete projections are
-- marked inactive instead of being deleted.

BEGIN;

SET LOCAL search_path = pg_catalog, pg_temp;

CREATE TEMP TABLE capture_expected_secdef_contract (
  signature text PRIMARY KEY,
  proconfig text[] NOT NULL,
  body_md5 text NOT NULL,
  io_md5 text NOT NULL,
  service_executable boolean NOT NULL,
  returns_set boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.capture_expected_secdef_contract
  (signature, proconfig, body_md5, io_md5, service_executable, returns_set)
VALUES
  ('public.get_mollie_payment_quote(text,text)', ARRAY['search_path=pg_catalog, extensions, public, pg_temp']::text[], '64323e588243eb11d29f2e27270c0104', '25fcd431d639b3f1d67c0f218290871e', true, true),
  ('public.reserve_mollie_payment_attempt(uuid,text,text,bigint,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'e9cd92c3720b8295b3699092f1906a3b', 'e87baa2c03b88d61b9c0714aa691e208', true, true),
  ('public.bind_mollie_payment_provider(uuid,text,text,bigint,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '9196af65db96c0bc7b17597e7bcfe075', '6ec4078fc3ffce3c68b2d973f000e671', true, false),
  ('public.record_mollie_payment_state(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '12e8cf72079be8fbbe5ed43f494e0d0c', '494a983c2f837f44a9c30bfaaeb09ccf', true, true),
  ('public.finalize_mollie_payment(text,text,text,timestamptz,text,text,bigint,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'd8b71dd4335661376fec5d592c15e060', 'ef9825dad89d19b778cbb4f31cc78cd4', true, true),
  ('public.consume_security_rate_limit(text,text,integer,integer)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '311596f0313c11fb4a51ef90f3241584', '9382ddc772176c42f64cc35a766466e3', true, true),
  ('public.reset_security_rate_limit(text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '9e79bdd85c9336c2e748cfbb55ff55d9', 'c70eb964d535689f84f0369c683ca57b', true, false),
  ('public.reserve_ai_usage(text,text,text,text,integer,integer,integer,integer,bigint,bigint)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'b532f4ad667ae95ac44d58668daa1219', 'ea941a7b3d8085fdda7a9a647c1f7c98', true, true),
  ('public.claim_ai_usage_reservation(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'dd3a7c24ffdecbbbb4e1294764129758', '30538ba0c66ff5faca46b42332171f1d', true, false),
  ('public.settle_ai_usage_reservation(uuid,text,text,text,text,integer,text,jsonb)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'a420af6963cf4a4302d53d4c6e384bca', 'ae2ff008ce201376b6a458e3b53bc607', true, true),
  ('public.reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'aed2d28d6637729d030327347edf8491', '242f3a6c90e60e503bc38f0cf59abeb6', true, true),
  ('public.bind_item_photo_upload(uuid,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '6a6769e3aabb2652ddf9242f981b909e', '6066a3c2ac90316a14a288158d8b7728', true, false),
  ('public.claim_item_photo_analysis(uuid)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '46ccd33e07c50ef3ed72f5016af6d13f', '9b10957302449264c7274227e3d858ec', true, true),
  ('public.settle_item_photo_analysis(uuid,text,integer,text,jsonb)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '5db9cd477e5ffb6d57d48940fa0d490c', 'c2f84e274e4730064b0301432b9302ea', true, true),
  ('public.mark_item_photo_uncertain(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'fb75f8f94f65f89937d33d6e73832187', '4d7ae7cc89952db30f7314c13f3513fe', true, false),
  ('public.finance_close_period(uuid,text,uuid,uuid)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'a20f372e57488c6b5dd699f1688a13c2', 'd2fedd0ff1af53fa994c2f6dcb2ab05f', true, true),
  ('public.fn_update_vorlagen()', ARRAY['search_path=pg_catalog, pg_temp']::text[], 'c0a810fd594dd7012e097d2d00be7f50', '2911fbf3f7efd182a3830e31e79eb4e1', false, false),
  ('public.fn_guard_template_projection_source_insert()', ARRAY['search_path=pg_catalog, pg_temp']::text[], '758bf8c0fc6506ad85862f5547a660f2', '2911fbf3f7efd182a3830e31e79eb4e1', false, false),
  ('public.guard_active_mollie_payment_quote()', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '2eaede153b9426c4c7483f538daa8398', '2911fbf3f7efd182a3830e31e79eb4e1', false, false),
  ('public.guard_final_finance_period()', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '6be3c140533c3cb6ee8b0c93dae26dea', '2911fbf3f7efd182a3830e31e79eb4e1', false, false);

CREATE TEMP TABLE capture_expected_secdef_trigger (
  function_signature text NOT NULL,
  relation_name text NOT NULL,
  trigger_name text PRIMARY KEY,
  trigger_type smallint NOT NULL,
  trigger_md5 text NOT NULL
) ON COMMIT DROP;

INSERT INTO pg_temp.capture_expected_secdef_trigger
  (function_signature, relation_name, trigger_name, trigger_type, trigger_md5)
VALUES
  ('public.fn_guard_template_projection_source_insert()', 'public.arbeitszeit_buchung', 'template_projection_time_source_guard_trg', 7, '5bcc98cc276601c794cc86b94543f52a'),
  ('public.fn_guard_template_projection_source_insert()', 'public.items', 'template_projection_items_source_guard_trg', 7, '4ea1d298c5b87ee735867e25b9542f33'),
  ('public.fn_guard_template_projection_source_insert()', 'public.stock_movements', 'template_projection_movement_source_guard_trg', 7, '768f4f1e8a396a1f14d510372e1e0c97'),
  ('public.fn_update_vorlagen()', 'public.orders', 'trg_insert_vorlagen', 5, '8236f23a0ed55e431dc91ae322613169'),
  ('public.fn_update_vorlagen()', 'public.orders', 'trg_update_vorlagen', 17, 'e514cdaf1cca2df32f7807c3f3201523'),
  ('public.guard_active_mollie_payment_quote()', 'public.price_lines', 'trg_price_lines_active_mollie_quote', 31, '5f03627880a6fde058e195e676a51fcc'),
  ('public.guard_final_finance_period()', 'public.ausgangsrechnung', 'ausgangsrechnung_final_period_guard', 31, 'e646b728c23ee051de351cf1f0b4c570'),
  ('public.guard_final_finance_period()', 'public.beleg', 'beleg_final_period_guard', 31, 'c7eab965a3b7be753a967c6a488503ce');

CREATE FUNCTION pg_temp.capture_secdef_contract_valid(
  p_service_role_oid oid,
  p_migration_owner oid,
  p_phase text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $contract$
  SELECT
    p_service_role_oid IS NOT NULL
    AND p_migration_owner IS NOT NULL
    AND p_phase IN ('pre', 'post')
    AND CASE WHEN p_phase = 'pre' THEN 18 ELSE 20 END = (
      SELECT count(*)
      FROM pg_proc function_record
      JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
      WHERE namespace_record.nspname = 'public'
        AND function_record.prosecdef
        AND function_record.oid >= 16384
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp.capture_expected_secdef_contract expected
      LEFT JOIN pg_proc function_record ON function_record.oid = to_regprocedure(expected.signature)
      LEFT JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
      LEFT JOIN pg_language language_record ON language_record.oid = function_record.prolang
      CROSS JOIN LATERAL (
        SELECT
          count(*) AS entry_count,
          count(*) FILTER (WHERE
            acl_entry.grantee = function_record.proowner
            AND acl_entry.grantor = function_record.proowner
            AND acl_entry.privilege_type = 'EXECUTE'
            AND NOT acl_entry.is_grantable
          ) AS owner_entry_count,
          count(*) FILTER (WHERE
            acl_entry.grantee = p_service_role_oid
            AND acl_entry.grantor = function_record.proowner
            AND acl_entry.privilege_type = 'EXECUTE'
            AND NOT acl_entry.is_grantable
          ) AS service_entry_count
        FROM aclexplode(
          coalesce(function_record.proacl, acldefault('f', function_record.proowner))
        ) acl_entry
      ) acl_contract
      WHERE (
          p_phase = 'post'
          OR expected.signature NOT IN (
            'public.fn_update_vorlagen()',
            'public.fn_guard_template_projection_source_insert()'
          )
        )
        AND (
          function_record.oid IS NULL
          OR namespace_record.nspname <> 'public'
          OR NOT function_record.prosecdef
          OR function_record.oid < 16384
          OR function_record.prokind <> 'f'
          OR language_record.lanname <> 'plpgsql'
          OR function_record.proowner <> p_migration_owner
          OR function_record.proconfig IS DISTINCT FROM expected.proconfig
          OR md5(convert_to(
            btrim(regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')),
            'UTF8'
          )) <> expected.body_md5
          OR md5(convert_to(
            pg_get_function_arguments(function_record.oid) || ' -> ' || pg_get_function_result(function_record.oid),
            'UTF8'
          )) <> expected.io_md5
          OR function_record.provolatile <> 'v'
          OR function_record.proparallel <> 'u'
          OR function_record.proisstrict
          OR function_record.proleakproof
          OR function_record.provariadic <> 0
          OR function_record.pronargdefaults <> 0
          OR function_record.prosupport <> 0
          OR function_record.prosqlbody IS NOT NULL
          OR function_record.probin IS NOT NULL
          OR function_record.proretset IS DISTINCT FROM expected.returns_set
          OR function_record.procost <> 100
          OR function_record.prorows <> CASE WHEN expected.returns_set THEN 1000 ELSE 0 END
          OR acl_contract.entry_count <> CASE WHEN expected.service_executable THEN 2 ELSE 1 END
          OR acl_contract.owner_entry_count <> 1
          OR acl_contract.service_entry_count <> CASE WHEN expected.service_executable THEN 1 ELSE 0 END
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp.capture_expected_secdef_trigger expected
      LEFT JOIN pg_trigger trigger_record
        ON trigger_record.tgfoid = to_regprocedure(expected.function_signature)
        AND trigger_record.tgrelid = to_regclass(expected.relation_name)
        AND trigger_record.tgname = expected.trigger_name
      WHERE (
          p_phase = 'post'
          OR expected.function_signature IN (
            'public.guard_active_mollie_payment_quote()',
            'public.guard_final_finance_period()'
          )
        )
        AND (
          trigger_record.oid IS NULL
          OR trigger_record.tgisinternal
          OR trigger_record.tgtype <> expected.trigger_type
          OR trigger_record.tgenabled <> 'O'
          OR trigger_record.tgnargs <> 0
          OR octet_length(trigger_record.tgargs) <> 0
          OR trigger_record.tgconstraint <> 0
          OR trigger_record.tgdeferrable
          OR trigger_record.tginitdeferred
          OR trigger_record.tgparentid <> 0
          OR trigger_record.tgoldtable IS NOT NULL
          OR trigger_record.tgnewtable IS NOT NULL
          OR md5(convert_to(
            btrim(regexp_replace(pg_get_triggerdef(trigger_record.oid), '[[:space:]]+', ' ', 'g')),
            'UTF8'
          )) <> expected.trigger_md5
        )
    )
    AND CASE WHEN p_phase = 'pre' THEN 3 ELSE 8 END = (
      SELECT count(*)
      FROM pg_trigger trigger_record
      WHERE NOT trigger_record.tgisinternal
        AND (
          (p_phase = 'pre' AND trigger_record.tgfoid IN (
            to_regprocedure('public.guard_active_mollie_payment_quote()'),
            to_regprocedure('public.guard_final_finance_period()')
          ))
          OR (p_phase = 'post' AND trigger_record.tgfoid IN (
            to_regprocedure('public.fn_guard_template_projection_source_insert()'),
            to_regprocedure('public.fn_update_vorlagen()'),
            to_regprocedure('public.guard_active_mollie_payment_quote()'),
            to_regprocedure('public.guard_final_finance_period()')
          ))
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger_record
      JOIN pg_proc function_record ON function_record.oid = trigger_record.tgfoid
      WHERE NOT trigger_record.tgisinternal
        AND function_record.prosecdef
        AND function_record.oid >= 16384
        AND (
          has_table_privilege(p_service_role_oid, trigger_record.tgrelid, 'INSERT')
          OR has_table_privilege(p_service_role_oid, trigger_record.tgrelid, 'UPDATE')
          OR has_table_privilege(p_service_role_oid, trigger_record.tgrelid, 'DELETE')
          OR has_any_column_privilege(p_service_role_oid, trigger_record.tgrelid, 'INSERT')
          OR has_any_column_privilege(p_service_role_oid, trigger_record.tgrelid, 'UPDATE')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pg_temp.capture_expected_secdef_trigger expected
          WHERE (
              p_phase = 'post'
              OR expected.function_signature IN (
                'public.guard_active_mollie_payment_quote()',
                'public.guard_final_finance_period()'
              )
            )
            AND trigger_record.tgfoid = to_regprocedure(expected.function_signature)
            AND trigger_record.tgrelid = to_regclass(expected.relation_name)
            AND trigger_record.tgname = expected.trigger_name
        )
        AND NOT (
          p_phase = 'pre'
          AND trigger_record.tgfoid = to_regprocedure('public.fn_update_vorlagen()')
          AND trigger_record.tgrelid = to_regclass('public.orders')
          AND trigger_record.tgname = 'trg_update_vorlagen'
        )
    );
$contract$;

DO $preflight$
DECLARE
  relation_name text;
  migration_owner oid := (SELECT oid FROM pg_roles WHERE rolname = current_user);
  service_role_oid oid := (SELECT oid FROM pg_roles WHERE rolname = 'service_role');
  runtime_role_oid oid := (SELECT oid FROM pg_roles WHERE rolname = 'kreile_app_runtime');
  legacy_function oid := to_regprocedure('public.fn_update_vorlagen()');
BEGIN
  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: PostgreSQL 16 or newer is required for exact role-edge verification';
  END IF;

  IF current_setting('session_replication_role') <> 'origin'
     OR current_setting('lo_compat_privileges') <> 'off' THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: replication and large-object compatibility settings are unsafe';
  END IF;

  FOREACH relation_name IN ARRAY ARRAY[
    'orders', 'items', 'arbeitszeit_buchung', 'teile_klassifikator',
    'stock_movements', 'inventory_items', 'vorlage_zeit', 'vorlage_verbrauch',
    'customers', 'ausgangsrechnung', 'kostenstelle', 'kostenstellen_energie_monat'
  ] LOOP
    IF to_regclass('public.' || relation_name) IS NULL THEN
      RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: missing public.%', relation_name;
    END IF;
  END LOOP;

  IF legacy_function IS NULL THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: legacy fn_update_vorlagen() is missing';
  END IF;

  IF migration_owner IS NULL OR service_role_oid IS NULL OR runtime_role_oid IS NULL OR NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE oid = migration_owner
      AND (rolbypassrls OR rolsuper)
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE oid = service_role_oid
      AND rolbypassrls
      AND NOT rolsuper
      AND NOT rolcanlogin
      AND NOT rolcreaterole
      AND NOT rolcreatedb
      AND NOT rolreplication
      AND rolconfig IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_db_role_setting role_setting
        WHERE role_setting.setrole = service_role_oid
      )
      AND NOT has_database_privilege(service_role_oid, current_database(), 'CREATE')
      AND NOT has_database_privilege(service_role_oid, current_database(), 'TEMP')
      AND NOT has_parameter_privilege(service_role_oid, 'session_replication_role', 'SET')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_namespace namespace_record
        WHERE namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND has_schema_privilege(service_role_oid, namespace_record.oid, 'CREATE')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_tablespace tablespace_record
        WHERE has_tablespace_privilege(service_role_oid, tablespace_record.oid, 'CREATE')
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_auth_members membership
        WHERE membership.member = service_role_oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_auth_members membership
        JOIN pg_roles member_role ON member_role.oid = membership.member
        JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
        WHERE membership.roleid = service_role_oid
          AND (
            member_role.rolname NOT IN ('kreile_app_runtime', 'authenticator')
            OR membership.admin_option
            OR membership.inherit_option
            OR NOT membership.set_option
            OR NOT (grantor_role.rolsuper OR grantor_role.oid = migration_owner)
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_shdepend dependency
        WHERE dependency.refclassid = 'pg_authid'::regclass
          AND dependency.refobjid = service_role_oid
          AND dependency.deptype = 'o'
      )
  ) OR migration_owner IS DISTINCT FROM (
    SELECT datdba FROM pg_database WHERE datname = current_database()
  ) OR current_user IN ('anon', 'authenticated', 'service_role', 'authenticator') THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: migration owner must bypass RLS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class view_record
    WHERE view_record.oid = to_regclass('public.v_auftrag_db')
      AND view_record.relowner <> migration_owner
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: existing v_auftrag_db owner differs from migration owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class view_record
    CROSS JOIN LATERAL aclexplode(view_record.relacl) acl_entry
    WHERE view_record.oid = to_regclass('public.v_auftrag_db')
      AND acl_entry.grantor <> migration_owner
  ) OR EXISTS (
    SELECT 1
    FROM pg_attribute attribute_record
    CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = to_regclass('public.v_auftrag_db')
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
      AND acl_entry.grantor <> migration_owner
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: v_auftrag_db contains ACLs from a foreign grantor; the current grantor or a superuser must revoke them before applying';
  END IF;

  IF (SELECT proowner FROM pg_proc WHERE oid = legacy_function) <> migration_owner THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: legacy function owner differs from migration owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc function_record
    CROSS JOIN LATERAL aclexplode(function_record.proacl) acl_entry
    WHERE function_record.oid = legacy_function
      AND acl_entry.grantor <> migration_owner
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: fn_update_vorlagen contains ACLs from a foreign grantor; the current grantor or a superuser must revoke them before applying';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger trigger_record
    WHERE trigger_record.tgfoid = legacy_function
      AND NOT trigger_record.tgisinternal
      AND NOT (
        trigger_record.tgrelid = 'public.orders'::regclass
        AND trigger_record.tgname = 'trg_update_vorlagen'
      )
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: fn_update_vorlagen has an unknown trigger attachment';
  END IF;

  IF to_regprocedure('public.fn_kreile_template_normalize(text)') IS NOT NULL
     OR to_regprocedure('public.fn_kreile_template_keywords_valid(text[])') IS NOT NULL
     OR to_regprocedure('public.fn_kreile_template_classify(text,text)') IS NOT NULL
     OR to_regprocedure('public.fn_guard_template_projection_source_insert()') IS NOT NULL THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: helper function drift';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('orders', 'trg_insert_vorlagen'),
      ('items', 'template_projection_items_source_guard_trg'),
      ('arbeitszeit_buchung', 'template_projection_time_source_guard_trg'),
      ('stock_movements', 'template_projection_movement_source_guard_trg')
    ) expected(relation_name, trigger_name)
    JOIN pg_trigger trigger_record
      ON trigger_record.tgrelid = to_regclass('public.' || expected.relation_name)
     AND trigger_record.tgname = expected.trigger_name
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: target trigger name already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles runtime_role
    WHERE runtime_role.oid = runtime_role_oid
      AND runtime_role.rolname = 'kreile_app_runtime'
      AND runtime_role.rolcanlogin
      AND NOT runtime_role.rolinherit
      AND NOT runtime_role.rolsuper
      AND NOT runtime_role.rolbypassrls
      AND NOT runtime_role.rolcreaterole
      AND NOT runtime_role.rolcreatedb
      AND NOT runtime_role.rolreplication
      AND runtime_role.rolconfig IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_db_role_setting role_setting
        WHERE role_setting.setrole = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_auth_members membership
        WHERE membership.roleid = runtime_role.oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_auth_members membership
        WHERE membership.member = runtime_role.oid
          AND membership.roleid = service_role_oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_auth_members membership
        WHERE membership.member = runtime_role.oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_auth_members membership
        JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
        WHERE membership.member = runtime_role.oid
          AND membership.roleid = service_role_oid
          AND NOT membership.admin_option
          AND NOT membership.inherit_option
          AND membership.set_option
          AND (grantor_role.rolsuper OR grantor_role.oid = migration_owner)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_class relation_record
        CROSS JOIN LATERAL aclexplode(relation_record.relacl) acl_entry
        WHERE acl_entry.grantee = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_attribute attribute_record
        CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
        WHERE attribute_record.attnum > 0
          AND NOT attribute_record.attisdropped
          AND acl_entry.grantee = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc function_record
        CROSS JOIN LATERAL aclexplode(function_record.proacl) acl_entry
        WHERE acl_entry.grantee = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_namespace namespace_record
        CROSS JOIN LATERAL aclexplode(namespace_record.nspacl) acl_entry
        WHERE acl_entry.grantee = runtime_role.oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_database database_record
        CROSS JOIN LATERAL aclexplode(database_record.datacl) acl_entry
        JOIN pg_roles grantor_role ON grantor_role.oid = acl_entry.grantor
        WHERE database_record.datname = current_database()
          AND acl_entry.grantee = runtime_role.oid
          AND acl_entry.privilege_type = 'CONNECT'
          AND NOT acl_entry.is_grantable
          AND (grantor_role.rolsuper OR grantor_role.oid = database_record.datdba)
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_database database_record
        CROSS JOIN LATERAL aclexplode(database_record.datacl) acl_entry
        WHERE acl_entry.grantee = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_database database_record
        CROSS JOIN LATERAL aclexplode(database_record.datacl) acl_entry
        WHERE database_record.datname = current_database()
          AND acl_entry.grantor = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_database database_record
        CROSS JOIN LATERAL aclexplode(
          coalesce(database_record.datacl, acldefault('d', database_record.datdba))
        ) acl_entry
        WHERE database_record.datname = current_database()
          AND acl_entry.grantee = 0
          AND acl_entry.privilege_type IN ('CONNECT', 'TEMPORARY')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_database database_record
        WHERE database_record.datallowconn
          AND database_record.datname <> current_database()
          AND (
            has_database_privilege(runtime_role.oid, database_record.oid, 'CONNECT')
            OR has_database_privilege(runtime_role.oid, database_record.oid, 'TEMP')
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_shdepend dependency
        WHERE dependency.refclassid = 'pg_authid'::regclass
          AND dependency.refobjid = runtime_role.oid
          AND dependency.deptype IN ('o', 'a', 'r')
          AND NOT (
            dependency.deptype = 'a'
            AND dependency.classid = 'pg_database'::regclass
            AND dependency.objid = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND dependency.objsubid = 0
          )
      )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_proc function_record
       JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
       WHERE function_record.prosecdef
         AND function_record.oid >= 16384
         AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
         AND has_function_privilege(runtime_role.oid, function_record.oid, 'EXECUTE')
     )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_namespace writable_namespace
        CROSS JOIN LATERAL aclexplode(
          coalesce(writable_namespace.nspacl, acldefault('n', writable_namespace.nspowner))
        ) acl_entry
        WHERE writable_namespace.nspname IN ('public', 'extensions')
          AND acl_entry.grantee = 0
          AND acl_entry.privilege_type = 'CREATE'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_roles candidate
        CROSS JOIN pg_namespace writable_namespace
        WHERE writable_namespace.nspname IN ('public', 'extensions')
          AND NOT candidate.rolsuper
          AND candidate.oid <> migration_owner
          AND has_schema_privilege(candidate.oid, writable_namespace.oid, 'CREATE')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc function_record
        JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
        JOIN pg_language language_record ON language_record.oid = function_record.prolang
        JOIN pg_roles owner_role ON owner_role.oid = function_record.proowner
        CROSS JOIN LATERAL (
          SELECT
            coalesce(bool_or(to_regprocedure(approved.signature) = function_record.oid), false) AS signature_approved,
            coalesce(bool_or(
              to_regprocedure(approved.signature) = function_record.oid
              AND function_record.proconfig IS NOT DISTINCT FROM approved.proconfig
            ), false) AS contract_approved
          FROM (VALUES
            ('public.get_mollie_payment_quote(text,text)', ARRAY['search_path=pg_catalog, extensions, public, pg_temp']::text[]),
            ('public.reserve_mollie_payment_attempt(uuid,text,text,bigint,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.bind_mollie_payment_provider(uuid,text,text,bigint,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.record_mollie_payment_state(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.finalize_mollie_payment(text,text,text,timestamptz,text,text,bigint,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.consume_security_rate_limit(text,text,integer,integer)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.reset_security_rate_limit(text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.reserve_ai_usage(text,text,text,text,integer,integer,integer,integer,bigint,bigint)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.claim_ai_usage_reservation(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.settle_ai_usage_reservation(uuid,text,text,text,text,integer,text,jsonb)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.bind_item_photo_upload(uuid,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.claim_item_photo_analysis(uuid)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.settle_item_photo_analysis(uuid,text,integer,text,jsonb)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.mark_item_photo_uncertain(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.finance_close_period(uuid,text,uuid,uuid)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[])
          ) approved(signature, proconfig)
        ) approval
        CROSS JOIN LATERAL (
          SELECT
            count(*) AS entry_count,
            count(*) FILTER (WHERE
              acl_entry.grantee = function_record.proowner
              AND acl_entry.grantor = function_record.proowner
              AND acl_entry.privilege_type = 'EXECUTE'
              AND NOT acl_entry.is_grantable
            ) AS owner_entry_count,
            count(*) FILTER (WHERE
              acl_entry.grantee = service_role_oid
              AND acl_entry.grantor = function_record.proowner
              AND acl_entry.privilege_type = 'EXECUTE'
              AND NOT acl_entry.is_grantable
            ) AS service_entry_count
          FROM aclexplode(
            coalesce(function_record.proacl, acldefault('f', function_record.proowner))
          ) acl_entry
        ) acl_contract
        WHERE function_record.prosecdef
          AND function_record.oid >= 16384
          AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND (
            function_record.prokind <> 'f'
            OR language_record.lanname <> 'plpgsql'
            OR NOT (owner_role.rolsuper OR owner_role.oid = migration_owner)
            OR (
              approval.signature_approved
              AND (
                NOT approval.contract_approved
                OR acl_contract.entry_count <> 2
                OR acl_contract.owner_entry_count <> 1
                OR acl_contract.service_entry_count <> 1
              )
            )
            OR (
              NOT approval.signature_approved
              AND (
                (
                  function_record.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
                  AND function_record.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
                  AND function_record.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, extensions, public, pg_temp']::text[]
                )
                OR acl_contract.entry_count <> 1
                OR acl_contract.owner_entry_count <> 1
              )
            )
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_class relation_record
        JOIN pg_namespace namespace_record ON namespace_record.oid = relation_record.relnamespace
        CROSS JOIN LATERAL aclexplode(
          coalesce(
            relation_record.relacl,
            CASE
              WHEN relation_record.relkind = 'S' THEN acldefault('s', relation_record.relowner)
              ELSE acldefault('r', relation_record.relowner)
            END
          )
        ) acl_entry
        WHERE relation_record.oid >= 16384
          AND relation_record.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND acl_entry.grantee = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_attribute attribute_record
        JOIN pg_class relation_record ON relation_record.oid = attribute_record.attrelid
        JOIN pg_namespace namespace_record ON namespace_record.oid = relation_record.relnamespace
        CROSS JOIN LATERAL aclexplode(
          coalesce(attribute_record.attacl, acldefault('c', relation_record.relowner))
        ) acl_entry
        WHERE relation_record.oid >= 16384
          AND relation_record.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          AND attribute_record.attnum > 0
          AND NOT attribute_record.attisdropped
          AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND acl_entry.grantee = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_largeobject_metadata large_object_record
        CROSS JOIN LATERAL aclexplode(
          coalesce(large_object_record.lomacl, acldefault('L', large_object_record.lomowner))
        ) acl_entry
        WHERE acl_entry.grantee = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_parameter_acl parameter_acl
        CROSS JOIN LATERAL aclexplode(
          coalesce(parameter_acl.paracl, '{}'::aclitem[])
        ) acl_entry
        WHERE acl_entry.grantee IN (0, runtime_role.oid, service_role_oid)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_default_acl default_acl
        CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) acl_entry
        WHERE acl_entry.grantee IN (0, runtime_role.oid, service_role_oid)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc function_record
        JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
        CROSS JOIN LATERAL aclexplode(
          coalesce(function_record.proacl, acldefault('f', function_record.proowner))
        ) acl_entry
        WHERE function_record.prosecdef
          AND function_record.oid >= 16384
          AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND acl_entry.grantee = 0
      )

      AND NOT has_schema_privilege(runtime_role.oid, 'public', 'CREATE')
      AND NOT has_database_privilege(runtime_role.oid, current_database(), 'CREATE')
      AND has_database_privilege(runtime_role.oid, current_database(), 'CONNECT')
      AND NOT has_database_privilege(runtime_role.oid, current_database(), 'TEMP')
      AND NOT has_parameter_privilege(runtime_role.oid, 'session_replication_role', 'SET')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_namespace namespace_record
        WHERE namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND has_schema_privilege(runtime_role.oid, namespace_record.oid, 'CREATE')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_tablespace tablespace_record
        WHERE has_tablespace_privilege(runtime_role.oid, tablespace_record.oid, 'CREATE')
      )
      AND CASE
        WHEN current_setting('server_version_num')::integer >= 160000
          THEN pg_has_role(runtime_role.oid, service_role_oid, 'SET')
        ELSE pg_has_role(runtime_role.oid, service_role_oid, 'MEMBER')
      END
      AND NOT pg_has_role(runtime_role.oid, migration_owner, 'MEMBER')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_roles reachable_role
        WHERE reachable_role.oid NOT IN (runtime_role.oid, service_role_oid)
          AND pg_has_role(runtime_role.oid, reachable_role.oid, 'MEMBER')
      )
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: kreile_app_runtime is missing or can recover a privileged identity';
  END IF;

  IF NOT pg_temp.capture_secdef_contract_valid(service_role_oid, migration_owner, 'pre') THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: SECURITY DEFINER function or trigger inventory drifted';
  END IF;

  -- Supabase's platform-owned authenticator is deliberately not an application
  -- session identity: the official platform graph may also let it SET
  -- supabase_admin. We only seal its direct service_role edge here; a path to
  -- the database owner remains forbidden below. Every app capability requires
  -- session_user = kreile_app_runtime.
  IF EXISTS (
    SELECT 1
    FROM pg_roles candidate
    WHERE candidate.rolname = 'authenticator'
      AND candidate.oid <> service_role_oid
      AND pg_has_role(candidate.oid, service_role_oid, 'MEMBER')
      AND (
        NOT candidate.rolcanlogin OR candidate.rolinherit
        OR candidate.rolsuper OR candidate.rolbypassrls
        OR candidate.rolcreaterole OR candidate.rolcreatedb OR candidate.rolreplication
        OR 1 <> (
          SELECT count(*)
          FROM pg_auth_members membership
          WHERE membership.member = candidate.oid
            AND membership.roleid = service_role_oid
        )
        OR NOT EXISTS (
          SELECT 1
          FROM pg_auth_members membership
          JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
          WHERE membership.member = candidate.oid
            AND membership.roleid = service_role_oid
            AND NOT membership.admin_option
            AND NOT membership.inherit_option
            AND membership.set_option
            AND (grantor_role.rolsuper OR grantor_role.oid = migration_owner)
        )
        OR has_schema_privilege(candidate.oid, 'public', 'CREATE')
        OR has_database_privilege(candidate.oid, current_database(), 'CREATE')
      )
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: approved runtime broker can recover a privileged identity';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles candidate
    WHERE NOT candidate.rolsuper
      AND candidate.oid <> service_role_oid
      AND candidate.rolname NOT IN ('authenticator', 'kreile_app_runtime')
      AND pg_has_role(candidate.oid, service_role_oid, 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: unapproved role can assume service_role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles candidate
    WHERE NOT candidate.rolsuper
      AND candidate.oid <> migration_owner
      AND pg_has_role(candidate.oid, migration_owner, 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: non-superuser can assume migration owner';
  END IF;

  IF NOT has_schema_privilege(current_user, 'public', 'USAGE')
     OR NOT has_schema_privilege(current_user, 'public', 'CREATE')
     OR NOT has_table_privilege(current_user, 'public.orders', 'TRIGGER')
     OR NOT has_table_privilege(current_user, 'public.vorlage_zeit', 'INSERT')
     OR NOT has_table_privilege(current_user, 'public.vorlage_zeit', 'UPDATE')
     OR NOT has_table_privilege(current_user, 'public.vorlage_verbrauch', 'INSERT')
     OR NOT has_table_privilege(current_user, 'public.vorlage_verbrauch', 'UPDATE') THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: migration owner lacks required DDL/DML rights';
  END IF;

  FOREACH relation_name IN ARRAY ARRAY[
    'orders', 'items', 'arbeitszeit_buchung', 'teile_klassifikator',
    'stock_movements', 'inventory_items', 'vorlage_zeit', 'vorlage_verbrauch',
    'customers', 'ausgangsrechnung', 'kostenstelle', 'kostenstellen_energie_monat'
  ] LOOP
    IF (SELECT relowner FROM pg_class WHERE oid = to_regclass('public.' || relation_name)) <> migration_owner THEN
      RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: migration owner does not own public.%', relation_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.items item
    LEFT JOIN public.orders order_record ON order_record.id = item.order_id
    WHERE order_record.id IS NULL
       OR (item.tenant_id IS NOT NULL AND btrim(item.tenant_id) <> '' AND item.tenant_id <> order_record.tenant_id)
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: item/order tenant drift';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vorlage_zeit
    GROUP BY tenant_id, schluessel,
      CASE lower(btrim(station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(station_kuerzel)) END
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1
    FROM public.vorlage_verbrauch
    GROUP BY tenant_id, schluessel,
      CASE lower(btrim(station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(station_kuerzel)) END,
      inventory_item_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: duplicate natural template key';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vorlage_zeit
    WHERE lower(btrim(station_kuerzel)) !~ '^[a-z0-9][a-z0-9_-]{0,49}$'
  ) OR EXISTS (
    SELECT 1 FROM public.vorlage_verbrauch
    WHERE lower(btrim(station_kuerzel)) !~ '^[a-z0-9][a-z0-9_-]{0,49}$'
  ) OR EXISTS (
    SELECT 1 FROM public.arbeitszeit_buchung
    WHERE btrim(station_kuerzel) <> ''
      AND lower(btrim(station_kuerzel)) !~ '^[a-z0-9][a-z0-9_-]{0,49}$'
  ) OR EXISTS (
    SELECT 1 FROM public.stock_movements
    WHERE station_kuerzel IS NOT NULL
      AND btrim(station_kuerzel) <> ''
      AND lower(btrim(station_kuerzel)) !~ '^[a-z0-9][a-z0-9_-]{0,49}$'
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: invalid station key';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.items
    WHERE surface_requested IS NOT NULL AND position('|' IN surface_requested) > 0
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: surface contains key delimiter';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vorlage_verbrauch template_record
    LEFT JOIN public.inventory_items inventory
      ON inventory.tenant_id = template_record.tenant_id
     AND inventory.id = template_record.inventory_item_id
    WHERE inventory.id IS NULL
       OR btrim(template_record.einheit_normiert) = ''
       OR btrim(inventory.unit) = ''
       OR lower(btrim(template_record.einheit_normiert)) <> lower(btrim(inventory.unit))
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: template/inventory unit drift';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_movements movement
    JOIN public.inventory_items inventory
      ON inventory.tenant_id = movement.tenant_id
     AND inventory.id = movement.inventory_item_id
    WHERE movement.movement_type IN ('consumption', 'verbrauch')
      AND (
        btrim(movement.unit) = ''
        OR lower(btrim(movement.unit)) <> lower(btrim(inventory.unit))
      )
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: movement/inventory unit drift';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.teile_klassifikator classifier
    WHERE classifier.klasse IS NULL
       OR btrim(classifier.klasse) = ''
       OR position('|' IN classifier.klasse) > 0
       OR classifier.keywords IS NULL
       OR cardinality(classifier.keywords) = 0
       OR EXISTS (
         SELECT 1 FROM unnest(classifier.keywords) keyword
         WHERE keyword IS NULL OR btrim(keyword) = ''
       )
  ) OR EXISTS (
    SELECT 1
    FROM public.teile_klassifikator classifier
    GROUP BY classifier.tenant_id, replace(
      replace(
        replace(
          replace(
            translate(
              lower(btrim(normalize(classifier.klasse, NFC))),
              'áàâãåéèêëíìîïóòôõúùûçñ',
              'aaaaaeeeeiiiioooouuucn'
            ),
            'ä', 'ae'
          ),
          'ö', 'oe'
        ),
        'ü', 'ue'
      ),
      'ß', 'ss'
    )
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_PREFLIGHT_FAILED: ambiguous classifier contract';
  END IF;
END;
$preflight$;

UPDATE public.items item
SET tenant_id = order_record.tenant_id
FROM public.orders order_record
WHERE item.order_id = order_record.id
  AND (item.tenant_id IS NULL OR btrim(item.tenant_id) = '');

ALTER TABLE public.items ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.items
  ADD CONSTRAINT items_template_surface_key_chk
  CHECK (surface_requested IS NULL OR position('|' IN surface_requested) = 0)
  NOT VALID;
ALTER TABLE public.items VALIDATE CONSTRAINT items_template_surface_key_chk;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_tenant_order_fk;
ALTER TABLE public.items
  ADD CONSTRAINT items_tenant_order_fk
  FOREIGN KEY (tenant_id, order_id)
  REFERENCES public.orders (tenant_id, id)
  ON DELETE CASCADE
  NOT DEFERRABLE
  NOT VALID;
ALTER TABLE public.items VALIDATE CONSTRAINT items_tenant_order_fk;

ALTER TABLE public.vorlage_zeit
  ADD COLUMN is_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.vorlage_verbrauch
  ADD COLUMN is_active boolean NOT NULL DEFAULT false;

UPDATE public.vorlage_zeit
SET station_kuerzel = CASE lower(btrim(station_kuerzel))
  WHEN 'beschichtung' THEN 'galvanik'
  ELSE lower(btrim(station_kuerzel))
END
WHERE station_kuerzel IS DISTINCT FROM CASE lower(btrim(station_kuerzel))
  WHEN 'beschichtung' THEN 'galvanik'
  ELSE lower(btrim(station_kuerzel))
END;

UPDATE public.vorlage_verbrauch
SET station_kuerzel = CASE lower(btrim(station_kuerzel))
  WHEN 'beschichtung' THEN 'galvanik'
  ELSE lower(btrim(station_kuerzel))
END
WHERE station_kuerzel IS DISTINCT FROM CASE lower(btrim(station_kuerzel))
  WHEN 'beschichtung' THEN 'galvanik'
  ELSE lower(btrim(station_kuerzel))
END;

UPDATE public.vorlage_verbrauch template_record
SET einheit_normiert = btrim(inventory.unit)
FROM public.inventory_items inventory
WHERE inventory.tenant_id = template_record.tenant_id
  AND inventory.id = template_record.inventory_item_id
  AND lower(btrim(template_record.einheit_normiert)) = lower(btrim(inventory.unit))
  AND template_record.einheit_normiert IS DISTINCT FROM btrim(inventory.unit);

ALTER TABLE public.vorlage_zeit
  ADD CONSTRAINT vorlage_zeit_projection_values_chk CHECK (
    btrim(tenant_id) <> ''
    AND btrim(schluessel) <> ''
    AND station_kuerzel = lower(btrim(station_kuerzel))
    AND station_kuerzel ~ '^[a-z0-9][a-z0-9_-]{0,49}$'
    AND median_minuten::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND median_minuten > 0
    AND (p25_minuten IS NULL OR (
      p25_minuten::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND p25_minuten > 0
      AND p25_minuten <= median_minuten
    ))
    AND (p75_minuten IS NULL OR (
      p75_minuten::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND p75_minuten >= median_minuten
    ))
    AND n_referenzauftraege > 0
  ) NOT VALID;

ALTER TABLE public.vorlage_verbrauch
  ADD CONSTRAINT vorlage_verbrauch_projection_values_chk CHECK (
    btrim(tenant_id) <> ''
    AND btrim(schluessel) <> ''
    AND station_kuerzel = lower(btrim(station_kuerzel))
    AND station_kuerzel ~ '^[a-z0-9][a-z0-9_-]{0,49}$'
    AND btrim(einheit_normiert) <> ''
    AND median_menge::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND median_menge > 0
    AND (p25_menge IS NULL OR (
      p25_menge::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND p25_menge > 0
      AND p25_menge <= median_menge
    ))
    AND (p75_menge IS NULL OR (
      p75_menge::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND p75_menge >= median_menge
    ))
    AND n_referenzauftraege > 0
    AND (haeufigkeit_prozent IS NULL OR (
      haeufigkeit_prozent::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND haeufigkeit_prozent BETWEEN 0 AND 100
    ))
  ) NOT VALID;

ALTER TABLE public.vorlage_zeit VALIDATE CONSTRAINT vorlage_zeit_projection_values_chk;
ALTER TABLE public.vorlage_verbrauch VALIDATE CONSTRAINT vorlage_verbrauch_projection_values_chk;

CREATE UNIQUE INDEX vorlage_zeit_tenant_key_station_uidx
  ON public.vorlage_zeit (tenant_id, schluessel, station_kuerzel);
CREATE UNIQUE INDEX vorlage_verbrauch_tenant_key_station_item_uidx
  ON public.vorlage_verbrauch (tenant_id, schluessel, station_kuerzel, inventory_item_id);

CREATE FUNCTION public.fn_kreile_template_normalize(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT replace(
    replace(
      replace(
        replace(
          translate(
            lower(btrim(normalize(p_value, NFC))),
            'áàâãåéèêëíìîïóòôõúùûçñ',
            'aaaaaeeeeiiiioooouuucn'
          ),
          'ä', 'ae'
        ),
        'ö', 'oe'
      ),
      'ü', 'ue'
    ),
    'ß', 'ss'
  );
$function$;

ALTER FUNCTION public.fn_kreile_template_normalize(text) OWNER TO CURRENT_USER;

CREATE FUNCTION public.fn_kreile_template_keywords_valid(p_keywords text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT p_keywords IS NOT NULL
    AND cardinality(p_keywords) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p_keywords) keyword
      WHERE keyword IS NULL OR btrim(keyword) = ''
    );
$function$;

ALTER FUNCTION public.fn_kreile_template_keywords_valid(text[]) OWNER TO CURRENT_USER;

ALTER TABLE public.teile_klassifikator
  ADD CONSTRAINT teile_klassifikator_template_key_chk CHECK (
    btrim(klasse) <> ''
    AND position('|' IN klasse) = 0
    AND public.fn_kreile_template_keywords_valid(keywords)
  ) NOT VALID;
ALTER TABLE public.teile_klassifikator
  VALIDATE CONSTRAINT teile_klassifikator_template_key_chk;

CREATE UNIQUE INDEX teile_klassifikator_tenant_normalized_class_uidx
  ON public.teile_klassifikator (
    tenant_id,
    public.fn_kreile_template_normalize(klasse)
  );

CREATE FUNCTION public.fn_kreile_template_classify(p_tenant_id text, p_item_name text)
RETURNS text
LANGUAGE sql
STABLE
STRICT
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT coalesce((
    SELECT classifier.klasse
    FROM public.teile_klassifikator classifier
    CROSS JOIN LATERAL unnest(classifier.keywords) WITH ORDINALITY AS keyword(value, position)
    WHERE classifier.tenant_id = p_tenant_id
      AND strpos(
        public.fn_kreile_template_normalize(p_item_name),
        public.fn_kreile_template_normalize(keyword.value)
      ) > 0
    ORDER BY
      length(public.fn_kreile_template_normalize(keyword.value)) DESC,
      classifier.klasse,
      classifier.id,
      keyword.position
    LIMIT 1
  ), 'sonstiges');
$function$;

ALTER FUNCTION public.fn_kreile_template_classify(text, text) OWNER TO CURRENT_USER;

CREATE OR REPLACE FUNCTION public.fn_update_vorlagen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  projection record;
  new_is_terminal boolean;
  old_is_terminal boolean := false;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'orders' OR TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_TRIGGER_CONTEXT_INVALID';
  END IF;
  IF TG_OP = 'UPDATE'
     AND (OLD.id IS DISTINCT FROM NEW.id OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_ORDER_IDENTITY_IMMUTABLE';
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_TERMINAL_INSERT_REQUIRES_STATUS_TRANSITION';
  END IF;

  new_is_terminal := coalesce(lower(btrim(NEW.status)), '') IN (
    'completed', 'abgeschlossen', 'fertig', 'done', 'shipped', 'versendet', 'delivered'
  );
  IF TG_OP = 'UPDATE' THEN
    old_is_terminal := coalesce(lower(btrim(OLD.status)), '') IN (
      'completed', 'abgeschlossen', 'fertig', 'done', 'shipped', 'versendet', 'delivered'
    );
  END IF;
  IF (TG_OP = 'INSERT' AND NOT new_is_terminal)
     OR (TG_OP = 'UPDATE' AND (
       coalesce(lower(btrim(OLD.status)), '') = coalesce(lower(btrim(NEW.status)), '')
       OR (NOT old_is_terminal AND NOT new_is_terminal)
     )) THEN
    RETURN NEW;
  END IF;
  IF NEW.tenant_id IS NULL OR btrim(NEW.tenant_id) = '' THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_TENANT_INVALID';
  END IF;

  FOR projection IN
    SELECT DISTINCT ON (projection_key.schluessel)
      projection_key.klasse,
      projection_key.oberflaeche,
      projection_key.schluessel
    FROM (
      SELECT
        classified.klasse,
        classified.oberflaeche,
        public.fn_kreile_template_normalize(classified.klasse)
          || '|' || classified.oberflaeche AS schluessel
      FROM (
        SELECT
          public.fn_kreile_template_classify(NEW.tenant_id, item.name) AS klasse,
          coalesce(nullif(public.fn_kreile_template_normalize(item.surface_requested), ''), 'unbekannt') AS oberflaeche
        FROM public.items item
        WHERE item.tenant_id = NEW.tenant_id
          AND item.order_id = NEW.id
      ) classified
    ) projection_key
    WHERE 1 = (
      SELECT count(DISTINCT (
        public.fn_kreile_template_normalize(
          public.fn_kreile_template_classify(NEW.tenant_id, current_item.name)
        ) || '|' || coalesce(
          nullif(public.fn_kreile_template_normalize(current_item.surface_requested), ''),
          'unbekannt'
        )
      ))
      FROM public.items current_item
      WHERE current_item.tenant_id = NEW.tenant_id
        AND current_item.order_id = NEW.id
    )
    ORDER BY projection_key.schluessel, projection_key.klasse
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'capture-template:' || NEW.tenant_id || ':' || projection.schluessel,
      0
    ));

    UPDATE public.vorlage_zeit
    SET is_active = false, letzte_aktualisierung = clock_timestamp()
    WHERE tenant_id = NEW.tenant_id
      AND schluessel = projection.schluessel
      AND is_active;

    WITH reference_orders AS (
      SELECT DISTINCT order_record.id
      FROM public.orders order_record
      WHERE order_record.tenant_id = NEW.tenant_id
        AND lower(btrim(order_record.status)) IN ('completed', 'abgeschlossen', 'fertig', 'done', 'shipped', 'versendet', 'delivered')
        AND 1 = (
          SELECT count(DISTINCT (
            public.fn_kreile_template_normalize(
              public.fn_kreile_template_classify(reference_key_item.tenant_id, reference_key_item.name)
            ) || '|' || coalesce(
              nullif(public.fn_kreile_template_normalize(reference_key_item.surface_requested), ''),
              'unbekannt'
            )
          ))
          FROM public.items reference_key_item
          WHERE reference_key_item.tenant_id = order_record.tenant_id
            AND reference_key_item.order_id = order_record.id
        )
        AND EXISTS (
          SELECT 1
          FROM public.items reference_item
          WHERE reference_item.tenant_id = order_record.tenant_id
            AND reference_item.order_id = order_record.id
            AND public.fn_kreile_template_normalize(
              public.fn_kreile_template_classify(reference_item.tenant_id, reference_item.name)
            ) || '|' || coalesce(
              nullif(public.fn_kreile_template_normalize(reference_item.surface_requested), ''),
              'unbekannt'
            ) = projection.schluessel
        )
    ), booking_per_order AS (
      SELECT booking.auftrag_id,
        CASE lower(btrim(booking.station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(booking.station_kuerzel)) END AS station_kuerzel,
        sum(booking.dauer_minuten)::numeric AS minutes
      FROM public.arbeitszeit_buchung booking
      JOIN reference_orders reference_order ON reference_order.id = booking.auftrag_id
      WHERE booking.tenant_id = NEW.tenant_id
        AND btrim(booking.station_kuerzel) <> ''
        AND booking.dauer_minuten > 0
        AND booking.end_zeit IS NOT NULL
      GROUP BY booking.auftrag_id,
        CASE lower(btrim(booking.station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(booking.station_kuerzel)) END
    )
    INSERT INTO public.vorlage_zeit (
      tenant_id, schluessel, teilekategorie, oberflaeche, station_kuerzel,
      median_minuten, p25_minuten, p75_minuten, n_referenzauftraege,
      letzte_aktualisierung, is_active
    )
    SELECT
      NEW.tenant_id,
      projection.schluessel,
      projection.klasse,
      projection.oberflaeche,
      booking.station_kuerzel,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY booking.minutes),
      percentile_cont(0.25) WITHIN GROUP (ORDER BY booking.minutes),
      percentile_cont(0.75) WITHIN GROUP (ORDER BY booking.minutes),
      count(*)::integer,
      clock_timestamp(),
      true
    FROM booking_per_order booking
    GROUP BY booking.station_kuerzel
    ON CONFLICT (tenant_id, schluessel, station_kuerzel)
    DO UPDATE SET
      teilekategorie = EXCLUDED.teilekategorie,
      oberflaeche = EXCLUDED.oberflaeche,
      median_minuten = EXCLUDED.median_minuten,
      p25_minuten = EXCLUDED.p25_minuten,
      p75_minuten = EXCLUDED.p75_minuten,
      n_referenzauftraege = EXCLUDED.n_referenzauftraege,
      letzte_aktualisierung = EXCLUDED.letzte_aktualisierung,
      is_active = true;

    UPDATE public.vorlage_verbrauch
    SET is_active = false, letzte_aktualisierung = clock_timestamp()
    WHERE tenant_id = NEW.tenant_id
      AND schluessel = projection.schluessel
      AND is_active;

    IF EXISTS (
      WITH reference_orders AS (
        SELECT DISTINCT order_record.id
        FROM public.orders order_record
        WHERE order_record.tenant_id = NEW.tenant_id
          AND lower(btrim(order_record.status)) IN ('completed', 'abgeschlossen', 'fertig', 'done', 'shipped', 'versendet', 'delivered')
        AND 1 = (
          SELECT count(DISTINCT (
            public.fn_kreile_template_normalize(
              public.fn_kreile_template_classify(reference_key_item.tenant_id, reference_key_item.name)
            ) || '|' || coalesce(
              nullif(public.fn_kreile_template_normalize(reference_key_item.surface_requested), ''),
              'unbekannt'
            )
          ))
          FROM public.items reference_key_item
          WHERE reference_key_item.tenant_id = order_record.tenant_id
            AND reference_key_item.order_id = order_record.id
        )
          AND EXISTS (
            SELECT 1
            FROM public.items reference_item
            WHERE reference_item.tenant_id = order_record.tenant_id
              AND reference_item.order_id = order_record.id
            AND public.fn_kreile_template_normalize(
              public.fn_kreile_template_classify(reference_item.tenant_id, reference_item.name)
            ) || '|' || coalesce(
              nullif(public.fn_kreile_template_normalize(reference_item.surface_requested), ''),
              'unbekannt'
            ) = projection.schluessel
          )
      )
      SELECT 1
      FROM public.stock_movements movement
      JOIN reference_orders reference_order ON reference_order.id = movement.order_id
      JOIN public.inventory_items inventory
        ON inventory.tenant_id = movement.tenant_id
       AND inventory.id = movement.inventory_item_id
      WHERE movement.tenant_id = NEW.tenant_id
        AND movement.movement_type IN ('consumption', 'verbrauch')
        AND (
          btrim(movement.unit) = ''
          OR lower(btrim(movement.unit)) <> lower(btrim(inventory.unit))
        )
    ) THEN
      RAISE EXCEPTION 'TEMPLATE_PROJECTION_UNIT_DRIFT';
    END IF;

    WITH reference_orders AS (
      SELECT DISTINCT order_record.id
      FROM public.orders order_record
      WHERE order_record.tenant_id = NEW.tenant_id
        AND lower(btrim(order_record.status)) IN ('completed', 'abgeschlossen', 'fertig', 'done', 'shipped', 'versendet', 'delivered')
        AND 1 = (
          SELECT count(DISTINCT (
            public.fn_kreile_template_normalize(
              public.fn_kreile_template_classify(reference_key_item.tenant_id, reference_key_item.name)
            ) || '|' || coalesce(
              nullif(public.fn_kreile_template_normalize(reference_key_item.surface_requested), ''),
              'unbekannt'
            )
          ))
          FROM public.items reference_key_item
          WHERE reference_key_item.tenant_id = order_record.tenant_id
            AND reference_key_item.order_id = order_record.id
        )
        AND EXISTS (
          SELECT 1
          FROM public.items reference_item
          WHERE reference_item.tenant_id = order_record.tenant_id
            AND reference_item.order_id = order_record.id
            AND public.fn_kreile_template_normalize(
              public.fn_kreile_template_classify(reference_item.tenant_id, reference_item.name)
            ) || '|' || coalesce(
              nullif(public.fn_kreile_template_normalize(reference_item.surface_requested), ''),
              'unbekannt'
            ) = projection.schluessel
        )
    ), movement_per_order AS (
      SELECT
        movement.order_id,
        CASE lower(btrim(movement.station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(movement.station_kuerzel)) END AS station_kuerzel,
        movement.inventory_item_id,
        btrim(inventory.unit) AS unit,
        sum(abs(movement.quantity))::numeric AS quantity
      FROM public.stock_movements movement
      JOIN reference_orders reference_order ON reference_order.id = movement.order_id
      JOIN public.inventory_items inventory
        ON inventory.tenant_id = movement.tenant_id
       AND inventory.id = movement.inventory_item_id
      WHERE movement.tenant_id = NEW.tenant_id
        AND movement.movement_type IN ('consumption', 'verbrauch')
        AND movement.station_kuerzel IS NOT NULL
        AND btrim(movement.station_kuerzel) <> ''
      GROUP BY movement.order_id,
        CASE lower(btrim(movement.station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(movement.station_kuerzel)) END,
        movement.inventory_item_id, inventory.unit
    )
    INSERT INTO public.vorlage_verbrauch (
      tenant_id, schluessel, teilekategorie, oberflaeche, station_kuerzel,
      inventory_item_id, einheit_normiert, median_menge, p25_menge,
      p75_menge, n_referenzauftraege, haeufigkeit_prozent,
      letzte_aktualisierung, is_active
    )
    SELECT
      NEW.tenant_id,
      projection.schluessel,
      projection.klasse,
      projection.oberflaeche,
      movement.station_kuerzel,
      movement.inventory_item_id,
      movement.unit,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY movement.quantity),
      percentile_cont(0.25) WITHIN GROUP (ORDER BY movement.quantity),
      percentile_cont(0.75) WITHIN GROUP (ORDER BY movement.quantity),
      count(*)::integer,
      (count(*)::numeric / NULLIF((SELECT count(*) FROM reference_orders), 0)::numeric) * 100,
      clock_timestamp(),
      true
    FROM movement_per_order movement
    GROUP BY movement.station_kuerzel, movement.inventory_item_id, movement.unit
    ON CONFLICT (tenant_id, schluessel, station_kuerzel, inventory_item_id)
    DO UPDATE SET
      teilekategorie = EXCLUDED.teilekategorie,
      oberflaeche = EXCLUDED.oberflaeche,
      einheit_normiert = EXCLUDED.einheit_normiert,
      median_menge = EXCLUDED.median_menge,
      p25_menge = EXCLUDED.p25_menge,
      p75_menge = EXCLUDED.p75_menge,
      n_referenzauftraege = EXCLUDED.n_referenzauftraege,
      haeufigkeit_prozent = EXCLUDED.haeufigkeit_prozent,
      letzte_aktualisierung = EXCLUDED.letzte_aktualisierung,
      is_active = true;
  END LOOP;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.fn_update_vorlagen() OWNER TO CURRENT_USER;

CREATE FUNCTION public.fn_guard_template_projection_source_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  source_tenant_id text;
  source_order_id text;
  source_order_status text;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_OP <> 'INSERT'
     OR TG_TABLE_NAME NOT IN ('items', 'arbeitszeit_buchung', 'stock_movements') THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_SOURCE_TRIGGER_CONTEXT_INVALID';
  END IF;

  IF TG_TABLE_NAME = 'items' THEN
    source_tenant_id := NEW.tenant_id;
    source_order_id := NEW.order_id;
  ELSIF TG_TABLE_NAME = 'arbeitszeit_buchung' THEN
    source_tenant_id := NEW.tenant_id;
    source_order_id := NEW.auftrag_id;
  ELSE
    IF NEW.order_id IS NULL OR coalesce(lower(btrim(NEW.movement_type)), '') NOT IN ('consumption', 'verbrauch') THEN
      RETURN NEW;
    END IF;
    source_tenant_id := NEW.tenant_id;
    source_order_id := NEW.order_id;
  END IF;

  IF source_tenant_id IS NULL OR btrim(source_tenant_id) = ''
     OR source_order_id IS NULL OR btrim(source_order_id) = '' THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_SOURCE_IDENTITY_INVALID';
  END IF;

  SELECT lower(btrim(order_record.status))
  INTO source_order_status
  FROM public.orders order_record
  WHERE order_record.tenant_id = source_tenant_id
    AND order_record.id = source_order_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_SOURCE_ORDER_MISSING';
  END IF;
  IF source_order_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_SOURCE_FROZEN';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.fn_guard_template_projection_source_insert() OWNER TO CURRENT_USER;

DO $function_acl_reset$
DECLARE
  function_record record;
  acl_record record;
  grantee_sql text;
BEGIN
  FOR function_record IN
    SELECT
      function_value.oid,
      function_value.proowner,
      function_namespace.nspname,
      function_value.proname,
      pg_get_function_identity_arguments(function_value.oid) AS identity_arguments
    FROM pg_proc function_value
    JOIN pg_namespace function_namespace ON function_namespace.oid = function_value.pronamespace
    WHERE function_value.oid IN (
      'public.fn_kreile_template_normalize(text)'::regprocedure,
      'public.fn_kreile_template_keywords_valid(text[])'::regprocedure,
      'public.fn_kreile_template_classify(text,text)'::regprocedure,
      'public.fn_update_vorlagen()'::regprocedure,
      'public.fn_guard_template_projection_source_insert()'::regprocedure
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %I.%I(%s) FROM PUBLIC CASCADE',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );

    FOR acl_record IN
      SELECT DISTINCT acl_entry.grantee
      FROM pg_proc acl_function,
           LATERAL aclexplode(acl_function.proacl) acl_entry
      WHERE acl_function.oid = function_record.oid
        AND acl_entry.grantee <> function_record.proowner
    LOOP
      grantee_sql := CASE
        WHEN acl_record.grantee = 0 THEN 'PUBLIC'
        ELSE quote_ident((SELECT rolname FROM pg_roles WHERE oid = acl_record.grantee))
      END;
      IF grantee_sql IS NULL THEN
        RAISE EXCEPTION 'TEMPLATE_PROJECTION_FUNCTION_ACL_RESET_FAILED: unknown grantee %', acl_record.grantee;
      END IF;
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION %I.%I(%s) FROM %s CASCADE',
        function_record.nspname,
        function_record.proname,
        function_record.identity_arguments,
        grantee_sql
      );
    END LOOP;
  END LOOP;
END;
$function_acl_reset$;

CREATE OR REPLACE TRIGGER trg_update_vorlagen
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_update_vorlagen();

CREATE TRIGGER trg_insert_vorlagen
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (lower(btrim(NEW.status)) IN (
    'completed', 'abgeschlossen', 'fertig', 'done', 'shipped', 'versendet', 'delivered'
  ))
  EXECUTE FUNCTION public.fn_update_vorlagen();

CREATE TRIGGER template_projection_items_source_guard_trg
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_template_projection_source_insert();

CREATE TRIGGER template_projection_time_source_guard_trg
  BEFORE INSERT ON public.arbeitszeit_buchung
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_template_projection_source_insert();

CREATE TRIGGER template_projection_movement_source_guard_trg
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_template_projection_source_insert();

-- Rebuild the derived projection from terminal historical orders. Legacy rows
-- remain preserved but inactive unless this canonical source set proves them.
WITH item_projection_keys AS (
  SELECT
    item.tenant_id,
    item.order_id,
    public.fn_kreile_template_classify(item.tenant_id, item.name) AS klasse,
    coalesce(nullif(public.fn_kreile_template_normalize(item.surface_requested), ''), 'unbekannt') AS oberflaeche
  FROM public.items item
  JOIN public.orders order_record
    ON order_record.tenant_id = item.tenant_id
   AND order_record.id = item.order_id
  WHERE lower(btrim(order_record.status)) IN ('completed', 'abgeschlossen', 'fertig', 'done', 'shipped', 'versendet', 'delivered')
), single_order_keys AS (
  SELECT
    tenant_id,
    order_id,
    min(klasse) AS klasse,
    min(oberflaeche) AS oberflaeche,
    min(public.fn_kreile_template_normalize(klasse) || '|' || oberflaeche) AS schluessel
  FROM item_projection_keys
  GROUP BY tenant_id, order_id
  HAVING count(DISTINCT public.fn_kreile_template_normalize(klasse) || '|' || oberflaeche) = 1
), booking_per_order AS (
  SELECT
    booking.tenant_id,
    booking.auftrag_id,
    CASE lower(btrim(booking.station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(booking.station_kuerzel)) END AS station_kuerzel,
    key_record.klasse,
    key_record.oberflaeche,
    key_record.schluessel,
    sum(booking.dauer_minuten)::numeric AS minutes
  FROM public.arbeitszeit_buchung booking
  JOIN single_order_keys key_record
    ON key_record.tenant_id = booking.tenant_id
   AND key_record.order_id = booking.auftrag_id
  WHERE btrim(booking.station_kuerzel) <> ''
    AND booking.dauer_minuten > 0
    AND booking.end_zeit IS NOT NULL
  GROUP BY
    booking.tenant_id, booking.auftrag_id,
    CASE lower(btrim(booking.station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(booking.station_kuerzel)) END,
    key_record.klasse, key_record.oberflaeche, key_record.schluessel
)
INSERT INTO public.vorlage_zeit (
  tenant_id, schluessel, teilekategorie, oberflaeche, station_kuerzel,
  median_minuten, p25_minuten, p75_minuten, n_referenzauftraege,
  letzte_aktualisierung, is_active
)
SELECT
  booking.tenant_id,
  booking.schluessel,
  booking.klasse,
  booking.oberflaeche,
  booking.station_kuerzel,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY booking.minutes),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY booking.minutes),
  percentile_cont(0.75) WITHIN GROUP (ORDER BY booking.minutes),
  count(*)::integer,
  clock_timestamp(),
  true
FROM booking_per_order booking
GROUP BY booking.tenant_id, booking.schluessel, booking.klasse, booking.oberflaeche, booking.station_kuerzel
ON CONFLICT (tenant_id, schluessel, station_kuerzel)
DO UPDATE SET
  teilekategorie = EXCLUDED.teilekategorie,
  oberflaeche = EXCLUDED.oberflaeche,
  median_minuten = EXCLUDED.median_minuten,
  p25_minuten = EXCLUDED.p25_minuten,
  p75_minuten = EXCLUDED.p75_minuten,
  n_referenzauftraege = EXCLUDED.n_referenzauftraege,
  letzte_aktualisierung = EXCLUDED.letzte_aktualisierung,
  is_active = true;

WITH item_projection_keys AS (
  SELECT
    item.tenant_id,
    item.order_id,
    public.fn_kreile_template_classify(item.tenant_id, item.name) AS klasse,
    coalesce(nullif(public.fn_kreile_template_normalize(item.surface_requested), ''), 'unbekannt') AS oberflaeche
  FROM public.items item
  JOIN public.orders order_record
    ON order_record.tenant_id = item.tenant_id
   AND order_record.id = item.order_id
  WHERE lower(btrim(order_record.status)) IN ('completed', 'abgeschlossen', 'fertig', 'done', 'shipped', 'versendet', 'delivered')
), single_order_keys AS (
  SELECT
    tenant_id,
    order_id,
    min(klasse) AS klasse,
    min(oberflaeche) AS oberflaeche,
    min(public.fn_kreile_template_normalize(klasse) || '|' || oberflaeche) AS schluessel
  FROM item_projection_keys
  GROUP BY tenant_id, order_id
  HAVING count(DISTINCT public.fn_kreile_template_normalize(klasse) || '|' || oberflaeche) = 1
), movement_per_order AS (
  SELECT
    movement.tenant_id,
    movement.order_id,
    CASE lower(btrim(movement.station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(movement.station_kuerzel)) END AS station_kuerzel,
    movement.inventory_item_id,
    btrim(inventory.unit) AS unit,
    key_record.klasse,
    key_record.oberflaeche,
    key_record.schluessel,
    sum(abs(movement.quantity))::numeric AS quantity
  FROM public.stock_movements movement
  JOIN single_order_keys key_record
    ON key_record.tenant_id = movement.tenant_id
   AND key_record.order_id = movement.order_id
  JOIN public.inventory_items inventory
    ON inventory.tenant_id = movement.tenant_id
   AND inventory.id = movement.inventory_item_id
  WHERE movement.movement_type IN ('consumption', 'verbrauch')
    AND movement.station_kuerzel IS NOT NULL
    AND btrim(movement.station_kuerzel) <> ''
  GROUP BY
    movement.tenant_id, movement.order_id,
    CASE lower(btrim(movement.station_kuerzel)) WHEN 'beschichtung' THEN 'galvanik' ELSE lower(btrim(movement.station_kuerzel)) END,
    movement.inventory_item_id, inventory.unit,
    key_record.klasse, key_record.oberflaeche, key_record.schluessel
), reference_counts AS (
  SELECT tenant_id, schluessel, count(*)::numeric AS order_count
  FROM single_order_keys
  GROUP BY tenant_id, schluessel
)
INSERT INTO public.vorlage_verbrauch (
  tenant_id, schluessel, teilekategorie, oberflaeche, station_kuerzel,
  inventory_item_id, einheit_normiert, median_menge, p25_menge,
  p75_menge, n_referenzauftraege, haeufigkeit_prozent,
  letzte_aktualisierung, is_active
)
SELECT
  movement.tenant_id,
  movement.schluessel,
  movement.klasse,
  movement.oberflaeche,
  movement.station_kuerzel,
  movement.inventory_item_id,
  movement.unit,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY movement.quantity),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY movement.quantity),
  percentile_cont(0.75) WITHIN GROUP (ORDER BY movement.quantity),
  count(*)::integer,
  (count(*)::numeric / NULLIF(reference.order_count, 0)) * 100,
  clock_timestamp(),
  true
FROM movement_per_order movement
JOIN reference_counts reference
  ON reference.tenant_id = movement.tenant_id
 AND reference.schluessel = movement.schluessel
GROUP BY
  movement.tenant_id, movement.schluessel, movement.klasse, movement.oberflaeche,
  movement.station_kuerzel, movement.inventory_item_id, movement.unit, reference.order_count
ON CONFLICT (tenant_id, schluessel, station_kuerzel, inventory_item_id)
DO UPDATE SET
  teilekategorie = EXCLUDED.teilekategorie,
  oberflaeche = EXCLUDED.oberflaeche,
  einheit_normiert = EXCLUDED.einheit_normiert,
  median_menge = EXCLUDED.median_menge,
  p25_menge = EXCLUDED.p25_menge,
  p75_menge = EXCLUDED.p75_menge,
  n_referenzauftraege = EXCLUDED.n_referenzauftraege,
  haeufigkeit_prozent = EXCLUDED.haeufigkeit_prozent,
  letzte_aktualisierung = EXCLUDED.letzte_aktualisierung,
  is_active = true;

CREATE OR REPLACE VIEW public.v_auftrag_db
WITH (security_invoker = true, security_barrier = true)
AS
WITH invoice_rollup AS (
  SELECT
    invoice.tenant_id,
    invoice.order_id,
    count(*)::bigint AS invoice_count,
    count(*) FILTER (
      WHERE invoice.netto IS NULL
         OR invoice.netto::text IN ('NaN', 'Infinity', '-Infinity')
    )::bigint AS missing_net_count,
    CASE WHEN count(*) FILTER (
      WHERE invoice.netto IS NULL
         OR invoice.netto::text IN ('NaN', 'Infinity', '-Infinity')
    ) > 0 THEN NULL
    ELSE coalesce(sum(invoice.netto), 0)
    END AS revenue_net
  FROM public.ausgangsrechnung invoice
  WHERE (invoice.is_demo IS NULL OR invoice.is_demo = false)
    AND invoice.status <> 'storniert'
    AND invoice.order_id IS NOT NULL
  GROUP BY invoice.tenant_id, invoice.order_id
), material_rollup AS (
  SELECT
    movement.tenant_id,
    movement.order_id,
    count(*)::bigint AS movement_count,
    count(*) FILTER (
      WHERE movement.snapshot_einkaufspreis_eur IS NULL
         OR movement.snapshot_einkaufspreis_eur::text IN ('NaN', 'Infinity', '-Infinity')
         OR movement.snapshot_einkaufspreis_eur < 0
    )::bigint AS missing_price_count,
    CASE WHEN count(*) FILTER (
      WHERE movement.snapshot_einkaufspreis_eur IS NULL
         OR movement.snapshot_einkaufspreis_eur::text IN ('NaN', 'Infinity', '-Infinity')
         OR movement.snapshot_einkaufspreis_eur < 0
    ) > 0 THEN NULL
    ELSE coalesce(sum(abs(movement.quantity) * movement.snapshot_einkaufspreis_eur), 0)
    END AS material_cost
  FROM public.stock_movements movement
  WHERE movement.movement_type IN ('consumption', 'verbrauch')
    AND movement.order_id IS NOT NULL
  GROUP BY movement.tenant_id, movement.order_id
), time_rollup AS (
  SELECT
    booking.tenant_id,
    booking.auftrag_id AS order_id,
    count(*)::bigint AS booking_count,
    count(*) FILTER (WHERE booking.end_zeit IS NULL)::bigint AS open_booking_count,
    CASE WHEN count(*) FILTER (WHERE booking.end_zeit IS NULL) > 0 THEN NULL
    ELSE coalesce(sum((booking.dauer_minuten::numeric / 60) * booking.kostensatz_eur_pro_stunde), 0)
    END AS time_cost
  FROM public.arbeitszeit_buchung booking
  GROUP BY booking.tenant_id, booking.auftrag_id
), energy_rollup AS (
  SELECT
    booking.tenant_id,
    booking.auftrag_id AS order_id,
    count(*) FILTER (
      WHERE energy.energie_eur_pro_stunde IS NULL
         OR energy.energie_eur_pro_stunde::text IN ('NaN', 'Infinity', '-Infinity')
         OR energy.energie_eur_pro_stunde < 0
    )::bigint AS missing_energy_count,
    CASE WHEN count(*) FILTER (
      WHERE energy.energie_eur_pro_stunde IS NULL
         OR energy.energie_eur_pro_stunde::text IN ('NaN', 'Infinity', '-Infinity')
         OR energy.energie_eur_pro_stunde < 0
    ) > 0 THEN NULL
    ELSE coalesce(sum((booking.dauer_minuten::numeric / 60) * energy.energie_eur_pro_stunde), 0)
    END AS energy_cost
  FROM public.arbeitszeit_buchung booking
  LEFT JOIN public.kostenstelle cost_center
    ON cost_center.tenant_id = booking.tenant_id
   AND cost_center.kuerzel = booking.kostenstelle_kuerzel
  LEFT JOIN public.kostenstellen_energie_monat energy
    ON energy.kostenstelle_id = cost_center.id
   AND energy.tenant_id = booking.tenant_id
   AND energy.monat = date_trunc(
     'month',
     booking.start_zeit AT TIME ZONE 'Europe/Berlin'
   )::date
  GROUP BY booking.tenant_id, booking.auftrag_id
), order_truth AS (
  SELECT
    order_record.id AS order_id,
    order_record.order_number,
    order_record.customer_id,
    customer.name AS kunde_name,
    customer.company_name,
    order_record.intake_date,
    order_record.status,
    coalesce(order_record.current_station_id, order_record.current_station, order_record.station)::text AS current_station,
    order_record.due_date,
    CASE WHEN invoice.order_id IS NULL THEN 0::numeric ELSE invoice.revenue_net END AS erloes_netto,
    CASE WHEN material.order_id IS NULL THEN 0::numeric ELSE material.material_cost END AS material_kosten,
    CASE WHEN booked_time.order_id IS NULL THEN 0::numeric ELSE booked_time.time_cost END AS arbeitszeit_kosten,
    CASE WHEN energy.order_id IS NULL THEN 0::numeric ELSE energy.energy_cost END AS energie_anteil_kosten,
    coalesce(invoice.invoice_count, 0)::bigint AS anz_rechnungen,
    coalesce(material.movement_count, 0)::bigint AS anz_verbrauch,
    coalesce(booked_time.booking_count, 0)::bigint AS anz_zeitbuchungen,
    order_record.tenant_id,
    coalesce(invoice.missing_net_count, 0)::bigint AS anz_rechnungen_ohne_netto,
    coalesce(material.missing_price_count, 0)::bigint AS anz_verbrauch_ohne_preis,
    coalesce(booked_time.open_booking_count, 0)::bigint AS anz_offene_zeitbuchungen,
    coalesce(energy.missing_energy_count, 0)::bigint AS anz_zeitbuchungen_ohne_energiepreis
  FROM public.orders order_record
  LEFT JOIN public.customers customer
    ON customer.tenant_id = order_record.tenant_id
   AND customer.id = order_record.customer_id
  LEFT JOIN invoice_rollup invoice
    ON invoice.tenant_id = order_record.tenant_id
   AND invoice.order_id = order_record.id
  LEFT JOIN material_rollup material
    ON material.tenant_id = order_record.tenant_id
   AND material.order_id = order_record.id
  LEFT JOIN time_rollup booked_time
    ON booked_time.tenant_id = order_record.tenant_id
   AND booked_time.order_id = order_record.id
  LEFT JOIN energy_rollup energy
    ON energy.tenant_id = order_record.tenant_id
   AND energy.order_id = order_record.id
)
SELECT
  order_truth.order_id,
  order_truth.order_number,
  order_truth.customer_id,
  order_truth.kunde_name,
  order_truth.company_name,
  order_truth.intake_date,
  order_truth.status,
  order_truth.current_station,
  order_truth.due_date,
  order_truth.erloes_netto,
  order_truth.material_kosten,
  order_truth.arbeitszeit_kosten,
  order_truth.energie_anteil_kosten,
  CASE WHEN order_truth.erloes_netto IS NULL
         OR order_truth.material_kosten IS NULL
         OR order_truth.arbeitszeit_kosten IS NULL
         OR order_truth.energie_anteil_kosten IS NULL
    THEN NULL
    ELSE order_truth.erloes_netto
      - order_truth.material_kosten
      - order_truth.arbeitszeit_kosten
      - order_truth.energie_anteil_kosten
  END AS deckungsbeitrag,
  CASE WHEN order_truth.erloes_netto > 0
         AND order_truth.material_kosten IS NOT NULL
         AND order_truth.arbeitszeit_kosten IS NOT NULL
         AND order_truth.energie_anteil_kosten IS NOT NULL
    THEN (
      order_truth.erloes_netto
      - order_truth.material_kosten
      - order_truth.arbeitszeit_kosten
      - order_truth.energie_anteil_kosten
    ) / order_truth.erloes_netto
    ELSE NULL
  END AS db_marge,
  order_truth.anz_rechnungen,
  order_truth.anz_verbrauch,
  order_truth.anz_zeitbuchungen,
  order_truth.tenant_id,
  order_truth.anz_rechnungen_ohne_netto,
  order_truth.anz_verbrauch_ohne_preis,
  order_truth.anz_offene_zeitbuchungen,
  order_truth.anz_zeitbuchungen_ohne_energiepreis,
  (
    order_truth.erloes_netto IS NOT NULL
    AND order_truth.material_kosten IS NOT NULL
    AND order_truth.arbeitszeit_kosten IS NOT NULL
    AND order_truth.energie_anteil_kosten IS NOT NULL
  ) AS db_berechenbar
FROM order_truth;

ALTER VIEW public.v_auftrag_db OWNER TO CURRENT_USER;

REVOKE CREATE ON SCHEMA public FROM service_role;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON TABLE
  public.orders,
  public.customers,
  public.ausgangsrechnung,
  public.stock_movements,
  public.arbeitszeit_buchung,
  public.kostenstelle,
  public.kostenstellen_energie_monat
TO service_role;

-- CREATE OR REPLACE VIEW preserves both relation- and column-level ACLs. Remove
-- every explicit legacy grant before publishing the exact read contract.
DO $view_acl_reset$
DECLARE
  acl_record record;
  grantee_sql text;
BEGIN
  FOR acl_record IN
    SELECT DISTINCT acl_entry.grantee
    FROM pg_class view_record,
         LATERAL aclexplode(view_record.relacl) acl_entry
    WHERE view_record.oid = 'public.v_auftrag_db'::regclass
  LOOP
    grantee_sql := CASE
      WHEN acl_record.grantee = 0 THEN 'PUBLIC'
      ELSE quote_ident((SELECT rolname FROM pg_roles WHERE oid = acl_record.grantee))
    END;
    IF grantee_sql IS NULL THEN
      RAISE EXCEPTION 'TEMPLATE_PROJECTION_VIEW_ACL_RESET_FAILED: unknown relation grantee %', acl_record.grantee;
    END IF;
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.v_auftrag_db FROM ' || grantee_sql || ' CASCADE';
  END LOOP;

  FOR acl_record IN
    SELECT DISTINCT attribute_record.attname, acl_entry.grantee
    FROM pg_attribute attribute_record,
         LATERAL aclexplode(attribute_record.attacl) acl_entry
    WHERE attribute_record.attrelid = 'public.v_auftrag_db'::regclass
      AND attribute_record.attnum > 0
      AND NOT attribute_record.attisdropped
  LOOP
    grantee_sql := CASE
      WHEN acl_record.grantee = 0 THEN 'PUBLIC'
      ELSE quote_ident((SELECT rolname FROM pg_roles WHERE oid = acl_record.grantee))
    END;
    IF grantee_sql IS NULL THEN
      RAISE EXCEPTION 'TEMPLATE_PROJECTION_VIEW_ACL_RESET_FAILED: unknown column grantee %', acl_record.grantee;
    END IF;
    EXECUTE format(
      'REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.v_auftrag_db FROM %2$s CASCADE',
      acl_record.attname,
      grantee_sql
    );
  END LOOP;
END;
$view_acl_reset$;

GRANT SELECT ON TABLE public.v_auftrag_db TO service_role;

DO $verification$
DECLARE
  migration_owner oid := (SELECT oid FROM pg_roles WHERE rolname = current_user);
  service_role_oid oid := (SELECT oid FROM pg_roles WHERE rolname = 'service_role');
  runtime_role_oid oid := (SELECT oid FROM pg_roles WHERE rolname = 'kreile_app_runtime');
  template_function oid := to_regprocedure('public.fn_update_vorlagen()');
  source_guard_function oid := to_regprocedure('public.fn_guard_template_projection_source_insert()');
  normalize_function oid := to_regprocedure('public.fn_kreile_template_normalize(text)');
  keywords_function oid := to_regprocedure('public.fn_kreile_template_keywords_valid(text[])');
  classify_function oid := to_regprocedure('public.fn_kreile_template_classify(text,text)');
  relation_name text;
BEGIN
  IF migration_owner IS NULL OR service_role_oid IS NULL OR runtime_role_oid IS NULL
     OR template_function IS NULL
     OR source_guard_function IS NULL OR normalize_function IS NULL
     OR keywords_function IS NULL OR classify_function IS NULL THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: owner or function missing';
  END IF;

  IF current_setting('session_replication_role') <> 'origin'
     OR current_setting('lo_compat_privileges') <> 'off' THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: replication or large-object compatibility setting drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vorlage_zeit'
      AND column_name = 'is_active' AND data_type = 'boolean' AND is_nullable = 'NO'
      AND column_default ILIKE '%false%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vorlage_verbrauch'
      AND column_name = 'is_active' AND data_type = 'boolean' AND is_nullable = 'NO'
      AND column_default ILIKE '%false%'
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: active marker drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index index_record
    JOIN pg_class index_relation ON index_relation.oid = index_record.indexrelid
    WHERE index_relation.relnamespace = 'public'::regnamespace
      AND index_relation.relname = 'vorlage_zeit_tenant_key_station_uidx'
      AND index_record.indrelid = 'public.vorlage_zeit'::regclass
      AND index_record.indisunique AND index_record.indimmediate
      AND index_record.indisvalid AND index_record.indisready
      AND NOT index_record.indisexclusion AND NOT index_record.indisprimary
      AND NOT index_record.indisclustered AND NOT index_record.indisreplident
      AND NOT index_record.indnullsnotdistinct
      AND index_record.indpred IS NULL AND index_record.indexprs IS NULL
      AND index_record.indnkeyatts = 3 AND index_record.indnatts = 3
      AND (SELECT amname FROM pg_am WHERE oid = index_relation.relam) = 'btree'
      AND (
        SELECT array_agg(
          (opclass_namespace.nspname || '.' || opclass.opcname)::text
          ORDER BY key.ordinality
        )
        FROM unnest(index_record.indclass::oid[]) WITH ORDINALITY AS key(opclass_oid, ordinality)
        JOIN pg_opclass opclass ON opclass.oid = key.opclass_oid
        JOIN pg_namespace opclass_namespace ON opclass_namespace.oid = opclass.opcnamespace
      ) = ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops', 'pg_catalog.text_ops']::text[]
      AND (
        SELECT array_agg(index_collation.collation_oid::oid ORDER BY index_collation.ordinality)
        FROM unnest(index_record.indcollation::oid[]) WITH ORDINALITY
          AS index_collation(collation_oid, ordinality)
      ) = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND (
        SELECT array_agg(attribute_record.attcollation ORDER BY key.ordinality)
        FROM unnest(index_record.indkey::smallint[]) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute attribute_record
          ON attribute_record.attrelid = index_record.indrelid
         AND attribute_record.attnum = key.attnum
         AND NOT attribute_record.attisdropped
      ) = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND index_record.indoption::text = '0 0 0'
      AND pg_get_indexdef(index_record.indexrelid, 1, false) = 'tenant_id'
      AND pg_get_indexdef(index_record.indexrelid, 2, false) = 'schluessel'
      AND pg_get_indexdef(index_record.indexrelid, 3, false) = 'station_kuerzel'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_index index_record
    JOIN pg_class index_relation ON index_relation.oid = index_record.indexrelid
    WHERE index_relation.relnamespace = 'public'::regnamespace
      AND index_relation.relname = 'vorlage_verbrauch_tenant_key_station_item_uidx'
      AND index_record.indrelid = 'public.vorlage_verbrauch'::regclass
      AND index_record.indisunique AND index_record.indimmediate
      AND index_record.indisvalid AND index_record.indisready
      AND NOT index_record.indisexclusion AND NOT index_record.indisprimary
      AND NOT index_record.indisclustered AND NOT index_record.indisreplident
      AND NOT index_record.indnullsnotdistinct
      AND index_record.indpred IS NULL AND index_record.indexprs IS NULL
      AND index_record.indnkeyatts = 4 AND index_record.indnatts = 4
      AND (SELECT amname FROM pg_am WHERE oid = index_relation.relam) = 'btree'
      AND (
        SELECT array_agg(
          (opclass_namespace.nspname || '.' || opclass.opcname)::text
          ORDER BY key.ordinality
        )
        FROM unnest(index_record.indclass::oid[]) WITH ORDINALITY AS key(opclass_oid, ordinality)
        JOIN pg_opclass opclass ON opclass.oid = key.opclass_oid
        JOIN pg_namespace opclass_namespace ON opclass_namespace.oid = opclass.opcnamespace
      ) = ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops', 'pg_catalog.text_ops', 'pg_catalog.text_ops']::text[]
      AND (
        SELECT array_agg(index_collation.collation_oid::oid ORDER BY index_collation.ordinality)
        FROM unnest(index_record.indcollation::oid[]) WITH ORDINALITY
          AS index_collation(collation_oid, ordinality)
      ) = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND (
        SELECT array_agg(attribute_record.attcollation ORDER BY key.ordinality)
        FROM unnest(index_record.indkey::smallint[]) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute attribute_record
          ON attribute_record.attrelid = index_record.indrelid
         AND attribute_record.attnum = key.attnum
         AND NOT attribute_record.attisdropped
      ) = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND index_record.indoption::text = '0 0 0 0'
      AND pg_get_indexdef(index_record.indexrelid, 1, false) = 'tenant_id'
      AND pg_get_indexdef(index_record.indexrelid, 2, false) = 'schluessel'
      AND pg_get_indexdef(index_record.indexrelid, 3, false) = 'station_kuerzel'
      AND pg_get_indexdef(index_record.indexrelid, 4, false) = 'inventory_item_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_index index_record
    JOIN pg_class index_relation ON index_relation.oid = index_record.indexrelid
    WHERE index_relation.relnamespace = 'public'::regnamespace
      AND index_relation.relname = 'teile_klassifikator_tenant_normalized_class_uidx'
      AND index_record.indrelid = 'public.teile_klassifikator'::regclass
      AND index_record.indisunique AND index_record.indimmediate
      AND index_record.indisvalid AND index_record.indisready
      AND NOT index_record.indisexclusion AND NOT index_record.indisprimary
      AND NOT index_record.indisclustered AND NOT index_record.indisreplident
      AND NOT index_record.indnullsnotdistinct
      AND index_record.indpred IS NULL AND index_record.indexprs IS NOT NULL
      AND index_record.indnkeyatts = 2 AND index_record.indnatts = 2
      AND (SELECT amname FROM pg_am WHERE oid = index_relation.relam) = 'btree'
      AND (
        SELECT array_agg(
          (opclass_namespace.nspname || '.' || opclass.opcname)::text
          ORDER BY key.ordinality
        )
        FROM unnest(index_record.indclass::oid[]) WITH ORDINALITY AS key(opclass_oid, ordinality)
        JOIN pg_opclass opclass ON opclass.oid = key.opclass_oid
        JOIN pg_namespace opclass_namespace ON opclass_namespace.oid = opclass.opcnamespace
      ) = ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops']::text[]
      AND (
        SELECT array_agg(index_collation.collation_oid::oid ORDER BY index_collation.ordinality)
        FROM unnest(index_record.indcollation::oid[]) WITH ORDINALITY
          AS index_collation(collation_oid, ordinality)
      ) = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND ARRAY[
        (SELECT attcollation FROM pg_attribute WHERE attrelid = index_record.indrelid AND attname = 'tenant_id' AND NOT attisdropped),
        (SELECT attcollation FROM pg_attribute WHERE attrelid = index_record.indrelid AND attname = 'klasse' AND NOT attisdropped)
      ]::oid[] = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND index_record.indoption::text = '0 0'
      AND pg_get_indexdef(index_record.indexrelid, 1, false) = 'tenant_id'
      AND pg_get_indexdef(index_record.indexrelid, 2, false) IN (
        'fn_kreile_template_normalize(klasse)',
        'public.fn_kreile_template_normalize(klasse)'
      )
      AND 3 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_class'::regclass
          AND dependency.objid = index_record.indexrelid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_class'::regclass
          AND dependency.objid = index_record.indexrelid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_proc'::regclass
          AND dependency.refobjid = normalize_function
          AND dependency.refobjsubid = 0
          AND dependency.deptype = 'n'
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_class'::regclass
          AND dependency.objid = index_record.indexrelid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_class'::regclass
          AND dependency.refobjid = 'public.teile_klassifikator'::regclass
          AND dependency.refobjsubid = 2
          AND dependency.deptype = 'a'
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_class'::regclass
          AND dependency.objid = index_record.indexrelid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_class'::regclass
          AND dependency.refobjid = 'public.teile_klassifikator'::regclass
          AND dependency.refobjsubid = 3
          AND dependency.deptype = 'a'
      )
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: natural key drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.items'::regclass
      AND constraint_record.conname = 'items_template_surface_key_chk'
      AND constraint_record.convalidated
      AND constraint_record.contype = 'c'
      AND constraint_record.conislocal
      AND constraint_record.coninhcount = 0
      AND NOT constraint_record.connoinherit
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.conparentid = 0
      AND pg_get_expr(constraint_record.conbin, constraint_record.conrelid, false)
        = '((surface_requested IS NULL) OR (POSITION((''|''::text) IN (surface_requested)) = 0))'
      AND 2 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_class'::regclass
          AND dependency.refobjid = 'public.items'::regclass
          AND dependency.refobjsubid = 5
          AND dependency.deptype = 'a'
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_class'::regclass
          AND dependency.refobjid = 'public.items'::regclass
          AND dependency.refobjsubid = 5
          AND dependency.deptype = 'n'
      )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.teile_klassifikator'::regclass
      AND constraint_record.conname = 'teile_klassifikator_template_key_chk'
      AND constraint_record.convalidated
      AND constraint_record.contype = 'c'
      AND constraint_record.conislocal
      AND constraint_record.coninhcount = 0
      AND NOT constraint_record.connoinherit
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.conparentid = 0
      AND pg_get_expr(constraint_record.conbin, constraint_record.conrelid, false) IN (
        '((btrim(klasse) <> ''''::text) AND (POSITION((''|''::text) IN (klasse)) = 0) AND fn_kreile_template_keywords_valid(keywords))',
        '((btrim(klasse) <> ''''::text) AND (POSITION((''|''::text) IN (klasse)) = 0) AND public.fn_kreile_template_keywords_valid(keywords))'
      )
      AND 5 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_proc'::regclass
          AND dependency.refobjid = keywords_function
          AND dependency.refobjsubid = 0
          AND dependency.deptype = 'n'
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_class'::regclass
          AND dependency.refobjid = 'public.teile_klassifikator'::regclass
          AND dependency.refobjsubid = 3
          AND dependency.deptype = 'a'
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_class'::regclass
          AND dependency.refobjid = 'public.teile_klassifikator'::regclass
          AND dependency.refobjsubid = 3
          AND dependency.deptype = 'n'
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_class'::regclass
          AND dependency.refobjid = 'public.teile_klassifikator'::regclass
          AND dependency.refobjsubid = 4
          AND dependency.deptype = 'a'
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_depend dependency
        WHERE dependency.classid = 'pg_constraint'::regclass
          AND dependency.objid = constraint_record.oid
          AND dependency.objsubid = 0
          AND dependency.refclassid = 'pg_class'::regclass
          AND dependency.refobjid = 'public.teile_klassifikator'::regclass
          AND dependency.refobjsubid = 4
          AND dependency.deptype = 'n'
      )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.vorlage_zeit'::regclass
      AND constraint_record.conname = 'vorlage_zeit_projection_values_chk'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
      AND constraint_record.conislocal
      AND constraint_record.coninhcount = 0
      AND NOT constraint_record.connoinherit
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.conparentid = 0
      AND md5(pg_get_expr(constraint_record.conbin, constraint_record.conrelid, false))
        = '2dafb1c34dcb1e1f071b0adb425c6972'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.vorlage_verbrauch'::regclass
      AND constraint_record.conname = 'vorlage_verbrauch_projection_values_chk'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
      AND constraint_record.conislocal
      AND constraint_record.coninhcount = 0
      AND NOT constraint_record.connoinherit
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.conparentid = 0
      AND md5(pg_get_expr(constraint_record.conbin, constraint_record.conrelid, false))
        = 'b4c1bfc16010d3005ab0fcb3695631b8'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    JOIN pg_index target_index_record
      ON target_index_record.indexrelid = constraint_record.conindid
    JOIN pg_class target_index_relation
      ON target_index_relation.oid = target_index_record.indexrelid
    JOIN pg_namespace target_index_namespace
      ON target_index_namespace.oid = target_index_relation.relnamespace
    JOIN pg_am target_index_access_method
      ON target_index_access_method.oid = target_index_relation.relam
    WHERE constraint_record.conrelid = 'public.items'::regclass
      AND constraint_record.confrelid = 'public.orders'::regclass
      AND constraint_record.conname = 'items_tenant_order_fk'
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated
      AND constraint_record.conislocal
      AND constraint_record.coninhcount = 0
      AND constraint_record.conparentid = 0
      AND constraint_record.connoinherit
      AND NOT constraint_record.condeferrable
      AND NOT constraint_record.condeferred
      AND constraint_record.confmatchtype = 's'
      AND constraint_record.confupdtype = 'a'
      AND constraint_record.confdeltype = 'c'
      AND constraint_record.conindid = 'public.orders_tenant_id_uidx'::regclass
      AND constraint_record.conpfeqop::oid[] = ARRAY[
        'pg_catalog.=(text,text)'::regoperator::oid,
        'pg_catalog.=(text,text)'::regoperator::oid
      ]::oid[]
      AND constraint_record.conppeqop::oid[] = ARRAY[
        'pg_catalog.=(text,text)'::regoperator::oid,
        'pg_catalog.=(text,text)'::regoperator::oid
      ]::oid[]
      AND constraint_record.conffeqop::oid[] = ARRAY[
        'pg_catalog.=(text,text)'::regoperator::oid,
        'pg_catalog.=(text,text)'::regoperator::oid
      ]::oid[]
      AND target_index_namespace.nspname = 'public'
      AND target_index_relation.relname = 'orders_tenant_id_uidx'
      AND target_index_record.indrelid = constraint_record.confrelid
      AND target_index_access_method.amname = 'btree'
      AND target_index_record.indisunique
      AND target_index_record.indimmediate
      AND target_index_record.indisvalid
      AND target_index_record.indisready
      AND NOT target_index_record.indisexclusion
      AND NOT target_index_record.indisprimary
      AND NOT target_index_record.indisclustered
      AND NOT target_index_record.indisreplident
      AND NOT target_index_record.indnullsnotdistinct
      AND target_index_record.indpred IS NULL
      AND target_index_record.indexprs IS NULL
      AND target_index_record.indnkeyatts = 2
      AND target_index_record.indnatts = 2
      AND (
        SELECT array_agg(key.attnum::smallint ORDER BY key.ordinality)
        FROM unnest(target_index_record.indkey::smallint[]) WITH ORDINALITY
          AS key(attnum, ordinality)
      ) = constraint_record.confkey
      AND (
        SELECT array_agg(
          (opclass_namespace.nspname || '.' || opclass.opcname)::text
          ORDER BY key.ordinality
        )
        FROM unnest(target_index_record.indclass::oid[]) WITH ORDINALITY
          AS key(opclass_oid, ordinality)
        JOIN pg_opclass opclass ON opclass.oid = key.opclass_oid
        JOIN pg_namespace opclass_namespace ON opclass_namespace.oid = opclass.opcnamespace
      ) = ARRAY['pg_catalog.text_ops', 'pg_catalog.text_ops']::text[]
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(target_index_record.indoption::smallint[]) AS option_value(value)
        WHERE option_value.value <> 0
      )
      AND (
        SELECT array_agg(index_collation.collation_oid::oid ORDER BY index_collation.ordinality)
        FROM unnest(target_index_record.indcollation::oid[]) WITH ORDINALITY
          AS index_collation(collation_oid, ordinality)
      ) = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND (
        SELECT array_agg(target_attribute.attcollation ORDER BY key.ordinality)
        FROM unnest(constraint_record.confkey) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute target_attribute
          ON target_attribute.attrelid = constraint_record.confrelid
         AND target_attribute.attnum = key.attnum
         AND NOT target_attribute.attisdropped
      ) = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND (
        SELECT array_agg(source_attribute.attcollation ORDER BY key.ordinality)
        FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute source_attribute
          ON source_attribute.attrelid = constraint_record.conrelid
         AND source_attribute.attnum = key.attnum
         AND NOT source_attribute.attisdropped
      ) = ARRAY[
        'pg_catalog.default'::regcollation::oid,
        'pg_catalog.default'::regcollation::oid
      ]::oid[]
      AND (
        SELECT array_agg(attribute_record.attname::text ORDER BY key.ordinality)
        FROM unnest(constraint_record.conkey) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute attribute_record
          ON attribute_record.attrelid = constraint_record.conrelid
         AND attribute_record.attnum = key.attnum
      ) = ARRAY['tenant_id', 'order_id']::text[]
      AND (
        SELECT array_agg(attribute_record.attname::text ORDER BY key.ordinality)
        FROM unnest(constraint_record.confkey) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute attribute_record
          ON attribute_record.attrelid = constraint_record.confrelid
         AND attribute_record.attnum = key.attnum
      ) = ARRAY['tenant_id', 'id']::text[]
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: classifier or tenant-order constraint drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE oid = migration_owner AND (rolbypassrls OR rolsuper)
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE oid = service_role_oid
      AND rolbypassrls
      AND NOT rolsuper
      AND NOT rolcanlogin
      AND NOT rolcreaterole
      AND NOT rolcreatedb
      AND NOT rolreplication
      AND rolconfig IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_db_role_setting role_setting
        WHERE role_setting.setrole = service_role_oid
      )
      AND NOT has_database_privilege(service_role_oid, current_database(), 'CREATE')
      AND NOT has_database_privilege(service_role_oid, current_database(), 'TEMP')
      AND NOT has_parameter_privilege(service_role_oid, 'session_replication_role', 'SET')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_namespace namespace_record
        WHERE namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND has_schema_privilege(service_role_oid, namespace_record.oid, 'CREATE')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_tablespace tablespace_record
        WHERE has_tablespace_privilege(service_role_oid, tablespace_record.oid, 'CREATE')
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_auth_members membership
        WHERE membership.member = service_role_oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_auth_members membership
        JOIN pg_roles member_role ON member_role.oid = membership.member
        JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
        WHERE membership.roleid = service_role_oid
          AND (
            member_role.rolname NOT IN ('kreile_app_runtime', 'authenticator')
            OR membership.admin_option
            OR membership.inherit_option
            OR NOT membership.set_option
            OR NOT (grantor_role.rolsuper OR grantor_role.oid = migration_owner)
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_shdepend dependency
        WHERE dependency.refclassid = 'pg_authid'::regclass
          AND dependency.refobjid = service_role_oid
          AND dependency.deptype = 'o'
      )
  ) OR migration_owner IS DISTINCT FROM (
    SELECT datdba FROM pg_database WHERE datname = current_database()
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: migration owner cannot bypass RLS';
  END IF;

  IF current_setting('search_path') <> 'pg_catalog, pg_temp'
     OR NOT has_schema_privilege(service_role_oid, 'public', 'USAGE') THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: schema resolution or service_role schema ACL drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles runtime_role
    WHERE runtime_role.oid = runtime_role_oid
      AND runtime_role.rolname = 'kreile_app_runtime'
      AND runtime_role.rolcanlogin
      AND NOT runtime_role.rolinherit
      AND NOT runtime_role.rolsuper
      AND NOT runtime_role.rolbypassrls
      AND NOT runtime_role.rolcreaterole
      AND NOT runtime_role.rolcreatedb
      AND NOT runtime_role.rolreplication
      AND runtime_role.rolconfig IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_db_role_setting role_setting
        WHERE role_setting.setrole = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_auth_members membership
        WHERE membership.roleid = runtime_role.oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_auth_members membership
        WHERE membership.member = runtime_role.oid
          AND membership.roleid = service_role_oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_auth_members membership
        WHERE membership.member = runtime_role.oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_auth_members membership
        JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
        WHERE membership.member = runtime_role.oid
          AND membership.roleid = service_role_oid
          AND NOT membership.admin_option
          AND NOT membership.inherit_option
          AND membership.set_option
          AND (grantor_role.rolsuper OR grantor_role.oid = migration_owner)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_class relation_record
        CROSS JOIN LATERAL aclexplode(relation_record.relacl) acl_entry
        WHERE acl_entry.grantee = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_attribute attribute_record
        CROSS JOIN LATERAL aclexplode(attribute_record.attacl) acl_entry
        WHERE attribute_record.attnum > 0
          AND NOT attribute_record.attisdropped
          AND acl_entry.grantee = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc function_record
        CROSS JOIN LATERAL aclexplode(function_record.proacl) acl_entry
        WHERE acl_entry.grantee = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_namespace namespace_record
        CROSS JOIN LATERAL aclexplode(namespace_record.nspacl) acl_entry
        WHERE acl_entry.grantee = runtime_role.oid
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_database database_record
        CROSS JOIN LATERAL aclexplode(database_record.datacl) acl_entry
        JOIN pg_roles grantor_role ON grantor_role.oid = acl_entry.grantor
        WHERE database_record.datname = current_database()
          AND acl_entry.grantee = runtime_role.oid
          AND acl_entry.privilege_type = 'CONNECT'
          AND NOT acl_entry.is_grantable
          AND (grantor_role.rolsuper OR grantor_role.oid = database_record.datdba)
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_database database_record
        CROSS JOIN LATERAL aclexplode(database_record.datacl) acl_entry
        WHERE acl_entry.grantee = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_database database_record
        CROSS JOIN LATERAL aclexplode(database_record.datacl) acl_entry
        WHERE database_record.datname = current_database()
          AND acl_entry.grantor = runtime_role.oid
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_database database_record
        CROSS JOIN LATERAL aclexplode(
          coalesce(database_record.datacl, acldefault('d', database_record.datdba))
        ) acl_entry
        WHERE database_record.datname = current_database()
          AND acl_entry.grantee = 0
          AND acl_entry.privilege_type IN ('CONNECT', 'TEMPORARY')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_database database_record
        WHERE database_record.datallowconn
          AND database_record.datname <> current_database()
          AND (
            has_database_privilege(runtime_role.oid, database_record.oid, 'CONNECT')
            OR has_database_privilege(runtime_role.oid, database_record.oid, 'TEMP')
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_shdepend dependency
        WHERE dependency.refclassid = 'pg_authid'::regclass
          AND dependency.refobjid = runtime_role.oid
          AND dependency.deptype IN ('o', 'a', 'r')
          AND NOT (
            dependency.deptype = 'a'
            AND dependency.classid = 'pg_database'::regclass
            AND dependency.objid = (SELECT oid FROM pg_database WHERE datname = current_database())
            AND dependency.objsubid = 0
          )
      )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_proc function_record
       JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
       WHERE function_record.prosecdef
         AND function_record.oid >= 16384
         AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
         AND has_function_privilege(runtime_role.oid, function_record.oid, 'EXECUTE')
     )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_namespace writable_namespace
        CROSS JOIN LATERAL aclexplode(
          coalesce(writable_namespace.nspacl, acldefault('n', writable_namespace.nspowner))
        ) acl_entry
        WHERE writable_namespace.nspname IN ('public', 'extensions')
          AND acl_entry.grantee = 0
          AND acl_entry.privilege_type = 'CREATE'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_roles candidate
        CROSS JOIN pg_namespace writable_namespace
        WHERE writable_namespace.nspname IN ('public', 'extensions')
          AND NOT candidate.rolsuper
          AND candidate.oid <> migration_owner
          AND has_schema_privilege(candidate.oid, writable_namespace.oid, 'CREATE')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc function_record
        JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
        JOIN pg_language language_record ON language_record.oid = function_record.prolang
        JOIN pg_roles owner_role ON owner_role.oid = function_record.proowner
        CROSS JOIN LATERAL (
          SELECT
            coalesce(bool_or(to_regprocedure(approved.signature) = function_record.oid), false) AS signature_approved,
            coalesce(bool_or(
              to_regprocedure(approved.signature) = function_record.oid
              AND function_record.proconfig IS NOT DISTINCT FROM approved.proconfig
            ), false) AS contract_approved
          FROM (VALUES
            ('public.get_mollie_payment_quote(text,text)', ARRAY['search_path=pg_catalog, extensions, public, pg_temp']::text[]),
            ('public.reserve_mollie_payment_attempt(uuid,text,text,bigint,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.bind_mollie_payment_provider(uuid,text,text,bigint,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.record_mollie_payment_state(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.finalize_mollie_payment(text,text,text,timestamptz,text,text,bigint,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.consume_security_rate_limit(text,text,integer,integer)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.reset_security_rate_limit(text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.reserve_ai_usage(text,text,text,text,integer,integer,integer,integer,bigint,bigint)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.claim_ai_usage_reservation(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.settle_ai_usage_reservation(uuid,text,text,text,text,integer,text,jsonb)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.bind_item_photo_upload(uuid,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.claim_item_photo_analysis(uuid)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.settle_item_photo_analysis(uuid,text,integer,text,jsonb)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.mark_item_photo_uncertain(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[]),
            ('public.finance_close_period(uuid,text,uuid,uuid)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[])
          ) approved(signature, proconfig)
        ) approval
        CROSS JOIN LATERAL (
          SELECT
            count(*) AS entry_count,
            count(*) FILTER (WHERE
              acl_entry.grantee = function_record.proowner
              AND acl_entry.grantor = function_record.proowner
              AND acl_entry.privilege_type = 'EXECUTE'
              AND NOT acl_entry.is_grantable
            ) AS owner_entry_count,
            count(*) FILTER (WHERE
              acl_entry.grantee = service_role_oid
              AND acl_entry.grantor = function_record.proowner
              AND acl_entry.privilege_type = 'EXECUTE'
              AND NOT acl_entry.is_grantable
            ) AS service_entry_count
          FROM aclexplode(
            coalesce(function_record.proacl, acldefault('f', function_record.proowner))
          ) acl_entry
        ) acl_contract
        WHERE function_record.prosecdef
          AND function_record.oid >= 16384
          AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND (
            function_record.prokind <> 'f'
            OR language_record.lanname <> 'plpgsql'
            OR NOT (owner_role.rolsuper OR owner_role.oid = migration_owner)
            OR (
              approval.signature_approved
              AND (
                NOT approval.contract_approved
                OR acl_contract.entry_count <> 2
                OR acl_contract.owner_entry_count <> 1
                OR acl_contract.service_entry_count <> 1
              )
            )
            OR (
              NOT approval.signature_approved
              AND (
                (
                  function_record.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']::text[]
                  AND function_record.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
                  AND function_record.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, extensions, public, pg_temp']::text[]
                )
                OR acl_contract.entry_count <> 1
                OR acl_contract.owner_entry_count <> 1
              )
            )
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_class relation_record
        JOIN pg_namespace namespace_record ON namespace_record.oid = relation_record.relnamespace
        CROSS JOIN LATERAL aclexplode(
          coalesce(
            relation_record.relacl,
            CASE
              WHEN relation_record.relkind = 'S' THEN acldefault('s', relation_record.relowner)
              ELSE acldefault('r', relation_record.relowner)
            END
          )
        ) acl_entry
        WHERE relation_record.oid >= 16384
          AND relation_record.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND acl_entry.grantee = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_attribute attribute_record
        JOIN pg_class relation_record ON relation_record.oid = attribute_record.attrelid
        JOIN pg_namespace namespace_record ON namespace_record.oid = relation_record.relnamespace
        CROSS JOIN LATERAL aclexplode(
          coalesce(attribute_record.attacl, acldefault('c', relation_record.relowner))
        ) acl_entry
        WHERE relation_record.oid >= 16384
          AND relation_record.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          AND attribute_record.attnum > 0
          AND NOT attribute_record.attisdropped
          AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND acl_entry.grantee = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_largeobject_metadata large_object_record
        CROSS JOIN LATERAL aclexplode(
          coalesce(large_object_record.lomacl, acldefault('L', large_object_record.lomowner))
        ) acl_entry
        WHERE acl_entry.grantee = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_parameter_acl parameter_acl
        CROSS JOIN LATERAL aclexplode(
          coalesce(parameter_acl.paracl, '{}'::aclitem[])
        ) acl_entry
        WHERE acl_entry.grantee IN (0, runtime_role.oid, service_role_oid)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_default_acl default_acl
        CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) acl_entry
        WHERE acl_entry.grantee IN (0, runtime_role.oid, service_role_oid)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc function_record
        JOIN pg_namespace namespace_record ON namespace_record.oid = function_record.pronamespace
        CROSS JOIN LATERAL aclexplode(
          coalesce(function_record.proacl, acldefault('f', function_record.proowner))
        ) acl_entry
        WHERE function_record.prosecdef
          AND function_record.oid >= 16384
          AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND acl_entry.grantee = 0
      )
      AND NOT has_schema_privilege(runtime_role.oid, 'public', 'CREATE')
      AND NOT has_database_privilege(runtime_role.oid, current_database(), 'CREATE')
      AND has_database_privilege(runtime_role.oid, current_database(), 'CONNECT')
      AND NOT has_database_privilege(runtime_role.oid, current_database(), 'TEMP')
      AND NOT has_parameter_privilege(runtime_role.oid, 'session_replication_role', 'SET')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_namespace namespace_record
        WHERE namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          AND has_schema_privilege(runtime_role.oid, namespace_record.oid, 'CREATE')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_tablespace tablespace_record
        WHERE has_tablespace_privilege(runtime_role.oid, tablespace_record.oid, 'CREATE')
      )
      AND CASE
        WHEN current_setting('server_version_num')::integer >= 160000
          THEN pg_has_role(runtime_role.oid, service_role_oid, 'SET')
        ELSE pg_has_role(runtime_role.oid, service_role_oid, 'MEMBER')
      END
      AND NOT pg_has_role(runtime_role.oid, migration_owner, 'MEMBER')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_roles reachable_role
        WHERE reachable_role.oid NOT IN (runtime_role.oid, service_role_oid)
          AND pg_has_role(runtime_role.oid, reachable_role.oid, 'MEMBER')
      )
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: runtime broker can recover a privileged identity';
  END IF;

  IF NOT pg_temp.capture_secdef_contract_valid(service_role_oid, migration_owner, 'post') THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: SECURITY DEFINER function or trigger inventory drifted';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles candidate
    WHERE candidate.rolname = 'authenticator'
      AND candidate.oid <> service_role_oid
      AND pg_has_role(candidate.oid, service_role_oid, 'MEMBER')
      AND (
        NOT candidate.rolcanlogin OR candidate.rolinherit
        OR candidate.rolsuper OR candidate.rolbypassrls
        OR candidate.rolcreaterole OR candidate.rolcreatedb OR candidate.rolreplication
        OR 1 <> (
          SELECT count(*)
          FROM pg_auth_members membership
          WHERE membership.member = candidate.oid
            AND membership.roleid = service_role_oid
        )
        OR NOT EXISTS (
          SELECT 1
          FROM pg_auth_members membership
          JOIN pg_roles grantor_role ON grantor_role.oid = membership.grantor
          WHERE membership.member = candidate.oid
            AND membership.roleid = service_role_oid
            AND NOT membership.admin_option
            AND NOT membership.inherit_option
            AND membership.set_option
            AND (grantor_role.rolsuper OR grantor_role.oid = migration_owner)
        )
        OR has_schema_privilege(candidate.oid, 'public', 'CREATE')
        OR has_database_privilege(candidate.oid, current_database(), 'CREATE')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_roles candidate
    WHERE NOT candidate.rolsuper
      AND candidate.oid <> service_role_oid
      AND candidate.rolname NOT IN ('authenticator', 'kreile_app_runtime')
      AND pg_has_role(candidate.oid, service_role_oid, 'MEMBER')
  ) OR EXISTS (
    SELECT 1
    FROM pg_roles candidate
    WHERE NOT candidate.rolsuper
      AND candidate.oid <> migration_owner
      AND pg_has_role(candidate.oid, migration_owner, 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: role reachability drift';
  END IF;

  FOREACH relation_name IN ARRAY ARRAY[
    'orders', 'items', 'arbeitszeit_buchung', 'teile_klassifikator',
    'stock_movements', 'inventory_items', 'vorlage_zeit', 'vorlage_verbrauch',
    'customers', 'ausgangsrechnung', 'kostenstelle', 'kostenstellen_energie_monat'
  ] LOOP
    IF (SELECT relowner FROM pg_class WHERE oid = to_regclass('public.' || relation_name)) <> migration_owner THEN
      RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: owner drift on public.%', relation_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_language language_record ON language_record.oid = function_record.prolang
    WHERE function_record.oid = template_function
      AND language_record.lanname = 'plpgsql'
      AND function_record.prokind = 'f'
      AND function_record.prorettype = 'trigger'::regtype
      AND function_record.provolatile = 'v'
      AND NOT function_record.proisstrict
      AND function_record.prosecdef
      AND function_record.proowner = migration_owner
      AND function_record.proconfig = ARRAY['search_path=pg_catalog, pg_temp']::text[]
      AND function_record.pronargs = 0
      AND function_record.proargnames IS NULL
      AND NOT function_record.proleakproof
      AND function_record.proparallel = 'u'
      AND NOT function_record.proretset
      AND function_record.prosupport = 0
      AND function_record.pronargdefaults = 0
      AND function_record.provariadic = 0
      AND function_record.protrftypes IS NULL
      AND function_record.proallargtypes IS NULL
      AND function_record.proargmodes IS NULL
      AND function_record.proargdefaults IS NULL
      AND function_record.probin IS NULL
      AND function_record.prosqlbody IS NULL
      AND function_record.procost = 100
      AND function_record.prorows = 0
      AND md5(convert_to(
        btrim(regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')),
        'UTF8'
      )) = 'c0a810fd594dd7012e097d2d00be7f50'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          'TG_TABLE_SCHEMA', 'TG_TABLE_NAME', 'TG_OP',
          'OLD.id IS DISTINCT FROM NEW.id', 'OLD.tenant_id IS DISTINCT FROM NEW.tenant_id',
          'old_is_terminal', 'new_is_terminal', 'booking.end_zeit IS NOT NULL',
          'movement_type IN (''consumption'', ''verbrauch'')',
          'WHEN ''beschichtung'' THEN ''galvanik''', 'pg_advisory_xact_lock',
          'ON CONFLICT (tenant_id, schluessel, station_kuerzel)',
          'ON CONFLICT (tenant_id, schluessel, station_kuerzel, inventory_item_id)',
          'TEMPLATE_PROJECTION_UNIT_DRIFT',
          'TEMPLATE_PROJECTION_TERMINAL_INSERT_REQUIRES_STATUS_TRANSITION'
        ]) fragment
        WHERE regexp_replace(pg_get_functiondef(function_record.oid), '[[:space:]]+', ' ', 'g')
          NOT ILIKE ('%' || regexp_replace(fragment, '[[:space:]]+', ' ', 'g') || '%')
      )
      AND pg_get_functiondef(function_record.oid) NOT ILIKE '%COALESCE(NEW.tenant_id%'
      AND pg_get_functiondef(function_record.oid) NOT ILIKE '%''st''%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_language language_record ON language_record.oid = function_record.prolang
    WHERE function_record.oid = source_guard_function
      AND language_record.lanname = 'plpgsql'
      AND function_record.prokind = 'f'
      AND function_record.prorettype = 'trigger'::regtype
      AND function_record.provolatile = 'v'
      AND NOT function_record.proisstrict
      AND function_record.prosecdef
      AND function_record.proowner = migration_owner
      AND function_record.proconfig = ARRAY['search_path=pg_catalog, pg_temp']::text[]
      AND function_record.pronargs = 0
      AND function_record.proargnames IS NULL
      AND NOT function_record.proleakproof
      AND function_record.proparallel = 'u'
      AND NOT function_record.proretset
      AND function_record.prosupport = 0
      AND function_record.pronargdefaults = 0
      AND function_record.provariadic = 0
      AND function_record.protrftypes IS NULL
      AND function_record.proallargtypes IS NULL
      AND function_record.proargmodes IS NULL
      AND function_record.proargdefaults IS NULL
      AND function_record.probin IS NULL
      AND function_record.prosqlbody IS NULL
      AND function_record.procost = 100
      AND function_record.prorows = 0
      AND md5(convert_to(
        btrim(regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')),
        'UTF8'
      )) = '758bf8c0fc6506ad85862f5547a660f2'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          'TG_TABLE_SCHEMA', 'TG_TABLE_NAME', 'TG_OP <> ''INSERT''',
          '''items''', '''arbeitszeit_buchung''', '''stock_movements''',
          'NEW.order_id', 'NEW.auftrag_id', 'NEW.movement_type',
          'FOR SHARE', 'source_order_status IS DISTINCT FROM ''in_progress''',
          'TEMPLATE_PROJECTION_SOURCE_ORDER_MISSING', 'TEMPLATE_PROJECTION_SOURCE_FROZEN'
        ]) fragment
        WHERE regexp_replace(pg_get_functiondef(function_record.oid), '[[:space:]]+', ' ', 'g')
          NOT ILIKE ('%' || regexp_replace(fragment, '[[:space:]]+', ' ', 'g') || '%')
      )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_language language_record ON language_record.oid = function_record.prolang
    WHERE function_record.oid = normalize_function
      AND language_record.lanname = 'sql'
      AND function_record.prokind = 'f'
      AND function_record.prorettype = 'text'::regtype
      AND NOT function_record.prosecdef
      AND function_record.provolatile = 'i'
      AND function_record.proisstrict
      AND function_record.proowner = migration_owner
      AND function_record.proconfig = ARRAY['search_path=pg_catalog, pg_temp']::text[]
      AND function_record.pronargs = 1
      AND function_record.proargnames = ARRAY['p_value']::text[]
      AND NOT function_record.proleakproof
      AND function_record.proparallel = 'u'
      AND NOT function_record.proretset
      AND function_record.prosupport = 0
      AND function_record.pronargdefaults = 0
      AND function_record.provariadic = 0
      AND function_record.protrftypes IS NULL
      AND function_record.proallargtypes IS NULL
      AND function_record.proargmodes IS NULL
      AND function_record.proargdefaults IS NULL
      AND function_record.probin IS NULL
      AND function_record.prosqlbody IS NULL
      AND function_record.procost = 100
      AND function_record.prorows = 0
      AND md5(convert_to(
        btrim(regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')),
        'UTF8'
      )) = '11156fe67484f3a382eea5202c6e80a4'
      AND pg_get_functiondef(function_record.oid) ILIKE '%normalize(p_value, NFC)%'
      AND pg_get_functiondef(function_record.oid) ILIKE '%''ä'', ''ae''%'
      AND pg_get_functiondef(function_record.oid) ILIKE '%''ß'', ''ss''%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_language language_record ON language_record.oid = function_record.prolang
    WHERE function_record.oid = keywords_function
      AND language_record.lanname = 'sql'
      AND function_record.prokind = 'f'
      AND function_record.prorettype = 'boolean'::regtype
      AND NOT function_record.prosecdef
      AND function_record.provolatile = 'i'
      AND NOT function_record.proisstrict
      AND function_record.proowner = migration_owner
      AND function_record.proconfig = ARRAY['search_path=pg_catalog, pg_temp']::text[]
      AND function_record.pronargs = 1
      AND function_record.proargnames = ARRAY['p_keywords']::text[]
      AND NOT function_record.proleakproof
      AND function_record.proparallel = 'u'
      AND NOT function_record.proretset
      AND function_record.prosupport = 0
      AND function_record.pronargdefaults = 0
      AND function_record.provariadic = 0
      AND function_record.protrftypes IS NULL
      AND function_record.proallargtypes IS NULL
      AND function_record.proargmodes IS NULL
      AND function_record.proargdefaults IS NULL
      AND function_record.probin IS NULL
      AND function_record.prosqlbody IS NULL
      AND function_record.procost = 100
      AND function_record.prorows = 0
      AND md5(convert_to(
        btrim(regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')),
        'UTF8'
      )) = 'd6c4024c3d3a869f0795c96a6ebe9c8e'
      AND pg_get_functiondef(function_record.oid) ILIKE '%p_keywords IS NOT NULL%'
      AND pg_get_functiondef(function_record.oid) ILIKE '%cardinality(p_keywords) > 0%'
      AND pg_get_functiondef(function_record.oid) ILIKE '%keyword IS NULL OR btrim(keyword) = ''''%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_language language_record ON language_record.oid = function_record.prolang
    WHERE function_record.oid = classify_function
      AND language_record.lanname = 'sql'
      AND function_record.prokind = 'f'
      AND function_record.prorettype = 'text'::regtype
      AND NOT function_record.prosecdef
      AND function_record.provolatile = 's'
      AND function_record.proisstrict
      AND function_record.proowner = migration_owner
      AND function_record.proconfig = ARRAY['search_path=pg_catalog, pg_temp']::text[]
      AND function_record.pronargs = 2
      AND function_record.proargnames = ARRAY['p_tenant_id', 'p_item_name']::text[]
      AND NOT function_record.proleakproof
      AND function_record.proparallel = 'u'
      AND NOT function_record.proretset
      AND function_record.prosupport = 0
      AND function_record.pronargdefaults = 0
      AND function_record.provariadic = 0
      AND function_record.protrftypes IS NULL
      AND function_record.proallargtypes IS NULL
      AND function_record.proargmodes IS NULL
      AND function_record.proargdefaults IS NULL
      AND function_record.probin IS NULL
      AND function_record.prosqlbody IS NULL
      AND function_record.procost = 100
      AND function_record.prorows = 0
      AND md5(convert_to(
        btrim(regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')),
        'UTF8'
      )) = 'aa3283092a231dd9134774ce3de5aecb'
      AND pg_get_functiondef(function_record.oid) ILIKE '%classifier.tenant_id = p_tenant_id%'
      AND pg_get_functiondef(function_record.oid) ILIKE '%strpos(%'
      AND pg_get_functiondef(function_record.oid) ILIKE '%length(public.fn_kreile_template_normalize(keyword.value)) DESC%'
      AND pg_get_functiondef(function_record.oid) ILIKE '%''sonstiges''%'
  ) OR EXISTS (
    SELECT 1
    FROM pg_proc function_record,
         LATERAL aclexplode(coalesce(function_record.proacl, acldefault('f', function_record.proowner))) acl_entry
    WHERE function_record.oid IN (
      template_function, source_guard_function, normalize_function, keywords_function, classify_function
    )
      AND (
        acl_entry.grantee <> migration_owner
        OR acl_entry.grantor <> migration_owner
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_roles role_record
    CROSS JOIN unnest(ARRAY[
      template_function, source_guard_function, normalize_function, keywords_function, classify_function
    ]) function_oid
    WHERE role_record.oid <> migration_owner
      AND NOT role_record.rolsuper
      AND has_function_privilege(role_record.oid, function_oid, 'EXECUTE')
  ) OR EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      template_function, source_guard_function, normalize_function, keywords_function, classify_function
    ]) function_oid
    WHERE NOT has_function_privilege(migration_owner, function_oid, 'EXECUTE')
  ) OR EXISTS (
    SELECT 1
    FROM pg_roles role_record
    CROSS JOIN unnest(ARRAY[
      template_function, source_guard_function, normalize_function, keywords_function, classify_function
    ]) function_oid
    WHERE role_record.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator')
      AND has_function_privilege(role_record.oid, function_oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: function owner or ACL drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger_record
    JOIN pg_class relation_record ON relation_record.oid = trigger_record.tgrelid
    WHERE relation_record.oid = 'public.orders'::regclass
      AND trigger_record.tgname = 'trg_update_vorlagen'
      AND trigger_record.tgfoid = template_function
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgparentid = 0
      AND trigger_record.tgconstrrelid = 0
      AND trigger_record.tgconstrindid = 0
      AND trigger_record.tgconstraint = 0
      AND NOT trigger_record.tgdeferrable
      AND NOT trigger_record.tginitdeferred
      AND trigger_record.tgenabled = 'O'
      AND trigger_record.tgtype = 17
      AND trigger_record.tgnargs = 0
      AND octet_length(trigger_record.tgargs) = 0
      AND trigger_record.tgoldtable IS NULL
      AND trigger_record.tgnewtable IS NULL
      AND trigger_record.tgattr::text = (
        SELECT attribute_record.attnum::text
        FROM pg_attribute attribute_record
        WHERE attribute_record.attrelid = 'public.orders'::regclass
          AND attribute_record.attname = 'status'
          AND NOT attribute_record.attisdropped
      )
      AND trigger_record.tgqual IS NOT NULL
      AND md5(convert_to(
        btrim(regexp_replace(pg_get_triggerdef(trigger_record.oid), '[[:space:]]+', ' ', 'g')),
        'UTF8'
      )) IN ('22cecf094c118fa1dc2a444493928b34', 'e514cdaf1cca2df32f7807c3f3201523')
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger_record
    WHERE trigger_record.tgrelid = 'public.orders'::regclass
      AND trigger_record.tgname = 'trg_insert_vorlagen'
      AND trigger_record.tgfoid = template_function
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgparentid = 0
      AND trigger_record.tgconstrrelid = 0
      AND trigger_record.tgconstrindid = 0
      AND trigger_record.tgconstraint = 0
      AND NOT trigger_record.tgdeferrable
      AND NOT trigger_record.tginitdeferred
      AND trigger_record.tgenabled = 'O'
      AND trigger_record.tgtype = 5
      AND trigger_record.tgnargs = 0
      AND octet_length(trigger_record.tgargs) = 0
      AND trigger_record.tgoldtable IS NULL
      AND trigger_record.tgnewtable IS NULL
      AND trigger_record.tgattr::text = ''
      AND trigger_record.tgqual IS NOT NULL
      AND md5(convert_to(
        btrim(regexp_replace(pg_get_triggerdef(trigger_record.oid), '[[:space:]]+', ' ', 'g')),
        'UTF8'
      )) IN ('5539b157c4df2c3e9a487f15c3b9ee03', '8236f23a0ed55e431dc91ae322613169')
  ) OR 2 <> (
    SELECT count(*)
    FROM pg_trigger trigger_record
    WHERE trigger_record.tgfoid = template_function
      AND NOT trigger_record.tgisinternal
  ) OR 3 <> (
    SELECT count(*)
    FROM (VALUES
      ('template_projection_items_source_guard_trg', 'items', ARRAY['1518b003c2b9daa78a4c9fb95495ab25', '4ea1d298c5b87ee735867e25b9542f33']::text[]),
      ('template_projection_time_source_guard_trg', 'arbeitszeit_buchung', ARRAY['d549dd2d444805a2199fb4714a65a584', '5bcc98cc276601c794cc86b94543f52a']::text[]),
      ('template_projection_movement_source_guard_trg', 'stock_movements', ARRAY['4043dfe12eaf485e867ffce88def38fa', '768f4f1e8a396a1f14d510372e1e0c97']::text[])
    ) expected(trigger_name, relation_name, definition_hashes)
    JOIN pg_class relation_record ON relation_record.oid = to_regclass('public.' || expected.relation_name)
    JOIN pg_trigger trigger_record
      ON trigger_record.tgrelid = relation_record.oid
     AND trigger_record.tgname = expected.trigger_name
     AND trigger_record.tgfoid = source_guard_function
     AND NOT trigger_record.tgisinternal
     AND trigger_record.tgparentid = 0
     AND trigger_record.tgconstrrelid = 0
     AND trigger_record.tgconstrindid = 0
     AND trigger_record.tgconstraint = 0
     AND NOT trigger_record.tgdeferrable
     AND NOT trigger_record.tginitdeferred
     AND trigger_record.tgenabled = 'O'
     AND trigger_record.tgtype = 7
     AND trigger_record.tgnargs = 0
     AND octet_length(trigger_record.tgargs) = 0
     AND trigger_record.tgoldtable IS NULL
     AND trigger_record.tgnewtable IS NULL
     AND trigger_record.tgattr::text = ''
     AND trigger_record.tgqual IS NULL
     AND md5(convert_to(
       btrim(regexp_replace(pg_get_triggerdef(trigger_record.oid), '[[:space:]]+', ' ', 'g')),
       'UTF8'
     )) = ANY(expected.definition_hashes)
  ) OR 3 <> (
    SELECT count(*)
    FROM pg_trigger trigger_record
    WHERE trigger_record.tgfoid = source_guard_function
      AND NOT trigger_record.tgisinternal
  ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: trigger drift';
  END IF;

  IF has_table_privilege('service_role', 'public.vorlage_zeit', 'INSERT')
     OR has_table_privilege('service_role', 'public.vorlage_zeit', 'UPDATE')
     OR has_table_privilege('service_role', 'public.vorlage_verbrauch', 'INSERT')
     OR has_table_privilege('service_role', 'public.vorlage_verbrauch', 'UPDATE') THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: service_role direct write detected';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class view_record
    WHERE view_record.oid = 'public.v_auftrag_db'::regclass
      AND view_record.relkind = 'v'
      AND view_record.relowner = migration_owner
      AND view_record.reloptions @> ARRAY['security_invoker=true', 'security_barrier=true']::text[]
      AND view_record.reloptions <@ ARRAY['security_invoker=true', 'security_barrier=true']::text[]
      AND md5(convert_to(
        btrim(regexp_replace(pg_get_viewdef(view_record.oid, false), '[[:space:]]+', ' ', 'g')),
        'UTF8'
      )) IN (
        '8d59ab4d53f735d657349f089f300a1f',
        '88e7ea8c5610a89487080ba27262697c'
      )
      AND (
        SELECT array_agg(
          (attribute_record.attname || ':' || format_type(attribute_record.atttypid, attribute_record.atttypmod))::text
          ORDER BY attribute_record.attnum
        )
        FROM pg_attribute attribute_record
        WHERE attribute_record.attrelid = view_record.oid
          AND attribute_record.attnum > 0
          AND NOT attribute_record.attisdropped
      ) = ARRAY[
        'order_id:text', 'order_number:text', 'customer_id:text',
        'kunde_name:text', 'company_name:text', 'intake_date:timestamp without time zone',
        'status:text', 'current_station:text', 'due_date:timestamp without time zone',
        'erloes_netto:numeric', 'material_kosten:numeric', 'arbeitszeit_kosten:numeric',
        'energie_anteil_kosten:numeric', 'deckungsbeitrag:numeric', 'db_marge:numeric',
        'anz_rechnungen:bigint', 'anz_verbrauch:bigint', 'anz_zeitbuchungen:bigint',
        'tenant_id:character varying(50)', 'anz_rechnungen_ohne_netto:bigint',
        'anz_verbrauch_ohne_preis:bigint', 'anz_offene_zeitbuchungen:bigint',
        'anz_zeitbuchungen_ohne_energiepreis:bigint', 'db_berechenbar:boolean'
      ]::text[]
      AND 1 = (
        SELECT count(*)
        FROM pg_rewrite rewrite_record
        WHERE rewrite_record.ev_class = view_record.oid
          AND rewrite_record.rulename = '_RETURN'
          AND rewrite_record.ev_type = '1'
          AND rewrite_record.ev_enabled = 'O'
          AND rewrite_record.is_instead
      )
      AND 38 = (
        SELECT count(*)
        FROM (VALUES
          ('public.orders'::regclass::oid, 1),
          ('public.orders'::regclass::oid, 2),
          ('public.orders'::regclass::oid, 3),
          ('public.orders'::regclass::oid, 4),
          ('public.orders'::regclass::oid, 5),
          ('public.orders'::regclass::oid, 6),
          ('public.orders'::regclass::oid, 7),
          ('public.orders'::regclass::oid, 8),
          ('public.orders'::regclass::oid, 9),
          ('public.orders'::regclass::oid, 10),
          ('public.stock_movements'::regclass::oid, 2),
          ('public.stock_movements'::regclass::oid, 4),
          ('public.stock_movements'::regclass::oid, 5),
          ('public.stock_movements'::regclass::oid, 7),
          ('public.stock_movements'::regclass::oid, 17),
          ('public.arbeitszeit_buchung'::regclass::oid, 2),
          ('public.arbeitszeit_buchung'::regclass::oid, 3),
          ('public.arbeitszeit_buchung'::regclass::oid, 5),
          ('public.arbeitszeit_buchung'::regclass::oid, 6),
          ('public.arbeitszeit_buchung'::regclass::oid, 10),
          ('public.arbeitszeit_buchung'::regclass::oid, 12),
          ('public.arbeitszeit_buchung'::regclass::oid, 13),
          ('public.customers'::regclass::oid, 1),
          ('public.customers'::regclass::oid, 2),
          ('public.customers'::regclass::oid, 3),
          ('public.customers'::regclass::oid, 4),
          ('public.ausgangsrechnung'::regclass::oid, 2),
          ('public.ausgangsrechnung'::regclass::oid, 3),
          ('public.ausgangsrechnung'::regclass::oid, 4),
          ('public.ausgangsrechnung'::regclass::oid, 5),
          ('public.ausgangsrechnung'::regclass::oid, 6),
          ('public.kostenstelle'::regclass::oid, 1),
          ('public.kostenstelle'::regclass::oid, 2),
          ('public.kostenstelle'::regclass::oid, 3),
          ('public.kostenstellen_energie_monat'::regclass::oid, 2),
          ('public.kostenstellen_energie_monat'::regclass::oid, 3),
          ('public.kostenstellen_energie_monat'::regclass::oid, 4),
          ('public.kostenstellen_energie_monat'::regclass::oid, 5)
        ) expected_dependency(relation_oid, attribute_num)
        JOIN pg_rewrite rewrite_record
          ON rewrite_record.ev_class = view_record.oid
         AND rewrite_record.rulename = '_RETURN'
        JOIN pg_depend dependency
          ON dependency.classid = 'pg_rewrite'::regclass
         AND dependency.objid = rewrite_record.oid
         AND dependency.objsubid = 0
         AND dependency.refclassid = 'pg_class'::regclass
         AND dependency.refobjid = expected_dependency.relation_oid
         AND dependency.refobjsubid = expected_dependency.attribute_num
         AND dependency.deptype = 'n'
      )
      AND 1 = (
        SELECT count(*)
        FROM pg_rewrite rewrite_record
        JOIN pg_depend dependency
          ON dependency.classid = 'pg_rewrite'::regclass
         AND dependency.objid = rewrite_record.oid
         AND dependency.objsubid = 0
         AND dependency.refclassid = 'pg_class'::regclass
         AND dependency.refobjid = view_record.oid
         AND dependency.refobjsubid = 0
         AND dependency.deptype = 'i'
        WHERE rewrite_record.ev_class = view_record.oid
          AND rewrite_record.rulename = '_RETURN'
      )
      AND 39 = (
        SELECT count(*)
        FROM pg_rewrite rewrite_record
        JOIN pg_depend dependency
          ON dependency.classid = 'pg_rewrite'::regclass
         AND dependency.objid = rewrite_record.oid
        WHERE rewrite_record.ev_class = view_record.oid
          AND rewrite_record.rulename = '_RETURN'
      )
  ) OR NOT has_table_privilege('service_role', 'public.v_auftrag_db', 'SELECT')
     OR has_table_privilege('anon', 'public.v_auftrag_db', 'SELECT')
     OR has_table_privilege('authenticated', 'public.v_auftrag_db', 'SELECT')
     OR EXISTS (
       SELECT 1
       FROM pg_class view_record,
            LATERAL aclexplode(view_record.relacl) acl_entry
       WHERE view_record.oid = 'public.v_auftrag_db'::regclass
         AND (
           acl_entry.grantor <> migration_owner
           OR acl_entry.grantee NOT IN (
             view_record.relowner,
             (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
           )
           OR (
             acl_entry.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
             AND (acl_entry.privilege_type <> 'SELECT' OR acl_entry.is_grantable)
           )
         )
     ) OR NOT EXISTS (
       SELECT 1
       FROM pg_class view_record,
            LATERAL aclexplode(view_record.relacl) acl_entry
       WHERE view_record.oid = 'public.v_auftrag_db'::regclass
         AND acl_entry.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
         AND acl_entry.grantor = migration_owner
         AND acl_entry.privilege_type = 'SELECT'
          AND NOT acl_entry.is_grantable
     ) OR EXISTS (
       SELECT 1
       FROM pg_attribute attribute_record,
            LATERAL aclexplode(attribute_record.attacl) acl_entry
       WHERE attribute_record.attrelid = 'public.v_auftrag_db'::regclass
         AND attribute_record.attnum > 0
         AND NOT attribute_record.attisdropped
     ) OR EXISTS (
       SELECT 1
       FROM pg_roles role_record
       WHERE NOT role_record.rolsuper
         AND role_record.rolname !~ '^pg_'
         AND role_record.oid NOT IN (
           migration_owner,
           (SELECT oid FROM pg_roles WHERE rolname = 'service_role')
         )
         AND has_table_privilege(role_record.oid, 'public.v_auftrag_db', 'SELECT')
     ) THEN
    RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: controlling view security drift';
  END IF;

  FOREACH relation_name IN ARRAY ARRAY[
    'orders', 'customers', 'ausgangsrechnung', 'stock_movements',
    'arbeitszeit_buchung', 'kostenstelle', 'kostenstellen_energie_monat'
  ] LOOP
    IF NOT has_table_privilege('service_role', format('public.%I', relation_name), 'SELECT') THEN
      RAISE EXCEPTION 'TEMPLATE_PROJECTION_VERIFICATION_FAILED: service_role cannot read view base %', relation_name;
    END IF;
  END LOOP;

END;
$verification$;

COMMIT;
