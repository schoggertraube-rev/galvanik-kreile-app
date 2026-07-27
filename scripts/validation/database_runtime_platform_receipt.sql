\set ON_ERROR_STOP on

-- Read-only Supabase platform inventory. Never turn a changed receipt into an
-- allowlist without reviewing the canonical rows that produced it.

SELECT
  version() AS postgres_version,
  current_database() AS database_name,
  current_user AS current_user_name,
  session_user AS session_user_name;

WITH database_acl AS (
  SELECT
    CASE
      WHEN acl_entry.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.pg_get_userbyid(acl_entry.grantee)
    END AS grantee_name,
    pg_catalog.pg_get_userbyid(acl_entry.grantor) AS grantor_name,
    acl_entry.privilege_type,
    acl_entry.is_grantable
  FROM pg_catalog.pg_database database_record
  CROSS JOIN LATERAL pg_catalog.aclexplode(database_record.datacl) acl_entry
  WHERE database_record.datname = pg_catalog.current_database()
    AND acl_entry.privilege_type IN ('CONNECT', 'CREATE', 'TEMPORARY')
)
SELECT *
FROM database_acl
ORDER BY grantee_name, grantor_name, privilege_type, is_grantable;

WITH database_acl AS (
  SELECT
    CASE
      WHEN acl_entry.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.pg_get_userbyid(acl_entry.grantee)
    END AS grantee_name,
    pg_catalog.pg_get_userbyid(acl_entry.grantor) AS grantor_name,
    acl_entry.privilege_type,
    acl_entry.is_grantable
  FROM pg_catalog.pg_database database_record
  CROSS JOIN LATERAL pg_catalog.aclexplode(database_record.datacl) acl_entry
  WHERE database_record.datname = pg_catalog.current_database()
    AND acl_entry.privilege_type IN ('CONNECT', 'CREATE', 'TEMPORARY')
)
SELECT
  count(*)::bigint AS database_acl_entry_count,
  pg_catalog.md5(pg_catalog.string_agg(
    pg_catalog.concat_ws(
      '|',
      grantee_name,
      grantor_name,
      privilege_type,
      is_grantable::text
    ),
    pg_catalog.chr(10)
    ORDER BY grantee_name, grantor_name, privilege_type, is_grantable
  )) AS database_acl_receipt_md5
FROM database_acl;

WITH role_contract AS (
  SELECT
    role_record.rolname,
    role_record.rolsuper,
    role_record.rolinherit,
    role_record.rolcreaterole,
    role_record.rolcreatedb,
    role_record.rolcanlogin,
    role_record.rolreplication,
    role_record.rolbypassrls,
    coalesce(
      pg_catalog.array_to_string(role_record.rolconfig, ','),
      '<null>'
    ) AS rolconfig
  FROM pg_catalog.pg_roles role_record
  WHERE role_record.rolcanlogin
     OR role_record.rolsuper
     OR role_record.rolbypassrls
     OR role_record.rolcreaterole
     OR role_record.rolcreatedb
     OR role_record.rolreplication
     OR role_record.rolname = 'dashboard_user'
)
SELECT *
FROM role_contract
ORDER BY rolname;

WITH role_contract AS (
  SELECT
    role_record.rolname,
    role_record.rolsuper,
    role_record.rolinherit,
    role_record.rolcreaterole,
    role_record.rolcreatedb,
    role_record.rolcanlogin,
    role_record.rolreplication,
    role_record.rolbypassrls,
    coalesce(
      pg_catalog.array_to_string(role_record.rolconfig, ','),
      '<null>'
    ) AS rolconfig
  FROM pg_catalog.pg_roles role_record
  WHERE role_record.rolcanlogin
     OR role_record.rolsuper
     OR role_record.rolbypassrls
     OR role_record.rolcreaterole
     OR role_record.rolcreatedb
     OR role_record.rolreplication
     OR role_record.rolname = 'dashboard_user'
)
SELECT
  count(*)::bigint AS provider_role_entry_count,
  pg_catalog.md5(pg_catalog.string_agg(
    pg_catalog.concat_ws(
      '|',
      rolname,
      rolsuper::text,
      rolinherit::text,
      rolcreaterole::text,
      rolcreatedb::text,
      rolcanlogin::text,
      rolreplication::text,
      rolbypassrls::text,
      rolconfig
    ),
    pg_catalog.chr(10)
    ORDER BY rolname
  )) AS provider_role_receipt_md5
FROM role_contract;

