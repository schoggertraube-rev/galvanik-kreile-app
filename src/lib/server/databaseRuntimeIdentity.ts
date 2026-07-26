import { sql } from "drizzle-orm";

/**
 * Shared fail-closed proof for the direct PostgreSQL runtime connection.
 *
 * PostgreSQL 16+ is required for per-membership INHERIT/SET option receipts.
 * `SET ROLE service_role` is not sufficient when the authenticated session
 * could use `SET ROLE NONE` to recover its login identity (while RESET ROLE
 * restores the startup role). The broker login therefore has exactly one
 * non-inheriting, non-admin SET edge and no ambient object or role path.
 */
export const databaseRuntimeIdentityPredicate = sql`(
  current_user = 'service_role'
  and session_user = 'kreile_app_runtime'
  and current_setting('search_path') = 'pg_catalog,public,pg_temp'
  and current_setting('session_replication_role') = 'origin'
  and current_setting('lo_compat_privileges') = 'off'
  and exists (
    select 1
    from pg_roles service_role
    where service_role.rolname = 'service_role'
      and service_role.rolbypassrls
      and not service_role.rolsuper
      and not service_role.rolcanlogin
      and not service_role.rolcreaterole
      and not service_role.rolcreatedb
      and not service_role.rolreplication
      and service_role.rolconfig is null
      and not has_database_privilege(service_role.oid, current_database(), 'CREATE')
      and not has_database_privilege(service_role.oid, current_database(), 'TEMP')
      and not has_parameter_privilege(service_role.oid, 'session_replication_role', 'SET')
      and not exists (
        select 1
        from pg_auth_members membership
        where membership.member = service_role.oid
      )
      and not exists (
        select 1
        from pg_auth_members membership
        join pg_roles member_role on member_role.oid = membership.member
        join pg_roles grantor_role on grantor_role.oid = membership.grantor
        join pg_database database_record on database_record.datname = current_database()
        where membership.roleid = service_role.oid
          and (
            member_role.rolname not in ('kreile_app_runtime', 'authenticator')
            or membership.admin_option
            or membership.inherit_option
            or not membership.set_option
            or not (grantor_role.rolsuper or grantor_role.oid = database_record.datdba)
          )
      )
      and not exists (
        select 1
        from pg_shdepend dependency
        where dependency.refclassid = 'pg_authid'::regclass
          and dependency.refobjid = service_role.oid
          and dependency.deptype = 'o'
      )
      and not exists (
        select 1
        from pg_db_role_setting role_setting
        where role_setting.setrole = service_role.oid
      )
  )
  and not exists (
    select 1
    from pg_roles authenticator_role
    join pg_roles service_role on service_role.rolname = 'service_role'
    join pg_database database_record on database_record.datname = current_database()
    where authenticator_role.rolname = 'authenticator'
      and authenticator_role.oid <> service_role.oid
      and pg_has_role(authenticator_role.oid, service_role.oid, 'MEMBER')
      and (
        not authenticator_role.rolcanlogin
        or authenticator_role.rolinherit
        or authenticator_role.rolsuper
        or authenticator_role.rolbypassrls
        or authenticator_role.rolcreaterole
        or authenticator_role.rolcreatedb
        or authenticator_role.rolreplication
        or 1 <> (
          select count(*)
          from pg_auth_members membership
          where membership.member = authenticator_role.oid
            and membership.roleid = service_role.oid
        )
        or not exists (
          select 1
          from pg_auth_members membership
          join pg_roles grantor_role on grantor_role.oid = membership.grantor
          where membership.member = authenticator_role.oid
            and membership.roleid = service_role.oid
            and not membership.admin_option
            and not membership.inherit_option
            and membership.set_option
            and (grantor_role.rolsuper or grantor_role.oid = database_record.datdba)
        )
        or has_schema_privilege(authenticator_role.oid, 'public', 'CREATE')
        or has_database_privilege(authenticator_role.oid, current_database(), 'CREATE')
      )
  )
  and has_schema_privilege('service_role', 'public', 'USAGE')
  and not exists (
    select 1
    from pg_namespace namespace_record
    join pg_roles service_role on service_role.rolname = 'service_role'
    where namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
      and has_schema_privilege(service_role.oid, namespace_record.oid, 'CREATE')
  )
  and not exists (
    select 1
    from pg_tablespace tablespace_record
    join pg_roles service_role on service_role.rolname = 'service_role'
    where has_tablespace_privilege(service_role.oid, tablespace_record.oid, 'CREATE')
  )
  and exists (
    select 1
    from pg_roles session_role
    join pg_roles service_role on service_role.rolname = 'service_role'
    join pg_database database_record on database_record.datname = current_database()
    where session_role.rolname = session_user
      and session_role.rolname = 'kreile_app_runtime'
      and session_role.oid <> service_role.oid
      and session_role.rolcanlogin
      and not session_role.rolinherit
      and not session_role.rolsuper
      and not session_role.rolbypassrls
      and not session_role.rolcreaterole
      and not session_role.rolcreatedb
      and not session_role.rolreplication
      and session_role.rolconfig is null
      and not exists (
        select 1
        from pg_db_role_setting role_setting
        where role_setting.setrole = session_role.oid
      )
      and not exists (
        select 1
        from pg_auth_members membership
        where membership.roleid = session_role.oid
      )
      and not has_schema_privilege(session_role.oid, 'public', 'CREATE')
      and not has_database_privilege(session_role.oid, current_database(), 'CREATE')
      and has_database_privilege(session_role.oid, current_database(), 'CONNECT')
      and not has_database_privilege(session_role.oid, current_database(), 'TEMP')
      and not has_parameter_privilege(session_role.oid, 'session_replication_role', 'SET')
      and not exists (
        select 1
        from pg_namespace namespace_record
        where namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          and has_schema_privilege(session_role.oid, namespace_record.oid, 'CREATE')
      )
      and not exists (
        select 1
        from pg_tablespace tablespace_record
        where has_tablespace_privilege(session_role.oid, tablespace_record.oid, 'CREATE')
      )
      and 1 = (
        select count(*)
        from pg_auth_members membership
        where membership.member = session_role.oid
          and membership.roleid = service_role.oid
      )
      and 1 = (
        select count(*)
        from pg_auth_members membership
        where membership.member = session_role.oid
      )
      and 1 = (
        select count(*)
        from pg_auth_members membership
        join pg_roles grantor_role on grantor_role.oid = membership.grantor
        where membership.member = session_role.oid
          and membership.roleid = service_role.oid
          and not membership.admin_option
          and not membership.inherit_option
          and membership.set_option
          and (grantor_role.rolsuper or grantor_role.oid = database_record.datdba)
      )
      and not exists (
        select 1
        from pg_roles reachable_role
        where reachable_role.oid not in (session_role.oid, service_role.oid)
          and pg_has_role(session_role.oid, reachable_role.oid, 'MEMBER')
      )
      and not exists (
        select 1
        from pg_class relation_record
        cross join lateral aclexplode(relation_record.relacl) acl_entry
        where acl_entry.grantee = session_role.oid
      )
      and not exists (
        select 1
        from pg_attribute attribute_record
        cross join lateral aclexplode(attribute_record.attacl) acl_entry
        where attribute_record.attnum > 0
          and not attribute_record.attisdropped
          and acl_entry.grantee = session_role.oid
      )
      and not exists (
        select 1
        from pg_proc function_record
        cross join lateral aclexplode(function_record.proacl) acl_entry
        where acl_entry.grantee = session_role.oid
      )
      and not exists (
        select 1
        from pg_namespace namespace_record
        cross join lateral aclexplode(namespace_record.nspacl) acl_entry
        where acl_entry.grantee = session_role.oid
      )
      and 1 = (
        select count(*)
        from pg_database direct_database_record
        cross join lateral aclexplode(direct_database_record.datacl) acl_entry
        join pg_roles grantor_role on grantor_role.oid = acl_entry.grantor
        where direct_database_record.datname = current_database()
          and acl_entry.grantee = session_role.oid
          and acl_entry.privilege_type = 'CONNECT'
          and not acl_entry.is_grantable
          and (grantor_role.rolsuper or grantor_role.oid = direct_database_record.datdba)
      )
      and 1 = (
        select count(*)
        from pg_database direct_database_record
        cross join lateral aclexplode(direct_database_record.datacl) acl_entry
        where acl_entry.grantee = session_role.oid
      )
      and not exists (
        select 1
        from pg_database direct_database_record
        cross join lateral aclexplode(direct_database_record.datacl) acl_entry
        where direct_database_record.datname = current_database()
          and acl_entry.grantor = session_role.oid
      )
      and not exists (
        select 1
        from pg_database current_database_record
        cross join lateral aclexplode(
          coalesce(current_database_record.datacl, acldefault('d', current_database_record.datdba))
        ) acl_entry
        where current_database_record.datname = current_database()
          and acl_entry.grantee = 0
          and acl_entry.privilege_type in ('CONNECT', 'TEMPORARY')
      )
      and not exists (
        select 1
        from pg_database other_database_record
        where other_database_record.datallowconn
          and other_database_record.datname <> current_database()
          and (
            has_database_privilege(session_role.oid, other_database_record.oid, 'CONNECT')
            or has_database_privilege(session_role.oid, other_database_record.oid, 'TEMP')
          )
      )
      and not exists (
        select 1
        from pg_shdepend dependency
        where dependency.refclassid = 'pg_authid'::regclass
          and dependency.refobjid = session_role.oid
          and dependency.deptype in ('o', 'a', 'r')
          and not (
            dependency.deptype = 'a'
            and dependency.classid = 'pg_database'::regclass
            and dependency.objid = database_record.oid
            and dependency.objsubid = 0
          )
      )
     and not exists (
       select 1
       from pg_proc function_record
       join pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
       where function_record.prosecdef
         and function_record.oid >= 16384
         and namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
         and has_function_privilege(session_role.oid, function_record.oid, 'EXECUTE')
     )
      and not exists (
        select 1
        from pg_namespace writable_namespace
        cross join lateral aclexplode(
          coalesce(writable_namespace.nspacl, acldefault('n', writable_namespace.nspowner))
        ) acl_entry
        where writable_namespace.nspname in ('public', 'extensions')
          and acl_entry.grantee = 0
          and acl_entry.privilege_type = 'CREATE'
      )
      and not exists (
        select 1
        from pg_roles candidate
        cross join pg_namespace writable_namespace
        where writable_namespace.nspname in ('public', 'extensions')
          and not candidate.rolsuper
          and candidate.oid <> database_record.datdba
          and candidate.rolname <> 'pg_database_owner'
          and has_schema_privilege(candidate.oid, writable_namespace.oid, 'CREATE')
      )
      and not exists (
        select 1
        from (values
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
          ('public.reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'dea9ba102ae52810c6b4fde3fac9a7b4', '242f3a6c90e60e503bc38f0cf59abeb6', true, true),
          ('public.bind_item_photo_upload(uuid,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '6a6769e3aabb2652ddf9242f981b909e', '6066a3c2ac90316a14a288158d8b7728', true, false),
          ('public.claim_item_photo_analysis(uuid)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '46ccd33e07c50ef3ed72f5016af6d13f', '9b10957302449264c7274227e3d858ec', true, true),
          ('public.settle_item_photo_analysis(uuid,text,integer,text,jsonb)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '5db9cd477e5ffb6d57d48940fa0d490c', 'c2f84e274e4730064b0301432b9302ea', true, true),
          ('public.mark_item_photo_uncertain(uuid,text,text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'fb75f8f94f65f89937d33d6e73832187', '4d7ae7cc89952db30f7314c13f3513fe', true, false),
          ('public.finance_close_period(uuid,text,uuid,uuid)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '278437cfcac19649d064088b7295d628', 'd2fedd0ff1af53fa994c2f6dcb2ab05f', true, true),
          ('public.fn_update_vorlagen()', ARRAY['search_path=pg_catalog, pg_temp']::text[], 'c0a810fd594dd7012e097d2d00be7f50', '2911fbf3f7efd182a3830e31e79eb4e1', false, false),
          ('public.fn_guard_template_projection_source_insert()', ARRAY['search_path=pg_catalog, pg_temp']::text[], '758bf8c0fc6506ad85862f5547a660f2', '2911fbf3f7efd182a3830e31e79eb4e1', false, false),
          ('public.guard_active_mollie_payment_quote()', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '2eaede153b9426c4c7483f538daa8398', '2911fbf3f7efd182a3830e31e79eb4e1', false, false),
          ('public.guard_final_finance_period()', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], '6be3c140533c3cb6ee8b0c93dae26dea', '2911fbf3f7efd182a3830e31e79eb4e1', false, false)
        ) approved(signature, proconfig, body_md5, io_md5, service_executable, returns_set)
        left join pg_proc function_record on function_record.oid = to_regprocedure(approved.signature)
        left join pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
        left join pg_language language_record on language_record.oid = function_record.prolang
        cross join lateral (
          select
            count(*) as entry_count,
            count(*) filter (where
              acl_entry.grantee = function_record.proowner
              and acl_entry.grantor = function_record.proowner
              and acl_entry.privilege_type = 'EXECUTE'
              and not acl_entry.is_grantable
            ) as owner_entry_count,
            count(*) filter (where
              acl_entry.grantee = service_role.oid
              and acl_entry.grantor = function_record.proowner
              and acl_entry.privilege_type = 'EXECUTE'
              and not acl_entry.is_grantable
            ) as service_entry_count
          from aclexplode(
            coalesce(function_record.proacl, acldefault('f', function_record.proowner))
          ) acl_entry
        ) acl_contract
        where function_record.oid is null
          or namespace_record.nspname <> 'public'
          or not function_record.prosecdef
          or function_record.oid < 16384
          or function_record.prokind <> 'f'
          or language_record.lanname <> 'plpgsql'
          or function_record.proowner <> database_record.datdba
          or function_record.proconfig is distinct from approved.proconfig
          or md5(convert_to(
            btrim(regexp_replace(function_record.prosrc, '[[:space:]]+', ' ', 'g')),
            'UTF8'
          )) <> approved.body_md5
          or md5(convert_to(
            pg_get_function_arguments(function_record.oid) || ' -> ' || pg_get_function_result(function_record.oid),
            'UTF8'
          )) <> approved.io_md5
          or function_record.provolatile <> 'v'
          or function_record.proparallel <> 'u'
          or function_record.proisstrict
          or function_record.proleakproof
          or function_record.provariadic <> 0
          or function_record.pronargdefaults <> 0
          or function_record.prosupport <> 0
          or function_record.prosqlbody is not null
          or function_record.probin is not null
          or function_record.proretset is distinct from approved.returns_set
          or function_record.procost <> 100
          or function_record.prorows <> case when approved.returns_set then 1000 else 0 end
          or acl_contract.entry_count <> case when approved.service_executable then 2 else 1 end
          or acl_contract.owner_entry_count <> 1
          or acl_contract.service_entry_count <> case when approved.service_executable then 1 else 0 end
      )
      and 20 = (
        select count(*)
        from pg_proc function_record
        join pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
        where namespace_record.nspname = 'public'
          and function_record.prosecdef
          and function_record.oid >= 16384
      )
      and not exists (
        select 1
        from pg_proc function_record
        join pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
        join pg_language language_record on language_record.oid = function_record.prolang
        join pg_roles owner_role on owner_role.oid = function_record.proowner
        cross join lateral (
          select
            count(*) as entry_count,
            count(*) filter (where
              acl_entry.grantee = function_record.proowner
              and acl_entry.grantor = function_record.proowner
              and acl_entry.privilege_type = 'EXECUTE'
              and not acl_entry.is_grantable
            ) as owner_entry_count
          from aclexplode(
            coalesce(function_record.proacl, acldefault('f', function_record.proowner))
          ) acl_entry
        ) acl_contract
        where function_record.prosecdef
          and function_record.oid >= 16384
          and namespace_record.nspname <> 'public'
          and namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          and (
            function_record.prokind <> 'f'
            or language_record.lanname <> 'plpgsql'
            or not (owner_role.rolsuper or owner_role.oid = database_record.datdba)
            or (
              function_record.proconfig is distinct from ARRAY['search_path=pg_catalog, pg_temp']::text[]
              and function_record.proconfig is distinct from ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
              and function_record.proconfig is distinct from ARRAY['search_path=pg_catalog, extensions, public, pg_temp']::text[]
            )
            or acl_contract.entry_count <> 1
            or acl_contract.owner_entry_count <> 1
          )
      )
      and not exists (
        select 1
        from (values
          ('public.fn_guard_template_projection_source_insert()', 'public.arbeitszeit_buchung', 'template_projection_time_source_guard_trg', 7, 'd549dd2d444805a2199fb4714a65a584'),
          ('public.fn_guard_template_projection_source_insert()', 'public.items', 'template_projection_items_source_guard_trg', 7, '1518b003c2b9daa78a4c9fb95495ab25'),
          ('public.fn_guard_template_projection_source_insert()', 'public.stock_movements', 'template_projection_movement_source_guard_trg', 7, '4043dfe12eaf485e867ffce88def38fa'),
          ('public.fn_update_vorlagen()', 'public.orders', 'trg_insert_vorlagen', 5, '5539b157c4df2c3e9a487f15c3b9ee03'),
          ('public.fn_update_vorlagen()', 'public.orders', 'trg_update_vorlagen', 17, '22cecf094c118fa1dc2a444493928b34'),
          ('public.guard_active_mollie_payment_quote()', 'public.price_lines', 'trg_price_lines_active_mollie_quote', 31, 'b5da1a62c2f3c7afcc7d81d8157d5c43'),
          ('public.guard_final_finance_period()', 'public.ausgangsrechnung', 'ausgangsrechnung_final_period_guard', 31, 'c4f1475d61c21eb58918ffb5ce27c6e4'),
          ('public.guard_final_finance_period()', 'public.beleg', 'beleg_final_period_guard', 31, '6d9494e435081a5ec978588fe683aa77')
        ) expected(function_signature, relation_name, trigger_name, trigger_type, trigger_md5)
        left join pg_trigger trigger_record
          on trigger_record.tgfoid = to_regprocedure(expected.function_signature)
          and trigger_record.tgrelid = to_regclass(expected.relation_name)
          and trigger_record.tgname = expected.trigger_name
        where trigger_record.oid is null
          or trigger_record.tgisinternal
          or trigger_record.tgtype <> expected.trigger_type
          or trigger_record.tgenabled <> 'O'
          or trigger_record.tgnargs <> 0
          or octet_length(trigger_record.tgargs) <> 0
          or trigger_record.tgconstraint <> 0
          or trigger_record.tgdeferrable
          or trigger_record.tginitdeferred
          or trigger_record.tgparentid <> 0
          or trigger_record.tgoldtable is not null
          or trigger_record.tgnewtable is not null
          or md5(convert_to(
            btrim(regexp_replace(pg_get_triggerdef(trigger_record.oid), '[[:space:]]+', ' ', 'g')),
            'UTF8'
          )) <> expected.trigger_md5
      )
      and 8 = (
        select count(*)
        from pg_trigger trigger_record
        where not trigger_record.tgisinternal
          and trigger_record.tgfoid in (
            to_regprocedure('public.fn_guard_template_projection_source_insert()'),
            to_regprocedure('public.fn_update_vorlagen()'),
            to_regprocedure('public.guard_active_mollie_payment_quote()'),
            to_regprocedure('public.guard_final_finance_period()')
          )
      )
      and not exists (
        select 1
        from pg_trigger trigger_record
        join pg_proc function_record on function_record.oid = trigger_record.tgfoid
        where not trigger_record.tgisinternal
          and function_record.prosecdef
          and function_record.oid >= 16384
          and (
            has_table_privilege(service_role.oid, trigger_record.tgrelid, 'INSERT')
            or has_table_privilege(service_role.oid, trigger_record.tgrelid, 'UPDATE')
            or has_table_privilege(service_role.oid, trigger_record.tgrelid, 'DELETE')
            or has_any_column_privilege(service_role.oid, trigger_record.tgrelid, 'INSERT')
            or has_any_column_privilege(service_role.oid, trigger_record.tgrelid, 'UPDATE')
          )
          and not exists (
            select 1
            from (values
              ('public.fn_guard_template_projection_source_insert()', 'public.arbeitszeit_buchung', 'template_projection_time_source_guard_trg'),
              ('public.fn_guard_template_projection_source_insert()', 'public.items', 'template_projection_items_source_guard_trg'),
              ('public.fn_guard_template_projection_source_insert()', 'public.stock_movements', 'template_projection_movement_source_guard_trg'),
              ('public.fn_update_vorlagen()', 'public.orders', 'trg_insert_vorlagen'),
              ('public.fn_update_vorlagen()', 'public.orders', 'trg_update_vorlagen'),
              ('public.guard_active_mollie_payment_quote()', 'public.price_lines', 'trg_price_lines_active_mollie_quote'),
              ('public.guard_final_finance_period()', 'public.ausgangsrechnung', 'ausgangsrechnung_final_period_guard'),
              ('public.guard_final_finance_period()', 'public.beleg', 'beleg_final_period_guard')
            ) expected(function_signature, relation_name, trigger_name)
            where trigger_record.tgfoid = to_regprocedure(expected.function_signature)
              and trigger_record.tgrelid = to_regclass(expected.relation_name)
              and trigger_record.tgname = expected.trigger_name
          )
      )
      and not exists (
        select 1
        from pg_class relation_record
        join pg_namespace namespace_record on namespace_record.oid = relation_record.relnamespace
        cross join lateral aclexplode(
          coalesce(
            relation_record.relacl,
            case
              when relation_record.relkind = 'S' then acldefault('s', relation_record.relowner)
              else acldefault('r', relation_record.relowner)
            end
          )
        ) acl_entry
        where relation_record.oid >= 16384
          and relation_record.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
          and namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          and acl_entry.grantee = 0
      )
      and not exists (
        select 1
        from pg_attribute attribute_record
        join pg_class relation_record on relation_record.oid = attribute_record.attrelid
        join pg_namespace namespace_record on namespace_record.oid = relation_record.relnamespace
        cross join lateral aclexplode(
          coalesce(attribute_record.attacl, acldefault('c', relation_record.relowner))
        ) acl_entry
        where relation_record.oid >= 16384
          and relation_record.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
          and attribute_record.attnum > 0
          and not attribute_record.attisdropped
          and namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
          and acl_entry.grantee = 0
      )
      and not exists (
        select 1
        from pg_largeobject_metadata large_object_record
        cross join lateral aclexplode(
          coalesce(large_object_record.lomacl, acldefault('L', large_object_record.lomowner))
        ) acl_entry
        where acl_entry.grantee = 0
      )
      and not exists (
        select 1
        from pg_parameter_acl parameter_acl
        cross join lateral aclexplode(
          coalesce(parameter_acl.paracl, '{}'::aclitem[])
        ) acl_entry
        where acl_entry.grantee in (0, session_role.oid, service_role.oid)
      )
      and not exists (
        select 1
        from pg_default_acl default_acl
        cross join lateral aclexplode(default_acl.defaclacl) acl_entry
        where acl_entry.grantee in (0, session_role.oid, service_role.oid)
      )
  )
  and not exists (
    select 1
    from pg_roles candidate
    join pg_roles service_role on service_role.rolname = 'service_role'
    where not candidate.rolsuper
      and candidate.oid <> service_role.oid
      and candidate.rolname not in ('authenticator', 'kreile_app_runtime')
      and pg_has_role(candidate.oid, service_role.oid, 'MEMBER')
  )
  and not exists (
    select 1
    from pg_roles candidate
    join pg_database database_record on database_record.datname = current_database()
    where not candidate.rolsuper
      and candidate.oid <> database_record.datdba
      and pg_has_role(candidate.oid, database_record.datdba, 'MEMBER')
  )
)`;
