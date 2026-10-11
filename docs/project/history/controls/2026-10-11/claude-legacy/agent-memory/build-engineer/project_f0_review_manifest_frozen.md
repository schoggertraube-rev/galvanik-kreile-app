---
name: f0-review-manifest-frozen
description: F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST pins stale sha256 of F0-Evidenzdateien und ist in keiner CI verdrahtet - keine Falschregression jagen.
metadata:
  type: project
---

`docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json` friert `sha256`/`bytes` der F0-Evidenzdateien auf den Stand der damaligen F0-Review ein. Diese Receipts sind laengst ueberholt (Beispiel 2026-09-27: Manifest pinnt 1402 Bytes fuer `W4_CROSS_MODULE_READ_PORT_INVENTORY.json`, das auf `main` bereits 8917 Bytes gross war). `scripts/quality/check-f0-independent-review-package.mjs` (`SOURCE_HASH_DRIFT`) ist in KEINEM Workflow und KEINEM npm-Script verdrahtet.

**Why:** Wer eine F0-Evidenzdatei legitim erweitert (z.B. neuen Read-Port ins W4-Inventar eintraegt), sieht sonst `SOURCE_HASH_DRIFT` und haelt es faelschlich fuer eine selbst verursachte Regression - oder schlimmer: faengt an, gepinnte Hashes "nachzuziehen" und fasst damit fremde Evidenz an.

**How to apply:** Beim Aendern von Dateien unter `docs/evidence/f0/**` zuerst pruefen, ob der betroffene Check ueberhaupt in `.github/workflows/**` oder `package.json` verdrahtet ist. Ist er es nicht, gilt er als eingefrorene Historie: nicht anfassen, nur als Befund melden ([[feedback-scope-stop-and-report]]). Die lebende W4-Pruefung ist `scripts/quality/check-w4-cross-module-read-ports.mjs` (`--check` / `--selftest`), nicht das Review-Paket.
