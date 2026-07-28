# W3 — Auth-, Tenant-, RLS-, ACL-, View- und Storage-Discovery

## Status

`DISCOVERY_ONLY — NO_REMOTE_MUTATION`

| Feld | Wert |
| --- | --- |
| Ziel | Supabase `syhaigjhsbpjmtnggqka` (`CANONICAL_PRODUCT_SYSTEM`) |
| Snapshot | `contracts/product-security-snapshot.v1.json` |
| Erfasst am | 2026-07-28 |
| Kandidaten-SHA | `abecbaf669bf9b14c461a7084e4d492df02a64ea` (lokaler, voll gegateter Kandidat; keine W3-Mutation) |
| Produktfreigabe | `UNASSIGNED` |
| Migration | keine — W3 ist noch nicht entscheidungsreif |

Der aktuelle Produktkatalog meldet 69 Security-Advisors: 27 `ERROR`, 31
`WARN`, 11 `INFO`. Die 27 Fehler bestehen aus 26 öffentlichen Tabellen ohne
RLS und `public.v_auftrag_db` als Security-Definer-View. Dieses Dokument ist
ein Entscheidungsregister, keine Erlaubnis, Policy- oder RLS-Änderungen remote
auszuführen.

## Harte Regel für W3

Kein Eintrag bekommt eine generische `FOR ALL ... USING (true)`-Policy. Für
jede Relation muss vor einer W3-Migration Actor, Tenantquelle, erlaubte
Operation, serverseitiger Konsument, RLS-Prädikat, Storage-/View-Abhängigkeit
und negativer Cross-Tenant-Test feststehen.

## 26 RLS-lose öffentliche Tabellen: Einzelentscheidungen

| Relation | Heute belegte Tenantquelle | W3-Entscheidung | Vorbedingung für eine spätere Migration |
| --- | --- | --- | --- |
| `forecast_version` | direkte `tenant_id` | `ADD_TENANT_RLS_LATER` | rollenbezogene Read/Write-Matrix, kein Browserzugriff vor Beweis |
| `inventory_items` | direkte `tenant_id` | `ADD_TENANT_RLS_LATER` | Lager-/Auftragskonsumenten und Bestandsmutation einzeln beweisen |
| `kosten_posten` | direkte `tenant_id` | `GATE_FINANCE_UNTIL_OWNER_PROOF` | Finanzrollen, Belegbezug und Kosten-Readback |
| `kostensatz_default` | direkte `tenant_id` | `GATE_FINANCE_UNTIL_OWNER_PROOF` | Kostenstellen-/Finanzrollen und Historienvertrag |
| `kostenstelle` | direkte `tenant_id` | `GATE_CAPACITY_UNTIL_OWNER_PROOF` | Stations-/Kapazitätsvertrag statt abgeleiteter Auslastung |
| `kostenstellen_energie_monat` | direkte `tenant_id` | `GATE_FINANCE_UNTIL_OWNER_PROOF` | Kostenstelle, Monat, Finanzrolle und Evidenzvertrag |
| `marketing_touchpoints` | direkte `tenant_id` | `GATE_MARKETING_UNTIL_CONSENT_PROOF` | Einwilligung, Actor und Attributionstrace |
| `periode` | direkte `tenant_id` | `GATE_FINANCE_UNTIL_OWNER_PROOF` | Abschlussrolle, Unveränderbarkeit und Auditreceipt |
| `teile_klassifikator` | direkte `tenant_id` | `GATE_CLASSIFICATION_UNTIL_PROVENANCE` | Quelle, Änderungsrolle und Teilebezug |
| `vorlage_verbrauch` | direkte `tenant_id` | `GATE_TEMPLATE_UNTIL_OPERATIONAL_PROOF` | Vorlagenowner, Materialbuchung und Receipt |
| `vorlage_zeit` | direkte `tenant_id` | `GATE_TEMPLATE_UNTIL_OPERATIONAL_PROOF` | Vorlagenowner, Zeitbuchung und Receipt |
| `warning_event` | direkte `tenant_id` | `GATE_WARNING_UNTIL_EVIDENCE_PROOF` | Regelquelle, Evidenz, Acknowledgement und Rollen |
| `price_agreements` | `customer_id → customers.id → customers.tenant_id` | `DERIVE_TENANT_VIA_CUSTOMER_LATER` | Join-Prädikat und Cross-Tenant-Child-Test; keine eigene Tenantspalte erfinden |
| `aktion` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Produktentscheidung: neue Tenantquelle oder belegte Parent-Kette |
| `attribution` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Produktentscheidung: Auftrag/Lead/Touchpoint-Kette eindeutig machen |
| `einwilligung` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Kunde/Einwilligung/Actor-Kette vor Marketing-Reaktivierung |
| `feedback_eingang` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Feedbacktoken-/Kunden-/Mandantenkette |
| `feedback_mail` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Versand- und Kundenowner, Consent, Receipt |
| `kampagne` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Marketingowner und Kanal/Segment-Bezug |
| `kanal` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Provider-Secret- und Mandantenmodell |
| `lern_metrik` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Messquelle, Personenschutz und Retention |
| `marketing_asset` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Assetowner, Storagepfad und Consent |
| `segment` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Kunden-/Einwilligungsquelle und Marketingrolle |
| `statistik_kennzahl` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Kennzahlenformel, Scope und Evidenz |
| `telemetrie_event` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Developer-Telemetrie, Consent, Pseudonymisierung und Retention |
| `touchpoint` | kein belegter Tenantpfad | `GATE_OWNER_MAPPING_REQUIRED` | Attribution-/Kanal-/Kundenkettenvertrag |

