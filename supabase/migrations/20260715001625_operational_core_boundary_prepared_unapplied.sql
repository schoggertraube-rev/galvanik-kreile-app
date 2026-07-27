-- PREPARED, NOT APPLIED.
-- Reconciles the exact PostgreSQL boundary used by the server runtime. The
-- application connects with `SET ROLE service_role`; RLS policies alone do not
-- grant relation privileges and therefore cannot make these paths executable.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $preflight$
DECLARE
  migration_owner oid := (SELECT oid FROM pg_roles WHERE rolname = current_user);
  database_owner oid := (SELECT datdba FROM pg_database WHERE datname = current_database());
  relation_name text;
  required_column record;
BEGIN
  IF migration_owner IS NULL OR migration_owner <> database_owner THEN
    RAISE EXCEPTION 'OPERATIONAL_CORE_PREFLIGHT_FAILED: migration user must own the database';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE oid = migration_owner AND (rolsuper OR rolbypassrls)
      AND rolname NOT IN ('anon', 'authenticated', 'service_role', 'authenticator')
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_CORE_PREFLIGHT_FAILED: trusted BYPASSRLS database owner required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'service_role' AND rolbypassrls AND NOT rolsuper
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_CORE_PREFLIGHT_FAILED: non-superuser service_role with BYPASSRLS required';
  END IF;

  FOREACH relation_name IN ARRAY ARRAY['app_users', 'orders', 'items', 'customers'] LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NULL THEN
      RAISE EXCEPTION 'OPERATIONAL_CORE_PREFLIGHT_FAILED: public.% is missing', relation_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname = relation_name
        AND relation.relkind IN ('r', 'p')
        AND relation.relowner = migration_owner
    ) THEN
      RAISE EXCEPTION 'OPERATIONAL_CORE_PREFLIGHT_FAILED: migration user must own public.%', relation_name;
    END IF;
  END LOOP;

  FOR required_column IN
    SELECT * FROM (VALUES
      ('app_users', 'id'), ('app_users', 'tenant_id'), ('app_users', 'email'),
      ('app_users', 'full_name'), ('app_users', 'role'), ('app_users', 'location'),
      ('app_users', 'language'), ('app_users', 'pin_hash'), ('app_users', 'active'),
      ('orders', 'id'), ('orders', 'tenant_id'), ('orders', 'order_number'),
      ('orders', 'customer_id'), ('orders', 'title'), ('orders', 'task'),
      ('orders', 'station'), ('orders', 'current_station_id'), ('orders', 'status'),
      ('orders', 'risk'), ('orders', 'priority'), ('orders', 'priority_computed'),
      ('orders', 'due_date'), ('orders', 'promised_due_date'), ('orders', 'completed_date'),
      ('orders', 'source'), ('orders', 'source_ref'), ('orders', 'freetext_original'),
      ('orders', 'is_quote'), ('orders', 'quote_status'),
      ('items', 'id'), ('items', 'tenant_id'), ('items', 'order_id'),
      ('items', 'customer_id'), ('items', 'name'), ('items', 'quantity'),
      ('items', 'current_station_id'), ('items', 'material'),
      ('items', 'surface_requested'), ('items', 'photo_ids'),
      ('items', 'station_sequence'), ('items', 'current_step'),
      ('customers', 'id'), ('customers', 'tenant_id'), ('customers', 'customer_number'),
      ('customers', 'name'), ('customers', 'company_name'), ('customers', 'type'),
      ('customers', 'address'), ('customers', 'street'), ('customers', 'city'),
      ('customers', 'zip_code'), ('customers', 'country'), ('customers', 'image_urls'),
      ('customers', 'contact_person'), ('customers', 'email'), ('customers', 'phone'),
      ('customers', 'notes'), ('customers', 'behavior_notes'), ('customers', 'source'),
      ('customers', 'source_ref'), ('customers', 'is_lead'),
      ('customers', 'trust_level'), ('customers', 'internal_warning'),
      ('customers', 'tags'), ('customers', 'credit_rating'),
      ('customers', 'shipping_preference'), ('customers', 'payment_preference'),
      ('customers', 'classification'), ('customers', 'internal_notes'),
      ('customers', 'updated_at')
    ) AS required(table_name, column_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = required_column.table_name
        AND column_name = required_column.column_name
    ) THEN
      RAISE EXCEPTION 'OPERATIONAL_CORE_PREFLIGHT_FAILED: public.%.% is missing',
        required_column.table_name, required_column.column_name;
    END IF;
  END LOOP;
