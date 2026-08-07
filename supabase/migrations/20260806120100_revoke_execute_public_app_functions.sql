-- D2: revoke EXECUTE on application-owned functions from PUBLIC/anon/authenticated.
-- Applied to production on 2026-08-06 via execute_sql; captured here as a
-- forward, replayable migration. Idempotent and safe if a function is absent
-- in a given replay state (the loop simply finds no matching signatures).
-- service_role and postgres retain EXECUTE (privileged server paths keep working).
do $$
declare
  fn record;
  target_names text[] := array[
    'fn_compute_warnings','fn_is_production_order','fn_update_vorlagen',
    'fn_verteile_energiekosten','search_global','log_beleg_insert',
    'prevent_beleg_delete','prevent_beleg_mutation','prevent_audit_mutation'
  ];
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(target_names)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;
