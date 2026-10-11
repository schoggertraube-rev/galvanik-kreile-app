---
name: reference-g04-dossier
description: Location of the binding G04 (Auftraege) module dossier outside the repo and which files carry contract/ownership truth
metadata:
  type: reference
---

Das verbindliche G04-Dossier liegt AUSSERHALB von `02_app`:
`C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_MODULDOSSIERS\G04_AUFTRAEGE\`

Wichtigste Fundstellen fuer Datenvertrags-Audits:
- `04_SCHNITTSTELLEN_DATEN.md` — Ports (§1), Events (§3), Feldliste mit Spalte "Besitzer-Modul" (§4), Manifest-Soll (§5).
- `02_FUNKTIONEN_ABLAEUFE.md` — pro Funktion "Ergebnis + Receipt/Readback" (dort steht z. B. die Versionierungspflicht fuer den Termintreue-Read-Port).
- `05_REGELN_SPERREN_KONFLIKTE.md` — Sperren S-G04-* und Konflikte K-G04-*.
- `08_OFFENE_FRAGEN.md` — Q-G04-*; Status "OFFEN – abgesichert" bedeutet: nicht vom Writer entscheidbar.
- `11_IST_CODE_UMBAU.md` — Umbauentscheidung je Ist-Datei.

**How to apply:** Bei Manifest-, Port- oder KPI-Vertragsbefunden zuerst dort pruefen, ob die Frage schon als Q-G04-* an PL/Architektur gebunden ist, bevor eine "Reparatur" empfohlen wird. Siehe [[open-q-g04-008-manifest-ownership]].
