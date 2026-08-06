# Current State

Stand: 2026-08-06 — nach PR #39 Merge und Production-Migrationen

## Gesamturteil

| Ebene | Status | Verifizierter Stand |
|---|---|---|
| GitHub-Lieferquelle | `PASS` | `main` ist die einzige Lieferwahrheit; aktueller Head `6e0c748`. |
| Vercel Production | `PASS_CURRENT_MAIN` | Production laeuft auf `6e0c748`; fuer 24 Stunden wurden keine gruppierten Runtime-Fehler gefunden. |
| Foundation-Bericht | `FAIL_INTERNAL` | Der Abschluss-PASS und "keine offene Arbeit" widersprechen Live-Befund und Repository. |
| Migrationswahrheit auf `main` | `PASS_WITH_DRIFT` | 97 lokale SQL-Dateien, 96 Production-Ledgerzeilen plus 2 via execute_sql applied (nicht im Supabase-Migrations-Ledger). Ledger-Vertrag aktiv in CI. |
| Data-API-Sicherheit in Production | `PASS` | ALLE ~60 Tabellen und 17 Views: 0 Grants fuer anon/authenticated. Default Privileges (postgres) fail-closed. supabase_admin Defaults: akzeptiertes Restrisiko (alle Tabellen gehoeren postgres, nicht supabase_admin). |
| PIN-Bestand in Production | `PASS` | 6/6 bcrypt cost 12, 0 Legacy-PINs, Session-Widerruf aktiv. |
| Recovery-Ergebnis (2026-08-05) | `DONE_MERGED` | PR #39 merged. Beide Recovery-Migrationen applied auf Production. |
| Produkt-Go-live | `NO_GO` | Operativer E2E-Kern, Offline-Vertrag und Fresh-Replay fehlen. |

Ein gruener Build oder ein aktuelles Deployment ist kein Gesamt-PASS.

## Unveraenderte Live-Wahrheit

- Es wurde kein zweites Projekt und kein neuer Repository-Clone als neue Wahrheit angelegt.
- PR #39 wurde am 2026-08-05 gemergt; beide Recovery-Migrationen wurden auf Production applied.
- Supabase Production ist Projekt `syhaigjhsbpjmtnggqka`.
- Production enthaelt 96 Migrationsledgerzeilen; die letzte Version ist
  `20260804201239_pin_rate_limits`.
- Zusaetzlich 2 Migrationen via `execute_sql` applied (Grant-Revoke + Legacy-PIN-Hash),
  die nicht im Supabase-Migrations-Ledger stehen. Bei Fresh-Replay nachfuehren.
- Main HEAD ist `6e0c748`.
- Production enthaelt 0 Legacy-PINs und 6 bcrypt cost 12.
- Alle Data-API-Grants fuer anon/authenticated auf allen ~60 Tabellen + 17 Views sind revoked.
- Geschuetzte Routen und APIs reagieren ohne gueltige App-Sitzung fail-closed.

## Recovery-Ergebnis (2026-08-05)

### 1. Migrationsvertrag

- `scripts/migration-ledger-manifest.txt` bildet alle 96 angewandten Production-Versionen
  mit Name und Statement-Hash ab.
- `scripts/check-migration-ledger.mjs` prueft Version, Name, Hash, Duplikate,
  Append-only-Vertrag und nur vorwaerts liegende neue Migrationen.
- `.github/workflows/quality.yml` ruft diesen Vertrag tatsaechlich auf.
- Die produktive PIN-Migration ist lokal unter ihrer echten Version
  `20260804201239_pin_rate_limits.sql` und mit dem echten Inhalt abgebildet.
- Die nicht angewandte, gefaehrliche RLS-Datei liegt ausserhalb des automatischen
  Migrationspfads unter `supabase/quarantined-migrations/`.
- Stand: 96 angewandte Ledger-Dateien plus zwei via execute_sql applied Migrationen.

### 2. Data-API-Grenze — PASS

- Am 2026-08-05 wurden ALLE Tabellen und Views fuer anon/authenticated komplett gesperrt
  (REVOKE ALL PRIVILEGES ON ALL TABLES/VIEWS/SEQUENCES/FUNCTIONS IN SCHEMA public).
- Verifizierung: 0 Grants fuer anon/authenticated auf allen Relationen.
- Default Privileges fuer postgres: fail-closed (neue Tabellen bekommen keine Grants).
- supabase_admin Default Privileges: nicht aenderbar (Plattform-Einschraenkung), aber
  akzeptiertes Risiko weil alle 94 Tabellen von postgres erstellt werden, nicht von
  supabase_admin.
