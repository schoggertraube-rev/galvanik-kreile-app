<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G06 KV / Angebot — Vollständigkeitscheck

Prüfung gegen `00_ANLEITUNG_MODULDOSSIER.md` Version 1.1, Abschnitt 7, am 2026-09-26.

1. ✓ Alle 12 Pflichtdateien plus `BERICHT_2026-09-26.md` sind vorhanden; die vorgeschriebenen Tabellen beginnen mit den exakten Kopfspalten.
2. ✓ Der Steckbrief enthält Zweck, Stufe, beide Status, Session, Arbeits-/Codepfad, Abhängigkeiten, Verbraucher, Zeitpunkt/Gate, Ausgrau-Elemente samt Wortlaut, Übertragbarkeit und konkrete Red-Team-Rate-Stellen.
3. ✓ Jede Anforderung besitzt Quelle, testbares Abnahmekriterium und einen zulässigen Standwert.
4. ✓ Jede der sechs Funktionen beschreibt alle sieben Zustände mit wörtlichem Text; nicht belegte Texte verweisen ausdrücklich auf Q-G06-002/-003/-004.
5. ✓ Die verbindliche V5-Quelle ist mit vollem SHA-256 und Ankern genannt; alle Screens enthalten Desktop/Tablet/Handy oder `fehlt → Designphase 1` sowie Zustandsdeckung.
6. ✓ Angebotene Ports, benötigte Host-Ports, Events, vollständige Feldliste mit Soll-Ist, Datenbesitz, Manifest/Handshake-Abgrenzung, Provider und Secret-Besitz sind dokumentiert.
7. ✓ Jeder persistente Konflikt hat Zuständigkeit, Anzeigeort, sichere Auflösung und Stand; lokale Validierungsfehler sind davon abgegrenzt.
8. ✓ Entscheidungen stehen ausschließlich als knappe Verweise mit Datum und Geltungsstatus; Registertexte wurden nicht dupliziert.
9. ✓ Quellen besitzen Datum, SHA-256 (12) und Status; Registerduplikat, alter Prozess, Alt-UI, historische Evidence und verworfene V6 sind markiert.
10. ✓ Jede offene Frage enthält Optionen, eine Empfehlung, Zuständigkeit, Suchorte und den sicheren Wortlaut bis zur Klärung.
11. ✓ Jeder relevante vorhandene Codebestandteil einschließlich Kern, Adapter, UI, CSS, Migrationen, Tests, Evidence und totem Altpfad hat eine Umbauentscheidung.
12. ✓ Das Dossier enthält keine Secret-Werte, keine fremden Zielapp-Anforderungen, keine Mojibake, nur ISO-Daten und beschreibt als Schreibziel ausschließlich seinen eigenen Ordner.
13. ✓ Build-Frage: Ein fremder Builder kann den belegten Kern und den Designsystem-Umbau ohne Raten umsetzen; alle fachlich offenen Erweiterungen sind nicht klickbar als `In Klärung`/`In Aufbau` gegatet und dürfen vor Klärung keine Datenstruktur oder Provideraktion erzeugen.

## Selbstprüfgrenze

Die technische Selbstprüfung ersetzt nicht den nach Anleitung §9 vorgeschriebenen unabhängigen Read-only-Review vor Import/Bau-Warteschlange. Dieser Post-Dossier-Gate ändert den Dossier-Status nicht.

