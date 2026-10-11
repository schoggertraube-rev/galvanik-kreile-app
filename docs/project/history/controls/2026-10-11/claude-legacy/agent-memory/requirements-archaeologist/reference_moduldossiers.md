---
name: reference-moduldossiers
description: Where the per-module Kreile dossiers (A-/K-/T-/Q-/S-IDs, OE-2609-* owner decisions) live — outside the git repo, not D-GOV-001 authoritative
metadata:
  type: reference
---

Module dossiers live OUTSIDE the app repo at:
`C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_MODULDOSSIERS\<MODUL>\`
(e.g. `G04_AUFTRAEGE`, `G07_GELD_RECHNUNGEN`).

Standard file set per dossier: `00_STECKBRIEF.md` (carries `Dossier-Status:` and
`Modul-Status:`), `01_ANFORDERUNGSKATALOG.md` (A-IDs + per-requirement Stand
GEBAUT/SPEZ/GEPLANT/FEHLT), `02_FUNKTIONEN_ABLAEUFE.md` (F-IDs + the seven UI
states with literal German texts), `03_OPTIKVORLAGE.md`, `04_SCHNITTSTELLEN_DATEN.md`
(ports, events, field list with "Ist im Schema" column), `05_REGELN_SPERREN_KONFLIKTE.md`
(S-IDs locks, K-IDs conflicts), `06_ENTSCHEIDUNGEN.md` (register cross-refs),
`07_ABNAHME_TESTS.md` (T-IDs), `08_OFFENE_FRAGEN.md` (Q-IDs + "bis dahin in der App"),
`09_QUELLEN_AKTUALITAET.md`, `10_CHECKLISTE.md`, `11_IST_CODE_UMBAU.md` (per-file
keep/rebuild decision), plus `AUFTRAG_*.md` briefs and `BERICHT_*.md` reports.

Release status convention: the LAST line of the newest `BERICHT_*.md` is exactly
`DOSSIER-STATUS: BAUBEREIT` or `DOSSIER-STATUS: NICHT_BAUBEREIT – <Grund>`.
Owner decisions are `OE-2609-NN`, sourced from
`_MODULDOSSIERS\00_PROJEKT\OWNER_ENTSCHEIDUNGEN_2026-09-25_26.md`.

Governance caveat: see [[project-moduldossiers-not-authoritative]]. These dossiers
are NOT registered as a D-GOV-001 truth source.