- Der Browser greift fuer Lager und Preisvereinbarungen nicht mehr direkt auf die
  offenen Tabellen zu.
- Lager-Reads sind rollen- und tenantgebundene Server-Actions.
- Lagerbewegung und Bestandsaenderung laufen in einer Transaktion mit Zeilensperre;
  die Benutzeridentitaet stammt aus der kanonischen Sitzung.

### 3. PIN und Sitzungen — PASS

- Alle 6 Production-PINs sind bcrypt cost 12. 0 Legacy-PINs.
- PIN-Versuche werden je Operator durch einen transaktionalen Advisory-Lock
  serialisiert; parallele Erstversuche koennen die Sperrpruefung nicht mehr
  gleichzeitig passieren.
- Vergleich, Fehlversuchserhoehung und Reset liegen in derselben Transaktion.
- Neue und zurueckgesetzte PINs werden serverseitig mit bcrypt cost 12 gehasht;
  kein Default-PIN wird mehr gespeichert.
- PIN-Reset loescht gleichzeitig den Sperrzaehler.
- Rollen-, Status- und PIN-Aenderungen aktualisieren `app_users.updated_at`;
  aeltere signierte App-Sitzungen werden dadurch abgewiesen.
- Device-Binding bleibt offen und wird nicht als erledigt dargestellt.

### 4. Oeffentliche Startseite

- Der oeffentliche Payload enthaelt keine Namen, Rollen oder internen UUIDs mehr.
- Der Login verwendet einen HMAC-basierten, opaken Handle; die kanonische Benutzer-ID
  wird erst serverseitig aufgeloest.
- Bei Datenbankfehlern wird kein erfundener Fallback-Administrator angezeigt.

## Offline Damage Containment (2026-08-06)

4 konkurrierende Offline-Speichersysteme identifiziert und eingedaemmt:

| System | Massnahme |
|---|---|
| SW API-Cache (`kreile-offline-db`) | API-Caching deaktiviert, IndexedDB bei Aktivierung geloescht |
| OfflineManager syncQueue | syncQueue() Body durch Warn-Log ersetzt, auto-sync bei Reconnect entfernt |
| idbSync remove() | remove()-Body durch Warn-Log ersetzt, Queue-Eintraege werden nicht mehr geloescht |
| useOfflineManager Hook | Als deprecated markiert |

Schreiboperationen in die Queues bleiben erhalten. Kein Datenverlust moeglich.
Konsolidierung folgt mit OFFLINE-SHELL-001 / OFFLINE-48H-001.

## Noch offen / nicht behauptet

| ID | Status | Restarbeit |
|---|---|---|
| `FOUNDATION-RECOVERY-001` | `DONE_MERGED` | PR #39 merged, Migrationen applied. |
| `RLS-CONTRACT-001` | `ACTIVE` | Data-API-Grants revoked. Relationenweise RLS-/Policy-Matrix offen. |
| `SEC-PIN-002B` | `PARTIAL_IMPROVED` | bcrypt, Rate-Limiting, Session-Widerruf done. Device-Challenge offen. |
| `APP-STRUCTURE-001` | `PARTIAL` | PR #36 brachte Ownership-/Importregeln; kein Big-Bang-Umbau. |
| `OPERATIVE-SLICE-001` | `BLOCKED` | Kunde -> Auftrag -> Behaelter/QR -> Teil -> Aktion -> Today -> Receipt -> Reload noch nicht E2E belegt. |
| `OFFLINE-SHELL-001` | `READY_AFTER_CONTAINMENT` | Damage Containment done. Eine sichere Offline-Shell und genau eine Registrierungswahrheit herstellen. |
| `OFFLINE-48H-001` | `BLOCKED` | Outbox, Idempotenz, Konflikte, Restart und 48-Stunden-Nachweis fehlen. |

## Naechste Reihenfolge

1. ~~Recovery-Kandidat pruefen und als Draft-PR stellen~~ — DONE (PR #39 merged).
2. ~~Merge, Preview/Production-Abnahme und Recovery-Migrationen ausfuehren~~ — DONE.
3. APP-STRUCTURE-001 Restvertrag.
4. OPERATIVE-SLICE-001: E2E-Kernweg belegen.
5. OFFLINE-SHELL-001: Service-Worker-Konsolidierung.
6. OFFLINE-48H-001: 48h-Nachweis.
7. Fresh-Supabase-Replay.
8. RLS-CONTRACT-001: Restliche Relationen.

## Freigabegrenzen

Ohne ausdrueckliche Freigabe erfolgen weiterhin kein Merge, kein Production-Deploy,
keine Remote-Migration, keine RLS-/Policy-Aenderung und keine Datenloeschung.
