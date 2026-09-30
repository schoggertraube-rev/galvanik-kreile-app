<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# KREILE — OFFENE PUNKTE (gebündelt)
**Stand:** 2026-09-26 · **Owner:** Siglinder · **PL:** Cowork-PL
**Hinweis:** Kanonische Repo-Änderungen verschoben, bis git/GitHub erreichbar (~1.10.). Jetzt kein App-Bau. Detailklärungen laufen in den Moduldossiers (`_MODULDOSSIERS\<Ordner>\08_OFFENE_FRAGEN.md`); hier nur projektweite Punkte.
**Status:** OFFEN(Owner) · OFFEN(PL) · GEKLÄRT · VERSCHOBEN(git) · GATE · LÄUFT

| ID | Thema | Stand / Beschluss | Wer | Bis dahin in der App | Status |
|---|---|---|---|---|---|
| OP-01 | Register-Divergenz V5/V6 | Merge Master-first, byte-identisch; D-UI-V5-003 gilt, V6 verworfen; OE-2609-01…16 eintragen | PL | — | VERSCHOBEN(git) |
| OP-02 | Kanon-Abgleich MODULKARTE | Module hinten angestellt (nicht „entfällt"); Leadership ergänzen; Ausgrauen-Element erlauben; Terminübersicht im Grundstamm (vs. D-ARCH-011); Analyse-Menüpunkt (OE-2609-22) | PL | ausgegraut | VERSCHOBEN(git) |
| OP-03 | Skonto | nur bei Rechnung auf Ziel je Kunde (OE-2609-11); Zahlungsparameter, keine autonome Buchungslogik | — | — | GEKLÄRT |
| OP-04 | Zahlungsmodell | Abholung ⇒ bar/Karte, sonst Vorkasse; Rechnung auf Ziel als Ausnahme je Kunde (OE-2609-07/11) | — | greift bei T-08 | GEKLÄRT |
| OP-05 | Designsystem | Auftrag Design-Chat fertig: `_DESIGN_VERBINDLICH\BUNDLE\01_AUFTRAG_DESIGN_KREILE.md (Bundle: BUNDLE\00_START_HIER.md)` (Schritt 1 DS + 1b Kundenansicht sofort; Schritt 2 nach Dossier-Prüfung) | Owner öffnet Design-Chat | alte Token-CSS | GATE |
| OP-06 | P0-Storno | App-Schicht vorhanden, DB-Schicht fehlt, nicht abgenommen | PL | — | OFFEN(PL) |
| OP-07 | ratchet Required | wieder eintragen | PL | — | VERSCHOBEN(git) |
| OP-08 | Route-/Modul-Hygiene | 15 Alt-Routen, 2 Token-CSS, 2 Suchen, Stubs → T-13 | PL | fail-closed | OFFEN(PL) |
| OP-09 | OCR/KI-Provider | Azure DI/OpenAI, Datenschutz/AVV — im Dossier M06/M07; Dev DI F0 + Foundry vorhanden → OP-36 | Owner (Gate) | ausgegraut | GATE |
| OP-10 | Suche L4 | Dokument-Port → Dossier G08 | PL | — | OFFEN(PL) |
| OP-11 | M365-Grenzen | Consent/Entra/Secrets/Kosten/Testkonto → Dossier M04/M05; Dev vorhanden, Prod offen → OP-36 | Owner (Gate) | geschlossen | GATE |
| OP-12 | Stale-Docs | 00_BIBEL_INDEX, CURRENT_STATE | PL | — | VERSCHOBEN(git) |
| OP-13 | Go-live-Gates | inkl. ZUGFeRD-Prüfung; Steuerberater/Datenschutz bestätigt Aufbewahrungsfristen (OE-2609-20) | Owner/PL | LIVE=NO_GO | GATE |
| OP-14 | Owner-Befunde G5/G3/G4/G7 | Phase 3 | Bau | — | OFFEN(PL) |
| OP-15 | Master-Pflege | Sync-Prozess Register verankern | PL | — | OFFEN(PL) |
| OP-16 | Kartenterminal | integriert (OE-2609-12); Anbieter/Vertrag/Kosten/Secrets am Gate (M01) | Owner (Gate) | Kassieren-Bestätigung; Terminal-Element „In Aufbau" | GATE |
| OP-17 | Termine/Konflikte | Umfang „alles nach USP" (OE-2609-13); Ableitung aus Vorwissen → Dossiers G09/G02/G04 | PL | — | LÄUFT |
| OP-18 | Rechte-Modell | alles für alle, Admin steuert je Person (OE-2609-09) → G01/G10, T-05 | PL | — | LÄUFT |
| OP-19 | E-Rechnung | ZUGFeRD vor Livegang (OE-2609-14) → G07, T-09 | — | — | GEKLÄRT |
| OP-20 | kette.py-Kontext | MOCK-TREUE → Designsystem (T-01), erst bei Bau-Start, mit Sicherung | PL | k5/k6 hold | OFFEN(PL) |
| OP-21 | Umbau k1–k4 | auf Designsystem (T-02) | Bau | — | OFFEN(PL) |
| OP-22 | Fehlende Tickets | Rolf „Der Tag" (T-03), Suche/Backstack (T-04) | PL | — | OFFEN(PL) |
| OP-23 | Offline + Backup/Restore | Phase 3 | PL | — | OFFEN(PL) |
| OP-24 | Export Ausgangsrechnungen | T-10 | PL | — | OFFEN(PL) |
| OP-25 | Moduldossiers | 17/17 GEPRÜFT (Sonnet + PL-Abnahme, `PRUEFUNG_DOSSIERS_2026-09-26.md`); Import per Docs-PR OP-27 | PL | — | GEKLÄRT |
| OP-26 | Lerninsel-Abstimmung | Beantwortet 2026-09-26 im Lerninsel-Projekt. Für Kreile nur: Kerne app-neutral, Zielapp-Anpassungen in deren HostAdapter, keine gemeinsamen Ressourcen (Owner: nicht vermischen) | — | — | GEKLÄRT |
| OP-27 | Docs-Import 02app | ein Docs-PR mit Dossiers + Plan + Offene Punkte | PL | — | VERSCHOBEN(git) |
| OP-28 | M04 entmischen | erledigt (Nachlauf + Nacharbeit, GEPRÜFT) | PL | — | GEKLÄRT |
| OP-29 | Lerninsel-Gruppenergebnis | kein Kreile-Punkt (Lerninsel-Projekt) | — | — | GEKLÄRT |
| OP-30 | Reihenfolge Modulkern-Bau (off-repo) | Parallel, max. 2 Läufe, Priorität Kreile-Reihenfolge M01→M07, Abhängigkeiten beachtet (OE-2609-17) | — | — | GEKLÄRT |
| OP-31 | Outlook-Kalender | Hauptkalender des eigenen Kreile-Büropostfachs (OE-2609-18) | — | M04 ausgegraut | GEKLÄRT |
| OP-32 | E-Mail-Postfach | eigenes Kreile-Büropostfach, benannter Nutzer, delegiert (OE-2609-18); Lizenz/Kosten am Gate OP-11 | — | M05 ausgegraut | GEKLÄRT |
| OP-33 | Inhalte & Aufbewahrung | Outlook-Inhalt OE-2609-19; Aufbewahrung OE-2609-20 (DSGVO; Geschäfts-/Analysedaten länger, anonymisiert) | — | keine Löschfunktion bis Bau | GEKLÄRT |
| OP-34 | Analyse: erste Kennzahl | Termintreue (OE-2609-21) | — | M02 ausgegraut | GEKLÄRT |
| OP-35 | Analyse: Platzierung | eigener Menüpunkt, vollständige Analyse; Startseite nur dringende Konflikte/Warnungen/Entscheidungen (OE-2609-22) | — | kein Menüpunkt bis Anbindung | GEKLÄRT |
| OP-36 | Produktivumgebung Microsoft/Azure | Kreile-eigener Tenant + Azure-Abo, Siglinder Admin (OE-2609-25); Anlage/Verträge/Kosten am Gate | Owner (Gate) | Dev-E2E synthetisch erlaubt | GEKLÄRT |
| OP-37 | Hintergrund-Jobs Plattform | Supabase Cron + Edge/DB-Funktionen, Webhook-Eingang über Vercel-Route (PL-Entscheidung 2026-09-26, siehe REDTEAM_GESAMT §4); Vercel Pro + Supabase Pro für Livegang → Kosten-Gate | PL / Owner (Kosten) | — | GEKLÄRT |
| OP-38 | Kette: Queue + k4 | übergeben an Bau-Dirigent (Parallel-Chat): Kette auf Claude Code + Hintergrund-Phase, #113 parken, Bauplan B1–B9 + P-DS (`UEBERGABE_BAU_HINTERGRUND_2026-09-26.md` §5/§6) | Bau-Dirigent | kein UI-Bau | LÄUFT |
| OP-39 | Outlook-Kopien & DSGVO | Anonymisieren/Löschen der Outlook-Kopien mit OE-2609-20 (R3); Token-/Abo-Überwachung (R5) | PL → M04/M05 | — | OFFEN(PL) |
| OP-40 | Designphase-Umfang | Zusatz-Screens aus OE-2609-19…24 in Phase-1b-Liste (R6); Startseite geklärt (OE-2609-26) | PL | — | OFFEN(PL) |
| OP-41 | Dossier-Grundlagen | git-Snapshot für Codex-Sandbox (R9); Azure-Abo-Trennung Lerninsel prüfen (R8); E-Rechnung-Empfangsweg bis M01 (R11) | PL | — | OFFEN(PL) |
| OP-42 | Hintergrund-Bau | Bau-Dirigent = Codex-Session 01a0df64-5f91-7662-b3c4-021ccc582844; B1–B9 laut Übergabe; echter Fortschritt stündlich (`MELDUNGEN_KREILE.md`), Wächter je Paket; Merge nur Owner nach CI-Rückkehr | Bau-Dirigent | — | LÄUFT |
