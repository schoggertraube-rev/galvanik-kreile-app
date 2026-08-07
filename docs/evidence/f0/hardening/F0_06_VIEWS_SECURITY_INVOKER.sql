-- F0-06 Härtung: alle 17 public-Views auf security_invoker=on.
-- Grund: Views sind postgres-owned; ohne security_invoker umgehen sie RLS (laufen mit Owner-Rechten).
-- Mit security_invoker=on respektieren sie die RLS des abfragenden Users (Defense-in-Depth).
-- Aktuell zusaetzlich durch 0 anon/auth-Grants gedeckt; diese Migration entfernt die Abhaengigkeit
-- allein vom Grant-Entzug. Idempotent (SET ist wiederholbar).
-- Status: buildable Kandidat; Remote-Anwendung braucht Freigabe (F0-04/F0-06).

alter view public.v_aging set (security_invoker = on);
alter view public.v_analyse_durchlaufzeit set (security_invoker = on);
alter view public.v_analyse_engpass set (security_invoker = on);
alter view public.v_analyse_kunden_kpi set (security_invoker = on);
alter view public.v_analyse_station_durchlauf set (security_invoker = on);
alter view public.v_analyse_termintreue set (security_invoker = on);
alter view public.v_analyse_werkstatt_puls_economics set (security_invoker = on);
alter view public.v_analyse_wochenziel set (security_invoker = on);
alter view public.v_auftrag_db set (security_invoker = on);
alter view public.v_engpass set (security_invoker = on);
alter view public.v_kostenstelle_monatswerte set (security_invoker = on);
alter view public.v_kunde_clv set (security_invoker = on);
alter view public.v_monatsergebnis set (security_invoker = on);
alter view public.v_periodenabschluss_status set (security_invoker = on);
alter view public.v_pipeline_forecast set (security_invoker = on);
alter view public.v_production_customers set (security_invoker = on);
alter view public.v_production_orders set (security_invoker = on);
