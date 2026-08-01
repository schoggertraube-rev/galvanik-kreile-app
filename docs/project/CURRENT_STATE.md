# Current State

Stand: 2026-08-01

Verifiziert gegen GitHub, Vercel, Supabase und einen sauberen lokalen Checkout.

## Gesamturteil

| Vertrag | Status | Beleg |
|---|---|---|
| Lieferquelle | `PASS` | GitHub `main` ist die einzige Code-Lieferwahrheit. |
| Production-Deployment | `PASS` | Vercel Production laeuft auf demselben Commit wie `main`. |
| Lokale Worktree-Hygiene | `PASS_LOCAL` | Alle in diesem Arbeitsbereich sichtbaren App-Worktrees sind sauber und voneinander isoliert. |
| Migrations-/Schemaquelle | `FAIL` | `main` enthaelt 79 Migrationsdateien, Production 92 Ledger-Eintraege, Integration 1. |
| Quality-Ratchet / Lint-Nullstand | `PASS_RATCHET` / `FAIL_ZERO` | 484 Fehler und 460 Warnungen sind ehrlich inventarisiert; Inline-Disable ist wirkungslos, jede Erhoehung und jede nicht verbuchte Reduktion blockiert. |
| Produkt-Go-live | `NO_GO` | RLS, PIN-Grenze, Offline-Vertrag und operativer End-to-End-Kern sind nicht vollstaendig abgenommen. |

Ein gruenes Deployment oder ein gemergter Sicherheitsfix ist deshalb kein Gesamt-PASS.

## Autoritaet der Wahrheiten

| Ebene | Autoritaet | Aktueller Stand | Darf nicht ersetzt werden durch |
|---|---|---|---|
| Code-Lieferung | GitHub `main` | Vor diesem Quality-Kandidaten verifiziert auf `672ee4c5496324303500b46d9a94b2c70a727aa1` | lokale Branches, offene PRs, alte Uebergaben |
| Laufende App | Vercel Production | Deployment `dpl_J3wMBows7eQmPnxNPA8AiLTNSLP7`, `READY`, Commit `672ee4c...` | Preview, lokaler Dev-Server |
| Produktive Datenbank | Supabase Production | Projekt `syhaigjhsbpjmtnggqka`, 92 Ledger-Eintraege | lokale SQL-Dateien, Integration |
| Nichtproduktiver DB-Test | Supabase Integration | Projekt `yroeivcldiphoyfmxuus`, 1 Ledger-Eintrag | Production, Fresh-Replay-Beweis |
| Kandidaten / Quellen | PRs, Remote-Branches, isolierte Worktrees | nur Salvage oder Review | `main`, Production |
| Produktvertrag | Masterplan, Non-Loss-Register und dort kanonisch uebernommene Twin-/Akzeptanzregeln | Akzeptanz- und Roadmapquelle | rohe Twin-/Ideendateien, Mock-Oberflaechen, Dateimenge |

Bei einem Widerspruch wird nicht still eine Ebene bevorzugt. Der Widerspruch wird als eigener Blocker mit Besitzer und Aufloesungsweg dokumentiert.

## GitHub und Vercel

- GitHub Default Branch: `main`.
- Vor diesem Quality-Kandidaten verifizierter `main` und `origin/main`: exakt `672ee4c5496324303500b46d9a94b2c70a727aa1`.
- Vercel-Projekt: `galvanik-kreile-werkstatt`.
- Production-URL: `https://galvanik-kreile-werkstatt.vercel.app`.
- Aktuelles Production-Deployment ist `READY` und nennt exakt denselben GitHub-Commit.
- Der kombinierte GitHub-Status fuer `main` enthaelt aktuell den erfolgreichen Vercel-Status. Die PR-Gates der gemergten PRs 23 und 24 waren vor Merge gruen; das ersetzt keinen Fresh-Replay- oder Gesamtproduktnachweis.

### Branch-Disposition

Vor dem aktuellen Quality-Kandidaten gab es **null offene PRs**. PR `#8`, `#15`, `#19` und `#20` wurden nach Einzelkommentar geschlossen und nicht gemergt. Ihre Quellbranches bleiben als Salvage erhalten; die unveraenderlichen Archivrefs und Inventar-Receipts lauten:

| PR | Archivref | Unique Commits | Dateien | `+` / `-` | Inventar-SHA-256 |
|---|---|---:|---:|---:|---|
| `#8` | `archive/pr-8-auth-identity-002-007b85b` | 3 | 15 | 561 / 219 | `7f408d25ee90ae06f1fa0be0f8dd642bbb74d06c2190ddccb649ef082aa885d2` |
| `#15` | `archive/pr-15-capture-auth-tenant-f0090ab` | 48 | 149 | 13830 / 1915 | `0443d4bd7cae1d1eaba7a4132b1ebe4d90a0f5cba0045b457f2e869af1b70391` |
| `#19` | `archive/pr-19-foundation-security-338a13c` | 11 | 692 | 75509 / 22912 | `5e2bf0b74e4a300c1ed4d36fbc686ba85ed494cbacec7b142b22042de94108f4` |
| `#20` | `archive/pr-20-foundation-consolidation-2589fde` | 12 | 430 | 11041 / 34054 | `9cf75c29c76fac6487558820a8d5dd882d2e4f600cb2926731f94d5f5339e16c` |

