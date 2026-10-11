<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M01_BUCHHALTUNG — Steckbrief

**Zweck:** M01 erweitert den bereits gebauten engen Rechnungs-/Zahlungskern zu einem Buchhaltungs-Kontrollzentrum für Kreile: sichere Korrekturen, Belegeingang einschließlich E-Rechnungen, Bankabgleich, Gutschrift/Refund, Kosten, Mahnwesen, Export und belastbare Liquiditätsdaten. Es erzeugt keine zweite Rechnungs-, Zahlungs-, Analyse- oder Steuerwahrheit; jede Mutation läuft über genau einen bestätigten Fachcommand mit Receipt und unabhängigem Readback.
**Stufe:** hinten angestellt
**Dossier-Status:** BAUBEREIT
**Modul-Status:** OFF_REPO_KANDIDAT (Candidate.2 verifiziert, PARKED_NOT_ADOPTED; Anbindung HINTEN_ANGESTELLT)
**zuständige Session:** 01a0a938
**Arbeitsordner:** `C:\Users\Traube\Documents\Codex\2026-09-16\du`
**Code-Pfad:** off-repo `work/accounting-core-contract-v1-candidate2/`, Core-SHA-256 `cada15a2541b` (vollständig: `cada15a2541b215bb2554003b5fcce605334eaef9680879291092ed08597ddcc`); im Produkt nur schmaler Bestand unter `src/modules/accounting/`, nicht adoptiert
**braucht (Module/Ports):** G01 Autorisierung/Tenant/Personenrechte; G07 kanonische Rechnungs-/Zahlungsreads und -commands; G10 Einstellungen für Zahlungsregeln und geplante Liquiditätseingaben; G02/G09 Handlungsbedarf und Konfliktanzeige; `DOCUMENT_ORIGINAL_V1`; später M05 Zustellport, M06 OCR-Vorschläge und freigegebene PaymentAdapter
**wird gebraucht von:** M02 Analyse (Termintreue plus Liquidität 30 Tage), M03 Unternehmensführung, G02/G09 Startseiten-Handlungsbedarf sowie G07/G10 für Buchhaltungsanschlüsse
**Anbindungszeitpunkt + Gate:** seriell als erstes hinten angestelltes Modul nach fertigem Grundstamm und OWNER_UX_PASS; Designphase 1b; Re-Verifikation des dann aktuellen `origin/main`; HostAdapter-, Manifest-, DB-/RLS-, Recovery-, Browser-E2E- und unabhängiger Review-PASS am Exact SHA; anschließend Owner-Transfergate. Provider, Kosten und Secrets haben zusätzliche Owner-Gates.
**Bis dahin im Grundstamm:** Innerhalb des gebauten Screens „Geld & Rechnungen“ genau ein nicht klickbares, gedämpftes Element mit Titel „Buchhaltungs-Kontrollzentrum“ und Status „In Aufbau“. Funktionen mit offener dauerhafter Entscheidung zeigen „In Klärung“. Es gibt keine M01-Route; Direkt-URLs enden fail-closed/404. Der reale Grundstamm-Pfad `/buchhaltung/rechnungen` bleibt davon unberührt.
**Übertragbarkeit:** Kern app-neutral: ja, weil Vertrag, Geldwerte, Receipts, Recovery und Fehlerzustände keine Kreile-Rollen, -Routen, -Tabellen, -Daten, -Secrets oder -Provider enthalten. Kreile-spezifische Autorisierung, Datenabbildung, Texte, Zuständigkeiten und Ressourcen liegen ausschließlich im Kreile-HostAdapter; Anpassungen anderer Zielapps gehören nicht in dieses Dossier.
**Rate-Stellen aus Red-Team:** RT-01, RT-02 und RT-04 sind durch OE-2609-07/11/12/14 geklärt; RT-13, RT-14, RT-22, RT-24 und RT-31 werden durch dieses Dossier beziehungsweise die ausgewiesenen Gates und Fragen abgesichert.
**Stand:** 2026-09-26
**Bearbeiter:** Codex

## Verbindliche Statusabgrenzung

`BAUBEREIT` bewertet die Vollständigkeit dieses Dossiers. Es bedeutet weder, dass M01 adoptiert oder produktiv ist, noch dass blockierte Slices gebaut werden dürfen. Der gebaute Candidate.2 ist nur ein app-neutraler A0–A2-Vertragskandidat ohne Produkt-HostAdapter, Datenbank, Provider oder UI.
