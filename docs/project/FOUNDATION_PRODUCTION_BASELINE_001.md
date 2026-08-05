# FOUNDATION_PRODUCTION_BASELINE_001

Stand: 2026-08-05

Dieses Dokument belegt die Herkunft und Abgrenzung der schema-only Baseline.
Es behauptet weder eine Anwendung in Production noch einen abgeschlossenen
Production-Ledger-Abgleich.

## Quelle und Export

- Supabase-Projekt: `syhaigjhsbpjmtnggqka`
- Production-Status beim Export: `ACTIVE_HEALTHY`
- Production-Postgres: `17.6.1.121`
- CLI: Supabase `2.111.0`
- Zugriff: read-only; kein `db push`, `db reset --linked`,
  `migration repair`, `apply_migration`, Dashboard-SQL oder Remote-DDL/DML

| Temp-Artefakt | Bytes | SHA-256 | Zweck |
|---|---:|---|---|
| `production-public-schema.sql` | 214981 | `e40ebd39d504a9e5fbefda95e06fb8790373ef5113c6ae61ba7586e5dc56fd01` | erster Public-Scope-Check |
| `production-schema.sql` | 229376 | `cd4b69f4102504905dffdf2d013199e04991226dbe1ec97908c57efb4028cd4e` | vollständiger CLI-Schema-Dump für die Baseline |
| `production-storage-schema.sql` | 50216 | `96eb60645705a0ff1f00f8537243c5c7dc360f804424cdea7c675399e9209226` | Extraktion der vier app-eigenen Storage-Policies |

Die Temp-Artefakte liegen außerhalb des Repositorys unter
`C:\tmp\foundation_production_baseline_001_20260805`.

## Dump-Prüfung

Der vollständige Dump enthält:

- 95 Tabellen einschließlich `drizzle.__drizzle_migrations`
- 1 Sequenz im `drizzle`-Schema und 0 Public-Sequenzen
- 17 Views und 0 Materialized Views
- 21 nicht extension-eigene Funktionen
- 7 fachliche Trigger
- 68 RLS-Aktivierungen und 67 Public-Policies
- 280 Grants und 6 Default-Privilege-Anweisungen
- die Schemas `public`, `private` und `drizzle`
- die benötigten Extensions `pg_stat_statements`, `pg_trgm`, `pgcrypto`,
  `supabase_vault` und `uuid-ossp`

Der Dump enthält keine `COPY`-Zeile und nach Beginn der Tabellen-DDL keine
top-level `INSERT`-, `UPDATE`- oder `DELETE`-Anweisung. DML-Schlüsselwörter vor
der Tabellen-DDL gehören ausschließlich zu Funktionskörpern. Die Prüfung fand
keine Connection-Strings, JWTs, Supabase-Secret-/Publishable-Key-Werte oder
anderen Secret-Werte.

## Reproduzierbarkeitsanpassungen

Aus dem vollständigen Dump wurde keine Owner-, Grant-, Default-Privilege-,
RLS-, Policy-, Extension-, Funktions- oder `search_path`-Anweisung entfernt.
Alle ursprünglichen Dump-Anweisungen bleiben unverändert erhalten. Ergänzt
wurden der Provenienzkommentar und vor der Objekterzeugung drei
`ALTER DEFAULT PRIVILEGES ... REVOKE`-Anweisungen. Sie neutralisieren nur die
breiteren `anon`-/`authenticated`-/`service_role`-Defaults des lokalen
Supabase-Images. Die expliziten Grants des Dumps und seine abschließenden sechs
Default-Privilege-Anweisungen stellen anschließend den read-only verifizierten
Production-ACL-Vertrag wieder her.

Für `git diff --check` wurden ausschließlich nachlaufende Leerzeichen und
zusätzliche Leerzeilen am Dateiende entfernt. SQL-Tokens und Semantik des Dumps
blieben dabei unverändert.

Die Supabase-CLI schließt das verwaltete `storage`-Schema im vollständigen Dump
aus. Deshalb wurden ausschließlich die vier Production-Policies
`scan_objects_insert_authenticated`, `scan_objects_select_authenticated`,
`scan_objects_service_role_all` und `scan_objects_update_authenticated` auf
`storage.objects` an die Baseline angehängt. Die verwaltete Storage-Schema-DDL
wurde nicht dupliziert.

## Legacy-DML-Prüfung

Alle 98 historischen SQL-Dateien wurden auf `INSERT`, `UPDATE`, `DELETE`,
`COPY` und Storage-Bucket-Konfiguration geprüft. 23 Dateien enthalten
entsprechende Tokens:

