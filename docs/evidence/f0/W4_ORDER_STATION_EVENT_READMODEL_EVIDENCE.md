# W4 Order Station Event, Receipt und Read-Model Evidence

```yaml
BASE: 28a165455f59d800d010da4ebe298af9b4167f1d
SCOPE: W4-01; wareneingang-to-galvanik event/receipt/read-model only
SOURCE_STATUS: PASS_LOCAL
RUNTIME_STATUS: PASS_LOCAL
MIGRATION: 20260811154732_w4_order_station_event_readmodels.sql
MIGRATION_CREATED_WITH: Supabase CLI 2.111.0
MIGRATION_EXECUTED: LOCAL_REPLAY_ONLY
LOCAL_DB_RESET: PASS; db reset --local --no-seed; exactly 11 migrations through 20260811154732
LOCAL_INTEGRATION_AT: 2026-08-11 18:48 Europe/Berlin
LOCAL_DATABASE: 127.0.0.1:54322; postgres; rolbypassrls=true; service-role env unset
LOCAL_INTEGRATION: PASS; 1 file; 17 tests
FOCUSED_UNIT_UI: PASS; 3 files; 37 tests
TYPECHECK: PASS; tsc --noEmit --incremental false
EXACT_ESLINT: PASS; 9 paths
FULL_UNIT_SUITE: PASS; 79 files; 417 tests
DIFF_CHECK: PASS
INDEPENDENT_FINAL_REVIEW: REVIEW_PASS; no P0/P1
BUILD: NOT_RUN
REMOTE_PRODUCTION: NOT_RUN
RLS_POLICY_DEFAULT_ACL: NOT_CHANGED
GRANT_REVOKE: NOT_CHANGED
STORAGE_ATTACHMENTS: OUT_OF_SCOPE_W4_01
OVERALL_W4: OPEN
```

## Liefervertrag W4-01

- `events.client_event_id` bleibt die einzige Idempotenzwahrheit. Der Browser
  erzeugt pro beabsichtigtem Auftrag-/Versionswechsel genau eine stabile UUID
  und behält sie nach einem unbestätigten Readback für den sicheren Replay bei.
- Der einzige Command bindet einen Replay exakt an Tenant, Actor, Auftrag,
  Eventtyp, Client-Event-ID, erwartete Aggregate-Version, Quell- und Zielstation.
  Eine abweichende Bindung liefert `CONFLICT` und wird nicht als Erfolg behandelt.
- Genau ein namensgebundener Advisory-Mutex serialisiert dieselbe
  `tenant_id/client_event_id`-Kombination. Verschiedene Client-Event-IDs werden
  zusätzlich durch den bestehenden Auftragssperr- und Versionsvertrag
  serialisiert.
- Auftrag, Items und das verpflichtende `ORDER_STATION_MOVED_V1`-Event werden in
  derselben Transaktion geschrieben. Ein fehlgeschlagener oder leer
  zurückgelesener Event-Insert wirft und rollt alle Aggregate-Änderungen zurück.
- `private.v_order_station_receipts_v1` ist ein `security_invoker`-Port mit
  explizitem v1-Filter, nichtleerem Tenant-GUC sowie vollständiger
  Actor-/Order-/Customer-/Item-Tenant-Schließung. Historische gleichnamige, aber
  unvollständige Events werden nicht als v1-Receipt projiziert.
- `private.v_operational_station_queue_v1` ist der tenantgebundene
  `security_invoker`-Read-Port. Ein `NOT EXISTS`-Integritätsguard verhindert die
  Projektion eines Teilaggregats oder fremder Item-Daten.
- Die Oberfläche bestätigt Erfolg erst nach separaten frischen Reads der
  Quellstation, Zielstation und des persistenten Receipts. Fehlendes, fremdes
  oder nicht exakt passendes Receipt löst keinen Success-Callback aus.
- W4-Events sind über drei getrennte Trigger unveränderlich: UPDATE prüft OLD
  und NEW, DELETE prüft OLD, TRUNCATE wird statementweit blockiert. Die Trigger
  verwenden ausschließlich die bereits vorhandene, ACL-gehärtete
  `public.prevent_audit_mutation()`; W4-01 erzeugt keine Funktion und ändert
  keine Objektberechtigung.

## Ausgeführte lokale Gates

