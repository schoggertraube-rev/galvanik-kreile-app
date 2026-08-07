-- F0-05 RLS-CONTRACT-HÃ¤rtung â€” tenant_id-Tabellen (KANDIDAT, noch nicht aktive Migration).
-- Zweck: breite Policies (FOR ALL USING(true)) durch tenant-gebundene ersetzen (fail-closed).
-- Muster wie vorhandene tenant_isolation-Policies: USING (tenant_id = current_setting('app.tenant_id', true)).
-- Prod-verifiziert 2026-08-07 (Policy-Namen, Rollen, tenant_id-Typen).
-- ANWENDUNG: paritÃ¤t-vor-hÃ¤rtung -> gleichzeitig auf Prod UND Baseline anwenden, danach Prod-Fingerprint-
-- Referenz (pol) neu ziehen. Bis dahin bleibt die Baseline byte-gleich zu Prod (Kandidat = nicht im aktiven Chain).
-- Idempotent-orientiert: neue Policy anlegen, dann breite droppen (RLS ist OR-verknÃ¼pft; kein offenes Fenster,
-- da beide restriktiver-oder-gleich in einer Transaktion laufen).


-- ===== Gruppe A: redundante breite Policies droppen (tenant_isolation existiert bereits) =====
drop policy if exists "auth_all_inquiries" on public.inquiries;
drop policy if exists "public_all_inquiries_final" on public.inquiries;
drop policy if exists "public_all_items_final" on public.items;

-- ===== Gruppe B: breit -> tenant-gebunden (neue Policy zuerst, dann breite droppen) =====

-- audit_log (tenant_id text)
create policy "tenant_isolation_audit_log" on public.audit_log as permissive for all to public
  using (tenant_id = current_setting('app.tenant_id'::text, true))
  with check (tenant_id = current_setting('app.tenant_id'::text, true));
drop policy if exists "Allow full access to audit_log" on public.audit_log;

-- calendar_events (tenant_id text; service_role_all_calendar_events bleibt)
create policy "tenant_isolation_calendar_events" on public.calendar_events as permissive for all to public
  using (tenant_id = current_setting('app.tenant_id'::text, true))
  with check (tenant_id = current_setting('app.tenant_id'::text, true));
drop policy if exists "allow_all_calendar_events" on public.calendar_events;

-- communication_drafts (tenant_id varchar)
create policy "tenant_isolation_communication_drafts" on public.communication_drafts as permissive for all to public
  using ((tenant_id)::text = current_setting('app.tenant_id'::text, true))
  with check ((tenant_id)::text = current_setting('app.tenant_id'::text, true));
drop policy if exists "Enable all for authenticated users" on public.communication_drafts;

-- email_templates (tenant_id text)
create policy "tenant_isolation_email_templates" on public.email_templates as permissive for all to public
  using (tenant_id = current_setting('app.tenant_id'::text, true))
  with check (tenant_id = current_setting('app.tenant_id'::text, true));
drop policy if exists "email_templates_all" on public.email_templates;

-- kpi_snapshots (tenant_id text; war SELECT-only -> SELECT-only bleiben, nicht verbreitern)
create policy "tenant_isolation_kpi_snapshots" on public.kpi_snapshots as permissive for select to public
  using (tenant_id = current_setting('app.tenant_id'::text, true));
drop policy if exists "analyse_read" on public.kpi_snapshots;

-- kvp_items (tenant_id text)
create policy "tenant_isolation_kvp_items" on public.kvp_items as permissive for all to public
  using (tenant_id = current_setting('app.tenant_id'::text, true))
  with check (tenant_id = current_setting('app.tenant_id'::text, true));
drop policy if exists "Enable all for public on kvp_items" on public.kvp_items;

-- offline_outbox (tenant_id varchar)
create policy "tenant_isolation_offline_outbox" on public.offline_outbox as permissive for all to public
  using ((tenant_id)::text = current_setting('app.tenant_id'::text, true))
  with check ((tenant_id)::text = current_setting('app.tenant_id'::text, true));
