# W3 Order Station Transition Evidence

```yaml
BASE: 465f8967a0bd55baf3cbd2d496cbb6dc7bcbefe6
W3_03B_BASE: 2b8073612930329f1d3ccb5a8d28165eda6dfe66
SCOPE: wareneingang-to-galvanik-only
COMMAND_RESULT: OK | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION_ERROR | UNAVAILABLE
READBACK: fresh tenant-bound Wareneingang and Galvanik reads; source absence plus target presence and version increment
READ_CAPABILITY: perm_view_leitstand
COMMAND_CAPABILITY: perm_op_status
LOCAL_DB_REPLAY: PASS_LOCAL
LOCAL_REPLAY_AT_UTC: 2026-08-11T14:49:17.3055828Z
SUPABASE_CLI: 2.111.0
POSTGRESQL: 17.6
LOCAL_LEDGER: 10 migrations; 20260805180624..20260811150000
LOCAL_DB_ROLE: postgres; rolsuper=false; rolbypassrls=true; row_security=on
LOCAL_INTEGRATION_BASE: 1 file; 7 tests PASS at W3_03B_BASE
W3_03B_FOCUSED_TESTS: 2 files; 20 tests PASS after final Customer tenant predicate
UNIT_SUITE_BASE: 79 files; 407 tests PASS at W3_03B_BASE
TYPECHECK_BASE: PASS at W3_03B_BASE
EXACT_ESLINT_BASE: PASS at W3_03B_BASE
W3_03B_TYPECHECK: PASS after final Customer tenant predicate; tsc --noEmit --incremental false
W3_03B_EXACT_ESLINT: PASS after final Customer tenant predicate; 3 TS/test paths
W3_03B_DIFF_CHECK: PASS after final Customer tenant predicate
W3_03B_SECURITY_REVIEW_BASE: PASS before final Customer tenant predicate
W4_PENDING: Events, Evidence, Attachments, versionierte SQL-Read-Models
REMOTE_PRODUCTION: BLOCKED_EXTERNAL_PERMISSION
```

## Lieferumfang

- Einziger aktivierter Command: `wareneingang -> galvanik` mit Session, Tenant,
  Capability, Ownership, Item-Lock und `expectedVersion`.
- Der Command sperrt den referenzierten Customer tenantgebunden `FOR SHARE` und
  verwirft fehlende oder fremdmandantige Customer-Zuordnungen vor jedem Write.
  Danach sperrt der Item-Lock alle verknüpften Items ohne Tenant-/Customer-Vorfilter
  und validiert Tenant, exakte Order-Customer-Zuordnung und Quellstation. Der
  Legacy-Stationswriter bleibt unmittelbar `NOT_AVAILABLE`.
- Die UI meldet Erfolg erst nach zwei frischen autorisierten Reads: Auftrag nicht
  mehr im Wareneingang und als `ready` mit inkrementierter Version in Galvanik.
- Nicht bestätigte oder fehlgeschlagene Readbacks melden keinen Erfolg und sperren
  den Retry dieser Browser-Sitzung.
- Stations-Read ist für `readonly` und `buero` ausschließlich tenantgebunden und
  read-only mit `perm_view_leitstand`; er verwendet weder Service-Role noch Mutation.
- Der negative Rollen-/Capability-Test belegt, dass `readonly` und `buero` mit
  `perm_view_leitstand` keinen Command erlauben und vor Öffnung einer Transaktion
  `FORBIDDEN` liefern. Der adversariale
  Tenanttest belegt, dass ein eingeschleustes `tenant-b`-Argument ignoriert und
  ausschließlich der aufgelöste Authorization-Snapshot für `tenant-a` verwendet wird.
- Stations-Start und -Abschluss sowie alle übrigen Legacy-Writer bleiben bewusst
  nicht verfügbar.

## Lokaler Replay- und Integrationsnachweis

