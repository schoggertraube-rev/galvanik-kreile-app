# Current State

Stand: 2026-08-05 — verifizierter Recovery-Kandidat, noch nicht gemergt oder deployed

## Gesamturteil

| Ebene | Status | Verifizierter Stand |
|---|---|---|
| GitHub-Lieferquelle | `PASS` | `main` ist die einzige Lieferwahrheit; aktueller Head `eb5f1c40d582a16eadeda90bec808c6e92aeb5fa`. |
| Vercel Production | `PASS_CURRENT_MAIN` | Production laeuft auf `eb5f1c40...`; fuer 24 Stunden wurden keine gruppierten Runtime-Fehler gefunden. |
| Foundation-Bericht | `FAIL_INTERNAL` | Der Abschluss-PASS und „keine offene Arbeit“ widersprechen Live-Befund und Repository. |
| Migrationswahrheit auf `main` | `FAIL` | 97 lokale SQL-Dateien, 96 Production-Ledgerzeilen; Versionen drifteten und der vorhandene Check lief nicht in CI. |
| Data-API-Sicherheit in Production | `NO_GO` | 26 Tabellen ohne RLS erlauben `anon` und `authenticated` jeweils SELECT, INSERT, UPDATE und DELETE. |
| PIN-Bestand in Production | `NO_GO` | 0 bcrypt-Hashes, 6 Legacy-PINs im vierstelligen Altformat. |
| Recovery-Kandidat | `PASS_LOCAL_PENDING_REVIEW` | Exakter Ledgervertrag, Grant-Entzug, PIN-Bestandsmigration und Codekorrekturen liegen nur im isolierten Branch. |
| Produkt-Go-live | `NO_GO` | Recovery-Migrationen, operativer E2E-Kern, Offline-Vertrag und Fresh-Replay sind nicht produktiv abgenommen. |

Ein gruener Build oder ein aktuelles Deployment ist kein Gesamt-PASS.

## Unveraenderte Live-Wahrheit

- Es wurde kein zweites Projekt und kein neuer Repository-Clone als neue Wahrheit angelegt.
- Es gab keinen Merge, kein Production-Deployment und keine Remote-Supabase-Migration.
- Supabase Production ist Projekt `syhaigjhsbpjmtnggqka`.
- Production enthaelt 96 Migrationsledgerzeilen; die letzte Version ist
  `20260804201239_pin_rate_limits`.
- Die produktive PIN-Tabelle existiert, RLS ist aktiviert und der Tenant-Index ist vorhanden.
- Geschuetzte Routen und APIs reagieren ohne gueltige App-Sitzung fail-closed.

## Recovery-Kandidat: exakt gefuellte Luecken

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
- Kandidatenstand: 96 angewandte Dateien plus zwei klar ausgewiesene, spaetere
  Recovery-Migrationen.

### 2. Data-API-Grenze

- Der Browser greift fuer Lager und Preisvereinbarungen nicht mehr direkt auf die
  offenen Tabellen zu.
- Lager-Reads sind rollen- und tenantgebundene Server-Actions.
- Lagerbewegung und Bestandsaenderung laufen in einer Transaktion mit Zeilensperre;
  die Benutzeridentitaet stammt aus der kanonischen Sitzung.
- Legitime Serverzugriffe auf die 26 grantlosen Tabellen erzeugen einen
  privilegierten Client erst nach `checkAppAuthorization("read" | "write")` und
  binden tenantfaehige Relationen an den kanonischen Mandanten. Bestehende
  sitzungsgebundene Supabase-Pfade auf anderen Relationen bleiben unveraendert.
- Die ausstehende Migration `20260805070750_revoke_public_data_api_grants.sql`
  entzieht `anon` und `authenticated` auf exakt den 26 live verifizierten Tabellen
  alle Tabellenrechte und setzt fuer kuenftige, von `postgres` angelegte `public`-
  Tabellen denselben fail-closed-Default. Sie aendert keine RLS-Policy.

### 3. PIN und Sitzungen

