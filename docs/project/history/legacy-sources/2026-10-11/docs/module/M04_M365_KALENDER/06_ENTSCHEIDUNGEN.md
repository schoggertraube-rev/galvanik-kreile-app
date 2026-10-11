<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 06 — Entscheidungsverweise

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| D-GOV-001 / `DOCUMENT_AUTHORITY.md` | Bei Widerspruch gilt die festgelegte Dokumentautorität; Chat/Arbeitsartefakt ist nicht automatisch Kanon. | 2026-09-21 | gilt |
| D-ARCH-011 / Entscheidungsregister Repo-Kopie | Microsoft Graph hinter tenantneutralem CalendarPort; App ist Wahrheit, kein Google-/Demo-Fallback, realer E2E Pflicht. | 2026-09-21 | gilt |
| D-UI-CORE-002 / Entscheidungsregister Repo-Kopie | Kalender-/Integrationsroute bleibt bis realer Providerabnahme geschlossen. | 2026-09-21 | gilt; aktueller Repo-Abgleich Q-M04-011 |
| D-UI-V5-003 / Entscheidungsregister Repo-Kopie | V5 ist verbindliche Designsprache; V6-Beschlüsse sind verworfen. | 2026-09-21 | gilt |
| `MODULKARTE_KANON.md` / Kalender | Kalender ist Pflicht vor F1.6, Woche/Monat, fachmodulgetriebene Termine, Outlook als Projektion. | 2026-09-21 | gilt |
| `ARCHITEKTUR_MODULE_PATH1.md` / M365 Kalender | Port-, Provider-, Auth-, Retry-, Delta-, Readback- und UI-Zustandsgrenzen. | 2026-09-15 | gilt |
| Mission F1 / `p3_kreile_adapter` und Providerstatus | M365 Kalender ist `NOT_STARTED_BLOCKED_EXTERNAL_PERMISSION`; delegierter benannter Bürobenutzer ist Ziel. | 2026-09-21 | gilt |
| OE-2609-04 / Owner-Entscheidungen | Spätere Module werden innerhalb gebauter Grundstamm-Screens als nicht klickbares Element markiert. | 2026-09-25 | gilt; §6-Abgrenzung: Element ja, Route nein |
| OE-2609-05 / Owner-Entscheidungen | Module kommen nach Grundstamm und eigener Abnahme. | 2026-09-25 | gilt |
| OE-2609-09 / Owner-Entscheidungen | Alle Personen lesen grundsätzlich alles; Admin darf sperren/erweitern. | 2026-09-26 | gilt |
| OE-2609-17 / Owner-Entscheidungen | BAUBEREITE Modulkerne werden off-repo mit höchstens zwei Läufen parallel in Kreile-Reihenfolge M01→M07 gebaut; Anbindung bleibt seriell. | 2026-09-26 | gilt |
| OE-2609-18 / Owner-Entscheidungen | Lizenziertes Kreile-Büropostfach als delegierter Benutzer; App nutzt dessen Hauptkalender, Rolf/Phillip binden ihn in Outlook ein. | 2026-09-26 | gilt; Q-M04-003 geklärt |
| OE-2609-19 / Owner-Entscheidungen | Kalender hauptsächlich im Hintergrund; App schreibt Auftragstermine, liest Betriebstermine/Abwesenheiten read-only und rendert festgelegte Outlook-Inhalte/App-Links. | 2026-09-26 | gilt; Q-M04-008 Inhalt und Q-M04-013 Anzeige geklärt |
| OE-2609-20 / Owner-Entscheidungen; Red-Team R3 / `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` | Fristen je Datenart; Lösch-/Anonymisierungsvorschlag nur mit Admin-Freigabe; app-erzeugte Outlook-Kopien folgen der freigegebenen Anonymisierung/Löschung, andere Postfachinhalte bleiben unberührt. | 2026-09-26 | gilt; konkrete M04-Zuordnung Q-M04-016 |
| OE-2609-25 / Owner-Entscheidungen | Produktive M365-/Azure-Ressourcen gehören Kreile; Owner-Dev bleibt auf synthetische Tests begrenzt, E2E wird im Kreile-Tenant wiederholt. | 2026-09-26 | gilt; Q-M04-009 geklärt, Ausführung Q-M04-014 |
| OE-2609-26 / Owner-Entscheidungen | Startseite: Dringendes oben; darunter Tagesüberblick mit Aufträgen, Terminen, Bündelung und anstehenden Abwesenheiten. | 2026-09-26 | gilt |
| PL-Entscheidung Hintergrund-Jobs / `HINWEIS_OWNER_OE-2609-25.md` | Supabase Cron plus DB-/Edge-Funktionen und Job-/Outbox-Receipts; Vercel-Route queued Microsoft-Benachrichtigungen nur in die DB. | 2026-09-26 | gilt; Q-M04-006 geklärt |
| Red-Team R5 / `..\00_PROJEKT\REDTEAM_GESAMT_2026-09-26.md` | Delegierte Anmeldung und Graph-Abonnements per Erneuerungsjob überwachen; bei Ablauf Gregor auf seiner Startseite warnen. | 2026-09-26 | gilt; A-M04-043 |
| OP-01 / Offene Punkte | Zwei abweichende Registerkopien; Repo-Kopie mit D-UI-V5-003 ist Arbeitsautorität. | 2026-09-26 | gilt als letzter verfügbarer Stand; Revalidierung Q-M04-011 |
| OP-11 / Offene Punkte | M365-Consent, Credential, Lizenz und Kreile-Ressourcen sind am externen Owner-Gate bereitzustellen. | 2026-09-26 | gilt; Q-M04-014 |
| später Koordinator-Digest `KOORD_late.md` | Historische Dev-Ressourcen ersetzen keine Kreile-Produktressource und bleiben disconnected. | 2026-09-25 | durch OE-2609-25 für Produktion präzisiert |