END
$preflight$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $schema_boundary$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF to_regrole(role_name) IS NOT NULL THEN
      EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I', role_name);
    END IF;
  END LOOP;
  GRANT USAGE ON SCHEMA public TO service_role;
END
$schema_boundary$;

DO $relation_boundary$
DECLARE
  relation_name text;
  role_name text;
  policy_name text;
  column_name text;
  privilege_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['app_users', 'orders', 'items', 'customers'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', relation_name);

    FOR policy_name IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = relation_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, relation_name);
    END LOOP;

    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', relation_name);
    FOREACH column_name IN ARRAY ARRAY(
      SELECT attribute.attname::text
      FROM pg_attribute attribute
      WHERE attribute.attrelid = format('public.%I', relation_name)::regclass
        AND attribute.attnum > 0 AND NOT attribute.attisdropped
    ) LOOP
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        EXECUTE format(
          'REVOKE %s (%I) ON TABLE public.%I FROM PUBLIC',
          privilege_name, column_name, relation_name
        );
      END LOOP;
    END LOOP;

    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF to_regrole(role_name) IS NOT NULL THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', relation_name, role_name);
        FOREACH column_name IN ARRAY ARRAY(
          SELECT attribute.attname::text
          FROM pg_attribute attribute
          WHERE attribute.attrelid = format('public.%I', relation_name)::regclass
            AND attribute.attnum > 0 AND NOT attribute.attisdropped
        ) LOOP
          FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
            EXECUTE format(
              'REVOKE %s (%I) ON TABLE public.%I FROM %I',
              privilege_name, column_name, relation_name, role_name
            );
          END LOOP;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  GRANT SELECT ON TABLE public.app_users TO service_role;
  GRANT INSERT (
    id, tenant_id, email, full_name, role, location, language, pin_hash, active
  ) ON TABLE public.app_users TO service_role;
  GRANT UPDATE (role, pin_hash, active) ON TABLE public.app_users TO service_role;

  GRANT SELECT ON TABLE public.orders TO service_role;
  GRANT INSERT (
    id, tenant_id, order_number, customer_id, title, task, station,
    current_station_id, status, risk, priority, priority_computed, due_date,
    promised_due_date, source, source_ref, freetext_original, is_quote, quote_status
  ) ON TABLE public.orders TO service_role;
  GRANT UPDATE (
    priority_computed, title, task, due_date, promised_due_date,
    current_station_id, station, status, completed_date
  ) ON TABLE public.orders TO service_role;

  GRANT SELECT ON TABLE public.items TO service_role;
  GRANT INSERT (
    id, tenant_id, order_id, customer_id, name, quantity, current_station_id,
    material, surface_requested, photo_ids, station_sequence, current_step
  ) ON TABLE public.items TO service_role;
  GRANT UPDATE (current_station_id, current_step) ON TABLE public.items TO service_role;

  GRANT SELECT ON TABLE public.customers TO service_role;
  GRANT INSERT (
    id, tenant_id, customer_number, name, company_name, type, address, street,
    city, zip_code, country, image_urls, contact_person, email, phone, notes,
    behavior_notes, source, source_ref, is_lead
  ) ON TABLE public.customers TO service_role;
  GRANT UPDATE (
    name, company_name, type, address, street, city, zip_code, country,
    contact_person, email, phone, notes, image_urls, trust_level,
    internal_warning, tags, credit_rating, behavior_notes, shipping_preference,
    payment_preference, classification, internal_notes, updated_at
  ) ON TABLE public.customers TO service_role;
END
$relation_boundary$;

DO $verification$
DECLARE
  relation_name text;
  role_name text;
  privilege_name text;
  required_record record;
