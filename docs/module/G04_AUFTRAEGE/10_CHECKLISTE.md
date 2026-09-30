<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G04 · Vollständigkeitscheck

Prüfdatum: 2026-09-26. Bewertet wird das Dossier gemäß Anleitung §7; externe Bau-, Design-, Provider-, Datenschutz- und Importgates sind getrennt ausgewiesen.

1. ✓ **Alle 12 Pflichtdateien + Bericht vorhanden, Tabellen mit exakten Kopfzeilen.** Dateien `00` bis `11`, `BERICHT_2026-09-26.md` und `BERICHT_2026-09-26_NACHARBEIT.md` sind angelegt; die vorgeschriebenen Tabellenköpfe wurden wörtlich übernommen.
2. ✓ **Steckbrief vollständig.** Anbindung, Gate, zwei sichere Ausgrau-Elemente mit Wortlaut, Übertragbarkeit und Red-Team-Nummern sind enthalten.
3. ✓ **Jede Anforderung belegt.** Jede Zeile in `01_ANFORDERUNGSKATALOG.md` enthält Quelle, testbares Abnahmekriterium und einen zulässigen Stand.
4. ✓ **Alle sieben Zustände behandelt.** Liste, Karte und neue Terminübersicht enthalten Daten, lädt, leer, Fehler, gesperrt, In Klärung und In Aufbau; fehlende neue Texte verweisen auf Q-G04-006.
5. ✓ **Optikvorlage vollständig abgegrenzt.** V5/V8 mit SHA, Desktop/Tablet/Handy, fehlende Designphase-1b-Flächen und vollständige Inhaltslisten sind dokumentiert; Mock-CSS ist nicht Ziel.
6. ✓ **Schnittstellen vollständig.** Angebotene und benötigte Ports, Events, Feldliste mit Soll-Ist/Datenbesitz, Manifeste, Provider, Secret-Namen beziehungsweise ausdrücklich kein modul-eigenes Secret und Owner-Grenzen sind enthalten.
7. ✓ **Jeder Konflikt ist routbar.** Alle K-G04-Zeilen nennen Zuständigkeit, Anzeigeort, Erkennung und Auflösung.
8. ✓ **Entscheidungen nur als Verweise.** `06_ENTSCHEIDUNGEN.md` enthält IDs/Fundstellen, Kurzform, Datum und Gültigkeit, keine kopierten Registertexte.
9. ✓ **Quellen aktuell bewertet.** Datum, SHA-256 (12), zulässiger Status und Ersatzquelle sind aufgeführt; Registerkopie, HTML/PDF, Bauanleitung, Digests, veralteter CURRENT_STATE, Schema/Manifest und verworfene V6 sind markiert. Platzhalterpfade und nicht vorhandene Scheinanker wurden durch echte Pfade plus Fundstellen ersetzt; fehlende Dateien sind ausdrücklich `FEHLT`.
10. ✓ **Offene Fragen sicher.** Jede Frage hat Optionen, Empfehlung, Zuständigkeit, Status und den wörtlichen beziehungsweise technischen Zustand `bis dahin in der App`.
11. ✓ **Ist-Code vollständig entschieden.** Routen, Adapter, UI/CSS, Domain, Commands/Reads, Schema/Migrationen, Manifest/Fassaden, Tests und Legacy-Auswertungen haben eine Umbauentscheidung. Der nicht vorhandene Lifecycle-Sammelpfad ist durch `src/lib/server/commands/orderStationCommand.ts`, `src/lib/server/commands/orderFreezeCommand.ts` und `src/lib/server/commands/recordGoodsOutCommand.ts` ersetzt; alle weiteren expliziten Repo-Pfade sind vorhanden oder `FEHLT` gekennzeichnet.
12. ✓ **Sicherheits-/Formregeln eingehalten.** Keine Secret-Werte, keine Echtkundendaten, keine Mojibake; nur der freigegebene Dossierordner wurde beschrieben; alle Dossierdaten verwenden `JJJJ-MM-TT`.
13. ✓ **Build-Frage bestanden.** Ein fremder Builder kann den freigegebenen G04-Kern anhand dieses Ordners bauen: technische Soll-Verträge sind eindeutig; ungeklärte Produkt-/Designteile bleiben sichtbar nicht klickbar `In Klärung`/`In Aufbau` und dürfen vor Gate-Schluss nicht als implementiert gelten.

## Ergebnis

**Dossier-Status:** BAUBEREIT

Die unabhängige Prüfung vom 2026-09-26 ist die Grundlage dieser Nacharbeit. Ein erneuter unabhängiger Review des korrigierten Stands wurde in diesem Lauf nicht behauptet.