- PIN-Versuche werden je Operator durch einen transaktionalen Advisory-Lock
  serialisiert; parallele Erstversuche koennen die Sperrpruefung nicht mehr
  gleichzeitig passieren.
- Vergleich, Fehlversuchserhoehung und Reset liegen in derselben Transaktion.
- Neue und zurueckgesetzte PINs werden serverseitig mit bcrypt cost 12 gehasht;
  kein Default-PIN wird mehr gespeichert.
- PIN-Reset loescht gleichzeitig den Sperrzaehler.
- Rollen-, Status- und PIN-Aenderungen aktualisieren `app_users.updated_at`;
  aeltere signierte App-Sitzungen werden dadurch abgewiesen.
- Die ausstehende Migration `20260805071504_hash_legacy_pins.sql` konvertiert die
  sechs vierstelligen Legacy-Werte innerhalb von PostgreSQL und setzt dabei
  `app_users.updated_at`, damit vor der Umstellung ausgestellte Sitzungen
  widerrufen werden. Kein PIN-Wert wird ausgelesen oder in einen Client
  uebertragen.
- Device-Binding bleibt offen und wird nicht als erledigt dargestellt.

### 4. Oeffentliche Startseite

- Der oeffentliche Payload enthaelt keine Namen, Rollen oder internen UUIDs mehr.
- Der Login verwendet einen HMAC-basierten, opaken Handle; die kanonische Benutzer-ID
  wird erst serverseitig aufgeloest.
- Bei Datenbankfehlern wird kein erfundener Fallback-Administrator angezeigt.

## Noch offen / nicht behauptet

| ID | Status | Restarbeit |
|---|---|---|
| `FOUNDATION-RECOVERY-001` | `ACTIVE` | Vollstaendige Gates, Review, Draft-PR und Preview; danach separate Freigabe fuer Merge und Production-Migration. |
| `RLS-CONTRACT-001` | `ACTIVE_AFTER_RECOVERY` | Relationenspezifische Rollen-/Tenant-Matrix und schwache bestehende Policies pruefen. RLS ist nicht „entfallen“. |
| `SEC-PIN-002B` | `PARTIAL` | Device-Binding/Challenge und operativer Production-Postflight bleiben offen. |
| `APP-STRUCTURE-001` | `PARTIAL` | PR #36 brachte Ownership-/Importregeln; kein Big-Bang-Umbau. |
| `OPERATIVE-SLICE-001` | `BLOCKED` | Kunde -> Auftrag -> Behaelter/QR -> Teil -> Aktion -> Today -> Receipt -> Reload noch nicht E2E belegt. |
| `OFFLINE-SHELL-001` | `READY_AFTER_RECOVERY` | Eine sichere Offline-Shell und genau eine Registrierungswahrheit herstellen. |
| `OFFLINE-48H-001` | `BLOCKED` | Outbox, Idempotenz, Konflikte, Restart und 48-Stunden-Nachweis fehlen. |

## Naechste Reihenfolge

1. Recovery-Kandidat vollstaendig pruefen und als Draft-PR zur unabhaengigen Review stellen.
2. Nach ausdruecklicher Freigabe: Merge, Preview/Production-Abnahme und die beiden
   Recovery-Migrationen in kontrollierter Reihenfolge ausfuehren.
3. Postflight: 0 oeffentliche Tabellenrechte auf den 26 Relationen, 6/6 bcrypt,
   negativer anonymer CRUD-Test, legitimer Lager-/Cockpit-/Buchhaltungspfad positiv.
4. Danach den bestehenden Plan fortsetzen: `OFFLINE-SHELL-001`, verbleibender
   Strukturvertrag, `OPERATIVE-SLICE-001`, Receipt/Readback und `OFFLINE-48H-001`.

## Freigabegrenzen

Ohne ausdrueckliche Freigabe erfolgen weiterhin kein Merge, kein Production-Deploy,
keine Remote-Migration, keine RLS-/Policy-Aenderung und keine Datenloeschung.
