---
name: feedback-ratchet-judge-contract-refresh
description: Any byte change to .github/workflows/quality.yml breaks the ESLint ratchet judge-contract hash; the refresh is only acceptable when the baseline diff is confined to judgeContractHash
metadata:
  type: feedback
---

Jede Byte-Aenderung an einer der vier Judge-Dateien bricht `npm run lint:ratchet` mit
"The ratchet implementation or invocation drifted; a protected judge-contract migration is required."
(Exit 1). `judgeContractHash()` in `scripts/quality/check-eslint-ratchet.ts` hasht:
`.github/workflows/eslint-ratchet.yml`, `.github/workflows/quality.yml`,
`scripts/quality/check-eslint-ratchet.ts`, `scripts/quality/eslint-ratchet-core.ts` plus den
Invocation-Contract aus `package.json`. Der Check laeuft unbedingt und VOR jeder `--base`-Logik,
in `quality.yml` UND im geschuetzten `eslint-ratchet.yml` — eine quality.yml-Aenderung faerbt
also beide Gates rot, bis `quality/eslint-baseline.json` den neuen Hash traegt.

**Why:** In Paket B1 P0-Storno gekostet: das vom Stop-Gate verlangte CI-Wiring in quality.yml war
inhaltlich korrekt, machte aber die Ratchet rot — mit einer Fehlermeldung, die auf ein ganz anderes
Problem ("protected judge-contract migration") zeigt und leicht zu einer Fehlersuche am falschen
Ort fuehrt. Das ist kein Defekt, sondern der eingebaute Schutz gegen heimliches Verbiegen des
Richters. Siehe [[project_b1_storno_p0_package]].

**How to apply:** Wenn ein Paket eine der vier Judge-Dateien anfasst, ist der Refresh von
`quality/eslint-baseline.json` per `npm run lint:ratchet:update` Pflichtbestandteil desselben PR —
und muss als Scope-Erweiterung ausgewiesen werden. ACHTUNG Aufweichungsfalle: `--update` schreibt
den KOMPLETTEN aktuellen Snapshot und kurzschliesst dabei die Schuldenvergleiche. Deshalb immer
danach `git diff -- quality/eslint-baseline.json` pruefen und verlangen, dass der Diff
AUSSCHLIESSLICH `judgeContractHash` beruehrt. Weichen `totals`, `issues`, `ignoredCodeFiles`,
`lintContractHash`, `eslintVersion` oder `schemaVersion` ab, ist die Schuldengrenze angehoben
worden — dann zurueckstellen und eskalieren, nicht committen. Beweiskette: Exit 1 vorher, Ein-Hunk-Diff,
Exit 0 nachher. Laufzeit schwankt: frueher >7 Minuten, am 2026-10-05 (KR A1) nur 73 s (update) bzw.
85 s (check) — Timeout grosszuegig setzen, sonst deutet man Exit 124 faelschlich als Fehler.

**Nachtrag 2026-10-05 (KR A1, eslint-ratchet.yml geaendert):** Vor dem einzigen `--update` den
Zielwert unabhaengig vorhersagen: `judgeContractHash()` per Inline-Node nachrechnen (4 Judge-Dateien +
`judgeInvocationContract(package.json)`); aus `git show HEAD:<file>` muss exakt der committete
Baseline-Wert herauskommen, aus dem Arbeitsbaum der neue — der `--update`-Wert muss dem gleichen. Die
geschuetzte Base-Ratchet akzeptiert die Migration seit D-QA-001 (`baselineRegressions` ignoriert
Contract-Hashes, nur NOTICE), beide CI-Formen (`--base <sha>` und `--base-baseline`) liefen lokal
gruen. Arbeitsbaum muss LF sein (`.gitattributes eol=lf`), sonst weicht der lokale Hash von CI ab.
