---
name: project-path1-ratchet-deadlock
description: PATH1_UI_CONVERGENCE Final-Repair-Gate hat strukturellen Authority-Gate-Deadlock plus unabhaengige CI-Required-Check-Failures, entdeckt 2026-09-13
metadata:
  type: project
---

Beim Versuch, das Paket `PATH1_UI_CONVERGENCE` (Branch `path1/ui-convergence-full-20260910`,
Mission `missions/F1_ORDER_TO_CASH_PILOT_001.yml`) durchs Gate
`FINAL_REPAIR_COMMIT_PUSH_EXACT_SHA_CI_THEN_INDEPENDENT_REVIEW` zu bringen, wurden am
2026-09-13 zwei voneinander unabhängige Blocker gefunden (durch platform-architect und
release-manager als Entscheidungsvorlage verifiziert):

1. **Struktureller Authority-Gate-Bootstrap-Deadlock** (F-GOV-001..007): `.github/workflows/eslint-ratchet.yml`
   läuft als `pull_request_target` und vergleicht `AUTHORITY_CHECKER_SHA256` gegen den auf
   `main` gepinnten Wert — nicht gegen den Kandidaten. Der Pin war nur beim ersten Einbau
   grün (Abwesenheits-Bootstrap); jede spätere PR-Änderung an
   `scripts/quality/check-authoritative-sources.mjs` ist strukturell unmöglich grün zu
   bekommen, weil der Vergleichswert aus der Base kommt. Zusätzlich friert der Checker auf
   `main` einen *Defektzustand* ein (Google-Kalender-Route muss laut Checker existieren),
   sodass auch die Behebung dieses Defekts (Ziel von Etappe A) den Gate verletzt. Ein
   einfaches "Pin-only Governance-PR vorab" (ursprünglich als Option (a) angenommen) ist
   NICHT durchführbar — es wäre selbst rot. Empfohlener Ausweg: Expand/Migrate/Contract
   (Option d) — Checker transitionstolerant machen + Pin durch Laufzeitvergleich gegen
   Base-Tree + grow-only Selftest-Ratchet ersetzen, dann Kandidat mergen, dann Toleranz
   wieder entfernen. Erfordert Owner-Freigabe für main-Änderung mit bewusst rotem `ratchet`.
2. **Unabhängige Required-Check-Failures auf PR #86**: `quality` (required) schlägt fehl mit
   `connect ECONNREFUSED 127.0.0.1:5432` im Auth-Boundary-E2E-Job (Postgres in CI nicht
   erreichbar), zusätzlich `Fresh Supabase replay` FAIL (W4-03 Galvanik handoff attachment).
   Noch nicht geklärt, ob das ein vorbestehender CI-Infra-Flake ist oder eine echte
   Regression des Kandidaten.

**Why:** Beide Befunde zusammen bedeuten: selbst ein sauberer Commit+Push der 5
Final-Repair-Dateien (eslint-ratchet.yml, quality.yml, CURRENT_STATE.md, e2e/smoke.spec.ts,
mission.yml) macht CI NICHT vollständig grün. Das Gate kann nicht allein durch
Commit/Push erreicht werden — es braucht zusätzlich eine main-Governance-Entscheidung UND
eine CI-Infra-Diagnose.

**How to apply:** Bei künftiger Arbeit an PATH1_UI_CONVERGENCE oder am Authority-Gate:
zuerst prüfen, ob diese Befunde noch aktuell sind (Datei-Hashes/CI-Status können sich
geändert haben), dann NICHT versuchen, allein per PR-Pin-Update zu reparieren — das ist
nachweislich strukturell unmöglich, solange `pull_request_target` den Pin von `main` erbt.
Für main-Änderungen am Authority-Gate ist Owner-Freigabe zwingend (AGENTS.md „Ohne Freigabe
verboten: Merge nach main"). Siehe auch [[feedback_stop_gate_rules]] für das Muster
„nicht unbelegt fertigmelden, wenn Ausführung blockiert ist".
