---
name: ratchet-judge-contract-couples-quality-yml
description: Jede Byte-Aenderung an .github/workflows/quality.yml laesst lint:ratchet mit Exit 1 fehlschlagen; Fix ist ausschliesslich ein eslint-baseline-Refresh.
metadata:
  type: project
---

`judgeContractHash` in `scripts/quality/check-eslint-ratchet.ts` hasht vier Dateien
(`.github/workflows/eslint-ratchet.yml`, `.github/workflows/quality.yml`,
`scripts/quality/check-eslint-ratchet.ts`, `scripts/quality/eslint-ratchet-core.ts`)
plus den `judgeInvocationContract` aus `package.json`. Weicht der Wert vom Feld
`judgeContractHash` in `quality/eslint-baseline.json` ab, bricht der Lauf mit Exit 1 und
der Meldung `The ratchet implementation or invocation drifted; a protected judge-contract
migration is required.` — noch VOR jeder Debt-Messung.

Konsequenz: Ein CI-Schritt laesst sich nicht hinzufuegen, ohne die Baseline anzufassen.
Der einzige Fix ist `npm run lint:ratchet:update` plus Commit der neuen Baseline.

**Why:** Genau dieser Mechanismus hat die B1-/B2-CI-Verdrahtung ueber mehrere
Review-Runden blockiert (siehe [[b1-storno-ci-wiring-oscillation]]): Paketauftraege
verbieten Baseline-Aenderungen, verlangen aber gleichzeitig den CI-Schritt — das ist
konstruktiv unerfuellbar und endet korrekt in `BLOCKED_EXTERNAL_PERMISSION`.

**How to apply:** Wenn ein Auftrag eine `quality.yml`-Aenderung verlangt und Baselines
sperrt, ist das kein Writer-Fehler, sondern ein Auftragswiderspruch — als
Permission-Blocker werten, nicht als FAIL_INTERNAL. Der Guard laeuft identisch lokal
(`npm run lint:ratchet`) und in CI (`quality.yml` und `eslint-ratchet.yml` rufen beide
dasselbe Skript; der Guard steht vor dem `--base`-Zweig), ist also PR-blockierend, nicht
nur lokal. Gegenprobe ohne Schreibzugriff: `judgeContractHash` fuer Worktree- und
HEAD-Fassung der `quality.yml` per Node nachrechnen und gegen die Baseline halten — das
belegt die Kausalitaet staerker als der blosse Exit-Code.