Die erste Gruppe darf nicht vorschnell aktiviert werden: eine `tenant_id`
beweist weder den Actor noch die Rolle noch ein korrekt gesetztes
Request-Tenant-Setting. Die zweite Gruppe wird nicht mit einer neuen Spalte
oder einem geratenen Join „repariert“.

## Offene immer-wahre Policies: Einzelentscheidungen

Der Snapshot enthält 54 technisch immer-wahre Policyzeilen. 25 davon sind
`service_role`-only und erhalten je Snapshot-Zeile die Entscheidung
`PRIVATE_SERVER_ONLY_PENDING_OWNER_PROOF`: kein `anon`-/`authenticated`-Grant,
keine Browser-Transport-Reaktivierung und kein W3-Cutover ohne passenden
Server-Receipt-Test. Die 29 von Advisors als offen bewerteten Policies erhalten
folgende Einzelentscheidung:

| Relation | Policy | Entscheidung |
| --- | --- | --- |
| `audit_log` | `Allow full access to audit_log` | `REPLACE_AFTER_W1_WITH_ACTOR_TENANT_RECEIPT` |
| `beleg` | `beleg_all` | `GATE_FINANCE_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `beleg_position` | `beleg_position_all` | `GATE_FINANCE_AND_DERIVE_FROM_BELEG` |
| `bh_audit_log` | `bh_audit_log_insert`, `bh_audit_log_select` | `GATE_FINANCE_AND_REPLACE_WITH_ACTOR_TENANT_POLICY` |
| `bh_einstellungen` | `bh_einstellungen_all` | `GATE_FINANCE_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `calendar_events` | `allow_all_calendar_events` | `GATE_CALENDAR_AND_REPLACE_WITH_OWNER_POLICY` |
| `communication_drafts` | `Enable all for authenticated users` | `GATE_COMMUNICATION_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `email_templates` | `email_templates_all` | `GATE_COMMUNICATION_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `export_lauf` | `export_lauf_all` | `GATE_EXPORT_AND_REPLACE_WITH_ACTOR_TENANT_POLICY` |
| `feature_flags` | `Allow full access to feature_flags` | `PRIVATE_ADMIN_ONLY_OR_DROP_AFTER_W4` |
| `import_job_rows` | `Allow full access to import_job_rows` | `GATE_IMPORT_AND_DERIVE_FROM_IMPORT_JOB` |
| `import_jobs` | `Allow full access to import_jobs` | `GATE_IMPORT_AND_REPLACE_WITH_ACTOR_TENANT_POLICY` |
| `inquiries` | `auth_all_inquiries`, `public_all_inquiries_final` | `GATE_INQUIRIES_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `items` | `public_all_items_final` | `GATE_ITEM_MUTATION_AND_REPLACE_WITH_ORDER_TENANT_POLICY` |
| `kategorie` | `kategorie_all` | `GATE_FINANCE_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `kostenposten` | `Allow all actions for public` | `GATE_FINANCE_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `kraftstoff_detail` | `kraftstoff_detail_all` | `GATE_FINANCE_AND_DERIVE_FROM_BELEG` |
| `kvp_items` | `Enable all for public on kvp_items` | `GATE_KVP_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `lieferant` | `lieferant_all` | `GATE_FINANCE_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `offline_outbox` | `Enable all for authenticated users` | `KEEP_GATED; DESIGN_RECEIPT_RECOVERY_BEFORE_POLICY` |
| `order_cost_positions` | `Enable all for authenticated users` | `GATE_FINANCE_AND_DERIVE_FROM_ORDER` |
| `orders` | `public_all_orders_final` | `REPLACE_WITH_TENANT_ROLE_POLICY_BEFORE_RELEASE` |
| `payments` | `payments_all` | `GATE_PAYMENT_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `price_lines` | `price_lines_all` | `GATE_PRICE_AND_DERIVE_FROM_ORDER_OR_AGREEMENT` |
| `steuerprofil` | `Allow all actions for public`, `steuerprofil_all` | `GATE_FINANCE_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `ustva_periode` | `ustva_periode_all` | `GATE_FINANCE_AND_REPLACE_WITH_TENANT_ROLE_POLICY` |
| `zahlung` | `Allow all actions for public` | `GATE_FINANCE_AND_DERIVE_FROM_INVOICE` |

`orders` und `items` haben daher trotz vorhandener RLS-Flag aktuell keinen
beweisbaren DB-Schutz. Der Browserzugriff wurde lokal entfernt; das ist nur
eine App-Grenze und keine Entwarnung für die Datenbank.

## RLS aktiv, aber ohne Policy

`ai_usage_reservations`, `app_usage_events`, `app_users`,
`developer_feedback`, `item_photo_jobs`, `item_photos`, `locations`,
`operator_control_events`, `security_rate_limit_counters`,
`stock_movements`, `tenant_operator_controls` erhalten jeweils die Entscheidung
`SERVER_ONLY_PENDING_EXPLICIT_POLICY`. Besonders `app_users` ist Teil des
aktiven serverseitigen Berechtigungsresolvers; ein späterer RLS-Cutover braucht
deshalb erst einen getesteten, authentisierten Selektionspfad oder eine
bewusst private Serververbindung. Keine Policy wird aus dem aktuellen
Fehlerzustand geraten.

## View-Entscheidung: `public.v_auftrag_db`

| Befund | Entscheidung | Beweis vor Cutover |
| --- | --- | --- |
| Security-Definer; keine `security_invoker`-Reloption; SELECT für `anon`, `authenticated`, `service_role`; feste Tenant-Literale | `GATE_AND_REBUILD_WITH_EXPLICIT_INVOKER_AND_TENANT_CONTRACT` | vollständige Quellenmatrix, invoker/owner-Entscheidung, Grants, positive sowie anon/authenticated/cross-tenant-negative Tests |

Die lokale Controlling-Viewdatei ist nur historische Quellinformation. Sie
beweist nicht, dass die gleichnamige Remote-View aktuell dieselbe Definition
hat. Kein Analyse-, Cockpit- oder Finanzpfad darf sie vorher wieder öffnen.

## Storage-Entscheidungen

| Bucket | Remote-Ist | Entscheidung |
| --- | --- | --- |
| `belege` | öffentlich, 5 MB, PNG/JPEG/PDF | `GATE_AND_DECIDE_PRIVATE_OWNER_MODEL` |
| `buchhaltung-belege` | privat, keine belegte Größen-/MIME-Grenze | `GATE_FINANCE_STORAGE_CONTRACT` |
| `item-photos` | privat, keine belegte Größen-/MIME-Grenze | `GATE_ITEM_STORAGE_CONTRACT` |
| `scans` | privat; Objektpolicies prüfen `app_users`, `auth.uid()` und Tenant-Pfadsegment, keine Delete-Policy | `GATE_CAPTURE_UNTIL_PATH_RECEIPT_AND_NEGATIVE_TESTS` |

Für jeden Bucket sind spätere Tests erforderlich: anonym verweigert,
falscher Tenant verweigert, falscher Actor verweigert, erlaubter Actor liest
nur den eigenen Pfad, Upload-MIME/Größe wird erzwungen, signierte URL und
Delete-Verhalten sind explizit belegt.

## Pflichtbeweise vor einer W3-Welle

1. Isoliertes Labor ohne Produktzeilen und ein einziger kanonischer
   Migrationsrunner.
2. Pro Relation exakt manifestierte DDL/Policy-/Grant-Diff samt Hash,
   Forward-Fix und erwarteten Invarianten.
3. Positive und negative Tests für `anon`, `authenticated`, jeden relevanten
   App-Actor und einen fremden Tenant.
4. Serveraktion → Mutation → Audit/Receipt → Readback → Reload → Retry-
   Nachweis für jede später aktivierte Fachfunktion.
5. Nach Run: Ledger, Schemafingerprint, RLS/Policy/Grant-Katalog,
   Viewoptionen, Storagepolicies und Advisors erneut lesen.
6. Erst danach eine gebündelte, explizite Produktfreigabe ausschließlich für
   die gehashten W3-Migrationen.

Bis dahin bleibt jede nicht vollständig bewiesene Fachfläche server- und
oberflächenseitig fail-closed.