SELECT
  count(*)::bigint AS superuser_count,
  pg_catalog.md5(pg_catalog.string_agg(
    role_record.rolname,
    pg_catalog.chr(10)
    ORDER BY role_record.rolname
  )) AS superuser_name_receipt_md5
FROM pg_catalog.pg_roles role_record
WHERE role_record.rolsuper;

WITH membership_contract AS (
  SELECT
    granted_role.rolname AS granted_role,
    member_role.rolname AS member_role,
    grantor_role.rolname AS grantor_role,
    membership.admin_option,
    membership.inherit_option,
    membership.set_option
  FROM pg_catalog.pg_auth_members membership
  JOIN pg_catalog.pg_roles granted_role
    ON granted_role.oid = membership.roleid
  JOIN pg_catalog.pg_roles member_role
    ON member_role.oid = membership.member
  JOIN pg_catalog.pg_roles grantor_role
    ON grantor_role.oid = membership.grantor
)
SELECT
  count(*)::bigint AS membership_entry_count,
  pg_catalog.md5(pg_catalog.string_agg(
    pg_catalog.concat_ws(
      '|',
      granted_role,
      member_role,
      grantor_role,
      admin_option::text,
      inherit_option::text,
      set_option::text
    ),
    pg_catalog.chr(10)
    ORDER BY granted_role, member_role, grantor_role
  )) AS membership_receipt_md5
FROM membership_contract;

WITH platform_login(role_name) AS (
  VALUES
    ('authenticator'),
    ('cli_login_postgres'),
    ('pgbouncer'),
    ('postgres'),
    ('supabase_admin'),
    ('supabase_auth_admin'),
    ('supabase_etl_admin'),
    ('supabase_read_only_user'),
    ('supabase_replication_admin'),
    ('supabase_storage_admin')
)
SELECT
  platform_login.role_name,
  role_record.oid IS NOT NULL AS role_exists,
  pg_catalog.has_database_privilege(
    role_record.oid,
    pg_catalog.current_database(),
    'CONNECT'
  ) AS effective_connect,
  pg_catalog.has_database_privilege(
    role_record.oid,
    pg_catalog.current_database(),
    'TEMPORARY'
  ) AS effective_temporary,
  pg_catalog.has_database_privilege(
    role_record.oid,
    pg_catalog.current_database(),
    'CREATE'
  ) AS effective_create
FROM platform_login
LEFT JOIN pg_catalog.pg_roles role_record
  ON role_record.rolname = platform_login.role_name
ORDER BY platform_login.role_name;

WITH service_role AS (
  SELECT oid
  FROM pg_catalog.pg_roles
  WHERE rolname = 'service_role'
),
extension_runtime_relation_acl AS (
  SELECT
    namespace_record.nspname AS schema_name,
    relation_record.relname AS relation_name,
    relation_record.relkind::text AS relation_kind,
    pg_catalog.pg_get_userbyid(relation_record.relowner) AS owner_name,
    coalesce(
      pg_catalog.array_to_string(relation_record.reloptions, ','),
      '<null>'
    ) AS reloptions,
    CASE
      WHEN relation_record.relkind = 'v'
        THEN pg_catalog.md5(pg_catalog.convert_to(
          pg_catalog.pg_get_viewdef(relation_record.oid, false),
          'UTF8'
        ))
      ELSE '<not-view>'
    END AS view_md5,
    CASE
      WHEN acl_entry.grantee = 0 THEN 'PUBLIC'
      ELSE pg_catalog.pg_get_userbyid(acl_entry.grantee)
    END AS grantee_name,
    pg_catalog.pg_get_userbyid(acl_entry.grantor) AS grantor_name,
    acl_entry.privilege_type,
    acl_entry.is_grantable::text AS is_grantable
  FROM pg_catalog.pg_class relation_record
  JOIN pg_catalog.pg_namespace namespace_record
    ON namespace_record.oid = relation_record.relnamespace
  CROSS JOIN service_role
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    coalesce(
      relation_record.relacl,
      CASE
        WHEN relation_record.relkind = 'S'
          THEN pg_catalog.acldefault('s', relation_record.relowner)
        ELSE pg_catalog.acldefault('r', relation_record.relowner)
      END
    )
  ) acl_entry
  WHERE namespace_record.nspname = 'extensions'
    AND acl_entry.grantee IN (0, service_role.oid)
)
SELECT
  count(*)::integer AS extension_relation_acl_entry_count,
  pg_catalog.md5(pg_catalog.string_agg(
    pg_catalog.concat_ws(
      '|',
      schema_name,
      relation_name,
      relation_kind,
      owner_name,
      reloptions,
      view_md5,
      grantee_name,
      grantor_name,
      privilege_type,
      is_grantable
    ),
    pg_catalog.chr(10)
    ORDER BY
      schema_name,
      relation_name,
      grantee_name,
      grantor_name,
      privilege_type,
      is_grantable
  )) AS extension_relation_acl_receipt_md5
