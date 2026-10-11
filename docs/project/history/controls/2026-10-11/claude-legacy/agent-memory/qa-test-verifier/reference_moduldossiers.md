---
name: moduldossiers-location
description: Where the per-module requirement dossiers (G07 etc.) live outside the repo and which files carry which truth
metadata:
  type: reference
---

Per-module requirement dossiers live outside `02_app`, at
`C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_MODULDOSSIERS\<MODUL>\`
(e.g. `G07_GELD_RECHNUNGEN`). Consistent file numbering per module:

- `01_ANFORDERUNGSKATALOG.md` — `A-*` requirements with acceptance text and status
- `05_REGELN_SPERREN_KONFLIKTE.md` — `K-*` locks/conflicts plus the
  "Unverhandelbare Auflösungsschranken" section that carries the `LIVE = NO_GO` bars
- `07_ABNAHME_TESTS.md` — `T-*` test obligations mapped to `A-*`, with evidence column
- `08_OFFENE_FRAGEN.md` — `Q-*` open product questions
- `11_IST_CODE_UMBAU.md` — verdicts on existing code (KEEP/VERWORFEN/etc.)

Statuses used in these tables: `GEBAUT`, `SPEZ`, `GEPLANT`, `FEHLT`. Read the
dossier itself rather than a report about it; writer summaries have misquoted the
row status before.

These files are **not** authoritative under D-GOV-001 — see
[[g07-dossier-not-authoritative]].
