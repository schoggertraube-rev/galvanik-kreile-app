# RLS-Analyse — Galvanik Kreile

Stand: 2026-08-05 | Production-Projekt: `syhaigjhsbpjmtnggqka`

## Zusammenfassung

| Kategorie | Anzahl |
|---|---|
| Tabellen gesamt (public) | 92 |
| RLS aktiviert | 66 |
| RLS aktiviert + forced | 7 |
| **RLS deaktiviert** | **26** |

Auf allen 26 Tabellen besitzen `anon` und `authenticated` in Production jeweils
SELECT, INSERT, UPDATE und DELETE. Das ist der akute Befund; RLS-Status und Grants
muessen getrennt bewertet werden.

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

**Akute Aktion:** Data-API-Grants entziehen. RLS erst nach bewiesenem
Relations-/Tenant-Vertrag separat entscheiden.

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

**Akute Aktion:** Data-API-Grants entziehen. `tenant_id`-Backfill und RLS bleiben
eine eigene, relationenweise Produkt- und Datenentscheidung.

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

**Akute Aktion:** Data-API-Grants entziehen. Eine spaetere Policy darf nicht
pauschal `USING (true)` verwenden.

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

## Korrigierter Zugriffsbefund (2026-08-05)

1. `app.tenant_id` wird weiterhin nicht gesetzt; darauf basierende Policies sind
   ohne zusaetzlichen Vertrag nicht belastbar.
2. Die App besitzt sowohl Drizzle-/Serverzugriffe als auch Browser-Supabase-Pfade.
   Die fruehere Aussage „kein Clientzugriff“ war falsch.
3. Die nicht angewandte Datei `20260804200000_rls_p0_tenant_isolation.sql` wurde
   im Recovery-Kandidaten aus `supabase/migrations/` quarantainiert. Sie darf nicht
   auf Production angewandt werden.
4. Serverseitige Zugriffe auf die grantlosen Tabellen werden im Kandidaten erst
   nach der kanonischen App-Autorisierung privilegiert und tenantgebunden
   ausgefuehrt. Andere sitzungsgebundene Supabase-Pfade werden nicht pauschal auf
   Service Role umgestellt.
5. Die akute Migration entzieht auf den 26 Tabellen nur Grants. RLS-/Policy-Arbeit
   bleibt separat freigabepflichtig.

## Empfohlene Reihenfolge

1. Direkte Browserkonsumenten der 26 Tabellen entfernen.
2. `anon`-/`authenticated`-Grants entziehen und negativ pruefen.
3. Legitime Serverpfade positiv pruefen.
4. Danach pro Relation Tenant, Eigentuemer, Rollen, Grants und Policy bestimmen.
5. Schwache Catch-all-Policies nur zusammen mit negativen Integrationstests entfernen.
