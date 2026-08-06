# F0_PRECHECK — Preflight und Driftinventur

**Mission:** KREILE_F0_FOUNDATION_TRUTH_AND_ZIP_READINESS
**Erstellt:** 2026-08-06 (Cowork/Opus, Writer)
**Charakter:** read-only Inventur. Kein Schreibschritt an Prod/main erfolgte auf Basis dieses Dokuments.

> Hinweis: Diese Datei ist der Arbeitsstand im Workspace. Sie wird für den F0-Kandidaten nach
> `docs/evidence/f0/F0_PRECHECK.md` übernommen.

## 1. Wahrheitsanker

| Ebene | Wert | Quelle |
|---|---|---|
| `main` HEAD | `62af22d7b20ec4deb29dc0c1c8474baa8a1f6f65` (Squash-Merge PR #42) | GitHub API |
| Vorheriger `main` | `6e0c74893ed10e5337e03b10457477f4b6d8cbf7` | GitHub API |
| Vercel Production Commit | **NOCH ZU VERIFIZIEREN (read-only)** | offen |
| Supabase Projekt | `syhaigjhsbpjmtnggqka` (eu-central-1, PG 17.6) | Supabase MCP |

## 2. Supabase Production — read-only Inventar (public + private)

| Metrik | Wert |
|---|---:|
| Tabellen (public) | 94 |
| davon RLS aktiv / ohne RLS | 68 / 26 |
| Views | 17 |
| Indizes | 177 |
| Custom-Trigger | 7 |
| Constraints / Foreign Keys | 252 / 79 |
| Funktionen public / private | 20 / 1 |
| RLS-Policies | 67 |
| **Grants an anon/authenticated/PUBLIC** | **0** (Data-API entzogen) |
| Public Default-ACL-Zeilen | 6 |
| Custom-Schemas | `public`, `private`, `drizzle` |
| Nicht-Default-Extension | `pg_trgm` in `public` (weiter: pgcrypto/uuid-ossp/pg_stat_statements in `extensions`, supabase_vault) |
| Production-Ledger | 96 Einträge (`scripts/migration-ledger-manifest.txt`) |
| Migrationsdateien im Repo | 98 `.sql` + fremdes `0001_app_schema.sql` (Alt-Naming, nicht im Ledger) |

## 3. Bereits erbrachte F0-relevante Nachweise (diese Session)

- **Baseline (public+private, +pg_trgm-Preamble):** `PROD_BASELINE_2026-08-06.sql`,
  SHA-256 `030A6893112941C095EFA65A7347D754B741E1501A5974445C22F852F35CB6AD`; Secret-Scan 0 Hochrisiko.
- **Fresh-Replay** (lokal, leere DB): fehlerfrei (`db reset`), Struktur 11/11 Metriken = Prod.
- **ACL-Regression gefunden + gefixt:** Schema-Dump reproduziert Lockdown nicht (Fresh-Replay 666 Grants);
  `PROD_LOCKDOWN_GRANTS.sql` bringt lokal auf 0 = Prod.
- **B1/B4-Negativtests** grün (fail-closed Auth), auf PR #43/#46 gepusht.
- **PIN-Bestand** (früher verifiziert): 6/6 bcrypt cost 12, 0 Klartext — in F0-05 formal neu zu belegen.

## 4. Offene Foundation-Parallelarbeit (A02) — Snapshot

| PR | Inhalt | Disposition (F0-02 Vorschlag) |
|---|---|---|
| #40 (Draft) | Baseline-Ersatz (migrations_legacy-Archiv, 1 Baseline) | Material für F0-03/04 — evaluieren, nicht blind mergen |
| #41 | Docs + Offline-Containment | **SUPERSEDED** durch #45 — nicht mergen (kürzt Anforderungen) |
| #42 | C1 SyncContext | **INTEGRATED** — nach `main` gemergt (`62af22d7`) auf **ausdrückliche Nutzerfreigabe** ("mergen, wenn sinnvoll"). Danach Pivot auf Konsolidierung. |
| #43 | C2 inquiries + B1-Tests | in F0-Kandidat falten |
| #44 | C3/C4 Today + B2 | in F0-Kandidat falten |
| #45 | Docs G1 (wahrheitsgetreu, additiv) | in F0-Kandidat falten |
| #46 | B4 Upload-Auth + B4-Tests | in F0-Kandidat falten |
| #47 | D1/D2 als Migrationen | Material für F0-03/04 |

## 5. Drift-Register (Owner / Severity / betroffene Wahrheit / Vorwärtskorrektur / Verifikationsweg)

Format nach F0-01 DoD. Severity: H=hoch, M=mittel, N=niedrig.

| # | Drift | Owner | Sev | Betroffene Wahrheit | Vorwärtskorrektur | Verifikationsweg |
|---|---|---|---|---|---|---|
| D-1 | `CURRENT_STATE.md` auf `main` veraltet | Docs | M | Zustandsdoku | #45-Inhalt in F0-Kandidat | Driftprüfung F0-09 gegen Endcommit |
| D-2 | Migrationsquelle nicht replaybar; fremdes `0001` ≠ Prod | DB | H | Migrationswahrheit | Baseline vor Historie (F0-03) | 2× Fresh-Replay + Digest |
| D-3 | D1/D2 produktiv, nicht ledgergebunden | DB/Ledger | H | Ledger | Reconciliation-Plan (F0-04) | versions/namens/hash-Digest, freigabepflichtig |
| D-4 | Schema-Dump reproduziert Data-API-Lockdown nicht (666 Grants) | Security | H | Grants | Lockdown-Migration (belegt) | Fresh-Replay Grants=0 |
| D-5 | `supabase_admin` Default-Privileges fail-open | Security/Owner | H | Default Privileges | Dashboard/Owner-Fix | read-only Recheck — **BLOCKED_EXTERNAL** |
| D-6 | Parität bisher nur zählbasiert (11 Metriken) | DB/Security | H | Prod-Parität | per-Objekt-DDL/`search_path`/Storage-Diff (F0-05/06) | kanonischer Objekt-Diff, nicht nur Counts |
| D-7 | Storage-Buckets/Policies im Preflight nicht inventarisiert | Storage | M | Storage-Vertrag | Bucket/Policy/Signed-URL-Inventar (F0-06) | Negativtest-Matrix |
| D-8 | Drizzle-Schema (`src/db/schema*`) nicht gegen Prod abgeglichen | DB | M | Codemodell↔DB | Abgleich im Klon (F0-01 Rest) | Feld/Typ-Diff |
| D-9 | Kanonische Docs `DOCUMENT_AUTHORITY`/`MODULARITY_STRATEGY`/`OWNERSHIP_MAP` Existenz unklar | Docs | M | Quellenrang | im Klon prüfen/anlegen | Datei-Existenz + Inhalt |
| D-10 | DB-Passwort nach einmaliger Nutzung nicht rotiert | Security | M | Credential | Nutzer setzt neu | Dashboard-Bestätigung |

## 6. Definition of Done (F0-01) — Reststand

- [x] `main`-HEAD gesichert (`62af22d7`).
- [x] Prod read-only inventarisiert (Schema/Grants/RLS/Functions/Extensions/Ledger).
- [x] Offene PRs erfasst + Disposition (F0-02-Vorschlag).
- [x] Drift strukturiert (Owner/Severity/Verifikationsweg) — D-1..D-10.
- [ ] Vercel Production Commit read-only ermittelt.
- [ ] Storage-Buckets/Policies read-only inventarisiert (D-7).
- [ ] Drizzle-Schema↔Prod-Abgleich (D-8).
- [ ] Kanonische-Docs-Existenz auf `main` verifiziert (D-9).
- [ ] `git`-Worktree/Branch-Vollstand im frischen Klon.

## 7. Unabhängige Review (Selbstkontrolle)

Ein unabhängiger read-only Agent hat Precheck, Einordnung und Pivot geprüft: **REVIEW_CONCERNS**.
Kernpunkte übernommen: (a) Reifegrad **~30 %** statt ~50 % (kriteriengewichtet A01–A15); (b) Storage-
und Drizzle-Preflight-Lücken ergänzt (D-7/D-8); (c) Drift jetzt strukturiert; (d) #42-Merge als
nutzerfreigegeben dokumentiert; (e) A04/A05/A07/A08/A11/A13 als praktisch unbegonnen/blockiert markiert.
