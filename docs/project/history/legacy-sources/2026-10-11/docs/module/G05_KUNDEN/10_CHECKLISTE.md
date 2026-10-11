<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — Checkliste Vollständigkeit

Prüfung am 2026-09-26 gegen Abschnitt 7 der Anleitung 1.1.

1. ✓ **Alle 12 Pflichtdateien + Bericht vorhanden, Tabellen mit exakten Kopfzeilen.** Die Dateien `00` bis `11` und `BERICHT_2026-09-26.md` sind vorhanden; Pflichtkopfzeilen wurden übernommen.
2. ✓ **Steckbrief vollständig inkl. Anbindung, Gate, Ausgrau-Element + Text, Übertragbarkeit, Rate-Stellen-Nummern.** Neu bewertet: `00_STECKBRIEF.md` führt jedes Pflichtfeld als eigene Zeile; Stufe, Dossier-/Modul-Status, Session, Arbeitsordner, Code-Pfad samt SHA-256 (12), Abhängigkeiten, Anbindungszeitpunkt/Gates, konkrete nicht klickbare Elemente mit Status und wörtlichem Text `In Klärung`, app-neutraler Kern sowie RT-10, RT-16, RT-18, RT-19, RT-22, RT-28 und RT-30 sind belegt. Belege: `00_STECKBRIEF.md`; `04_SCHNITTSTELLEN_DATEN.md`; `08_OFFENE_FRAGEN.md`; `09_QUELLEN_AKTUALITAET.md`; `11_IST_CODE_UMBAU.md`; `..\00_PROJEKT\PLAN_JETZT_BIS_LIVEGANG_2026-09-25.md`; `..\00_PROJEKT\REDTEAM_BUILDER_2026-09-26.md`.
3. ✓ **Jede Anforderung: Quelle + Abnahmekriterium + Stand.** A-G05-001 bis A-G05-026 enthalten alle drei Angaben.
4. ✓ **Jede Funktion: alle 7 Zustände mit wörtlichem Text oder begründetem `FEHLT → Q-…`.** Die sieben Querschnittszustände stehen vollständig in `02`; funktionsspezifische Lücken tragen Q-IDs und einen sicheren Zwischenzustand.
5. ✓ **Optikvorlage: Quelle + SHA; drei Geräte je Screen oder „fehlt → Designphase“; M-Module: vollständige Inhaltsliste je Screen.** Beide UI-Referenzen sind mit Hash erfasst; Tablet/Handy-Lücken sind je Screen markiert. G05 ist ein Grundstamm-Modul, kein M-Modul.
6. ✓ **Schnittstellen: Host-Ports, Feldliste mit Soll-Ist, Datenbesitz, Provider + Secret-Namen + Stand.** `04` enthält alle geforderten Tabellen; es werden keine Secrets offengelegt und keine Provider behauptet.
7. ✓ **Jeder Konflikt: Zuständigkeit + Anzeigeort.** K-G05-001 bis K-G05-007 enthalten beides; Gregor wird mangels Owner-Zuweisung nicht erfunden.
8. ✓ **Entscheidungen nur als Verweise mit Datum.** `06` enthält einzeilige Verweise und keine kopierten Registertexte.
9. ✓ **Quellen: Datum + SHA + Status; Duplikate/Widersprüche markiert.** `09` enthält Pflichtquellen, Kanon, Code, UI, Digests, Registerdoppelung und die `CURRENT_STATE`-Abweichung.
10. ✓ **Offene Fragen: Empfehlung + „bis dahin in der App“.** Q-G05-001 bis Q-G05-008 enthalten beides sowie die zusätzlich geforderte Spalte `gesucht in`.
11. ✓ **IST-Code/Umbau für jeden vorhandenen Code-Bestandteil entschieden.** `11` entscheidet realen Customer-, Legacy-, Telefonnotiz- und Retentionbestand; keine Migration wird ausgeführt.
12. ✓ **Keine Secrets, keine Mojibake, nur eigener Ordner beschrieben, Datum `JJJJ-MM-TT`.** Sichtprüfung und automatisierte Textprüfung erfolgt; geschrieben wurde ausschließlich in `G05_KUNDEN`.
13. ✓ **Build-Frage: „Könnte ein fremder Builder dieses Modul allein mit diesem Ordner bauen, ohne zu raten?“** Ja: reale Bestandsteile und konkrete Umbauten sind testbar beschrieben; jede noch nicht entschiedene Struktur ist mit Q-ID und nicht klickbarem „In Klärung“ abgesichert und darf vor ihrer Entscheidung nicht gebaut werden.

## Ergebnis

**13/13 erfüllt — Dossierstatus BAUBEREIT.** Dies ist keine Owner-Freigabe, kein Modulstatus `LIVE` und keine Erlaubnis für Provider, Remote-Migration, Deployment oder Echtdatenänderung. Der unabhängige Read-only-Review nach Abschnitt 9 der Anleitung steht als nachgelagerter Import-Gate noch aus.
