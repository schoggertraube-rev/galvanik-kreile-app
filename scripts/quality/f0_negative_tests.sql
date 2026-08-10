-- F0 negative + inventory tests (fixture-free except Section E, deterministic).
-- Runs in CI against the fresh-replay DB, AFTER the fingerprint compare step
-- (creates no objects in A-D, but must not run before fingerprint on principle).
-- Any failure raises an exception -> psql ON_ERROR_STOP -> job fails.
--
-- BF-008 (2026-08-10): Section A ist jetzt relationsweit (dynamisch ueber ALLE public-
-- Tabellen/Views statt einer 5er-Stichprobe). Section E deckt jetzt alle 8
-- tenant_isolation_*-Haertungstabellen ab statt nur audit_log. Siehe
-- docs/evidence/f0/F0_TENANT_COVERAGE.json fuer die vollstaendige 62-Tabellen-Matrix
-- (relationsweite Tenant-Coverage ueber alle tenant_id-Tabellen, nicht nur die 8 hier
-- fixture-getesteten) und scripts/quality/check-tenant-coverage.mjs fuer den Live-Abgleich.

\set ON_ERROR_STOP on

-- (A) Grant-denial, relationsweit (BF-008): anon und authenticated duerfen auf KEINER
--     public-Tabelle oder -View SELECT besitzen. Ersetzt die vorherige 5er-Stichprobe durch
--     eine dynamische Pruefung ueber alle relkind IN ('r','v') via has_table_privilege() -
--     deckt damit automatisch auch neu hinzukommende Relationen ab, ohne Listenpflege.
do $$
declare
  rel record;
  r text;
  has_priv boolean;
  violations text[] := '{}';
  relation_count int := 0;
  check_count int := 0;
begin
  for rel in
    select c.oid, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','v')
    order by c.relname
  loop
    relation_count := relation_count + 1;
    foreach r in array array['anon','authenticated'] loop
      check_count := check_count + 1;
      select has_table_privilege(r, rel.oid, 'SELECT') into has_priv;
      if has_priv then
        violations := array_append(violations, rel.relname || ':' || r);
      end if;
    end loop;
  end loop;

  if array_length(violations, 1) > 0 then
    raise exception 'F0-NEGATIVE FAIL: SELECT-Grant fuer anon/authenticated gefunden: %', array_to_string(violations, ', ');
  end if;
  raise notice 'F0 (A) grant-denial PASS (relationsweit: % Relationen x anon/authenticated = % Pruefungen, 0 Grants)', relation_count, check_count;
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

-- (D) v_auftrag_db must be security_invoker=true.
--     BF-002-Folgemigration (20260810100000_normalize_view_invoker_spelling.sql) normalisiert die
--     Schreibweise von 'on' auf 'true' (Prod-Live-Wortlaut 2026-08-10) - dieser Assert folgt.
do $$
declare c int;
begin
  select count(*) into c
    from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
   where n.nspname = 'public' and cl.relname = 'v_auftrag_db'
     and 'security_invoker=true' = any(cl.reloptions);
  if c <> 1 then
    raise exception 'F0-VIEW FAIL: v_auftrag_db security_invoker=true not set';
  end if;
  raise notice 'F0 (D) view invoker PASS';
end $$;