| Gate | Lokaler Nachweis |
|---|---|
| Frischer Replay | `PASS_LOCAL`: gepinnte Supabase CLI `2.111.0`, `db reset --local --no-seed`, exakt 11 Migrationen bis `20260811154732` |
| Echte Integration | `PASS_LOCAL`: lokale PostgreSQL-Verbindung `127.0.0.1:54322`, Service-Role-Umgebung leer, 1 Datei / 17 Tests |
| Schema/Katalog | `PASS_LOCAL`: fünf Eventfelder, zwei private `security_invoker`-Views, drei aktive nichtinterne Trigger mit der bestehenden Guard-Funktion |
| ACL | `PASS_LOCAL`: Views ohne SELECT für PUBLIC/anon/authenticated/service_role; Guard ohne EXECUTE für PUBLIC/anon/authenticated, mit EXECUTE für postgres/service_role, `SECURITY INVOKER`, Returntyp `trigger` |
| Replay | `PASS_LOCAL`: gleiche Client-Event-ID im selben Tenant ergibt einen Write plus exakt gebundenen Replay; gleiche ID ist zwischen zwei DB-Tenants getrennt; verschiedene IDs bei Version 1 ergeben ein `OK`, ein `CONFLICT`, ein Event |
| Rollback | `PASS_LOCAL`: Event-Insert-Fehler lässt Auftrag, Items und Eventmenge unverändert; nullable Vertragsverletzungen liefern `23514` und hinterlassen keine Zeile |
| Immutabilität | `PASS_LOCAL`: W4→W4, W4→Legacy, Legacy→W4, DELETE und TRUNCATE scheitern mit `P0001`; Snapshots bleiben identisch; Legacy-Update/Delete bleibt als Kontrollgruppe möglich |
| Tenant | `PASS_LOCAL`: kein/leerer Tenant-GUC liefert keine Zeilen; Cross-Tenant-Receipt-Paare bleiben unsichtbar; Tenant-B-App-Session ist `UNAUTHENTICATED` und mutationsfrei; korrupte Customer-/Item-Zuordnung bleibt fail-closed |
| Readback/UI | `PASS_LOCAL`: Erfolg nur bei korrekter Source-/Target-Lage und separat persistent bestätigtem Receipt; Null-/Fremd-/Mismatch-Receipt ohne Erfolg |
| Fokussierte Units/UI | `PASS`: 3 Dateien / 37 Tests |
| Quellqualität | `PASS`: TypeScript mit `--incremental false`, exaktes ESLint für 9 Pfade und `git diff --check` |
| Gesamte Unit-Suite | `PASS`: 79 Dateien / 417 Tests |
| Unabhängiger Abschlussreview | `REVIEW_PASS`: kein P0/P1 |

Die Runtime-Gates liefen am 11. August 2026 um 18:48 Uhr Europe/Berlin auf dem
unveränderten Basis-HEAD `28a165455f59d800d010da4ebe298af9b4167f1d`.
Ein Anwendungs-Build wurde nicht ausgeführt und wird hier nicht behauptet.

## W4-Berichtsstatus

| Status | Kernpfad | Grenze |
|---|---|---|
| wieder aktiv / W4-01 gehärtet | tenantgebundener Read für Wareneingang und Galvanik; atomarer Command `wareneingang -> galvanik`; persistenter Receipt-Readback | durch Replay, Integration, Units/UI, TypeScript, ESLint, Gesamtsuite und Review lokal belegt |
| weiterhin bewusst quarantänisiert | alle übrigen Stationsübergänge und Legacy-Writer; Offline-/Realtime-Senden; Evidence-/Attachment-/Storage-Pfade | eigener W3-/W4-Vertrag erforderlich; W4-01 reaktiviert sie nicht |
| externer Blocker | Remote-/Production-Migration, Production-ACL/RLS-Parität, Deployment/Preview | ausdrückliche Owner-Freigabe und getrennte Remote-Evidence erforderlich |

W4 ist mit W4-01 nicht abgeschlossen. Attachments/Evidence/Storage sowie deren
Ende-zu-Ende-Nachweise bleiben in einem getrennten, ausdrücklich freigegebenen
W4-Paket offen. Es gab keine Remote-, Production-, RLS-, Policy-, Grant-,
Default-ACL-, Storage-, Deployment- oder Merge-Aktion.

Die lokale Integration lief als `postgres` mit `rolbypassrls=true`. Sie belegt
Anwendungspredikate, Tenant-GUC-Filter, Transaktionen, Replay, Read-Models und
Katalogverträge, aber ausdrücklich weder Production-RLS noch einen
Least-Privilege-Runtime-DB-Rollenvertrag. Remote- und Production-Nachweise
bleiben getrennt und wurden nicht ausgeführt.
