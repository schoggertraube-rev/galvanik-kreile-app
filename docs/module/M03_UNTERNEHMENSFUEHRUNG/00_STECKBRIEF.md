<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M03 Unternehmensführung - Steckbrief

**Zweck:** M03 hält versionierte Unternehmensziele als Absichten fest und stellt dafür sichere Read-, Command-, Receipt- und Projektionsverträge bereit. Der erste Kreile-Nutzenfall betrachtet Termintreue und Liquidität 30 Tage gemeinsam; die dafür benötigten Fakten und Bewertungen bleiben bei M01 beziehungsweise M02. Spätere Entscheidungs-, Freigabe-, Review-, Stopp- und Wirkungsnachweise gehören zur ratifizierten Domänengrenze `LEADERSHIP_DECISIONS`, bleiben aber bis zu einem eigenen seriellen Gate ausdrücklich ungebaut; Accounting-Fakten, Analyseergebnisse, Aufgabenstatus und Fachcommands bleiben bei ihren jeweiligen Wahrheitseigentümern.
**Stufe:** hinten angestellt
**Dossier-Status:** BAUBEREIT
**Modul-Status:** OFF_REPO_KANDIDAT
**Zuständige Session:** Unternehmensführung `01a0ab1c-ac8f-73b0-b522-181bd8f5dc4f`
**Arbeitsordner:** `C:\Users\Traube\Documents\Codex\2026-09-16\unternehmensfuehrung-ziele-entscheidungen-wirkung`
**Code-Pfad:** Off-repo-Kandidat `outputs\leadership-goals-v1-module-candidate.3\`; finales Inhaltsmanifest SHA-256 `3AEB7CDBF7A77072A71A559878A1154C32CDE268DD1266CAAE702B546449498F` (erste 12: `3AEB7CDBF7A7`); später owner-ratifizierter, noch leerer Repo-Slot `src/modules/leadership-decisions/`.
**Braucht (Module/Ports):** Fertigen Grundstamm mit OWNER_UX_PASS; formale D-LEADERSHIP-/OP-02-Kanonisierung; auswertbaren unabhängigen Opus-Schlussaudit; atomare Adoptionsmission; sieben verpflichtende Host-Portgruppen für Autorisierung, Command-Bindung, Bestätigung, Verantwortung, Messdefinition, Persistenz und Clock/IDs/Hash; optional Evaluation für die Attention-Projektion; reale Migration, Auth/RLS, Outbox, Receipt/Readback und Kreile-E2E. Für den ersten wirtschaftlichen Nutzenfall werden reale M01-/M02-Verträge für Liquidität 30 Tage und Termintreue benötigt.
**Wird gebraucht von:** Rolf-Unternehmensführung und Rolf-Startseite als read-only Aufmerksamkeitsprojektion; dort stehen dringende M03-Warnungen und -Entscheidungen im oberen Handlungsbereich vor dem Tagesüberblick. M02 Analyse referenziert Zielversionen, ohne sie zu besitzen; später G08/M07 Suche, Meetings und Fachmodule ausschließlich über öffentliche Ports und opake Referenzen.
**Anbindungszeitpunkt + Gate:** Phase 4, seriell nach fertigem Grundstamm sowie nach M01 und M02. Reihenfolge: formale Kanonisierung -> unabhängiger Opus-Schlussaudit -> atomare Adoption des unveränderten Candidate.3 -> Kreile-Manifest/Fassaden -> Hostports und Persistenz/Auth/RLS -> reales GOALS-E2E -> Designphase 1b/Owner-UX -> unabhängige Abnahme -> Owner-Transfergate. `DECISION_GOVERNANCE_V1` bleibt ein späteres separates Gate.
**Bis dahin im Grundstamm:** Keine M03-Route und kein klickbares Navigationsziel. Im oberen Handlungsbereich von Rolf „Der Tag“ darf ausschließlich ein gedämpftes, nicht klickbares Element mit dem Titel `Ziele & Entscheidungen` und dem wörtlichen Status `In Klärung` stehen; keine Zielwerte, keine Prozentreife, keine Entscheidung oder Fake-Daten. Die genaue Platzierung innerhalb dieses Bereichs ist Q-M03-001.
**Übertragbarkeit:** Kern app-neutral: ja – Grund: GOALS_V1 enthält nur versionierte Verträge, Invarianten, opake Referenzen und Host-Ports, aber keine Kreile-Fachbegriffe, -Rollen, -Tabellen, -Routen oder Provider.
**Rate-Stellen aus Red-Team:** RT-21, RT-22, RT-23, RT-24, RT-31.
**Stand:** 2026-09-26
**Bearbeiter:** Codex (Dossier-Writer); unabhängiger Dossier-Reviewer ausstehend