- Der isolierte Supabase-Stack wurde mit der gepinnten CLI `2.111.0` und nur
  PostgreSQL, GoTrue, Storage, Kong und PostgREST gestartet. Der anschließende
  `db reset --local --no-seed` spielte alle zehn getrackten Migrationen von Null
  bis `20260811150000_w3_order_station_version.sql` fehlerfrei ein.
- Der Live-Katalog belegt `orders.version integer NOT NULL DEFAULT 1` und den
  validierten Check `orders_version_positive`.
- Der echte Test `src/test/w3_order_station.integration.test.ts` nutzt weder
  einen DB-, Command-, Reader- noch Resolver-Mock. Nur die requestgebundene
  Cookie-Lesefunktion wird am Rand ersetzt; Rollen, Berechtigungen,
  Tenantauflösung, Queries und Transaktionen laufen über die Produktionsmodule.
- `readonly` und `buero` lesen mit `perm_view_leitstand` ausschließlich den
  Session-Tenant und erhalten für den Command `FORBIDDEN` ohne Mutation.
- Fremde Aufträge bleiben `NOT_FOUND`. Fremd- oder NULL-tenantgebundene Items an
  einem eigenen Auftrag liefern `VALIDATION_ERROR`; Auftrag und alle Items
  bleiben unverändert. Der Reader bricht bei beschädigter Customer-/Item-
  Ownership ab, statt fremde IDs oder ein Teilaggregat zurückzugeben.
- W3-03B belegt zusätzlich reale Negativfälle für einen Tenant-A-Auftrag mit
  Tenant-B-Customer sowie Tenant-A-Items mit einem anderen Tenant-A- oder einem
  Tenant-B-Customer. Der Command muss jeweils `VALIDATION_ERROR` liefern, der
  Reader fail-closed abbrechen und der vollständige Aggregate-Snapshot unverändert
  bleiben. `23502` und `23503` grenzen NULL- und nicht existente Customer-IDs von
  den durch einfache FKs weiterhin möglichen falschen Zuordnungen ab.
- Der Happy Path aktualisiert Auftragstriple, Status, Version und sämtliche
  eigenen Items atomar. Frische Reads belegen Quellabwesenheit und
  Zielanwesenheit. Ein stale Retry liefert `CONFLICT`; zwei parallele Version-1-
  Commands ergeben genau einmal `OK` und einmal `CONFLICT` bei Endversion 2.
- Eine echte absichtlich geworfene Transaktion belegt den vollständigen Rollback
  nach Order- und Item-Update. Die Eventmenge bleibt unverändert; Event- und
  Receipt-Wahrheit werden erst in W4 ergänzt.
- Am W3-03B-Baseline-HEAD waren fokussierte Units `16/16`, Integration `7/7`,
  TypeScript, exaktes ESLint sowie die gesamte Unit-Suite `407/407` grün. Die
  aktualisierten W3-03B-Units und Integrationstests liefen nach dem finalen
  Customer-Tenant-Prädikat gemeinsam mit `20/20` grün. Auch
  `tsc --noEmit --incremental false`, exaktes ESLint der drei betroffenen
  TS-/Testpfade und `git diff --check` sind für diesen finalen Tenant-Lock `PASS`.
  Der unabhängige Security Review bleibt getrennt als PASS des vorherigen
  Vorzustands ausgewiesen.
  Die Unit-Gesamtsuite `407/407` bleibt ausschließlich separat ausgewiesene
  Baseline-Evidenz und wurde für W3-03B nicht erneut ausgeführt.

## Nachweisgrenze

Die Migration bleibt ein lokaler Kandidat. Die lokale Verbindung lief als
`postgres` mit `rolbypassrls=true`; sie belegt daher Anwendungspredikate,
Ownership und Transaktionsatomarität, aber ausdrücklich weder RLS noch einen
Least-Privilege-Runtime-DB-Rollenvertrag. Dieser Nachweis behauptet keine
Remote-Migration, keine Production-Prüfung und keinen F0-PASS. W4 schließt
Events, Evidence, Attachments und versionierte SQL-Read-Models Ende-zu-Ende.
