<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M01_BUCHHALTUNG — Vollständigkeitscheck

Selbstprüfung nach Abschnitt 7 der Dossier-Anleitung Version 1.1, Stand 2026-09-26.

| Nr. | Prüfkriterium | Ergebnis | Begründung |
|---|---|---|---|
| 1 | Alle 12 Pflichtdateien + Bericht vorhanden, Tabellen mit exakten Kopfzeilen. | ✓ | `00` bis `11`, `BERICHT_2026-09-26.md` und der Nacharbeitsbericht sind angelegt; Pflichtkopfzeilen wurden formal geprüft. |
| 2 | Steckbrief vollständig inkl. Anbindung, Gate, Ausgrau-Element + Text, Übertragbarkeit, Rate-Stellen-Nummern. | ✓ | Alle Pflichtfelder stehen in `00`; Element lautet exakt „Buchhaltungs-Kontrollzentrum“ / „In Aufbau“. |
| 3 | Jede Anforderung: Quelle + Abnahmekriterium + Stand. | ✓ | A-M01-001 bis A-M01-045 enthalten Quelle, testbares Kriterium und erlaubten Inhaltsstatus. |
| 4 | Jede Funktion: alle 7 Zustände mit wörtlichem Text oder begründetem `FEHLT → Q-…`. | ✓ | F-M01-001 bis F-M01-014 verweisen auf die gemeinsame, ausdrücklich für jede Funktion geltende 7-Zustände-Tabelle; offene Copys gehen an Q-M01-011. |
| 5 | Optikvorlage: Quelle + SHA; drei Geräte je Screen oder „fehlt → Designphase“; M-Module: vollständige Inhaltsliste je Screen. | ✓ | V5 mit vollem SHA und Anker ist abgegrenzt; zwölf geplante Screens haben Desktop/Tablet/Handy-Status und vollständige Inhaltsliste. |
| 6 | Schnittstellen: Host-Ports, Feldliste mit Soll-Ist, Datenbesitz, Provider + Secret-Namen + Stand. | ✓ | C2-/Hostports, exakte Feldliste, Schemaabgleich, Manifest/Handshake und Provider stehen in `04`; OE-2609-25 begrenzt Produktivbetrieb auf Kreiles Tenant/Azure-Abo, und Supabase Cron + Outbox ist mit offenem Kostengate belegt. Unbekannte Secret-Namen bleiben als Q-M01-005/006/007/015 gesperrt. |
| 7 | Jeder Konflikt: Zuständigkeit + Anzeigeort. | ✓ | K-M01-001 bis K-M01-017 nennen Rolf/Phillip und jeweils „Startseite › Handlungsbedarf“ sowie Auflösung. |
| 8 | Entscheidungen nur als Verweise mit Datum. | ✓ | `06` enthält ausschließlich IDs/Fundstellen, Einzeiler, Datum und Geltungsstatus, einschließlich OE-2609-25 vom 2026-09-26. |
| 9 | Quellen: Datum + SHA + Status; Duplikate/Widersprüche markiert. | ✓ | `09` enthält lokale SHA-12, Abrufkennzeichnung für amtliche URLs sowie OP-01, OP-02, verworfene UI-Pakete und Candidate-/Remotegrenzen. |
| 10 | Offene Fragen: Empfehlung + „bis dahin in der App“. | ✓ | Q-M01-001 bis Q-M01-016 enthalten zusätzlich die vorab durchsuchten Fundstellen und eine harte Zwischenregel; Q-M01-016 hält das Produktiv-/Kostengate „In Klärung“. |
| 11 | IST-Code/Umbau für jeden vorhandenen Code-Bestandteil entschieden. | ✓ | Aktiver Grundstamm, Candidate.2 mit nachgezählten 86 Dateien insgesamt, Legacy-Routen/-clients, Provider, Schema, Mocks, Stubs und fremde Consumer sind in `11` erfasst. |
| 12 | Keine Secrets, keine Mojibake, nur eigener Ordner beschrieben, Datum `JJJJ-MM-TT`. | ✓ | Es stehen nur fehlende Secret-Namen/Gates im Dossier; geschrieben wurde nur im eigenen Dossierordner, `02_app` und der Off-Repo-Kandidat blieben read-only. |
| 13 | Build-Frage: Könnte ein fremder Builder dieses Modul allein mit diesem Ordner bauen, ohne zu raten? | ✓ | Ja, sliceweise: jede offene Produkt-/Strukturfrage stoppt genau den betroffenen Slice als „In Klärung/In Aufbau“; Ports, Datenbesitz, Reihenfolge, Tests und Rückbaugrenzen sind festgelegt. |

## Abgrenzung der Prüfung

`✓` bei Punkt 13 erlaubt keinen Bau hinter einem offenen Gate. Der Builder kann ohne Raten erkennen, **was** gebaut werden darf, **wo** gestoppt werden muss und **welcher** Nachweis das Gate öffnet. Die nach Anleitung §9 zusätzlich vorgesehene unabhängige Dossierprüfung ist ein nachgelagerter Import-/Warteschlangen-Gate und wurde von diesem einzelnen Writer nicht vorgetäuscht.
