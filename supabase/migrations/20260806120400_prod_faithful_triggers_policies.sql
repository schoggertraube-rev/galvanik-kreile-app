-- Migration: prod-faithful triggers + policies (drop+create from prod catalog)
-- Purpose: F0-04 fingerprint parity for the "trig" and "pol" components.
-- Source: read-only introspection of production project syhaigjhsbpjmtnggqka
--         (pg_trigger / pg_policy catalogs, schemas public/private/storage).
-- Generated: 2026-08-06
-- Scope: triggers (7) + policies (71) captured verbatim from prod DDL.
-- Constraints are NOT regenerated here (report-only, see task step 4):
--   contype c=60, f=79, p=94, u=19 (schemas public+private).
-- This migration is drop+create (idempotent replay), no data mutation.

SET check_function_bodies = false;

-- ==== Triggers (prod-faithful) ====
DROP TRIGGER IF EXISTS trg_beleg_audit_insert ON public.beleg;
CREATE TRIGGER trg_beleg_audit_insert AFTER INSERT ON public.beleg FOR EACH ROW EXECUTE FUNCTION log_beleg_insert();
DROP TRIGGER IF EXISTS trg_beleg_gobd ON public.beleg;
CREATE TRIGGER trg_beleg_gobd BEFORE UPDATE ON public.beleg FOR EACH ROW EXECUTE FUNCTION prevent_beleg_mutation();
DROP TRIGGER IF EXISTS trg_beleg_no_delete ON public.beleg;
CREATE TRIGGER trg_beleg_no_delete BEFORE DELETE ON public.beleg FOR EACH ROW EXECUTE FUNCTION prevent_beleg_delete();
DROP TRIGGER IF EXISTS trg_audit_no_delete ON public.bh_audit_log;
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON public.bh_audit_log FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
DROP TRIGGER IF EXISTS trg_audit_no_update ON public.bh_audit_log;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON public.bh_audit_log FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
DROP TRIGGER IF EXISTS trg_update_vorlagen ON public.orders;
CREATE TRIGGER trg_update_vorlagen AFTER UPDATE OF status ON public.orders FOR EACH ROW WHEN ((((new.status)::text = ANY ((ARRAY['completed'::character varying, 'abgeschlossen'::character varying])::text[])) AND ((old.status)::text IS DISTINCT FROM (new.status)::text))) EXECUTE FUNCTION fn_update_vorlagen();
DROP TRIGGER IF EXISTS tenant_operator_controls_monotonic_version_trg ON public.tenant_operator_controls;
CREATE TRIGGER tenant_operator_controls_monotonic_version_trg BEFORE UPDATE ON public.tenant_operator_controls FOR EACH ROW EXECUTE FUNCTION enforce_operator_control_monotonic_version();

-- ==== Policies (prod-faithful) ====
DROP POLICY IF EXISTS service_role_all_app_kvp ON public.app_kvp_items;
CREATE POLICY service_role_all_app_kvp ON public.app_kvp_items AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_isolation ON public.arbeitszeit_buchung;
CREATE POLICY tenant_isolation ON public.arbeitszeit_buchung AS PERMISSIVE FOR ALL TO public USING ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS "Allow full access to audit_log" ON public.audit_log;
CREATE POLICY "Allow full access to audit_log" ON public.audit_log AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_isolation ON public.ausgangsrechnung;
CREATE POLICY tenant_isolation ON public.ausgangsrechnung AS PERMISSIVE FOR ALL TO public USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS tenant_isolation ON public.ausgangsrechnung_position;
CREATE POLICY tenant_isolation ON public.ausgangsrechnung_position AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM ausgangsrechnung ar
  WHERE ((ar.id = ausgangsrechnung_position.ausgangsrechnung_id) AND ((ar.tenant_id)::text = current_setting('app.tenant_id'::text, true))))));