BEGIN
  IF NOT has_schema_privilege('service_role', 'public', 'USAGE')
     OR has_schema_privilege('service_role', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: invalid service schema privileges';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('app_users', 'orders', 'items', 'customers')
      AND (NOT relation.relrowsecurity OR NOT relation.relforcerowsecurity)
  ) OR EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('app_users', 'orders', 'items', 'customers')
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: core tables require forced policy-free RLS';
  END IF;

  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH relation_name IN ARRAY ARRAY['app_users', 'orders', 'items', 'customers'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ] LOOP
        IF has_table_privilege(role_name, format('public.%I', relation_name), privilege_name) THEN
          RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: % retains % on public.%',
            role_name, privilege_name, relation_name;
        END IF;
      END LOOP;
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        IF has_any_column_privilege(role_name, format('public.%I', relation_name), privilege_name) THEN
          RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: % retains column % on public.%',
            role_name, privilege_name, relation_name;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  FOR required_record IN
    SELECT * FROM (VALUES
      ('app_users', 'INSERT', ARRAY['id','tenant_id','email','full_name','role','location','language','pin_hash','active']),
      ('app_users', 'UPDATE', ARRAY['role','pin_hash','active']),
      ('orders', 'INSERT', ARRAY['id','tenant_id','order_number','customer_id','title','task','station','current_station_id','status','risk','priority','priority_computed','due_date','promised_due_date','source','source_ref','freetext_original','is_quote','quote_status']),
      ('orders', 'UPDATE', ARRAY['priority_computed','title','task','due_date','promised_due_date','current_station_id','station','status','completed_date']),
      ('items', 'INSERT', ARRAY['id','tenant_id','order_id','customer_id','name','quantity','current_station_id','material','surface_requested','photo_ids','station_sequence','current_step']),
      ('items', 'UPDATE', ARRAY['current_station_id','current_step']),
      ('customers', 'INSERT', ARRAY['id','tenant_id','customer_number','name','company_name','type','address','street','city','zip_code','country','image_urls','contact_person','email','phone','notes','behavior_notes','source','source_ref','is_lead']),
      ('customers', 'UPDATE', ARRAY['name','company_name','type','address','street','city','zip_code','country','contact_person','email','phone','notes','image_urls','trust_level','internal_warning','tags','credit_rating','behavior_notes','shipping_preference','payment_preference','classification','internal_notes','updated_at'])
    ) AS required(table_name, privilege_name, columns)
  LOOP
    IF EXISTS (
      SELECT 1 FROM unnest(required_record.columns) column_name
      WHERE NOT has_column_privilege(
        'service_role', format('public.%I', required_record.table_name),
        column_name, required_record.privilege_name
      )
    ) THEN
      RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: missing service % columns on public.%',
        required_record.privilege_name, required_record.table_name;
    END IF;
  END LOOP;

  FOREACH relation_name IN ARRAY ARRAY['app_users', 'orders', 'items', 'customers'] LOOP
    IF NOT has_table_privilege('service_role', format('public.%I', relation_name), 'SELECT')
       OR has_table_privilege('service_role', format('public.%I', relation_name), 'INSERT')
       OR has_table_privilege('service_role', format('public.%I', relation_name), 'UPDATE') THEN
      RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: invalid service table privileges on public.%', relation_name;
    END IF;
    FOREACH privilege_name IN ARRAY ARRAY['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
      IF has_table_privilege('service_role', format('public.%I', relation_name), privilege_name) THEN
        RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: forbidden service % on public.%',
          privilege_name, relation_name;
      END IF;
    END LOOP;
    IF has_any_column_privilege('service_role', format('public.%I', relation_name), 'REFERENCES') THEN
      RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: forbidden service column REFERENCES on public.%', relation_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('app_users', 'INSERT', ARRAY['id','tenant_id','email','full_name','role','location','language','pin_hash','active']),
      ('app_users', 'UPDATE', ARRAY['role','pin_hash','active']),
      ('orders', 'INSERT', ARRAY['id','tenant_id','order_number','customer_id','title','task','station','current_station_id','status','risk','priority','priority_computed','due_date','promised_due_date','source','source_ref','freetext_original','is_quote','quote_status']),
      ('orders', 'UPDATE', ARRAY['priority_computed','title','task','due_date','promised_due_date','current_station_id','station','status','completed_date']),
      ('items', 'INSERT', ARRAY['id','tenant_id','order_id','customer_id','name','quantity','current_station_id','material','surface_requested','photo_ids','station_sequence','current_step']),
      ('items', 'UPDATE', ARRAY['current_station_id','current_step']),
      ('customers', 'INSERT', ARRAY['id','tenant_id','customer_number','name','company_name','type','address','street','city','zip_code','country','image_urls','contact_person','email','phone','notes','behavior_notes','source','source_ref','is_lead']),
      ('customers', 'UPDATE', ARRAY['name','company_name','type','address','street','city','zip_code','country','contact_person','email','phone','notes','image_urls','trust_level','internal_warning','tags','credit_rating','behavior_notes','shipping_preference','payment_preference','classification','internal_notes','updated_at'])
    ) AS allowed(table_name, privilege_name, columns)
    JOIN pg_class relation ON relation.oid = format('public.%I', allowed.table_name)::regclass
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
      AND attribute.attnum > 0 AND NOT attribute.attisdropped
    WHERE attribute.attname <> ALL(allowed.columns)
      AND has_column_privilege(
        'service_role', relation.oid, attribute.attnum, allowed.privilege_name
      )
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_CORE_BOUNDARY_FAILED: service role has an inherited or direct column overgrant';
  END IF;
END
$verification$;