| Klassifikation | Legacy-Dateien | Übernahme |
|---|---|---|
| DML ausschließlich in Funktionskörpern | `202606031800_buchhaltung_core.sql`, `20260612000001_trigger_update_vorlagen.sql`, `20260617000002_fn_compute_warnings.sql` | Funktionsdefinitionen stammen aus dem Production-Schema-Dump; keine Zeilen werden kopiert. |
| Gemischte Konfigurations-Updates und Funktions-DML | `20260615000001_energieverteilung.sql` | Aktuelle Funktion stammt aus dem Dump; historische Zeilenupdates werden nicht übernommen. |
| Statische Seeds/Referenzwerte | `20260609000006_seed_kostenstellen.sql`, `20260609000007_seed_konten.sql`, `20260609000008_seed_periode_aktuelle.sql`, `20260610000000_customers_kundenkarte.sql`, `20260611000002_seed_teile_klassifikator.sql` | Nicht für den Schema-Replay erforderlich; keine Production- oder historische Fachzeile wird kopiert. |
| Storage-Bucket-Konfiguration | `20260611114327_create_storage_buckets.sql` | Nicht die historische Teilmenge, sondern die vier aktuell read-only verifizierten Production-Konfigurationen werden separat übernommen. |
| Tenant-, Rollen-, Kunden-, Auftrags-, Zahlungs-, Bad-, Firmen-, Demo- oder PIN-Backfills/-Bereinigung | `0004_fix_hotel_tenant.sql`, `0006_customer_extras.sql`, `20260610090000_add_amount_eur_to_payments.sql`, `20260615235959_mark_verified_legacy_orders.sql`, `20260619000001_fix_energie_anteil_prozent.sql`, `20260619200027_add_tenant_id_to_customers.sql`, `20260619200050_rls_ausgangsrechnung_tenant.sql`, `20260620000001_baths_target_values.sql`, `20260621000000_phase2_migrations.sql`, `20260625000000_cleanup_demo_data.sql`, `20260627000000_app_users_tenant_contract.sql`, `20260627000001_normalize_app_user_office_role.sql`, `20260805071504_hash_legacy_pins.sql` | Vollständig ausgeschlossen; diese Datenmutationen dürfen nicht in eine leere Baseline-DB übertragen werden. |

Die separate Post-Baseline-Migration enthält ausschließlich die vier
nicht-personenbezogenen Bucket-Konfigurationen:

- `belege`: public, 5 MiB, PNG/JPEG/PDF
- `buchhaltung-belege`: private, keine zusätzliche Größen-/MIME-Grenze
- `item-photos`: private, keine zusätzliche Größen-/MIME-Grenze
- `scans`: private, 20 MiB, PDF/HEIC/HEIF/JPEG/PNG/WebP

Storage-Objekte selbst werden nicht kopiert.

## Paritätsvertrag

`scripts/schema-parity-catalog.sql` erzeugt für Production und Local denselben
read-only Katalog-Snapshot. `scripts/check-schema-parity.mjs` verlangt innerhalb
dieses Scopes exakt null unklassifizierte Abweichungen.

Einzeln klassifizierte, erlaubte Ausnahmen:

1. Supabase-intern verwaltete Objekte in `auth`, `realtime`, `storage`,
   `extensions`, `vault`, `graphql`, `graphql_public` und
   `supabase_migrations`; app-eigene Storage-Policies und Bucket-Konfiguration
   bleiben ausdrücklich im Vergleich.
2. Reine Owner-Metadaten ohne Vertragswirkung; effektive Relation-/Funktions-
   Grants sowie schema-gebundene und globale Default Privileges bleiben
   ausdrücklich im Vergleich.
3. Production-Nutzdaten, Auth-Nutzer und Storage-Objekte; sie sind absichtlich
   nicht Bestandteil eines Schema-Katalogvergleichs.
4. Extension-eigene interne Funktionen; stattdessen werden Name, Version und
   Installationsschema jeder benötigten Extension verglichen.

Der Vergleich lässt keine Objektabweichung zu. Er lässt lediglich zwei Formen
versionsabhängiger, nicht semantischer Katalogdarstellung außer Betracht:

- physische `pg_attribute.attnum`-Positionen, weil gelöschte Production-Spalten
  Lücken hinterlassen; Spaltenname, Typ, Nullbarkeit, Default, Identity,
  Generation und Collation werden weiterhin vollständig verglichen;
- ausschließlich redundante `character varying`-zu-`text`- und
  `text[]`-Deparser-Casts in Definitionen. Andere Typ- und Definitionsänderungen
  bleiben Unterschiede;
- nachlaufende horizontale Leerzeichen und zusätzliche Leerzeilen am Ende von
  Definitionstexten, da sie keine SQL-Tokens verändern.

Jede weitere Abweichung ist unklassifiziert und führt zu `FAIL`.

## Ledger-Abgrenzung

- Historisches Production-Ledger: 96 Einträge, unverändert archiviert.
- Legacy-SQL-Dateien: 98.
- Hashverifizierte Legacy-Artefakte: 100.
- Aktive Kette: genau eine Baseline plus eine Post-Baseline-Konfiguration.
- `PRODUCTION_BASELINE_APPLIED=NOT_ASSERTED`
- `PRODUCTION_LEDGER_RECONCILIATION=OPEN`
- `REMOTE_LEDGER_MUTATION=NOT_PERFORMED`
