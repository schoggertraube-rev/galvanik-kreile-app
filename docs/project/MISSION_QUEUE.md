# Mission Queue

Stand: 2026-08-04

Priorisierte, sofort umsetzbare Missionspakete fuer das Galvanik-Kreile WerkstattCockpit.

## Abgeschlossen

| ID | Mission | Status | PR |
|---|---|---|---|
| `TRUTH-CLEANUP-001` | Worktree-Inventar, Branch-Disposition | `DONE` | PR 26, PR 27 |
| `QUALITY-RATCHET-001` | Maschinenlesbarer ESLint-Ratchet | `DONE` | PR 26 |
| `LINT-DEBT-001` | ESLint 484/459 auf 0/0 | `DONE` | PR #31 |
| `WORKTREE-CLEANUP-002` | 32 Worktrees auf 3 reduziert | `DONE` | — |
| `AUTH-IDENTITY-002` | Atomarer Identity-Snapshot, localStorage entfernt | `DONE` | PR #33 |

## Naechste Missionen (bereit)

### M2: DB-TRUTH-001 — Vorwaertsgerichtete Schema-Baseline

**Prioritaet:** P0 (79/92-Luecke blockiert sichere Migrationen)

**Problem:**
- Production: 92 Ledger-Eintraege, main: 79 SQL-Dateien
- 13 fehlende Versionen (6.–13. Juli 2026) — permanent opak
- Zwei unabgestimmte Migrationsoberflaechen: `supabase/migrations/` und `src/db/migrations/`

**Strategie:**
1. Production-Schema via `supabase db dump --schema-only` sichern
2. Baseline-Migration `20260805000000_baseline_post_gap.sql` erstellen
3. Pre-Baseline-Dateien als archiviert/read-only markieren
4. CI-Check: Dateianzahl vs. Ledger-Count
5. Drizzle-Schema gegen Baseline abgleichen

**Blocker:** Braucht Supabase-Production-Zugriff (read-only Schema-Dump). Kein Code-Risiko.

**Geschaetzter Aufwand:** Mittel (Schema-Dump + Baseline-Datei + CI-Skript). Teils Codex-faehig.

---

### M3: APP-STRUCTURE-001 — Import-/Ownership-Vertrag

**Prioritaet:** P1

**Ziel:** Modulgrenzen aus `MODULARITY_STRATEGY.md` als ESLint-Import-Regeln festlegen. Keine Ordnerverschiebung.

**Geschaetzter Aufwand:** Klein (Analyse + Regelkonfiguration).

---

### M4: SEC-PIN-002B — Device-Challenge und Session-Widerruf

**Prioritaet:** P0 (Security)

**Ziel:** Device-Binding oder Challenge fuer vierstellige PIN, Session-Widerruf bei Rollenwechsel, Plaintext-Ausschluss.

**Blocker:** Produktentscheidung zum Challenge-Mechanismus.

---

### M5: RLS-CONTRACT-001 — Relationenweise RLS-Matrix

**Prioritaet:** P1

**Ziel:** Alle 26 Tabellen ohne RLS read-only kartieren, dann relationenweise PRs.

---

## Empfohlene Reihenfolge

1. ~~Lint-PR mergen~~ **DONE** (PR #31)
2. ~~M1 (AUTH-IDENTITY-002)~~ **DONE** (PR #33)
3. **M2 (DB-TRUTH-001)** — braucht Supabase-Production-Schema-Dump-Freigabe
4. **M3 (APP-STRUCTURE-001)** — sofort machbar
5. **M4/M5** — nach Produktentscheidungen

## Codex-Eignung

| Mission | Codex-tauglich | Modell |
|---|---|---|
| ~~M1 AUTH-IDENTITY~~ | ~~ja~~ | **DONE** |
| M2 DB-TRUTH | teilweise (Baseline-Datei, CI-Skript) | kleines Modell |
| M3 APP-STRUCTURE | ja (ESLint-Config) | kleines Modell |
| M4 SEC-PIN | nein (Produktentscheidung noetig) | — |
| M5 RLS-CONTRACT | nein (Read-only-Analyse zuerst) | — |
