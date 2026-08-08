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

-- (E) Tenant-Isolation-Matrix MIT Fixtures (Ratifizierer-Auflage 3). Laeuft NACH dem Fingerprint-Step;
--     die Replay-DB ist danach wegwerfbar, daher sind Fixtures hier erlaubt (anders als A-D).
--     Tabelle: public.audit_log (tenant_id text). Gewaehlt statt kvp_items/email_templates, weil audit_log
--     bereits Referenztabelle in Abschnitt A ist, die einzige Pflichtspalte ohne Default "action" ist und
--     keine zusaetzlichen fremden NOT-NULL-Constraints (ausser dem generischen id/created_at-Default) hat.
--     RLS-Policy "tenant_isolation_audit_log" (f0_05_rls_contract_hardening.sql) ist FOR ALL TO public
--     USING/WITH CHECK (tenant_id = current_setting('app.tenant_id', true)) - exakt das hier gepruefte Muster.
do $$
begin
  execute 'drop role if exists f0_probe';
  execute 'create role f0_probe nologin';
  execute 'grant usage on schema public to f0_probe';
  execute 'grant select, insert on public.audit_log to f0_probe';
end $$;

-- Fixtures als postgres (Owner umgeht RLS): 2 Zeilen tenant f0-tenant-a, 1 Zeile tenant f0-tenant-b.
insert into public.audit_log (action, tenant_id) values
  ('f0_e2e_probe_a1', 'f0-tenant-a'),
  ('f0_e2e_probe_a2', 'f0-tenant-a');
insert into public.audit_log (action, tenant_id) values
  ('f0_e2e_probe_b1', 'f0-tenant-b');

-- (E1) als f0_probe mit app.tenant_id='f0-tenant-a': sichtbar == exakt die 2 a-Zeilen.
do $$
declare c int;
begin
  execute 'set local role f0_probe';
  perform set_config('app.tenant_id', 'f0-tenant-a', true);
  select count(*) into c from public.audit_log where action like 'f0_e2e_probe_%';
  execute 'reset role';
  if c <> 2 then
    raise exception 'F0-E1 FAIL: tenant f0-tenant-a sieht % Zeilen, erwartet 2', c;
  end if;
  raise notice 'F0 (E1) tenant-a sees exactly 2 rows PASS';
end $$;

-- (E2) als f0_probe mit app.tenant_id='f0-tenant-b': sichtbar == exakt 1.
do $$
declare c int;
begin
  execute 'set local role f0_probe';
  perform set_config('app.tenant_id', 'f0-tenant-b', true);
  select count(*) into c from public.audit_log where action like 'f0_e2e_probe_%';
  execute 'reset role';
  if c <> 1 then
    raise exception 'F0-E2 FAIL: tenant f0-tenant-b sieht % Zeilen, erwartet 1', c;
  end if;
  raise notice 'F0 (E2) tenant-b sees exactly 1 row PASS';
end $$;

-- (E3) als f0_probe OHNE tenant-Setting: 0 Zeilen sichtbar.
do $$
declare c int;
begin
  execute 'set local role f0_probe';
  perform set_config('app.tenant_id', '', true);
  select count(*) into c from public.audit_log where action like 'f0_e2e_probe_%';
  execute 'reset role';
  if c <> 0 then
    raise exception 'F0-E3 FAIL: ohne tenant-Setting sieht f0_probe % Zeilen, erwartet 0', c;
  end if;
  raise notice 'F0 (E3) no tenant setting sees 0 rows PASS';
end $$;

-- (E4) INSERT als f0_probe mit tenant_id='f0-tenant-b' waehrend app.tenant_id='f0-tenant-a' MUSS
--      mit RLS/WITH-CHECK-Fehler scheitern (Erfolg des INSERT = Testfehler).
do $$
begin
  execute 'set local role f0_probe';
  perform set_config('app.tenant_id', 'f0-tenant-a', true);
  begin
    insert into public.audit_log (action, tenant_id) values ('f0_e2e_probe_cross', 'f0-tenant-b');
    execute 'reset role';
    raise exception 'F0-E4 FAIL: cross-tenant INSERT wurde nicht durch RLS/WITH CHECK verhindert';
  exception
    when insufficient_privilege then
      execute 'reset role';
      raise notice 'F0 (E4) cross-tenant INSERT correctly rejected (insufficient_privilege) PASS';
    when others then
      execute 'reset role';
      raise;
  end;
end $$;

do $$
begin
  raise notice 'F0 (E) tenant-isolation fixture matrix PASS (public.audit_log, 4 assertions, f0-tenant-a/f0-tenant-b)';
end $$;

-- (F) Storage-Negativ (Ratifizierer-Auflage 3).

-- (F1) Kein oeffentlicher Bucket.
do $$
declare c int;
begin
  select count(*) into c from storage.buckets where public = true;
  if c <> 0 then
    raise exception 'F0-F1 FAIL: % public storage buckets found, erwartet 0', c;
  end if;
  raise notice 'F0 (F1) no public storage buckets PASS';
end $$;

-- (F2) anon/authenticated koennen storage.objects nicht direkt SELECTen (grant-denial wie Abschnitt A).
--      Falls Supabase-lokal Tabellen-Grants an authenticated/anon vergibt (Storage-Extension-Standard),
--      Fallback: RLS auf storage.objects aktiv UND Anzahl scan_objects_*-Policies >= Baseline-Sollwert (4,
--      siehe Kommentar "Prod: 67 public/private + 4 storage = 71 Policies gesamt" in der Baseline-Migration).
do $$
declare
  r text;
  grants_open boolean := false;
  rls_on boolean;
  policy_count int;
begin
  foreach r in array array['anon','authenticated'] loop
    begin
      execute format('set local role %I', r);
      execute 'select 1 from storage.objects limit 1';
      execute 'reset role';
      grants_open := true;
    exception
      when insufficient_privilege then
        execute 'reset role';
      when others then
        execute 'reset role';
        raise;
    end;
  end loop;

  if not grants_open then
    raise notice 'F0 (F2) anon/authenticated cannot SELECT storage.objects (grant-denial) PASS';
  else
    select relrowsecurity into rls_on
      from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname = 'storage' and cl.relname = 'objects';
    if not coalesce(rls_on, false) then
      raise exception 'F0-F2 FAIL: storage.objects hat Tabellen-Grants fuer anon/authenticated UND RLS ist nicht aktiv';
    end if;

    select count(*) into policy_count
      from pg_policy p
      join pg_class cl on cl.oid = p.polrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname = 'storage' and cl.relname = 'objects'
       and p.polname like 'scan_objects_%';
    if policy_count < 4 then
      raise exception 'F0-F2 FAIL: nur % scan_objects_*-Policies auf storage.objects, Baseline-Sollwert >=4', policy_count;
    end if;
    raise notice 'F0 (F2) storage.objects: table-grants vorhanden, aber RLS aktiv + % scan_objects_*-Policies (Baseline >=4) PASS', policy_count;
  end if;
end $$;

-- (F3) pin_rate_limits-Tabelle existiert.
do $$
declare c int;
begin
  select count(*) into c from information_schema.tables
   where table_schema = 'public' and table_name = 'pin_rate_limits';
  if c <> 1 then
    raise exception 'F0-F3 FAIL: Tabelle public.pin_rate_limits existiert nicht';
  end if;
  raise notice 'F0 (F3) pin_rate_limits table exists PASS';
end $$;

select 'F0_NEGATIVE_TESTS=PASS' as result;
