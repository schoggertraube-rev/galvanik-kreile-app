-- FOUNDATION_PRODUCTION_BASELINE_001
-- Read-only catalog snapshot for Production/Local comparison.
-- Contract scope: application schemas public/private/drizzle, app-owned storage
-- policies and buckets, and extensions emitted by the Production schema dump.
-- Supabase-managed base-schema internals and owner-only metadata are excluded.

WITH relation_scope AS (
  SELECT
    c.oid,
    n.nspname AS schema_name,
    c.relname,
    c.relkind,
    c.relrowsecurity,
    c.relforcerowsecurity,
    c.reloptions,
    c.relacl,
    c.relowner
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private', 'drizzle')
    AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
),
function_scope AS (
  SELECT
    p.oid,
    n.nspname AS schema_name,
    p.proname,
    p.proowner,
    p.proacl
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private', 'drizzle')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_depend AS d
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    )
),
snapshot AS (
  SELECT
    'relation'::text AS category,
    format('%I.%I', r.schema_name, r.relname) AS object_key,
    jsonb_build_object(
      'relation_type', r.relkind,
      'rls_enabled', r.relrowsecurity,
      'rls_forced', r.relforcerowsecurity
    ) AS payload
  FROM relation_scope AS r

  UNION ALL

  SELECT
    'column',
    format('%I.%I.%I', r.schema_name, r.relname, a.attname),
    jsonb_build_object(
      'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull,
      'default', pg_catalog.pg_get_expr(ad.adbin, ad.adrelid, true),
      'identity', a.attidentity,
      'generated', a.attgenerated,
      'collation', coll.collname
    )
  FROM relation_scope AS r
  JOIN pg_catalog.pg_attribute AS a ON a.attrelid = r.oid
  LEFT JOIN pg_catalog.pg_attrdef AS ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
  LEFT JOIN pg_catalog.pg_collation AS coll ON coll.oid = a.attcollation
  WHERE r.relkind IN ('r', 'p', 'v', 'm')
    AND a.attnum > 0
    AND NOT a.attisdropped

  UNION ALL

  SELECT
    'constraint',
    format('%I.%I|%s', n.nspname, c.relname, con.conname),
    jsonb_build_object(
      'type', con.contype,
      'definition', pg_catalog.pg_get_constraintdef(con.oid, true),
      'deferrable', con.condeferrable,
      'deferred', con.condeferred,
      'validated', con.convalidated
    )
  FROM pg_catalog.pg_constraint AS con
  JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private', 'drizzle')
    AND con.contype IN ('p', 'f', 'u', 'c')

  UNION ALL

  SELECT
    'index',
    format('%I.%I|%I', n.nspname, c.relname, idx.relname),
    jsonb_build_object(
      'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
      'unique', i.indisunique,
      'primary', i.indisprimary,
      'valid', i.indisvalid,
      'ready', i.indisready
    )
  FROM pg_catalog.pg_index AS i
  JOIN pg_catalog.pg_class AS c ON c.oid = i.indrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_class AS idx ON idx.oid = i.indexrelid
  WHERE n.nspname IN ('public', 'private', 'drizzle')

  UNION ALL

  SELECT
    'view',
    format('%I.%I', r.schema_name, r.relname),
    jsonb_build_object(
      'relation_type', r.relkind,
      'definition', pg_catalog.pg_get_viewdef(r.oid, true),
      'options', coalesce(to_jsonb(r.reloptions), '[]'::jsonb)
    )
  FROM relation_scope AS r
  WHERE r.relkind IN ('v', 'm')

  UNION ALL

  SELECT
    'function',
    format(
      '%I.%I(%s)',
      f.schema_name,
      f.proname,
      pg_catalog.pg_get_function_identity_arguments(f.oid)
    ),
    jsonb_build_object(
      'definition', pg_catalog.pg_get_functiondef(f.oid),
      'security_definer', p.prosecdef,
      'volatility', p.provolatile,
      'parallel', p.proparallel,
      'config', coalesce(to_jsonb(p.proconfig), '[]'::jsonb)
    )
  FROM function_scope AS f
  JOIN pg_catalog.pg_proc AS p ON p.oid = f.oid

  UNION ALL

  SELECT
    'trigger',
    format('%I.%I|%I', n.nspname, c.relname, t.tgname),
    jsonb_build_object(
      'definition', pg_catalog.pg_get_triggerdef(t.oid, true),
      'enabled', t.tgenabled
    )
  FROM pg_catalog.pg_trigger AS t
  JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname IN ('public', 'private', 'drizzle')

  UNION ALL

  SELECT
    'policy',
    format('%I.%I|%s', pol.schemaname, pol.tablename, pol.policyname),
    jsonb_build_object(
      'permissive', pol.permissive,
      'roles', to_jsonb(pol.roles),
      'command', pol.cmd,
      'using', pol.qual,
      'with_check', pol.with_check
    )
  FROM pg_catalog.pg_policies AS pol
  WHERE pol.schemaname IN ('public', 'private', 'drizzle')
     OR (
       pol.schemaname = 'storage'
       AND pol.tablename = 'objects'
       AND pol.policyname LIKE 'scan_objects_%'
     )

  UNION ALL

  SELECT
    'relation_grant',
    format(
      '%I.%I|%s|%s',
      r.schema_name,
      r.relname,
      coalesce(grantee.rolname, 'PUBLIC'),
      acl.privilege_type
    ),
    jsonb_build_object(
      'grantor', grantor.rolname,
      'grantable', acl.is_grantable
    )
  FROM relation_scope AS r
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    coalesce(
      r.relacl,
      pg_catalog.acldefault(
        CASE
          WHEN r.relkind = 'S' THEN 'S'::"char"
          ELSE 'r'::"char"
        END,
        r.relowner
      )
    )
  ) AS acl
  LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
  LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE coalesce(grantee.rolname, 'PUBLIC')
    IN ('PUBLIC', 'postgres', 'anon', 'authenticated', 'service_role')

  UNION ALL

  SELECT
    'function_grant',
    format(
      '%I.%I(%s)|%s|%s',
      f.schema_name,
      f.proname,
      pg_catalog.pg_get_function_identity_arguments(f.oid),
      coalesce(grantee.rolname, 'PUBLIC'),
      acl.privilege_type
    ),
    jsonb_build_object(
      'grantor', grantor.rolname,
      'grantable', acl.is_grantable
    )
  FROM function_scope AS f
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    coalesce(f.proacl, pg_catalog.acldefault('f', f.proowner))
  ) AS acl
  LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
  LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE coalesce(grantee.rolname, 'PUBLIC')
    IN ('PUBLIC', 'postgres', 'anon', 'authenticated', 'service_role')

  UNION ALL

  SELECT
    'default_privilege',
    format(
      '%s|%s|%s|%s|%s',
      owner_role.rolname,
      coalesce(n.nspname, '<global>'),
      d.defaclobjtype,
      coalesce(grantee.rolname, 'PUBLIC'),
      acl.privilege_type
    ),
    jsonb_build_object(
      'grantor', grantor.rolname,
      'grantable', acl.is_grantable
    )
  FROM pg_catalog.pg_default_acl AS d
  JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = d.defaclrole
  LEFT JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS acl
  LEFT JOIN pg_catalog.pg_roles AS grantor ON grantor.oid = acl.grantor
  LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
  WHERE (
      d.defaclnamespace = 0
      OR n.nspname IN ('public', 'private', 'drizzle')
    )
    AND coalesce(grantee.rolname, 'PUBLIC')
      IN ('PUBLIC', 'postgres', 'anon', 'authenticated', 'service_role')

  UNION ALL

  SELECT
    'extension',
    e.extname,
    jsonb_build_object(
      'version', e.extversion,
      'schema', n.nspname
    )
  FROM pg_catalog.pg_extension AS e
  JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
  WHERE e.extname IN (
    'pg_stat_statements',
    'pg_trgm',
    'pgcrypto',
    'supabase_vault',
    'uuid-ossp'
  )

  UNION ALL

  SELECT
    'storage_bucket',
    b.id,
    jsonb_build_object(
      'name', b.name,
      'public', b.public,
      'file_size_limit', b.file_size_limit,
      'allowed_mime_types', to_jsonb(b.allowed_mime_types)
    )
  FROM storage.buckets AS b
  WHERE b.id IN ('belege', 'buchhaltung-belege', 'item-photos', 'scans')
)
SELECT category, object_key, payload
FROM snapshot
ORDER BY category, object_key;
