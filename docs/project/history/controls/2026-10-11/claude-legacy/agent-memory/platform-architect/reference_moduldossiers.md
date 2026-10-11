---
name: reference-moduldossiers
description: Die G0x/M0x-Moduldossiers (Freigabequelle fuer Q-Fragen wie Q-G04-008) liegen AUSSERHALB von 02_app, eine Ebene hoeher unter galvanik_kreile/_MODULDOSSIERS/
metadata:
  type: reference
---

Arbeitspakete und Code-Kommentare verweisen auf Pfade wie `_MODULDOSSIERS/G04_AUFTRAEGE/08_OFFENE_FRAGEN.md`. Diese Pfade sind relativ zum Kundenordner, NICHT zum App-Repo:

`C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_MODULDOSSIERS\<G01..G10 | M01..M07>\`

Je Dossier gibt es u. a. `04_SCHNITTSTELLEN_DATEN.md` (Ports/Vertraege), `06_ENTSCHEIDUNGEN.md` (D-*-IDs), `07_ABNAHME_TESTS.md`, `08_OFFENE_FRAGEN.md` (Q-*-IDs mit Optionen, Empfehlung, Owner, Status).

**Wichtig:** Im Repo `02_app` existiert kein `_MODULDOSSIERS`, und `quality/authoritative-sources.json` kennt die Dossiers nicht. Sie sind damit Quellenmaterial/Herkunft von Q-IDs, aber keine CI-gepruefte Wahrheitsart nach D-GOV-001. Eine dort empfohlene Option ist noch keine Entscheidung — Status `OFFEN – abgesichert` heisst: Owner PL/Architektur muss sie in `docs/project/linie/KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md` als D-ID eintragen.

Frueherer Eintrag "Dossier fehlt im Repo" war falsch (nur in `02_app` gesucht) und ist ersetzt. Siehe [[project-b1-b2-branch-stack]].