-- (E) Tenant-Isolation-Matrix MIT Fixtures, relationsweit ueber alle 8 Haertungstabellen (BF-008,
--     Ratifizierer-Auflage 3 erweitert). Vorher deckte Section E nur public.audit_log ab; die Liste
--     der 8 Tabellen stammt aus den "create policy tenant_isolation_*"-Zeilen in
--     supabase/migrations/20260807090000_f0_05_rls_contract_hardening.sql (selbst extrahiert, nicht
--     uebernommen) und wird von scripts/quality/check-tenant-coverage.mjs zur Laufzeit gegen genau
--     diese Migrationsdatei re-verifiziert. Laeuft NACH dem Fingerprint-Step; die Replay-DB ist
--     danach wegwerfbar, daher sind Fixtures hier erlaubt (anders als A-D). f0_probe-Rollenmuster
--     wie vorhanden.
--
--     Parent-Fixtures fuer FK-gebundene Pflichtspalten (communication_drafts.customer_id ->
--     customers.id ON DELETE CASCADE, order_cost_positions.order_id -> orders.id ON DELETE CASCADE):
--     ein gemeinsamer Dummy-Kunde/-Auftrag genuegt, da der FK nur Existenz prueft, nicht
--     Tenant-Zugehoerigkeit der Elternzeile.
insert into public.customers (id, name, "type") values ('f0-e2e-probe-customer', 'F0 Probe Kunde', 'privat');
insert into public.orders (id, order_number, customer_id, title) values ('f0-e2e-probe-order', 'F0-PROBE-0001', 'f0-e2e-probe-customer', 'F0 Probe Auftrag');

do $$
begin
  execute 'drop role if exists f0_probe';
  execute 'create role f0_probe nologin';
  -- Nur Rollen-Erzeugung macht den Erzeuger noch nicht zum Mitglied (anders als bei anon/authenticated,
  -- wo postgres bereits Mitglied ist -> Abschnitt A kann direkt "set local role" nutzen). Ohne diesen
  -- GRANT scheitert "set local role f0_probe" unten mit "permission denied to set role".
  execute format('grant f0_probe to %I', current_user);
  execute 'grant usage on schema public to f0_probe';
end $$;

