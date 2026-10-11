---
name: f0-review-manifest-stale-unwired
description: F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json pinnt veraltete sha256/bytes; der pruefende Script ist nirgends verdrahtet — als Nacharbeit, nicht als FAIL werten.
metadata:
  type: project
---

`docs/evidence/f0/F0_W2C_W4_INDEPENDENT_REVIEW_MANIFEST.json` friert `sha256`/`bytes` der F0-Evidenzdateien auf den Stand der damaligen F0-Review ein. Diese Pins sind laengst ueberholt und driften bei jeder legitimen Evidenz-Aenderung weiter (Befund-Kuerzel in Berichten: `W4-EVID-STALE-001`).

Am 2026-09-27 unabhaengig nachgerechnet: Manifest pinnt 1402 Bytes fuer `W4_CROSS_MODULE_READ_PORT_INVENTORY.json`, real auf `origin/main` und HEAD bereits 8917 Bytes. Die Drift ist also um Groessenordnungen aelter als jede einzelne Paket-Aenderung. Am 2026-09-28 nach der B2-Ergaenzung erneut gemessen: 9369 Bytes, sha256 `c50322dc…` gegen Pin `81b59e51…` — die B2-Aenderung traegt rund 450 Bytes zu einer Drift von ueber 7900 Bytes bei.

Ebenfalls am 2026-09-28 erneut verifiziert: `check-f0-independent-review-package.mjs` ist weiterhin NICHT verdrahtet (grep ueber `.github/`, `package.json`, `scripts/` findet nur die Selbstreferenz im Skript). Der wirklich verdrahtete W4-Gate ist ein anderer: `scripts/quality/check-w4-cross-module-read-ports.mjs --selftest|--check` laeuft in `quality.yml` (Zeilen 65/66 und 269/270) und ist lokal ausfuehrbar; fuer B2 gruen (`W4_READ_PORT_CONTRACT=PASS files=554 read_ports=26`).

`node scripts/quality/check-f0-independent-review-package.mjs --check` endet mit Exit 1, bricht aber fail-fast schon bei `SOURCE_HASH_DRIFT:AGENTS.md` ab — es erreicht die Inventardatei gar nicht.

**Why:** Das Skript ist in KEINEM npm-Script, KEINEM `.github/workflows/*.yml`-Job und NICHT in der husky-Kette verdrahtet (`.husky/pre-commit` → `verify:precommit` = `tsc --noEmit && lint:staged && test:unit`). Es ist damit reine Dokumentation ohne Durchsetzung — ein rotes Ergebnis hat heute keine Lieferwirkung.

**How to apply:** Wenn ein Paket eine Datei unter `docs/evidence/f0/` legitim aendert und ein Agent die Manifest-Drift als Nebenbefund meldet: als Nacharbeit/Hygiene einordnen, nicht als Blocker fuer das Paket. ABER die Unverdrahtetheit jedes Mal neu verifizieren (grep ueber `package.json`, `.github/workflows/`, `.husky/`) — sobald das Skript irgendwo laeuft, kippt der Befund von folgenlos zu blockierend. Verwandt: [[runner-report-staleness]].
