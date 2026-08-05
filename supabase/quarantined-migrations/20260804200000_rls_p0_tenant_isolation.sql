-- ============================================================
-- P0-RLS: Tenant-Isolation fuer 12 Tabellen mit tenant_id
-- Siehe docs/project/RLS_ANALYSIS.md
--
-- Pattern:
--   1. ENABLE ROW LEVEL SECURITY
--   2. service_role ALL (Bypass fuer Server-Zugriff)
--   3. tenant_isolation ALL (Nutzer sehen nur eigenen Tenant)
-- ============================================================

-- 1. forecast_version (text)
ALTER TABLE public.forecast_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_forecast_version ON public.forecast_version
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.forecast_version
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 2. inventory_items (text)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_inventory_items ON public.inventory_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.inventory_items
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 3. kosten_posten (varchar — cast noetig)
ALTER TABLE public.kosten_posten ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_kosten_posten ON public.kosten_posten
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.kosten_posten
  FOR ALL USING ((tenant_id)::text = current_setting('app.tenant_id'::text, true));

-- 4. kostensatz_default (text)
ALTER TABLE public.kostensatz_default ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_kostensatz_default ON public.kostensatz_default
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.kostensatz_default
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 5. kostenstelle (text)
ALTER TABLE public.kostenstelle ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_kostenstelle ON public.kostenstelle
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.kostenstelle
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 6. kostenstellen_energie_monat (text)
ALTER TABLE public.kostenstellen_energie_monat ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_kostenstellen_energie_monat ON public.kostenstellen_energie_monat
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.kostenstellen_energie_monat
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 7. marketing_touchpoints (varchar — cast noetig)
ALTER TABLE public.marketing_touchpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_marketing_touchpoints ON public.marketing_touchpoints
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.marketing_touchpoints
  FOR ALL USING ((tenant_id)::text = current_setting('app.tenant_id'::text, true));

-- 8. periode (text)
ALTER TABLE public.periode ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_periode ON public.periode
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.periode
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 9. teile_klassifikator (text)
ALTER TABLE public.teile_klassifikator ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_teile_klassifikator ON public.teile_klassifikator
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.teile_klassifikator
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 10. vorlage_verbrauch (text)
ALTER TABLE public.vorlage_verbrauch ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_vorlage_verbrauch ON public.vorlage_verbrauch
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.vorlage_verbrauch
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 11. vorlage_zeit (text)
ALTER TABLE public.vorlage_zeit ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_vorlage_zeit ON public.vorlage_zeit
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.vorlage_zeit
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));

-- 12. warning_event (text)
ALTER TABLE public.warning_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_warning_event ON public.warning_event
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_isolation ON public.warning_event
  FOR ALL USING (tenant_id = current_setting('app.tenant_id'::text, true));
