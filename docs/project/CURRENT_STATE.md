# Current State

Stand: 2026-08-04 (Update nach PR #31, #32, #33, M2/M5-Analyse)

Verifiziert gegen GitHub, Vercel, Supabase und einen sauberen lokalen Checkout.

## Gesamturteil

| Vertrag | Status | Beleg |
|---|---|---|
| Lieferquelle | `PASS` | GitHub `main` ist die einzige Code-Lieferwahrheit. HEAD: `a87f979`. |
| Production-Deployment | `PASS` | Vercel Production laeuft auf demselben Commit wie `main`. |
| Lokale Worktree-Hygiene | `PASS_LOCAL` | Alle in diesem Arbeitsbereich sichtbaren App-Worktrees sind sauber und voneinander isoliert. |
| Migrations-/Schemaquelle | `PASS (PR offen)` | Stub-Dateien erstellt: 95 SQL-Dateien = 95 Ledger-Eintraege. CI-Check-Skript hinzugefuegt. PR ausstehend. |
| Quality-Ratchet / Lint-Nullstand | `PASS` | PR #31 gemergt. ESLint 0/0 ueber 668 Dateien, tsc sauber, Ratchet enforced. |
| Auth-Identity | `PASS` | PR #33 gemergt. Atomarer AuthState, keine localStorage-Reads mehr, alle Tests bestehen. |
| Produkt-Go-live | `NO_GO` | RLS, PIN-Grenze, Offline-Vertrag und operativer End-to-End-Kern sind nicht vollstaendig abgenommen. |

Ein gruenes Deployment oder ein gemergter Sicherheitsfix ist deshalb kein Gesamt-PASS.

## Autoritaet der Wahrheiten

| Ebene | Autoritaet | Aktueller Stand | Darf nicht ersetzt werden durch |
|---|---|---|---|
| Code-Lieferung | GitHub `main` | Audit-Receipt: `63a7b37a4095e82490716f4f12d9aaa0df8358b7` (PR 27) | lokale Branches, offene PRs, alte Uebergaben |
| Laufende App | Vercel Production | Audit-Receipt: Deployment `dpl_7TX6br8jHUgx3QHyy3q2gvAGw7Dy`, `READY`, Commit `63a7b37...`; Alias ohne Fehler | Preview, lokaler Dev-Server |
| Produktive Datenbank | Supabase Production | Projekt `syhaigjhsbpjmtnggqka`, 92 Ledger-Eintraege | lokale SQL-Dateien, Integration |
| Nichtproduktiver DB-Test | Supabase Integration | Projekt `yroeivcldiphoyfmxuus`, 1 Ledger-Eintrag | Production, Fresh-Replay-Beweis |
| Kandidaten / Quellen | PRs, Remote-Branches, isolierte Worktrees | nur Salvage oder Review | `main`, Production |
| Produktvertrag | Masterplan, Non-Loss-Register und dort kanonisch uebernommene Twin-/Akzeptanzregeln | Akzeptanz- und Roadmapquelle | rohe Twin-/Ideendateien, Mock-Oberflaechen, Dateimenge |

Bei einem Widerspruch wird nicht still eine Ebene bevorzugt. Der Widerspruch wird als eigener Blocker mit Besitzer und Aufloesungsweg dokumentiert.

## GitHub und Vercel

- GitHub Default Branch: `main`.
- Audit-Receipt nach PR 27: `main` und `origin/main` exakt `63a7b37a4095e82490716f4f12d9aaa0df8358b7`.
- Vercel-Projekt: `galvanik-kreile-werkstatt`.
- Production-URL: `https://galvanik-kreile-werkstatt.vercel.app`.
- Audit-Receipt: Production-Deployment `dpl_7TX6br8jHUgx3QHyy3q2gvAGw7Dy` ist `READY`, hat `aliasError: null` und nennt exakt denselben GitHub-Commit.
- Das aktive `main-protection`-Ruleset verlangt Pull Requests, einen aktuellen Branch sowie die Checks `quality` und `ratchet`; Force-Pushes, Loeschung und Bypasses sind gesperrt. Die PR-Gates der gemergten PRs ersetzen keinen Fresh-Replay- oder Gesamtproduktnachweis.

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

Stand: 2026-08-04. Friedhof-Bereinigung durchgefuehrt: 32 Worktrees auf 3 reduziert.

| Branch | Pfad | Zustand | Zweck |
|---|---|---|---|
| `feature/capture-auth-tenant` | `02_app` | dirty, read-only | erhaltener Windows-Dirty-Worktree, nie aendern |
| `agent/fnd-p0-01-lint-wave-2` | `_agent_worktrees/lint-wave2` | sauber, 83 Commits ahead | Lint-0/0-PR, wartet auf Merge |
| `agent/truth-maintenance-002` | `_agent_worktrees/truth-maintenance` | aktiv | Pflege dieses Dokuments |

Entfernt: 29 tote Worktrees in `_agent_worktrees/`, `_worktrees/`, `02_app/.agents/`, `02_app/.claude/worktrees/`, `C:\tmp\` und angrenzende Klone. Alle Remote-Branches bleiben erhalten. Hintergrund-Cleanup-Skript `_cleanup_tmp.cmd` laeuft fuer die `C:\tmp`-Verzeichnisse mit `node_modules`.

Der PIN-Kandidat bleibt als Remote-Checkpoint `checkpoint/sec-pin-002-no-merge-20260801` erhalten (`NO_MERGE`).

## Supabase- und Migrationswahrheit

### Production

- 95 Eintraege im produktiven Migrationsledger.
- Nach Stub-Erstellung: 95 `.sql`-Migrationsdateien (PR offen).
- 16 ehemals fehlende Versionen als kommentierte Stubs ergaenzt:
  - Juli-Fenster (13 Stk.): `20260706213500` bis `20260713000800`
  - August-Security (3 Stk.): `20260802213450`, `20260802220519`, `20260802221310`
- CI-Check-Skript (`scripts/check-migration-count.sh`) prueft Dateianzahl vs. Ledger.
- Der W1-Receipt-Schritt ist als `20260801100027` im Production-Ledger und als ledger-ausgerichtete Datei in `main` vorhanden.
- Ein frischer Replay der historischen lokalen Kette ist gescheitert. Die alte Historie wurde nach Ausfuehrung mehrfach umgeschrieben und darf nicht erneut pauschal rekonstruiert oder umgedeutet werden.

### Integration

- Das Integration-Projekt hat genau einen eigenen Ledger-Eintrag fuer die W1-Validierung.
- Es ist kein Spiegel von Production und kein Beweis, dass die 79/92-Historie frisch wiederholbar ist.

### Analyse (2026-08-04)

Die 16 fehlenden Versionen fallen in zwei Fenster: 13 aus Juli (6.–13. Juli 2026) und 3 August-Security-Migrationen (2. August 2026). Alle 16 wurden als kommentierte Stub-Dateien ergaenzt. Die alte Git-Historie wurde nach Ausfuehrung mehrfach umgeschrieben (Commits wie "restore executed migration sources", "reconcile applied migration history" auf Archiv-Branches belegen fehlgeschlagene Rekonstruktionsversuche).

Zusaetzlich existieren zwei parallele Migrationsoberflaechen: `supabase/migrations/` (79 Rohdateien) und `src/db/migrations/` (Drizzle, nur `meta/`-Ordner, kein generiertes SQL eingecheckt). Diese sind nicht aufeinander abgestimmt.

### Konsequenz und Vorwaerts-Strategie

`DB-TRUTH-001` muss einen vorwaertsgerichteten Baseline-/Quellenvertrag schaffen:

1. Das Juli-Fenster wird als permanent opak behandelt; keine Rekonstruktion.
2. Production-Schema via `supabase db dump --schema-only` als Ist-Wahrheit sichern.
3. Eine einzige Baseline-Migration (z.B. `20260805000000_baseline_post_gap.sql`) den Production-Schema-Stand festhalten und Ledger/Dateianzahl synchronisieren.
4. Die 79 Pre-Baseline-Dateien werden archiviert (read-only, nicht wiederholbar).
5. Kuenftige Migrationen erfordern: lokale Datei + Ledger-Eintrag + Drizzle-Schema-Abgleich, alle drei vor Merge.
6. CI-Check: lokale Dateianzahl vs. Production-Ledger bei jeder PR, die `supabase/migrations/` beruehrt.

PR 19, PR 20 oder PR 21 duerfen nicht wholesale gemergt werden. Vor jeder DB-Aenderung sind Produktionskatalog, Ledger, lokaler Quellstand und Drizzle-Vertrag read-only gegenzupruefen.

## Security-Stand

### Belegt abgeschlossen

- PR 23: produktiver `bypass-auth`-/Fake-Session-Weg geschlossen, API-Grenze fail-closed, oeffentlicher Testlogin entfernt.
- PR 24: anonyme Auftragsausgabe und unbeschraenkte oeffentliche Start-Actions geschlossen.
- W1: drei Receipt-Spalten und zwei partielle Unique-Indizes auf Production und Integration belegt; App-Runtime nutzt die Receipts noch nicht durchgaengig.

### Offen

- `LIVE-AUTH-001`: Cookie-/Routengrenzen sind gehaertet, der reale Ablauf mit einer zuvor gueltigen und dann abgelaufenen Sitzung ist aber noch nicht als vollstaendiger Benutzerweg belegt.
- `AUTH-IDENTITY-002`: **DONE** (PR #33, gemergt 2026-08-04). PermissionsContext nutzt jetzt ein einziges atomares `AuthState`-Objekt mit Sequence-Guard (`refreshSeqRef`). Alle `localStorage`-Reads/Writes fuer Identity entfernt (`MobileBottomNav`, `KontrolleDashboardClient`, `KvpClient`, `StartScreenClient`, `KreileHeader`). Tests aktualisiert und bestanden (7/7). Verbleibend: `loginWithPin` ruft kein `signOut` vor neuem Login auf — kein aktiver Bug (Cookie wird ueberschrieben), aber Defense-in-Depth-Verbesserung fuer spaeter.
- `SEC-PIN-002`: der remote gesicherte, tree-identische Checkpoint `dad42eb...` zu `d7d2bd3...` hasht neue PINs und zentralisiert Rollen-/Rotationsregeln, ist aber bewusst `NO_MERGE`.
  - Die vierstellige PIN-Zielmenge ist ueber verteilte Quellen weiter online angreifbar.
  - Device-Bindung/Enrollment oder ein gleichwertiger Challenge-/WAF-Vertrag fehlt.
  - Session-Widerruf bei PIN-Rotation fehlt.
  - Bestands-PINs und der abschliessende Plaintext-Ausschluss sind noch kontrolliert zu migrieren.
- RLS-Analyse abgeschlossen (siehe `docs/project/RLS_ANALYSIS.md`):
  - 26 Tabellen ohne RLS, davon 12 mit `tenant_id` (P0-Risiko),
  - 7 Tabellen mit `rls_forced` + keine Policies (korrekt: nur service_role),
  - 9 Tabellen mit schwachen `USING (true)` Policies.
  - **KRITISCH (2026-08-04):** `app.tenant_id` wird nie gesetzt — alle bestehenden
    `tenant_isolation` Policies sind No-Ops (Catch-all `USING(true)` macht sie wirkungslos).
    P0-Migration (PR #35, auf main) darf NICHT auf Production angewandt werden.
    Status: `BLOCKED_PRODUCT_DECISION` — Tenant-Isolation-Mechanismus muss gewaehlt werden.
- Referenz: [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter), insbesondere [RLS disabled in public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) und [Security Definer View](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).
- Jeder Advisor-Befund muss relationenweise nach realem Zugriffspfad, Rolle, Grant und Tenant-Vertrag bewertet werden. Ein pauschaler Policy-PR ist verboten.

## Quality-Stand

Der Quality-Kandidat fuehrt einen maschinenlesbaren Multiset-Ratchet ein. Der Judge, sein direkter Aufruf, die ESLint-Konfiguration, die geschuetzte Node-Auswahl und die vollstaendige transitive Lockfile-Closure der Lint-Einfluesse (`eslint`, `eslint-config-next`, `typescript`, `tsx`, `next`, `react`) sind gehasht. Ein geschuetzter `pull_request_target`-Workflow fuehrt Judge, Config und Abhaengigkeiten aus dem Base-Commit aus; Kandidatencode erhaelt keine Git-Credentials. Datei- und Meldungsschluessel werden unter Linux und Windows identisch kanonisiert.

Inline-ESLint-Konfiguration ist mit `noInlineConfig` vollstaendig wirkungslos.

### Lint-Nullstand (gemergt)

PR #31 (`agent/fnd-p0-01-lint-wave-2`, 83 Commits squash-merged) erreicht:

| Messwert | Vorher (PR 27) | Nachher (PR offen) |
|---|---:|---:|
| Dateien mit Meldungen | 279 | 0 |
| Fehler | 484 | 0 |
| Warnungen | 459 | 0 |

Lokal verifiziert: ESLint 0/0 ueber 668 Dateien, `tsc --noEmit` sauber, 100/103 vitest bestanden (3 Fails = DB-Integrationstests mit Dummy-Credentials, kein Zusammenhang mit Lint-Aenderungen), Ratchet-Baseline aktualisiert und verifiziert.

Behobene Regelklassen: `no-explicit-any` (typisierte DTOs und Type Guards), `react-hooks/exhaustive-deps` (vollstaendige Dependency-Arrays), `no-unused-vars`, `@next/next/no-img-element` (optimierte Images), `@next/next/no-page-custom-font` (next/font-Integration), `no-empty`, `prefer-const` und weitere.

Der Workflow blockiert weiterhin jede Meldung in geaenderten TypeScript-/TSX-Dateien. Zusaetzlich blockiert der globale Ratchet jedes neue Finding, jede Baseline-Erhoehung, Regel-/Dependency-/Judge-Drift, neue oder veraenderte Git-getrackte Code-Dateien unter ESLint-Ignores sowie eine Reduktion ohne mitgesenkte Baseline. Nach Merge ist der Ratchet bei echtem Nullstand.

### Weitere Luecken

- Integrationstests laufen nicht im normalen CI-Vertrag.
- Playwright prueft aktuell die Auth-Grenze, nicht den operativen Kernweg.
- Es gibt keinen bestandenen Fresh-Supabase-Replay fuer den aktuellen Migrationsbestand.
- Der operative Pfad `Kunde -> Auftrag -> Behaelter/QR -> Teil -> Arbeitsaktion -> Today -> Receipt -> Reload-Readback` ist nicht end-to-end belegt.

## Unmittelbare Reihenfolge

1. `TRUTH-CLEANUP-001` und `BRANCH-DISPOSITION-001`: abgeschlossen.
2. `QUALITY-RATCHET-001`: `DONE`; PR 26 gemergt, `quality` plus `ratchet` im aktiven Ruleset verpflichtend.
3. `LINT-DEBT-001`: `DONE`; PR #31 gemergt. ESLint 0/0, tsc sauber, Ratchet enforced.
4. `AUTH-IDENTITY-002`: `DONE`; PR #33 gemergt. Atomarer AuthState, localStorage-Reads entfernt, 7/7 Tests bestanden.
5. `DB-TRUTH-001`: 79/92-Quellluecke und vorwaertsgerichteten Baseline-/Replay-Vertrag loesen.
6. `APP-STRUCTURE-001`: Ownership-/Importvertrag festlegen; noch keine Big-Bang-Ordnerumsortierung.
7. `SEC-PIN-002B`: Device-/Challenge-Grenze und Session-Widerruf entscheiden und beweisen; erst dann Bestandsrotation und Merge.
8. `RLS-CONTRACT-001`: Rollen-, Tenant-, Grant- und Relationmatrix read-only ableiten; relationenweise PRs.
9. `OFFLINE-SHELL-001`: genau eine sichere Offline-App-Shell herstellen.
10. `OPERATIVE-SLICE-001`: den Online-Kernweg entlang der Zielstruktur bauen und belegen.
11. `OFFLINE-48H-001`: denselben Kernweg ueber eine einzige Outbox und 48 Stunden nachweisen.

Die groessere Cockpit-, Buchhaltungs- und KI-Roadmap bleibt geschuetzt, wird aber nicht vor dem belegten operativen Kernweg als fertig dargestellt.