Das vollstaendige maschinenlesbare Inventar steht in [`BRANCH_ARCHIVE_RECEIPTS.json`](./BRANCH_ARCHIVE_RECEIPTS.json): geordnete Unique-Commit-SHAs, sortierte `name-status`-Pfade, Base/Head/Archivref, Stats und der exakte kanonische Digest-Vertrag. Der volle Head-SHA und der dedizierte Archivref sichern den Inhalt. Die PR-Schliessung hat keine Quellbranch geloescht.

## Worktree-Audit

Zum Pruefzeitpunkt sind in diesem Arbeitsbereich genau drei App-Worktrees sichtbar:

| Branch | Commit / Basis | Zustand | Zweck |
|---|---|---|---|
| `main` | `672ee4c...` | sauber, exakt `origin/main` | lokale Lieferreferenz |
| `agent/quality-eslint-ratchet` | Basis `672ee4c...` | sauberer, isolierter Kandidat | Quality-Ratchet; nach Merge entfernen |
| `agent/p0-pin-hardening` | lokal `d7d2bd342221e4dbfc08be83f1864230dccd7341`; Remote-Checkpoint `dad42eb83e4dc4617291568631dea23f731febaa` | sauber; lokaler und Remote-Tree exakt `04474f3626b45f465242d17936764b7b0117712c` | `checkpoint/sec-pin-002-no-merge-20260801`, ausdruecklich `NO_MERGE` |

Damit gibt es hier **null uncommittete App-Aenderungen** ausser dem jeweils aktiv bearbeiteten, vor Commit sichtbaren Missionsdiff.

Der frueher erwaehnte Windows-Checkout ist von diesem Arbeitsbereich aus nicht einsehbar. Sein Zustand ist `UNKNOWN_EXTERNAL`, nicht angeblich bereinigt. Er darf nur in genau diesem Checkout inventarisiert und ohne Reset, Stash oder Loeschung aufgeraeumt werden.

## Supabase- und Migrationswahrheit

### Production

- 92 Eintraege im produktiven Migrationsledger.
- 79 `.sql`-Migrationsdateien in `main`.
- Folgende 13 produktiv registrierte Versionen fehlen als Quellen in `main`:
  - `20260706213500`
  - `20260708195800`
  - `20260709071600`
  - `20260710143540`
  - `20260712154103`
  - `20260713000100` bis `20260713000800`
- Der W1-Receipt-Schritt ist als `20260801100027` im Production-Ledger und als ledger-ausgerichtete Datei in `main` vorhanden.
- Ein frischer Replay der historischen lokalen Kette ist gescheitert. Die alte Historie wurde nach Ausfuehrung mehrfach umgeschrieben und darf nicht erneut pauschal rekonstruiert oder umgedeutet werden.

### Integration

- Das Integration-Projekt hat genau einen eigenen Ledger-Eintrag fuer die W1-Validierung.
- Es ist kein Spiegel von Production und kein Beweis, dass die 79/92-Historie frisch wiederholbar ist.

### Konsequenz

`DB-TRUTH-001` muss einen vorwaertsgerichteten Baseline-/Quellenvertrag schaffen. PR 19, PR 20 oder der geschlossene Replay-Kandidat PR 21 duerfen nicht wholesale gemergt werden. Vor jeder DB-Aenderung sind Produktionskatalog, Ledger, lokaler Quellstand und Drizzle-Vertrag read-only gegenzupruefen.

## Security-Stand

### Belegt abgeschlossen

- PR 23: produktiver `bypass-auth`-/Fake-Session-Weg geschlossen, API-Grenze fail-closed, oeffentlicher Testlogin entfernt.
- PR 24: anonyme Auftragsausgabe und unbeschraenkte oeffentliche Start-Actions geschlossen.
- W1: drei Receipt-Spalten und zwei partielle Unique-Indizes auf Production und Integration belegt; App-Runtime nutzt die Receipts noch nicht durchgaengig.

### Offen

- `LIVE-AUTH-001`: Cookie-/Routengrenzen sind gehaertet, der reale Ablauf mit einer zuvor gueltigen und dann abgelaufenen Sitzung ist aber noch nicht als vollstaendiger Benutzerweg belegt.
- `AUTH-IDENTITY-002`: Benutzerwechsel bleibt P0-offen. `PermissionsProvider` friert Rolle, Name und Initialen aus dem ersten Layout-Mount ein; `refreshPermissions()` aktualisiert nur Permissions und Status. PR 23/24 haben diesen Identity-Switch nicht geloest.
- `SEC-PIN-002`: der lokale Checkpoint `d7d2bd3...` und sein tree-identischer Remote-Checkpoint `dad42eb...` hashen neue PINs und zentralisieren Rollen-/Rotationsregeln, sind aber bewusst `NO_MERGE`.
  - Die vierstellige PIN-Zielmenge ist ueber verteilte Quellen weiter online angreifbar.
  - Device-Bindung/Enrollment oder ein gleichwertiger Challenge-/WAF-Vertrag fehlt.
  - Session-Widerruf bei PIN-Rotation fehlt.
  - Bestands-PINs und der abschliessende Plaintext-Ausschluss sind noch kontrolliert zu migrieren.
