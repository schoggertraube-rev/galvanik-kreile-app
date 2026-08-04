# RLS-Analyse — Galvanik Kreile

Stand: 2026-08-04 | Production-Projekt: `syhaigjhsbpjmtnggqka`

## Zusammenfassung

| Kategorie | Anzahl |
|---|---|
| Tabellen gesamt (public) | 92 |
| RLS aktiviert | 66 |
| RLS aktiviert + forced | 7 |
| **RLS deaktiviert** | **26** |

## P0 — Tabellen MIT tenant_id OHNE RLS (12)

Sofortiger Tenant-Isolation-Bruch. Jeder authentifizierte Nutzer kann
Daten aller Tenants lesen/schreiben.

| Tabelle | Risiko | Empfohlene Policy |
|---|---|---|
| `forecast_version` | Finanzplanung sichtbar | `tenant_id = current_setting('app.tenant_id')` |
| `inventory_items` | Lagerbestand + Preise | `tenant_id = current_setting('app.tenant_id')` |
| `kosten_posten` | Kostendaten | `tenant_id = current_setting('app.tenant_id')` |
| `kostensatz_default` | Stundensaetze | `tenant_id = current_setting('app.tenant_id')` |
| `kostenstelle` | Organisationsstruktur | `tenant_id = current_setting('app.tenant_id')` |
| `kostenstellen_energie_monat` | Energiekosten | `tenant_id = current_setting('app.tenant_id')` |
| `marketing_touchpoints` | Marketing-Aktionen | `tenant_id = current_setting('app.tenant_id')` |
| `periode` | Buchhaltungsperioden | `tenant_id = current_setting('app.tenant_id')` |
| `teile_klassifikator` | Teileklassen | `tenant_id = current_setting('app.tenant_id')` |
| `vorlage_verbrauch` | Verbrauchsvorlagen | `tenant_id = current_setting('app.tenant_id')` |
| `vorlage_zeit` | Zeitvorlagen | `tenant_id = current_setting('app.tenant_id')` |
| `warning_event` | Systemwarnungen | `tenant_id = current_setting('app.tenant_id')` |

