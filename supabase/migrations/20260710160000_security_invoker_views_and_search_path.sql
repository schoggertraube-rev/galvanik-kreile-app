-- P4 Slice 1: security_invoker auf 15 Views (v_auftrag_db bewusst ausgenommen: liest stock_movements mit RLS ohne Policy, folgt in Slice 2)
ALTER VIEW public.v_kostenstelle_monatswerte SET (security_invoker = true);
ALTER VIEW public.v_engpass SET (security_invoker = true);
ALTER VIEW public.v_periodenabschluss_status SET (security_invoker = true);
ALTER VIEW public.v_kunde_clv SET (security_invoker = true);
ALTER VIEW public.v_pipeline_forecast SET (security_invoker = true);
ALTER VIEW public.v_monatsergebnis SET (security_invoker = true);
ALTER VIEW public.v_aging SET (security_invoker = true);
ALTER VIEW public.v_analyse_station_durchlauf SET (security_invoker = true);
ALTER VIEW public.v_analyse_termintreue SET (security_invoker = true);
ALTER VIEW public.v_analyse_durchlaufzeit SET (security_invoker = true);
ALTER VIEW public.v_analyse_engpass SET (security_invoker = true);
ALTER VIEW public.v_analyse_wochenziel SET (security_invoker = true);
ALTER VIEW public.v_analyse_werkstatt_puls_economics SET (security_invoker = true);
ALTER VIEW public.v_analyse_kunden_kpi SET (security_invoker = true);
ALTER VIEW public.v_production_orders SET (security_invoker = true);
-- search_path-Härtung (Signaturen aus Live-Katalog durch Cowork verifiziert)
ALTER FUNCTION public.fn_compute_warnings(p_tenant text) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_update_vorlagen() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_verteile_energiekosten(p_jahr integer, p_monat integer, p_tenant text) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_beleg_insert() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_audit_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_beleg_delete() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_beleg_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.search_global(query text) SET search_path = public, pg_temp;
