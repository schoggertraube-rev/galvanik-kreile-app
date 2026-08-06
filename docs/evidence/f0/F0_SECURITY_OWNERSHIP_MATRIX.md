# F0_SECURITY_OWNERSHIP_MATRIX (F0-05) — read-only aus Prod

**Datum:** 2026-08-06. Schemas public + private. Prod ausschließlich read-only.

## 1. SECURITY DEFINER-Funktionen (Top-Risiko) — SAUBER
11 SECURITY-DEFINER-Funktionen, **alle mit gepinntem `search_path`** (kein mutable-search_path-Injection):

| Funktion | Schema | search_path | anon/auth/PUBLIC EXECUTE |
|---|---|---|---|
| current_user_can_view_finance | private | pg_catalog | **authenticated** (RLS-Helper, erforderlich) |
| bind_item_photo_upload, claim_ai_usage_reservation, claim_item_photo_analysis, consume_security_rate_limit, mark_item_photo_uncertain, reserve_ai_usage, reserve_item_photo_job, reset_security_rate_limit, settle_ai_usage_reservation, settle_item_photo_analysis | public | pg_catalog, public, pg_temp | — (keiner) |

Bewertung: `current_user_can_view_finance` ist SECURITY DEFINER mit `search_path=pg_catalog`, Body
schema-qualifiziert (`public.app_users`, `auth.uid()`); EXECUTE an `authenticated` ist für die
RLS-Policy-Auswertung notwendig → **korrekt, kein Escalation-Vektor**. Alle übrigen: kein anon/auth-EXECUTE.
**A07 (Functions) für diese Menge: PASS.**

## 2. Tabellen ohne RLS (26) — FAIL-CLOSED bestätigt
Alle 26 Tabellen ohne RLS haben **0 Grants** an anon/authenticated/PUBLIC → kein Data-API-Zugriff:
aktion, attribution, einwilligung, feedback_eingang, feedback_mail, forecast_version, inventory_items,
kampagne, kanal, kosten_posten, kostensatz_default, kostenstelle, kostenstellen_energie_monat, lern_metrik,
marketing_asset, marketing_touchpoints, periode, price_agreements, segment, statistik_kennzahl,
teile_klassifikator, telemetrie_event, touchpoint, vorlage_verbrauch, vorlage_zeit, warning_event.
**A06 (nicht-exponiert) für diese Menge: PASS** (nicht exponiert, Grants entzogen).

## 3. RLS-Tabellen mit breiten Policies — HÄRTUNGS-BACKLOG (RLS-CONTRACT-001)
Diese 68 RLS-Tabellen sind aktuell ebenfalls durch **0 anon/auth-Grants** gedeckt (kein Data-API-Pfad).
Latentes Risiko: mehrere Policies sind **permissiv/breit** (kein Tenant-Bezug) — würden bei je Wiederherstellten
Grants zu breit wirken. Zu tenant-/rollengebundenen Policies härten:

- `Allow all actions for public`: kostenposten, steuerprofil, zahlung
- `public_all_*_final` / `Enable all for public`: inquiries.public_all_inquiries_final, items.public_all_items_final, kvp_items
- `Allow full access to …`: audit_log, feature_flags, import_jobs, import_job_rows, calendar_events (allow_all), email_templates
- `Enable all for authenticated users`: communication_drafts, offline_outbox, order_cost_positions

Gut geformt (tenant-/rollengebunden, Referenz): `*.tenant_isolation*`, `orders.authenticated_finance_orders_select`,
`payments.authenticated_finance_payments_select`, `scan_uploads.*_authenticated`, `*.service_role_*`.

## 4. Offene/entscheidungspflichtige Punkte
- **service_role-ACL** auf `ai_usage_reservations`/`item_photo_jobs`/`security_rate_limit_counters`
  (Least-Privilege via RPC vs. voll) — **Produkt-/Security-Entscheidung** (s. F0_DEFINITIONAL_PARITY).
- **supabase_admin Default Privileges** (Cluster) — BLOCKED_EXTERNAL (Dashboard/Owner).
- RLS-CONTRACT-001: breite Policies (Abschnitt 3) tenant-/rollengebunden nachziehen + Pos/Neg-Tests (F0-05 DoD).

## 5. Red-Team-Korrektur (verifiziert, ersetzt überzogene Claims oben)
- **SECDEF-Owner geprüft:** alle 11 SECURITY-DEFINER-Funktionen gehören `postgres`, **kein Superuser**.
  Sie umgehen RLS (owner-Rechte), sind aber — außer `current_user_can_view_finance` (authenticated) —
  **nur service_role-EXECUTE**. Die finance-Check-Funktion ist tenant-gescopt (Boolean über auth.uid()),
  kein Cross-Tenant-Leak. → **kein Escalation-Vektor verifiziert**, aber Posture hängt an korrekten EXECUTE-Grants.
- **Views (17): NEUER Härtungspunkt.** Alle postgres-owned mit `security_invoker=off` → würden RLS umgehen,
  falls erreichbar. Aktuell 0 anon/auth-Grants → kein Data-API-Pfad. Defense-in-depth: `security_invoker=on`.
- **Ehrliche Herabstufung:** A06/A07 sind **NICHT PASS**, sondern **CONDITIONAL/UNTESTED** — die Fail-closed-Lage
  ruht allein auf Grant-Entzug (ein `GRANT`/`ALTER DEFAULT PRIVILEGES` von Totalexposition entfernt), nicht auf
  RLS+security_invoker. service_role umgeht RLS vollständig (bekannt, per Design Backend-Rolle).

## Fazit (korrigiert)
Fail-closed ist **aktuell wahr, aber fragil** (nur Grant-Entzug). Verifiziert: SECDEF-Owner=postgres/non-super,
RLS-umgehende Writes nur service_role, finance-Check tenant-gescopt, alle no-RLS-Tabellen + Views 0 anon/auth-Grants.
Für echtes A06/A07-PASS fehlt: RLS+Tenant-Policies auf die 68 Tabellen (RLS-CONTRACT-001), `security_invoker=on`
auf Views, relationsweise Pos/Neg-Tests, + die service_role-ACL-Entscheidung. **Kein PASS behauptet.**