**Aktion:** Eine Migration mit 12x `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
und je einer `tenant_isolation` PERMISSIVE Policy fuer `service_role` (ALL, true)
und eine fuer alle Rollen (ALL, tenant_id-Filter).

## P1 — Tabellen OHNE tenant_id mit Kundendaten (6)

Kein `tenant_id`, aber Referenzen auf Kunden/Auftraege. Tenant-Isolation
nur ueber FK-Join moeglich oder `tenant_id`-Spalte nachtragen.

| Tabelle | FK-Bezug | Empfehlung |
|---|---|---|
| `price_agreements` | `customer_id` → customers | `tenant_id` ergaenzen |
| `feedback_mail` | `auftrag_id`, `kunde_id` | `tenant_id` ergaenzen |
| `feedback_eingang` | `feedback_mail_id` | Indirekt ueber feedback_mail |
| `einwilligung` | `kunde_id` | `tenant_id` ergaenzen |
| `attribution` | `touchpoint_id`, `auftrag_id` | `tenant_id` ergaenzen |
| `marketing_asset` | `auftrag_id`, `kunde_id` | `tenant_id` ergaenzen |

**Aktion:** Zuerst `tenant_id`-Spalte per Migration ergaenzen und backfill,
dann RLS aktivieren. Produktentscheidung noetig fuer Backfill-Logik.

## P2 — Marketing/System-Tabellen ohne sensible Daten (8)

Kein `tenant_id`, keine direkten Kundendaten. Systemweite Konfig- oder
Demo-Daten.

| Tabelle | Inhalt | Empfehlung |
|---|---|---|
| `kampagne` | Marketing-Kampagnen (has is_demo) | `tenant_id` ergaenzen oder service_role-only |
| `kanal` | Kanalanbindung, config | service_role-only |
| `segment` | Marketing-Segmente (has is_demo) | `tenant_id` ergaenzen oder service_role-only |
| `aktion` | Kampagnenaktionen | Indirekt ueber kampagne |
| `touchpoint` | Conversion-Touchpoints | Indirekt ueber aktion |
| `statistik_kennzahl` | Aggregierte Kennzahlen | service_role-only |
| `lern_metrik` | KI-Lernmetriken | service_role-only |
| `telemetrie_event` | Telemetrie (anonym) | service_role-only |

**Aktion:** RLS aktivieren mit service_role-only Policies.
Kein Risiko fuer Tenant-Isolation, aber Defense-in-Depth.

## RLS-Forced Tabellen (7) — korrekt konfiguriert

Diese Tabellen haben `rls_enabled = true` UND `rls_forced = true` ohne
Policies. Nur `service_role` (BYPASSRLS) kann zugreifen. Korrekt fuer
Systemtabellen.

- `ai_usage_reservations`
- `app_usage_events`
- `developer_feedback`
- `item_photo_jobs`
- `operator_control_events`
- `security_rate_limit_counters`
- `tenant_operator_controls`

## Schwache Policies bei aktiviertem RLS

Einige Tabellen haben RLS aktiviert, aber Policies mit `USING (true)` —
effektiv kein Schutz. Diese sollten nachgeschaerft werden:

| Tabelle | Policy | Problem |
|---|---|---|
| `audit_log` | Allow full access | `USING (true)` fuer alle Rollen |
| `calendar_events` | allow_all | `USING (true)` fuer alle Rollen |
| `email_templates` | email_templates_all | `USING (true)` fuer alle Rollen |
| `feature_flags` | Allow full access | `USING (true)` fuer alle Rollen |
| `import_jobs` | Allow full access | `USING (true)` fuer alle Rollen |
| `import_job_rows` | Allow full access | `USING (true)` fuer alle Rollen |
| `kostenposten` | Allow all for public | `USING (true)` fuer alle Rollen |
| `kvp_items` | Enable all for public | `USING (true)` fuer alle Rollen |
| `zahlung` | Allow all for public | `USING (true)` fuer alle Rollen |

## KRITISCH: app.tenant_id wird nie gesetzt (2026-08-04)

### Befund

Die gesamte Tenant-Isolation ueber `current_setting('app.tenant_id', true)` ist
**nicht funktional**. Verifiziert in Production:

1. `current_setting('app.tenant_id', true)` gibt `NULL` zurueck
2. Kein Code in `src/` setzt `app.tenant_id` (0 Treffer)
3. Keine Datenbank-Funktion setzt `app.tenant_id` (0 Treffer in `pg_proc`)
4. Kein Next.js-Middleware aktiv (`middleware.ts` ist deaktiviert)
5. Beide Supabase-Clients (`client.ts`, `server.ts`) nutzen `ANON_KEY` — RLS gilt

### Warum die App trotzdem funktioniert

Bestehende Tabellen mit `tenant_isolation` Policy (z.B. `inquiries`) haben
**zusaetzlich** `USING (true)` Catch-all Policies (`auth_all_*`, `public_all_*`).
Da alle Policies PERMISSIVE sind, werden sie ge-OR-t:

    true OR (tenant_id = NULL) → true

Die Catch-all Policy hebt die Tenant-Isolation komplett auf. Tenant-Isolation
ist somit auf **keiner** Tabelle tatsaechlich wirksam.

### Konsequenz fuer P0-Migration (PR #35)

Die Migration `20260804200000_rls_p0_tenant_isolation.sql` erstellt **nur**:
- `service_role_all_*` — `USING(true)` fuer `service_role`
- `tenant_isolation` — `USING(tenant_id = current_setting(...))` fuer alle Rollen

**KEINE** Catch-all `USING(true)` Policy fuer `authenticated`/`public`.

Wenn die Migration auf Production angewandt wird:
- `service_role` Queries funktionieren (BYPASSRLS)
- Alle `anon`/`authenticated` Queries geben **0 Zeilen** zurueck
- Betroffene Server-Actions: `vorlage.actions.ts`, `orderCost.actions.ts`,
  `erfassung.actions.ts`, `cockpit/actions.ts`, `snapshot.ts`
- **Die App waere fuer Erfassung, Cockpit und Kostenkalkulation unbenutzbar**

### Status

**BLOCKED_PRODUCT_DECISION** — Die Migration darf NICHT auf Production angewandt
werden, bis eine Entscheidung fuer den Tenant-Isolation-Mechanismus getroffen ist.

Optionen:
1. **Datenbank-Funktion**: `ON LOGIN`-Trigger oder PostgREST-Hook, der
   `set_config('app.tenant_id', ...)` basierend auf JWT-Claims setzt
2. **JWT Custom Claims**: `tenant_id` in Supabase-Auth-JWT speichern,
   Policy aendern auf `auth.jwt() ->> 'tenant_id'`
3. **Catch-all + App-Filter**: `USING(true)` Policies + Tenant-Filterung
   im App-Code (aktueller De-facto-Zustand, aber explizit machen)

Option 2 ist die sauberste Loesung fuer Supabase-basierte Projekte.

## Empfohlene Reihenfolge (aktualisiert)

1. **Zuerst:** Tenant-Isolation-Mechanismus entscheiden (Produktentscheidung)
2. **Dann P0:** 12 Tabellen mit `tenant_id` — Migration anpassen je nach Mechanismus
3. **P1:** 6 Tabellen — braucht `tenant_id`-Spalte + Backfill
4. **P2:** 8 Tabellen — service_role-only Policies
5. **Nachschaerfung:** 9 Tabellen mit schwachen `USING (true)` Policies
   + bestehende Catch-all Policies entfernen sobald Mechanismus greift
