# F0_SECURITY_OWNERSHIP_MATRIX (F0-05) â€” read-only aus Prod

> **Nachtrag 2026-08-10 (SUPERSEDED-Aufloesung):** Der unten dokumentierte 16/17-Stand und
> 'A06/A07 NICHT PASS' beschreiben den Prueftag 07.08. Live-Stand seit 10.08.: 17/17 Views
> security_invoker (einheitlich true, Schreibweise normalisiert; Aufloesung des on-vs-true-
> Messartefakts in F0_FINAL_REPORT.md). A06/A07-Neubewertung: F0_FINAL_REPORT.md (PASS mit
> neuen CI-Beweisen: relationsweite Grant-Pruefung, viewopts-Hardgate, S1-S12, V1-V5).

**Datum:** 2026-08-06. Schemas public + private. Prod ausschlieÃŸlich read-only.

## 1. SECURITY DEFINER-Funktionen (Top-Risiko) â€” SAUBER
11 SECURITY-DEFINER-Funktionen, **alle mit gepinntem `search_path`** (kein mutable-search_path-Injection):

| Funktion | Schema | search_path | anon/auth/PUBLIC EXECUTE |
|---|---|---|---|
| current_user_can_view_finance | private | pg_catalog | **authenticated** (RLS-Helper, erforderlich) |
| bind_item_photo_upload, claim_ai_usage_reservation, claim_item_photo_analysis, consume_security_rate_limit, mark_item_photo_uncertain, reserve_ai_usage, reserve_item_photo_job, reset_security_rate_limit, settle_ai_usage_reservation, settle_item_photo_analysis | public | pg_catalog, public, pg_temp | â€” (keiner) |

Bewertung: `current_user_can_view_finance` ist SECURITY DEFINER mit `search_path=pg_catalog`, Body
schema-qualifiziert (`public.app_users`, `auth.uid()`); EXECUTE an `authenticated` ist fÃ¼r die
RLS-Policy-Auswertung notwendig â†’ **korrekt, kein Escalation-Vektor**. Alle Ã¼brigen: kein anon/auth-EXECUTE.
**A07 (Functions) fÃ¼r diese Menge: PASS.**

## 2. Tabellen ohne RLS (26) â€” FAIL-CLOSED bestÃ¤tigt
Alle 26 Tabellen ohne RLS haben **0 Grants** an anon/authenticated/PUBLIC â†’ kein Data-API-Zugriff:
aktion, attribution, einwilligung, feedback_eingang, feedback_mail, forecast_version, inventory_items,
kampagne, kanal, kosten_posten, kostensatz_default, kostenstelle, kostenstellen_energie_monat, lern_metrik,
marketing_asset, marketing_touchpoints, periode, price_agreements, segment, statistik_kennzahl,
teile_klassifikator, telemetrie_event, touchpoint, vorlage_verbrauch, vorlage_zeit, warning_event.
**A06 (nicht-exponiert) fÃ¼r diese Menge: PASS** (nicht exponiert, Grants entzogen).

## 3. RLS-Tabellen mit breiten Policies â€” HÃ„RTUNGS-BACKLOG (RLS-CONTRACT-001)
Diese 68 RLS-Tabellen sind aktuell ebenfalls durch **0 anon/auth-Grants** gedeckt (kein Data-API-Pfad).
Latentes Risiko: mehrere Policies sind **permissiv/breit** (kein Tenant-Bezug) â€” wÃ¼rden bei je Wiederherstellten
Grants zu breit wirken. Zu tenant-/rollengebundenen Policies hÃ¤rten:

- `Allow all actions for public`: kostenposten, steuerprofil, zahlung
- `public_all_*_final` / `Enable all for public`: inquiries.public_all_inquiries_final, items.public_all_items_final, kvp_items
- `Allow full access to â€¦`: audit_log, feature_flags, import_jobs, import_job_rows, calendar_events (allow_all), email_templates
- `Enable all for authenticated users`: communication_drafts, offline_outbox, order_cost_positions

Gut geformt (tenant-/rollengebunden, Referenz): `*.tenant_isolation*`, `orders.authenticated_finance_orders_select`,
`payments.authenticated_finance_payments_select`, `scan_uploads.*_authenticated`, `*.service_role_*`.

## 4. Offene/entscheidungspflichtige Punkte
- **service_role-ACL** auf `ai_usage_reservations`/`item_photo_jobs`/`security_rate_limit_counters`
  (Least-Privilege via RPC vs. voll) â€” **Produkt-/Security-Entscheidung** (s. F0_DEFINITIONAL_PARITY).
- **supabase_admin Default Privileges** (Cluster) â€” BLOCKED_EXTERNAL (Dashboard/Owner).
- RLS-CONTRACT-001: breite Policies (Abschnitt 3) tenant-/rollengebunden nachziehen + Pos/Neg-Tests (F0-05 DoD).

## 5. Red-Team-Korrektur (verifiziert, ersetzt Ã¼berzogene Claims oben)
- **SECDEF-Owner geprÃ¼ft:** alle 11 SECURITY-DEFINER-Funktionen gehÃ¶ren `postgres`, **kein Superuser**.
  Sie umgehen RLS (owner-Rechte), sind aber â€” auÃŸer `current_user_can_view_finance` (authenticated) â€”
  **nur service_role-EXECUTE**. Die finance-Check-Funktion ist tenant-gescopt (Boolean Ã¼ber auth.uid()),
  kein Cross-Tenant-Leak. â†’ **kein Escalation-Vektor verifiziert**, aber Posture hÃ¤ngt an korrekten EXECUTE-Grants.
- **Views (17) â€” KORRIGIERT 2026-08-07 (Messfehler behoben):** frÃ¼here Aussage â€žalle 17 `security_invoker=off`"
  war **falsch** (Query prÃ¼fte `=on`, Postgres speichert `=true`). TatsÃ¤chlich: **16 Views bereits
  `security_invoker=true`; nur `v_auftrag_db` ist ungesetzt (off).** HÃ¤rtungsbedarf = **genau 1 View**.
  Alle 17 postgres-owned; aktuell zusÃ¤tzlich durch 0 anon/auth-Grants gedeckt.
- **Ehrliche Herabstufung:** A06/A07 sind **NICHT PASS**, sondern **CONDITIONAL/UNTESTED** â€” die Fail-closed-Lage
  ruht allein auf Grant-Entzug (ein `GRANT`/`ALTER DEFAULT PRIVILEGES` von Totalexposition entfernt), nicht auf
  RLS+security_invoker. service_role umgeht RLS vollstÃ¤ndig (bekannt, per Design Backend-Rolle).

## Fazit (korrigiert)
Fail-closed ist **aktuell wahr, aber fragil** (nur Grant-Entzug). Verifiziert: SECDEF-Owner=postgres/non-super,
RLS-umgehende Writes nur service_role, finance-Check tenant-gescopt, alle no-RLS-Tabellen + Views 0 anon/auth-Grants.
FÃ¼r echtes A06/A07-PASS fehlt: RLS+Tenant-Policies auf die 68 Tabellen (RLS-CONTRACT-001), `security_invoker=on`
auf Views, relationsweise Pos/Neg-Tests, + die service_role-ACL-Entscheidung. **Kein PASS behauptet.**