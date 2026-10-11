<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Checkliste Vollständigkeit

Prüfgrundlage: `00_ANLEITUNG_MODULDOSSIER.md`, Version 1.1, Abschnitt 7.

| Nr. | Status | Prüfkriterium | Begründung |
|---|---|---|---|
| 1 | ✓ | Alle 12 Pflichtdateien + Bericht vorhanden, Tabellen mit exakten Kopfzeilen. | Dateien `00` bis `11` und `BERICHT_2026-09-26.md` liegen im Dossier; die vorgeschriebenen Tabellenköpfe sind enthalten. |
| 2 | ✓ | Steckbrief vollständig inkl. Anbindung, Gate, Ausgrau-Element + Text, Übertragbarkeit, Rate-Stellen-Nummern. | T-04, Designphase-1-Gate, „Suche — In Aufbau“, app-neutraler Kern/Kreile-Adapter und RT-18/19/22/25/27/29 sind benannt. |
| 3 | ✓ | Jede Anforderung: Quelle + Abnahmekriterium + Stand. | A-G08-001 bis A-G08-026 enthalten alle Pflichtspalten und nur belegte Inhalte. |
| 4 | ✓ | Jede Funktion: alle 7 Zustände mit wörtlichem Text oder begründetem `FEHLT → Q-…`. | F-G08-001 bis F-G08-004 enthalten je Daten, lädt, leer, Fehler, gesperrt, In Klärung und In Aufbau; ungeklärte Kartentexte verweisen auf Q-G08-003. |
| 5 | ✓ | Optikvorlage: Quelle + SHA; drei Geräte je Screen oder „fehlt → Designphase“. | V5-Pointer, V5 und vier Seitenwahrheiten sind gehasht; Desktop/Tablet/Handy und fehlende Zustände sind je Screen ausgewiesen. |
| 6 | ✓ | Schnittstellen: Host-Ports, Feldliste mit Soll-Ist, Datenbesitz, Provider + Secret-Namen + Stand. | Neutraler Vertrag, acht Host-Ports, vollständige Feldliste, View-/Migrations-Ist und Provider-/Secret-Grenzen stehen in `04`. |
| 7 | ✓ | Jeder Konflikt: Zuständigkeit + Anzeigeort. | K-G08-001 bis K-G08-006 nennen Rolf/Gregor, lokalen Anzeigeort und die Grenze einer späteren öffentlichen Home-Projektion. |
| 8 | ✓ | Entscheidungen nur als Verweise mit Datum. | `06` paraphrasiert ausschließlich Register-/Owner-/Planfundstellen und kopiert keine Registertexte. |
| 9 | ✓ | Quellen: Datum + SHA + Status; Duplikate/Widersprüche markiert. | `09` enthält Pflichtquellen, Digests, beide Registerkopien, Mindmap-Duplikate, UI, Ist-Code und Altpakete mit zulässigem Status. |
| 10 | ✓ | Offene Fragen: Empfehlung + „bis dahin in der App“. | Q-G08-001 bis Q-G08-003 sind nach Vorwissenssuche fail-contained; jede Zeile nennt Empfehlung und wörtlichen Zwischenzustand. |
| 11 | ✓ | IST-Code/Umbau für jeden vorhandenen Code-Bestandteil entschieden. | `11` entscheidet Kern, UI, Adapter, Shell, Backstack, Ports, Tests und Alt-/KI-Pfade; Löschung ist nur für T-13 nach Inventar vorgesehen. |
| 12 | ✓ | Keine Secrets, keine Mojibake, nur eigener Ordner beschrieben, Datum `JJJJ-MM-TT`. | Es stehen nur Secret-Namen im Dossier; Umlaute/Anführungszeichen sind UTF-8; geschrieben wurde ausschließlich hier; Datumsformat ist ISO. |
| 13 | ✓ | Build-Frage: Könnte ein fremder Builder dieses Modul allein mit diesem Ordner bauen, ohne zu raten? | Ja: T-04-Soll, vorhandener Salvage, Umbaugrenzen und Abnahme sind eindeutig; L4/Design/Doku-Drift sind mit nicht ausführbaren „In Klärung/In Aufbau“-Zuständen abgesichert. |

## Urteil der Selbstprüfung

Alle 13 Kriterien sind erfüllt. Das Dossier ist **BAUBEREIT**, aber noch nicht **FREIGEGEBEN**. Vor Import verlangt Anleitung 1.1 §9 weiterhin einen unabhängigen read-only Prüfer mit mindestens fünf Stichproben gegen echte Dateien.

