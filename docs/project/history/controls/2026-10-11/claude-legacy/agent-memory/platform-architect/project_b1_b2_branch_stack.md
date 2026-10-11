---
name: project-b1-b2-branch-stack
description: B2 "Auftrag-Zeitpunkte" sits byte-identical on B1-Storno's tip; B1's quality.yml change couples both PRs via judgeContractHash
metadata:
  type: project
---

Stand 2026-09-27: Branch `claude/kr-b2-auftrag-zeitpunkte` war beim Start byte-identisch mit dem Tip von `claude/kr-b1-storno-p0` (`0d3bacc6`), NICHT von `main` (`21a23567`). B1 ist auf main nicht gemergt; PR #114 stand auf BLOCKED_PRODUCT_DECISION.

**Why:** Die harte Kopplung ist nicht kosmetisch: `judgeContractHash` in `quality/eslint-baseline.json` hasht u.a. `.github/workflows/quality.yml` mit. B1 aendert quality.yml und bumpt den Hash (`312eb5b1…` -> `598df771…`). `lint:ratchet` verlangt bei abweichendem judgeContractHash eine "protected judge-contract migration". Ein main-basierter Folge-PR kann also nicht gruen werden, ohne B1s noch unentschiedene Judge-Contract-Migration mitzuratifizieren.

**How to apply:** Bei jedem Paket, das auf einem nicht-gemergten Paketbranch aufsetzt, zuerst `git diff --stat main...HEAD` pruefen und die Fremdanteile benennen. FILES-Angabe im Abschlussbericht gegen den echten Base-Tip bilden, nicht gegen `main`. Wenn ein Paket quality.yml, `quality/eslint-baseline.json`, `quality/module-gates-baseline.json` oder die Ratchet-Skripte anfasst, ist es nie "nur additiv" — es ist eine Contract-Migration mit Freigabebedarf. Vor dem Wiederverwenden dieser Memory den aktuellen Merge-Status von B1/PR #114 verifizieren. Siehe [[project-g04-dossier-fehlt]].