-- Fixtures als postgres (Owner umgeht RLS): je Tabelle 2x Tenant f0-a, 1x Tenant f0-b.
-- INSERT-Template enthaelt %L-Platzhalter fuer tenant_id. id-Spalten ohne DB-Default nutzen
-- gen_random_uuid()::text inline (bei jeder Ausfuehrung neu berechnet -> keine PK-Kollision
-- zwischen den 3 Fixture-Zeilen je Tabelle). Tabellen mit einer UNIQUE-Constraint UEBER die
-- id-Spalte hinaus bekommen zusaetzlich einen gen_random_uuid()-Anteil in genau der Spalte, die
-- den Konflikt verursachen wuerde: email_templates.template_key (UNIQUE) sowie
-- kpi_snapshots.kpi_key (Teil von UNIQUE(tenant_id, kpi_key, periode, periode_start) - ohne das
-- waeren die zwei f0-a-Zeilen mit identischem kpi_key/periode/periode_start ein Duplikat, siehe
-- CI-Fund 2026-08-10-Zyklus-1: "duplicate key value violates unique constraint
-- kpi_snapshots_tenant_id_kpi_key_periode_periode_start_key").
do $$
declare
  tbl text;
  tmpl text;
  tables text[] := array[
    'audit_log', 'calendar_events', 'communication_drafts', 'email_templates',
    'kpi_snapshots', 'kvp_items', 'offline_outbox', 'order_cost_positions'
  ];
  templates text[] := array[
    $t$insert into public.audit_log (action, tenant_id) values ('f0_e2e_probe', %L)$t$,
    $t$insert into public.calendar_events (id, tenant_id, title, event_type, starts_at) values (gen_random_uuid()::text, %L, 'f0 probe event', 'f0_probe', now())$t$,
    $t$insert into public.communication_drafts (id, tenant_id, customer_id, subject, body) values (gen_random_uuid()::text, %L, 'f0-e2e-probe-customer', 'f0 probe', 'f0 probe body')$t$,
    $t$insert into public.email_templates (tenant_id, template_key, name, subject_template, body_html_template) values (%L, 'f0-probe-' || gen_random_uuid()::text, 'f0 probe', 'f0 probe subject', 'f0 probe body')$t$,
    $t$insert into public.kpi_snapshots (tenant_id, kpi_key, periode, periode_start) values (%L, 'f0_probe_kpi_' || gen_random_uuid()::text, 'f0-probe', current_date)$t$,
    $t$insert into public.kvp_items (id, tenant_id, title, category, benefit) values (gen_random_uuid()::text, %L, 'f0 probe', 'f0_probe', 'f0 probe benefit')$t$,
    $t$insert into public.offline_outbox (id, tenant_id, mutation_type, payload) values (gen_random_uuid()::text, %L, 'f0_probe', '{}'::jsonb)$t$,
    $t$insert into public.order_cost_positions (id, tenant_id, order_id, "type", description, amount_cents) values (gen_random_uuid()::text, %L, 'f0-e2e-probe-order', 'f0_probe', 'f0 probe cost', 0)$t$
  ];
  i int;
begin
  if array_length(tables, 1) <> 8 then
    raise exception 'F0-E FAIL: erwartete 8 Haertungstabellen, Array hat %', array_length(tables, 1);
  end if;
  for i in 1 .. array_length(tables, 1) loop
    tbl := tables[i];
    tmpl := templates[i];
    execute format('grant select, insert on public.%I to f0_probe', tbl);
    execute format(tmpl, 'f0-a');
    execute format(tmpl, 'f0-a');
    execute format(tmpl, 'f0-b');
  end loop;
  raise notice 'F0 (E) Fixtures angelegt fuer % Tabellen (je 2x f0-a, 1x f0-b)', array_length(tables, 1);
end $$;

-- (E1)-(E4) je Tabelle: eigener Tenant sichtbar (2), anderer Tenant sichtbar (1), kein Kontext (0),
--           Cross-Tenant-INSERT scheitert. Faengt insufficient_privilege ab - das deckt sowohl
--           "WITH CHECK verletzt" als auch "keine passende INSERT-Policy vorhanden" ab (beides
--           SQLSTATE 42501). kpi_snapshots hat nur eine FOR SELECT-Policy: dort scheitert JEDES
--           Insert, nicht nur Cross-Tenant - erfuellt die E4-Erwartung "INSERT muss scheitern"
--           ebenso (SELECT-only-Tabelle, siehe F0_TENANT_COVERAGE.json Notiz select_only_policy).
do $$
declare
  tbl text;
  tmpl text;
  tables text[] := array[
    'audit_log', 'calendar_events', 'communication_drafts', 'email_templates',
    'kpi_snapshots', 'kvp_items', 'offline_outbox', 'order_cost_positions'
  ];
  templates text[] := array[
    $t$insert into public.audit_log (action, tenant_id) values ('f0_e2e_probe_cross', %L)$t$,
    $t$insert into public.calendar_events (id, tenant_id, title, event_type, starts_at) values (gen_random_uuid()::text, %L, 'f0 probe cross', 'f0_probe', now())$t$,
    $t$insert into public.communication_drafts (id, tenant_id, customer_id, subject, body) values (gen_random_uuid()::text, %L, 'f0-e2e-probe-customer', 'f0 probe cross', 'f0 probe body')$t$,
    $t$insert into public.email_templates (tenant_id, template_key, name, subject_template, body_html_template) values (%L, 'f0-probe-cross-' || gen_random_uuid()::text, 'f0 probe cross', 'f0 probe subject', 'f0 probe body')$t$,
    $t$insert into public.kpi_snapshots (tenant_id, kpi_key, periode, periode_start) values (%L, 'f0_probe_kpi_cross', 'f0-probe', current_date)$t$,
    $t$insert into public.kvp_items (id, tenant_id, title, category, benefit) values (gen_random_uuid()::text, %L, 'f0 probe cross', 'f0_probe', 'f0 probe benefit')$t$,
    $t$insert into public.offline_outbox (id, tenant_id, mutation_type, payload) values (gen_random_uuid()::text, %L, 'f0_probe', '{}'::jsonb)$t$,
    $t$insert into public.order_cost_positions (id, tenant_id, order_id, "type", description, amount_cents) values (gen_random_uuid()::text, %L, 'f0-e2e-probe-order', 'f0_probe cross', 'f0 probe cost', 0)$t$
  ];
  i int;
  c int;
begin
  for i in 1 .. array_length(tables, 1) loop
    tbl := tables[i];
    tmpl := templates[i];

    execute 'set local role f0_probe';
    perform set_config('app.tenant_id', 'f0-a', true);
    execute format('select count(*) from public.%I', tbl) into c;
    execute 'reset role';
    if c <> 2 then
      raise exception 'F0-E1 FAIL (%): tenant f0-a sieht % Zeilen, erwartet 2', tbl, c;
    end if;

    execute 'set local role f0_probe';
    perform set_config('app.tenant_id', 'f0-b', true);
    execute format('select count(*) from public.%I', tbl) into c;
    execute 'reset role';
    if c <> 1 then
      raise exception 'F0-E2 FAIL (%): tenant f0-b sieht % Zeilen, erwartet 1', tbl, c;
    end if;

    execute 'set local role f0_probe';
    perform set_config('app.tenant_id', '', true);
    execute format('select count(*) from public.%I', tbl) into c;
    execute 'reset role';
    if c <> 0 then
      raise exception 'F0-E3 FAIL (%): ohne tenant-Setting sieht f0_probe % Zeilen, erwartet 0', tbl, c;
    end if;

    execute 'set local role f0_probe';
    perform set_config('app.tenant_id', 'f0-a', true);
    begin
      execute format(tmpl, 'f0-b');
      execute 'reset role';
      raise exception 'F0-E4 FAIL (%): cross-tenant INSERT wurde nicht durch RLS verhindert', tbl;
    exception
      when insufficient_privilege then
        execute 'reset role';
      when others then
        execute 'reset role';
        raise;
    end;
  end loop;
  raise notice 'F0 (E) tenant-isolation fixture matrix PASS (% Tabellen x 4 Assertions, Tenants f0-a/f0-b)', array_length(tables, 1);
end $$;

-- (F) Storage-Inventar (rein strukturell/Konfiguration). Die echte Objekt-/HTTP-Negativmatrix
--     (Upload, Signed URLs, MIME/Size-Grenzen an der API-Grenze, Cross-Tenant/Cross-Bucket-Zugriff,
--     Cleanup) ist BF-007 und laeuft als eigener Schritt scripts/quality/f0-storage-http-tests.mjs
--     im selben Replay-Job gegen die echte lokale Storage-HTTP-API - siehe .github/workflows/quality.yml.

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

-- (H) Session-/PIN-Grundlage.

-- (H1, vormals Section F3) pin_rate_limits-Tabelle existiert.
do $$
declare c int;
begin
  select count(*) into c from information_schema.tables
   where table_schema = 'public' and table_name = 'pin_rate_limits';
  if c <> 1 then
    raise exception 'F0-H1 FAIL: Tabelle public.pin_rate_limits existiert nicht';
  end if;
  raise notice 'F0 (H1) pin_rate_limits table exists PASS';
end $$;

-- (H2) Alle vorhandenen app_users.pin_hash sind im bcrypt-Format ($2...). Ergaenzt die reine
--      Tabellenexistenz (H1) um eine inhaltliche Formatpruefung; deckt keine Rate-Limit-/
--      Session-Laufzeitwirkung ab (das ist scripts/quality/f0-verify-http-tests.mjs, BF-006).
do $$
declare bad int;
begin
  select count(*) into bad from public.app_users
   where pin_hash is not null and pin_hash not like '$2%';
  if bad <> 0 then
    raise exception 'F0-H2 FAIL: % app_users.pin_hash NICHT im bcrypt-Format', bad;
  end if;
  raise notice 'F0 (H2) all app_users.pin_hash bcrypt-format PASS';
end $$;

select 'F0_NEGATIVE_TESTS=PASS' as result;
