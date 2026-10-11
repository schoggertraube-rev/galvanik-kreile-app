---
name: ratchet-judge-contract-refresh
description: Jede Byte-Aenderung an quality.yml/eslint-ratchet.yml zieht einen quality/eslint-baseline.json-Refresh nach sich - nur mit Beweisprotokoll, Diff ausschliesslich judgeContractHash.
metadata:
  type: feedback
---

Ein Refresh von `quality/eslint-baseline.json` ist nur mit vollem Beweisprotokoll erlaubt, und der Diff darf ausschliesslich `judgeContractHash` beruehren. Abweichen `totals`, `issues`, `ignoredCodeFiles`, `lintContractHash`, `eslintVersion` oder `schemaVersion`, gilt das als Aufweichung: Datei auf den Vorzustand zuruecksetzen und SOFORT BLOCKED melden, keine weiteren Reparaturversuche.

**Why:** `judgeContractHash` hasht die Bytes von `.github/workflows/quality.yml`, `.github/workflows/eslint-ratchet.yml` und der beiden Ratchet-Skripte. Jede Workflow-Aenderung macht damit zwangslaeufig beide Ratchet-Gates rot ("The ratchet implementation or invocation drifted; a protected judge-contract migration is required") - der Refresh ist unvermeidbare Folgearbeit, aber genau derselbe Refresh koennte auch stillschweigend ESLint-Schuld anheben. Die Baseline steht auf 0/0/0; das ist der zu schuetzende Wert.

**How to apply:** Sobald ein Paket eine dieser vier Dateien anfasst, den Baseline-Refresh von Anfang an als zweite Datei einplanen (Freigabe einholen, nicht stillschweigend mitnehmen). Protokoll: `npm run lint:ratchet:update` -> `git diff -- quality/eslint-baseline.json` Zeile fuer Zeile -> nur bei reinem judgeContractHash-Diff `npm run lint:ratchet` auf Exit 0 -> `git diff --check`. Alle echten Ausgaben mit Exit-Codes melden, Abnahme bleibt beim unabhaengigen Pruefer. Siehe [[integration-test-classification]] und [[b1-storno-p0]].
