# Mission Queue

Stand: 2026-08-04 (Update M2/M5)

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

**Prioritaet:** P0

**Status:** PR offen — 16 Stub-Dateien + CI-Check erstellt.

**Erledigt:**
- Production-Ledger: 95 Eintraege verifiziert
- 16 fehlende Stub-SQL-Dateien erstellt (13 Juli + 3 August-Security)
- Dateianzahl synchronisiert: 95 Dateien = 95 Ledger-Eintraege
- CI-Check-Skript `scripts/check-migration-count.sh` + Referenzdatei erstellt
- Production-Schema (92 Tabellen) vollstaendig gesichert via `list_tables --verbose`

**Offen:**
- PR mergen
- Drizzle-Schema-Abgleich (Folgemission)

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

**Status:** Analyse abgeschlossen, siehe `docs/project/RLS_ANALYSIS.md`.

**Erledigt:**
- 26 ungeschuetzte Tabellen inventarisiert
- 66 geschuetzte Tabellen mit allen Policies erfasst
- 7 `rls_forced`-Tabellen verifiziert (korrekt konfiguriert)
- Risiko-Tiers definiert: P0 (12 mit tenant_id), P1 (6 ohne tenant_id), P2 (8 System)
- 9 schwache `USING (true)` Policies identifiziert

**Offen:**
- P0-Migration: 12 Tabellen RLS + tenant_isolation Policy (eine Migration, kein Schema-Change)
- P1: `tenant_id`-Spalte ergaenzen fuer 6 Tabellen (Produktentscheidung fuer Backfill)
- P2: service_role-only Policies fuer 8 Systemtabellen

---

## Empfohlene Reihenfolge

1. ~~Lint-PR mergen~~ **DONE** (PR #31)
2. ~~M1 (AUTH-IDENTITY-002)~~ **DONE** (PR #33)
3. **M2 (DB-TRUTH-001)** — PR offen (16 Stubs + CI-Check)
4. **M5 (RLS-CONTRACT-001)** — Analyse fertig, P0-Migration als naechstes
5. **M3 (APP-STRUCTURE-001)** — sofort machbar
6. **M4 (SEC-PIN-002B)** — nach Produktentscheidung

## Codex-Eignung

| Mission | Codex-tauglich | Modell |
|---|---|---|
| ~~M1 AUTH-IDENTITY~~ | ~~ja~~ | **DONE** |
| M2 DB-TRUTH | teilweise (Baseline-Datei, CI-Skript) | kleines Modell |
| M3 APP-STRUCTURE | ja (ESLint-Config) | kleines Modell |
| M4 SEC-PIN | nein (Produktentscheidung noetig) | — |
| M5 RLS-CONTRACT | nein (Read-only-Analyse zuerst) | — |