drop policy if exists "Enable all for authenticated users" on public.offline_outbox;

-- order_cost_positions (tenant_id varchar)
create policy "tenant_isolation_order_cost_positions" on public.order_cost_positions as permissive for all to public
  using ((tenant_id)::text = current_setting('app.tenant_id'::text, true))
  with check ((tenant_id)::text = current_setting('app.tenant_id'::text, true));
drop policy if exists "Enable all for authenticated users" on public.order_cost_positions;

-- ===== Gruppe C: Buchhaltung/Config OHNE tenant_id -> aktiver-App-User-Vertrag (Entscheidung 2026-08-07) =====
-- Vertrag: USING (auth.uid() IN (SELECT id FROM public.app_users WHERE active IS TRUE)).
-- FOR ALL (WITH CHECK gleich), ausser Append-only-Tabellen (Trigger-GoBD): bh_audit_log = nur INSERT+SELECT.
-- service_role (Backend) ist von RLS ausgenommen (bypassrls) und bleibt unberuehrt.

-- beleg (GoBD-Trigger erzwingen no-delete/no-mutation zusaetzlich)
create policy "app_user_beleg" on public.beleg as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "beleg_all" on public.beleg;

create policy "app_user_beleg_position" on public.beleg_position as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "beleg_position_all" on public.beleg_position;

-- bh_audit_log: APPEND-ONLY (Trigger no-update/no-delete) -> nur INSERT + SELECT, keine breite Ersetzung
--   (die vorhandenen bh_audit_log_insert/select sind bereits schmal auf authenticated; nur User-Bindung ergaenzen)
drop policy if exists "bh_audit_log_insert" on public.bh_audit_log;
drop policy if exists "bh_audit_log_select" on public.bh_audit_log;
create policy "app_user_bh_audit_log_insert" on public.bh_audit_log as permissive for insert to authenticated
  with check (auth.uid() in (select id from public.app_users where active is true));
create policy "app_user_bh_audit_log_select" on public.bh_audit_log as permissive for select to authenticated
  using (auth.uid() in (select id from public.app_users where active is true));

create policy "app_user_bh_einstellungen" on public.bh_einstellungen as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "bh_einstellungen_all" on public.bh_einstellungen;

create policy "app_user_export_lauf" on public.export_lauf as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "export_lauf_all" on public.export_lauf;

create policy "app_user_feature_flags" on public.feature_flags as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "Allow full access to feature_flags" on public.feature_flags;

create policy "app_user_import_jobs" on public.import_jobs as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "Allow full access to import_jobs" on public.import_jobs;

create policy "app_user_import_job_rows" on public.import_job_rows as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "Allow full access to import_job_rows" on public.import_job_rows;

create policy "app_user_kategorie" on public.kategorie as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "kategorie_all" on public.kategorie;

create policy "app_user_kostenposten" on public.kostenposten as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "Allow all actions for public" on public.kostenposten;

create policy "app_user_kraftstoff_detail" on public.kraftstoff_detail as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "kraftstoff_detail_all" on public.kraftstoff_detail;

create policy "app_user_lieferant" on public.lieferant as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "lieferant_all" on public.lieferant;

create policy "app_user_steuerprofil" on public.steuerprofil as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "Allow all actions for public" on public.steuerprofil;
drop policy if exists "steuerprofil_all" on public.steuerprofil;

create policy "app_user_ustva_periode" on public.ustva_periode as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "ustva_periode_all" on public.ustva_periode;

create policy "app_user_zahlung" on public.zahlung as permissive for all to authenticated
  using (auth.uid() in (select id from public.app_users where active is true))
  with check (auth.uid() in (select id from public.app_users where active is true));
drop policy if exists "Allow all actions for public" on public.zahlung;

