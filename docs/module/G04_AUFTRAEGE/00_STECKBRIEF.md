<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G04 · Aufträge — Steckbrief

**Zweck:** G04 ist die verlässliche Auftragswahrheit von der Annahme bis zur Abholung. Das Modul zeigt Liste und lebende Auftragskarte, führt den linearen Status, Teile, Termine und den prüfbaren Verlauf und liefert Termin- und Statusfakten an Startseite, Werkstatt, Suche und Analyse.

**Stufe:** Grundstamm

**Dossier-Status:** BAUBEREIT

**Modul-Status:** ADOPTIERT

**Zuständige Session:** Grundstamm-PL-Kontext, Session `01a0ce4b`

**Arbeitsordner:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_MODULDOSSIERS\G04_AUFTRAEGE`

**Code-Pfad:** `02_app/src/modules/orders` sowie die dünnen Routen/Adapter unter `02_app/src/app/orders`; geprüfte Lieferwahrheit `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`

**Braucht:** G01 Identität/Berechtigungsfähigkeiten und Evidenz-Fundament für Dokument-/Fotoreferenzen; G05 Kunden-Kurzakte; G06 KV-Wunschtermin und Zuschlag; G07 Zahlungs- und Warenausgangs-Gates; G09 Konfliktverteilung; G10 Katalog, Stundensatz und konfigurierbare Regeln; M04 Kalenderprojektion erst nach dessen eigenem Gate.

**Wird gebraucht von:** G02 Shell/Startseite/Werkstatt, G03 Anlegen/Intake, G05 Kundenakte, G06 Kostenvoranschlag, G07 Geld & Rechnungen, G08 Suche, G09 Konflikte/Sperren, M02 Analyse/Termintreue und später M04 Kalenderprojektion.

**Anbindungszeitpunkt + Gate:** Kern ist bereits adoptiert. Der Umbau der k2-Oberflächen erfolgt in T-02 auf das Designsystem; Terminänderung, Abholtermin und Terminprojektionen werden erst nach Fresh-Database-Replay, Modul-/Authority-Gate, Receipt+Readback-E2E und Owner-UX für 1914×917, 1220×880 und 390×844 aktiviert. Eine Microsoft-Spiegelung ist kein Gate für die G04-Terminwahrheit und bleibt bis zum separaten M04-Transfergate aus.

**Bis dahin im Grundstamm:** Ausgegraute Elemente `„Auftragsstorno – In Klärung“` und `„Termine Woche/Monat – In Aufbau“`; keine klickbare Attrappe und kein stiller Ersatzweg.

**Übertragbarkeit:** Kern app-neutral: ja — Identität, Lebenszyklus, versionierte Termine, Ereignisse und Read-/Command-Verträge bleiben neutral; Bezeichnungen, Oberflächenkatalog, Zahlungsabläufe und Kalenderzuordnung von Kreile liegen ausschließlich im Kreile-HostAdapter.

**Rate-Stellen aus Red-Team:** RT-03, RT-09, RT-15, RT-18, RT-19, RT-22, RT-23, RT-25, RT-28, RT-30

**Stand:** 2026-09-26

**Bearbeiter:** Codex (Writer); unabhängiger Read-only-Review gemäß Anleitung §9 noch vor Import