DROP POLICY IF EXISTS service_role_bath_measurements ON public.bath_measurements;
CREATE POLICY service_role_bath_measurements ON public.bath_measurements AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_baths ON public.baths;
CREATE POLICY service_role_baths ON public.baths AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS beleg_all ON public.beleg;
CREATE POLICY beleg_all ON public.beleg AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS beleg_position_all ON public.beleg_position;
CREATE POLICY beleg_position_all ON public.beleg_position AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS bh_audit_log_insert ON public.bh_audit_log;
CREATE POLICY bh_audit_log_insert ON public.bh_audit_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS bh_audit_log_select ON public.bh_audit_log;
CREATE POLICY bh_audit_log_select ON public.bh_audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS bh_einstellungen_all ON public.bh_einstellungen;
CREATE POLICY bh_einstellungen_all ON public.bh_einstellungen AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_business_kvp ON public.business_kvp_items;
CREATE POLICY service_role_all_business_kvp ON public.business_kvp_items AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all_calendar_events ON public.calendar_events;
CREATE POLICY allow_all_calendar_events ON public.calendar_events AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_calendar_events ON public.calendar_events;
CREATE POLICY service_role_all_calendar_events ON public.calendar_events AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.communication_drafts;
CREATE POLICY "Enable all for authenticated users" ON public.communication_drafts AS PERMISSIVE FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS service_role_all_communication_messages ON public.communication_messages;
CREATE POLICY service_role_all_communication_messages ON public.communication_messages AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_communication_threads ON public.communication_threads;
CREATE POLICY service_role_all_communication_threads ON public.communication_threads AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_isolation ON public.communications;
CREATE POLICY tenant_isolation ON public.communications AS PERMISSIVE FOR ALL TO public USING ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS tenant_isolation_company_settings ON public.company_settings;
CREATE POLICY tenant_isolation_company_settings ON public.company_settings AS PERMISSIVE FOR ALL TO public USING ((tenant_id = current_setting('app.tenant_id'::text, true))) WITH CHECK ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS tenant_isolation_complaints ON public.complaints;
CREATE POLICY tenant_isolation_complaints ON public.complaints AS PERMISSIVE FOR ALL TO public USING ((tenant_id = current_setting('app.tenant_id'::text, true))) WITH CHECK ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS service_role_all_consumable_uses ON public.consumable_uses;
CREATE POLICY service_role_all_consumable_uses ON public.consumable_uses AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_cost_positions ON public.cost_positions;
CREATE POLICY service_role_all_cost_positions ON public.cost_positions AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_customers ON public.customers;
CREATE POLICY service_role_customers ON public.customers AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_devices ON public.devices;
CREATE POLICY service_role_all_devices ON public.devices AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS email_templates_all ON public.email_templates;
CREATE POLICY email_templates_all ON public.email_templates AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_isolation ON public.events;
CREATE POLICY tenant_isolation ON public.events AS PERMISSIVE FOR ALL TO public USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS export_lauf_all ON public.export_lauf;
CREATE POLICY export_lauf_all ON public.export_lauf AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow full access to feature_flags" ON public.feature_flags;
CREATE POLICY "Allow full access to feature_flags" ON public.feature_flags AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_feedback_notes ON public.feedback_notes;
CREATE POLICY service_role_all_feedback_notes ON public.feedback_notes AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow full access to import_job_rows" ON public.import_job_rows;
CREATE POLICY "Allow full access to import_job_rows" ON public.import_job_rows AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow full access to import_jobs" ON public.import_jobs;
CREATE POLICY "Allow full access to import_jobs" ON public.import_jobs AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS auth_all_inquiries ON public.inquiries;
CREATE POLICY auth_all_inquiries ON public.inquiries AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS public_all_inquiries_final ON public.inquiries;
CREATE POLICY public_all_inquiries_final ON public.inquiries AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_isolation_inquiries ON public.inquiries;
CREATE POLICY tenant_isolation_inquiries ON public.inquiries AS PERMISSIVE FOR ALL TO public USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS service_role_all_invoices ON public.invoices;
CREATE POLICY service_role_all_invoices ON public.invoices AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS public_all_items_final ON public.items;
CREATE POLICY public_all_items_final ON public.items AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_items ON public.items;
CREATE POLICY service_role_items ON public.items AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_isolation_items ON public.items;
CREATE POLICY tenant_isolation_items ON public.items AS PERMISSIVE FOR ALL TO public USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS kategorie_all ON public.kategorie;
CREATE POLICY kategorie_all ON public.kategorie AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_isolation ON public.konto;
CREATE POLICY tenant_isolation ON public.konto AS PERMISSIVE FOR ALL TO public USING ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS "Allow all actions for public" ON public.kostenposten;
CREATE POLICY "Allow all actions for public" ON public.kostenposten AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_kpi_cost_assumptions ON public.kpi_cost_assumptions;
CREATE POLICY service_role_all_kpi_cost_assumptions ON public.kpi_cost_assumptions AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS analyse_read ON public.kpi_snapshots;
CREATE POLICY analyse_read ON public.kpi_snapshots AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS kraftstoff_detail_all ON public.kraftstoff_detail;
CREATE POLICY kraftstoff_detail_all ON public.kraftstoff_detail AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all for public on kvp_items" ON public.kvp_items;
CREATE POLICY "Enable all for public on kvp_items" ON public.kvp_items AS PERMISSIVE FOR ALL TO public USING (true);
DROP POLICY IF EXISTS service_role_all_licenses ON public.licenses;
CREATE POLICY service_role_all_licenses ON public.licenses AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lieferant_all ON public.lieferant;
CREATE POLICY lieferant_all ON public.lieferant AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.offline_outbox;
CREATE POLICY "Enable all for authenticated users" ON public.offline_outbox AS PERMISSIVE FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS service_role_all_order_cost_events ON public.order_cost_events;
CREATE POLICY service_role_all_order_cost_events ON public.order_cost_events AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.order_cost_positions;
CREATE POLICY "Enable all for authenticated users" ON public.order_cost_positions AS PERMISSIVE FOR ALL TO authenticated USING (true);
DROP POLICY IF EXISTS service_role_all_order_financials ON public.order_financials;
CREATE POLICY service_role_all_order_financials ON public.order_financials AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS authenticated_finance_orders_select ON public.orders;
CREATE POLICY authenticated_finance_orders_select ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING (private.current_user_can_view_finance((tenant_id)::text));
DROP POLICY IF EXISTS service_role_orders ON public.orders;
CREATE POLICY service_role_orders ON public.orders AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS authenticated_finance_payments_select ON public.payments;
CREATE POLICY authenticated_finance_payments_select ON public.payments AS PERMISSIVE FOR SELECT TO authenticated USING (private.current_user_can_view_finance(tenant_id));
DROP POLICY IF EXISTS service_role_all_payments ON public.payments;
CREATE POLICY service_role_all_payments ON public.payments AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_phone_notes ON public.phone_notes;
CREATE POLICY service_role_all_phone_notes ON public.phone_notes AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS scan_uploads_insert_authenticated ON public.scan_uploads;
CREATE POLICY scan_uploads_insert_authenticated ON public.scan_uploads AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS scan_uploads_select_authenticated ON public.scan_uploads;
CREATE POLICY scan_uploads_select_authenticated ON public.scan_uploads AS PERMISSIVE FOR SELECT TO authenticated USING ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS scan_uploads_service_role_all ON public.scan_uploads;
CREATE POLICY scan_uploads_service_role_all ON public.scan_uploads AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS scan_uploads_update_authenticated ON public.scan_uploads;
CREATE POLICY scan_uploads_update_authenticated ON public.scan_uploads AS PERMISSIVE FOR UPDATE TO authenticated USING ((tenant_id = current_setting('app.tenant_id'::text, true))) WITH CHECK ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS service_role_all_shipments ON public.shipments;
CREATE POLICY service_role_all_shipments ON public.shipments AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all actions for public" ON public.steuerprofil;
CREATE POLICY "Allow all actions for public" ON public.steuerprofil AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS steuerprofil_all ON public.steuerprofil;
CREATE POLICY steuerprofil_all ON public.steuerprofil AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_isolation_ui_events ON public.ui_events;
CREATE POLICY tenant_isolation_ui_events ON public.ui_events AS PERMISSIVE FOR ALL TO public USING ((tenant_id = current_setting('app.tenant_id'::text, true))) WITH CHECK ((tenant_id = current_setting('app.tenant_id'::text, true)));
DROP POLICY IF EXISTS ustva_periode_all ON public.ustva_periode;
CREATE POLICY ustva_periode_all ON public.ustva_periode AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all actions for public" ON public.zahlung;
CREATE POLICY "Allow all actions for public" ON public.zahlung AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS scan_objects_insert_authenticated ON storage.objects;
CREATE POLICY scan_objects_insert_authenticated ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1
   FROM app_users au
  WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[])))))));
DROP POLICY IF EXISTS scan_objects_select_authenticated ON storage.objects;
CREATE POLICY scan_objects_select_authenticated ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1
   FROM app_users au
  WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]))))));
DROP POLICY IF EXISTS scan_objects_service_role_all ON storage.objects;
CREATE POLICY scan_objects_service_role_all ON storage.objects AS PERMISSIVE FOR ALL TO service_role USING ((bucket_id = 'scans'::text)) WITH CHECK ((bucket_id = 'scans'::text));
DROP POLICY IF EXISTS scan_objects_update_authenticated ON storage.objects;
CREATE POLICY scan_objects_update_authenticated ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1
   FROM app_users au
  WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[]))))))) WITH CHECK (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1
   FROM app_users au
  WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[])))))));
