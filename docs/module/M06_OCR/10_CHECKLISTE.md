<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Checkliste M06

Prüfung gegen Abschnitt 7 und die Abgrenzung in Abschnitt 8 der Anleitung 1.1 am 2026-09-26.

| Nr. | Prüfschritt | Ergebnis | Begründung |
|---|---|---|---|
| 1 | Alle 12 Pflichtdateien + Bericht vorhanden, Tabellen mit exakten Kopfzeilen. | ✓ | `00` bis `11`, Erstbericht und `BERICHT_2026-09-26_NACHLAUF.md` sind vorhanden; die vorgeschriebenen kanonischen Tabellenkopfzeilen sind enthalten. |
| 2 | Steckbrief vollständig inkl. Anbindung, Gate, Ausgrau-Element + Text, Übertragbarkeit, Rate-Stellen-Nummern. | ✓ | Pflichtfelder stehen als einzelne `**Feld:**`-Zeilen; app-neutraler Kern mit Grund, RT-22/23/24/31, Session, Arbeits-/Codepfad und Wortlaut sind enthalten. |
| 3 | Jede Anforderung: Quelle + Abnahmekriterium + Stand. | ✓ | A-M06-001 bis A-M06-044 enthalten Muss/Soll, Quelle, testbares Kriterium und `SPEZ`; A-M06-039…042 sind die ausgewiesenen Soll-Anforderungen. |
| 4 | Jede Funktion: alle 7 Zustände mit wörtlichem Text oder begründetem `FEHLT → Q`. | ✓ | F-M06-001 bis F-M06-008 enthalten je Daten, lädt, leer, Fehler, gesperrt, In Klärung und In Aufbau mit Wortlaut/Quelle. |
| 5 | Optikvorlage: Quelle + SHA; drei Geräte je Screen oder fehlend; M-Modul-Inhaltsliste vollständig. | ✓ | V5-SHA/Anker, acht Screens, Desktop/Tablet/Handy jeweils `fehlt → Designphase 1b`, vollständige Inhaltsliste; Q-M06-008 sichert das externe Designgate. |
| 6 | Schnittstellen: Host-Ports, Feldliste mit Soll-Ist, Datenbesitz, Provider + Secret-Namen + Stand. | ✓ | Öffentliche/Host-/Providerports, exakte Feldtabelle, Baseline-/Drizzle-Abgleich, Manifest/Handshake, Provider-/Secretnamen und Übertragbarkeit des app-neutralen Kerns sind enthalten. |
| 7 | Jeder Konflikt: Zuständigkeit + Anzeigeort. | ✓ | K-M06-001 bis K-M06-006 nennen Rolf/Phillip und gemäß OE-2609-26 den Bereich `Dringende Konflikte, Warnungen und Entscheidungen`; vorbeugende Sperren stehen separat. |
| 8 | Entscheidungen nur als Verweise mit Datum. | ✓ | Datei 06 besteht aus der vorgeschriebenen Verweistabelle; OE-2609-17, -20, -25 und -26 sind mit Datum referenziert. |
| 9 | Quellen: Datum + SHA + Status; Duplikate/Widersprüche markiert. | ✓ | Alle bindenden lokalen und historisch gelesenen Git-Dateiquellen haben Datum, Hash und Status; Registerduplikat, V6 und Mindmapkopien sind markiert. Dynamische Microsoft-Referenzen stehen transparent separat ohne erfundenen Byte-Hash; aktuelle Git-Frische ist als externes PL-Gate Q-M06-005 ausgewiesen. |
| 10 | Offene Fragen: Empfehlung + „bis dahin in der App“. | ✓ | Q-M06-001 bis Q-M06-003 sind `GEKLÄRT`; Q-M06-004 bis Q-M06-010 enthalten Optionen, Empfehlung, Zuständigkeit, gesuchte Quellen und einen fail-closed App-Zustand. |
| 11 | IST-Code/Umbau für jeden vorhandenen Code-Bestandteil entschieden. | ✓ | Quarantänerouten/-provider, UI, Originalbasis, Tests, Drizzle/Baseline und Fachtabellen sind in Datei 11 bewertet. |
| 12 | Keine Secrets, keine Mojibake, nur eigener Ordner beschrieben, Datum `JJJJ-MM-TT`. | ✓ | Nur Secretnamen; UTF-8 ohne BOM und Mojibake-Prüfung bestanden; keine Änderung außerhalb dieses Dossierordners; ISO-Daten. |
| 13 | Build-Frage: Könnte ein fremder Builder dieses Modul allein mit diesem Ordner bauen, ohne zu raten? | ✓ | Ja. Der M06-Kern ist vollständig spezifiziert; alle offenen Gates haben Zuständigkeit und einen fail-closed `In Klärung`-/`In Aufbau`-Zustand. Modul-/Adoptionsgates bleiben grau ohne Route, das engere Aufbewahrungsgate sperrt nur die Lösch-/Anonymisierungsaktion. |

## Resultat

13 von 13 Punkten erfüllt. Nach Anleitung §7 Punkt 13 und §8 verhindern die abgesicherten externen Gates den Dossierstatus nicht. Der Dossierstatus lautet `BAUBEREIT`; dies ist keine Aussage, dass Modul, Provider oder Anbindung gebaut, freigegeben oder live sind.
