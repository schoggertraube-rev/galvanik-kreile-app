-- F0 negative + inventory tests (fixture-free, deterministic).
-- Runs in CI against the fresh-replay DB, AFTER the fingerprint compare step
-- (creates no objects, but must not run before fingerprint on principle).
-- Any failure raises an exception -> psql ON_ERROR_STOP -> job fails.

\set ON_ERROR_STOP on

-- (A) Grant-denial: anon and authenticated must be unable to SELECT
--     representative tables (fail-closed rests on zero grants).
do $$
declare
  t text;
  r text;
  tables text[] := array['inquiries','items','beleg','audit_log','app_users'];
begin
  foreach t in array tables loop
    foreach r in array array['anon','authenticated'] loop
      begin
        execute format('set local role %I', r);
        execute format('select 1 from public.%I limit 1', t);
        raise exception 'F0-NEGATIVE FAIL: role % can SELECT public.%', r, t;
      exception
        when insufficient_privilege then
          execute 'reset role';
        when others then
          execute 'reset role';
          raise;
      end;
    end loop;
  end loop;
  raise notice 'F0 (A) grant-denial PASS (% tables x anon/authenticated)', array_length(tables,1);
end $$;

-- (B) RLS-CONTRACT inventory: hardening policies present, no broad
--     USING(true) FOR ALL policies except TO service_role (bypassrls no-op).
do $$
declare c int;
begin
  select count(*) into c from pg_policy
    where polname like 'tenant_isolation_%' or polname like 'app_user_%';
  if c < 29 then
    raise exception 'F0-INVENTORY FAIL: expected >=29 hardening policies, found %', c;
  end if;

  select count(*) into c
    from pg_policy p
    join pg_class cl on cl.oid = p.polrelid
    join pg_namespace n on n.oid = cl.relnamespace
   where n.nspname = 'public'
     and p.polcmd = '*'
     and pg_get_expr(p.polqual, p.polrelid) = 'true'
     and p.polroles::regrole[]::text[] <> array['service_role'];
  if c > 0 then
    raise exception 'F0-INVENTORY FAIL: % broad USING(true) FOR ALL policies not scoped to service_role', c;
  end if;
  raise notice 'F0 (B) rls-contract inventory PASS';
end $$;

-- (C) Storage bucket limits: bucket rows are DATA (not schema); assert only
--     if present in the replay DB, otherwise notice-skip (documented).
do $$
declare lim bigint;
begin
  select file_size_limit into lim from storage.buckets where id = 'item-photos';
  if found then
    if lim is distinct from 12582912 then
      raise exception 'F0-STORAGE FAIL: item-photos limit % <> 12582912', lim;
    end if;
  else
    raise notice 'F0 (C) item-photos bucket row not present in replay (data, not schema) - skipped';
  end if;

  select file_size_limit into lim from storage.buckets where id = 'buchhaltung-belege';
  if found then
    if lim is distinct from 5242880 then
      raise exception 'F0-STORAGE FAIL: buchhaltung-belege limit % <> 5242880', lim;
    end if;
  else
    raise notice 'F0 (C) buchhaltung-belege bucket row not present in replay (data, not schema) - skipped';
  end if;
  raise notice 'F0 (C) storage limits check done';
end $$;

-- (D) v_auftrag_db must be security_invoker=on.
do $$
declare c int;
begin
  select count(*) into c
    from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
   where n.nspname = 'public' and cl.relname = 'v_auftrag_db'
     and 'security_invoker=on' = any(cl.reloptions);
  if c <> 1 then
    raise exception 'F0-VIEW FAIL: v_auftrag_db security_invoker=on not set';
  end if;
  raise notice 'F0 (D) view invoker PASS';
end $$;

select 'F0_NEGATIVE_TESTS=PASS' as result;