- Der aktuelle Supabase Security Advisor meldet 69 Hinweise:
  - 26 Tabellen im exponierten `public`-Schema ohne aktiviertes RLS (`ERROR`),
  - 1 `SECURITY DEFINER`-View (`ERROR`),
  - 29 immer wahre RLS-Policies (`WARN`),
  - 11 RLS-Tabellen ohne Policy (`INFO`),
  - 2 weitere Warnungen.
- Referenz: [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter), insbesondere [RLS disabled in public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) und [Security Definer View](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).
- Jeder Advisor-Befund muss relationenweise nach realem Zugriffspfad, Rolle, Grant und Tenant-Vertrag bewertet werden. Ein pauschaler Policy-PR ist verboten.

## Quality-Stand

Der Quality-Kandidat fuehrt einen maschinenlesbaren Multiset-Ratchet ein. Der Judge, sein direkter Aufruf, die ESLint-Konfiguration, die geschuetzte Node-Auswahl und die vollstaendige transitive Lockfile-Closure der Lint-Einfluesse (`eslint`, `eslint-config-next`, `typescript`, `tsx`, `next`, `react`) sind gehasht. Ein geschuetzter `pull_request_target`-Workflow fuehrt Judge, Config und Abhaengigkeiten aus dem Base-Commit aus; Kandidatencode erhaelt keine Git-Credentials. Datei- und Meldungsschluessel werden unter Linux und Windows identisch kanonisiert.

Inline-ESLint-Konfiguration ist mit `noInlineConfig` vollstaendig wirkungslos. Dadurch wurden 57 bestehende Disable-Direktiven und die zuvor darunter versteckte Schuld erstmals ehrlich sichtbar. Die kanonische Baseline lautet:

| Messwert | Stand |
|---|---:|
| Dateien mit Meldungen | 280 |
| Fehler | 484 |
| Warnungen | 460 |
| automatisch behebbare Fehler | 6 |
| automatisch behebbare Warnungen | 0 |

Der Workflow blockiert weiterhin jede Meldung in geaenderten TypeScript-/TSX-Dateien. Zusaetzlich blockiert der globale Ratchet jedes neue Finding, jede Baseline-Erhoehung, Regel-/Dependency-/Judge-Drift, neue oder veraenderte Git-getrackte Code-Dateien unter ESLint-Ignores sowie eine Reduktion ohne mitgesenkte Baseline. Ein gruener Ratchet bedeutet weiterhin nicht `0` globale Lintfehler.

Weitere Luecken:

- Integrationstests laufen nicht im normalen CI-Vertrag.
- Playwright prueft aktuell die Auth-Grenze, nicht den operativen Kernweg.
- Es gibt keinen bestandenen Fresh-Supabase-Replay fuer den aktuellen Migrationsbestand.
- Der operative Pfad `Kunde -> Auftrag -> Behaelter/QR -> Teil -> Arbeitsaktion -> Today -> Receipt -> Reload-Readback` ist nicht end-to-end belegt.

## Unmittelbare Reihenfolge

1. `TRUTH-CLEANUP-001` und `BRANCH-DISPOSITION-001`: abgeschlossen.
2. `QUALITY-RATCHET-001`: diesen Kandidaten mergen und den geschuetzten Check im aktiven `main`-Ruleset verpflichtend registrieren.
3. `AUTH-IDENTITY-002`: PR-8-Salvage pruefen, Identity-Snapshot atomar aktualisieren und real im Browser beweisen.
4. `DB-TRUTH-001`: 79/92-Quellluecke und vorwaertsgerichteten Baseline-/Replay-Vertrag loesen.
5. `APP-STRUCTURE-001`: Ownership-/Importvertrag festlegen; noch keine Big-Bang-Ordnerumsortierung.
6. `LINT-DEBT-001`: parallel kleine nichtfachliche Reduktionswellen von 484/460 bis null.
7. `SEC-PIN-002B`: Device-/Challenge-Grenze und Session-Widerruf entscheiden und beweisen; erst dann Bestandsrotation und Merge.
8. `RLS-CONTRACT-001`: Rollen-, Tenant-, Grant- und Relationmatrix read-only ableiten; relationenweise PRs.
9. `OFFLINE-SHELL-001`: genau eine sichere Offline-App-Shell herstellen.
10. `OPERATIVE-SLICE-001`: den Online-Kernweg entlang der Zielstruktur bauen und belegen.
11. `OFFLINE-48H-001`: denselben Kernweg ueber eine einzige Outbox und 48 Stunden nachweisen.

Die groessere Cockpit-, Buchhaltungs- und KI-Roadmap bleibt geschuetzt, wird aber nicht vor dem belegten operativen Kernweg als fertig dargestellt.