FROM extension_runtime_relation_acl;

WITH service_role AS (
  SELECT oid
  FROM pg_catalog.pg_roles
  WHERE rolname = 'service_role'
),
function_contract AS (
  SELECT
    namespace_record.nspname AS schema_name,
    function_record.oid::pg_catalog.regprocedure::text AS signature,
    pg_catalog.pg_get_userbyid(function_record.proowner) AS owner_name,
    language_record.lanname AS language_name,
    coalesce(
      pg_catalog.array_to_string(function_record.proconfig, ','),
      '<null>'
    ) AS proconfig,
    pg_catalog.md5(
      pg_catalog.convert_to(function_record.prosrc, 'UTF8')
    ) AS raw_body_md5,
    pg_catalog.md5(pg_catalog.convert_to(
      pg_catalog.pg_get_function_arguments(function_record.oid)
        || ' -> '
        || pg_catalog.pg_get_function_result(function_record.oid),
      'UTF8'
    )) AS io_md5,
    function_record.prokind::text AS prokind,
    function_record.provolatile::text AS provolatile,
    function_record.proparallel::text AS proparallel,
    function_record.proisstrict::text AS proisstrict,
    function_record.proleakproof::text AS proleakproof,
    function_record.proretset::text AS proretset,
    function_record.procost::text AS procost,
    function_record.prorows::text AS prorows,
    function_record.pronargdefaults::text AS pronargdefaults,
    function_record.provariadic::text AS provariadic,
    function_record.prosupport::text AS prosupport,
    coalesce(function_record.prosqlbody::text, '<null>') AS prosqlbody,
    coalesce(function_record.probin, '<null>') AS probin,
    (
      SELECT pg_catalog.string_agg(
        pg_catalog.concat_ws(
          ':',
          CASE
            WHEN acl_entry.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(acl_entry.grantee)
          END,
          pg_catalog.pg_get_userbyid(acl_entry.grantor),
          acl_entry.privilege_type,
          acl_entry.is_grantable::text
        ),
        ','
        ORDER BY
          CASE
            WHEN acl_entry.grantee = 0 THEN 'PUBLIC'
            ELSE pg_catalog.pg_get_userbyid(acl_entry.grantee)
          END,
          pg_catalog.pg_get_userbyid(acl_entry.grantor),
          acl_entry.privilege_type,
          acl_entry.is_grantable
      )
      FROM pg_catalog.aclexplode(
        coalesce(
          function_record.proacl,
          pg_catalog.acldefault('f', function_record.proowner)
        )
      ) acl_entry
    ) AS acl_receipt
  FROM pg_catalog.pg_proc function_record
  JOIN pg_catalog.pg_namespace namespace_record
    ON namespace_record.oid = function_record.pronamespace
  JOIN pg_catalog.pg_language language_record
    ON language_record.oid = function_record.prolang
  CROSS JOIN service_role
  WHERE function_record.prosecdef
    AND function_record.oid >= 16384
    AND namespace_record.nspname <> 'public'
    AND namespace_record.nspname !~ '^pg_(toast_)?temp_[0-9]+$'
    AND pg_catalog.has_function_privilege(
      service_role.oid,
      function_record.oid,
      'EXECUTE'
    )
)
SELECT
  count(*)::integer AS managed_secdef_entry_count,
  pg_catalog.md5(pg_catalog.string_agg(
    pg_catalog.concat_ws(
      '|',
      schema_name,
      signature,
      owner_name,
      language_name,
      proconfig,
      raw_body_md5,
      io_md5,
      prokind,
      provolatile,
      proparallel,
      proisstrict,
      proleakproof,
      proretset,
      procost,
      prorows,
      pronargdefaults,
      provariadic,
      prosupport,
      prosqlbody,
      probin,
      acl_receipt
    ),
    pg_catalog.chr(10)
    ORDER BY schema_name, signature
  )) AS managed_secdef_receipt_md5
FROM function_contract;
