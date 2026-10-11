<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G02 — Shell und Startseiten

**Zweck:** G02 stellt nach erfolgreicher Anmeldung die Kreile-Shell, die Navigation je Geräteklasse und die persönliche Startseite für Rolf, Phillip und Gregor bereit. Die Startseite bündelt oben dringende Konflikte, Warnungen und Entscheidungen je Zuständigkeit und darunter den Tagesüberblick; sie erzeugt keine eigene Fachwahrheit, sondern komponiert ausschließlich öffentliche Read-Ports der besitzenden Module.
**Stufe:** Grundstamm
**Dossier-Status:** BAUBEREIT
**Modul-Status:** ADOPTIERT
**zuständige Session:** Grundstamm-PL-Kontext 01a0ce4b
**Arbeitsordner:** `02_app`
**Code-Pfad:** kein neues `src/modules/g02`; bestehende Komposition in `src/app/page.tsx`, `src/components/layout/`, `src/components/home/` und `src/modules/werkstatt/`
**braucht (Module/Ports):** G01 Autorisierung und effektive Rechte; G04 Auftragsprojektion und Deep-Links; G09 `ConflictFeedPort`; G03 globales Anlegen; G05 Kunden-Deep-Link; G07 Geld-/Rechnungsnavigation; später M04 Kalender-/Abwesenheitsprojektion und M02 dringende Analysehinweise
**wird gebraucht von:** allen Grundstamm-Modulen als App-Rahmen und Rückkehrpunkt; G09 als Anzeigeort; M02 und M04 bei späterer Anbindung
**Anbindungszeitpunkt + Gate:** Umbau der vorhandenen Shell/Startseiten nach Designphase 1 und bestandenem Designsystem-Gate; G09-Anzeige nach G09-Portabnahme; M04/M02-Elemente erst nach jeweiliger Modulabnahme und Owner-Transfergate
**Bis dahin im Grundstamm:** Kalenderdaten als nicht klickbares Element „Kalenderabgleich — In Aufbau“; noch nicht eindeutig ableitbare Kapazitätskonflikte als „Konflikte & Kapazität — In Klärung“; keine Route zu Analyse oder Kalender
**Übertragbarkeit:** Kern app-neutral: ja — Shell, Geräteschwellen, Komposition und Zustandsmodell bleiben fachneutral; Kreile-Bezeichnungen, Personenabbildung, Menü und Portverdrahtung liegen ausschließlich im Kreile-HostAdapter
**Rate-Stellen aus Red-Team:** RT-03, RT-06, RT-07, RT-08, RT-09, RT-19, RT-21, RT-22, RT-23, RT-25, RT-26, RT-28, RT-30
**Stand:** 2026-09-26
**Bearbeiter:** Codex, Writer; unabhängiger Read-only-Review ist Import-Gate gemäß Anleitung §9

## Abgrenzung

- G02 besitzt keine Aufträge, Kunden, Konfliktregeln, Kalendertermine, Abwesenheiten, Analysewerte oder Berechtigungen.
- G02 schreibt keine Domain-Events und legt keine Tabellen, Providerzugänge oder Secrets an.
- Kreile ist der einzige Tenant dieses Dossiers; Anforderungen anderer Zielapps sind nicht enthalten.
- Aktueller Codebestand ist kein Liefernachweis: Die lokale `origin/main`-Referenz steht auf `21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`; ein frischer Fetch war wegen fehlendem Schreibzugriff auf `.git/FETCH_HEAD` am 2026-09-26 nicht möglich.
