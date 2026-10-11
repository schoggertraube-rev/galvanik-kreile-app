<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G03 — Anlegen / Intake

- **Zweck:** G03 ist der schnelle, manuelle und providerfreie Einstieg für Bestands- oder Neukunden, KV und direkten Wareneingang. Das Modul erfasst 1–20 Positionen, Terminwunsch und Zusagetermin, Eingangsart, Zahlungsmodus, optionale Eingangsfotos und liefert erst nach Command-Receipt plus fachlichem Readback Erfolg. OCR und Outlook sind spätere Adapter, keine Voraussetzung für den Kernweg.
- **Stufe:** Grundstamm
- **Dossier-Status:** BAUBEREIT
- **Modul-Status:** ADOPTIERT — der transaktionale Kern, Kunden- und KV-Verträge sowie Teile der UI sind auf `origin/main` gebaut; die in `01_ANFORDERUNGSKATALOG.md` als SPEZ/GEPLANT/FEHLT markierten Zielanteile sind noch umzubauen beziehungsweise zu ergänzen.
- **Session:** Grundstamm-PL-Kontext, Session `01a0ce4b` (kein Resume)
- **Arbeitsordner:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\_MODULDOSSIERS\G03_ANLEGEN_INTAKE`
- **Code-Pfad:** Ziel `src/modules/erfassung/`; heutiger Bestand verteilt auf `src/components/layout/GlobalCreateFlow.tsx`, `src/app/GlobalCreateAppAdapter.tsx`, `src/components/erfassung/`, `src/lib/server/commands/orderIntakeCommand.ts`, `src/lib/server/orderIntakeRead.ts`, `src/modules/customers/` und `src/modules/quotes/`.
- **Braucht:** authentifizierten Tenant-/Rollen-Kontext und Sperren aus dem Grundstamm; öffentliche Ports von Kundenstamm und KV; Auftrags-, Katalog-, Evidenz- und Termin-Ports des Hosts; Kreile-Texte und Rollenabbildung aus dem Kreile-HostAdapter.
- **Gebraucht von:** globalem `+ Anlegen`, Kundenkarte, KV-Fluss, Auftragskarte, Wareneingang/Werkstatt, Startseiten-Handlungsbedarf sowie der späteren Kalenderprojektion.
- **Anbindungszeitpunkt + Gate:** Grundstamm-Phase 2 nach Designsystem-Phase 1. Pflicht-Gates: Dossier BAUBEREIT, Fresh-Supabase-Replay ohne Mocks, echte Session-/Tenant-Grenzen, D-RES-001, E2E auf 1914×917 / 1220×880 / 390×844 und Owner-UX gegen V5. M04- und M06-Anbindung erst nach deren eigenem Provider-/Owner-Gate.
- **Bis dahin im Grundstamm:** `OCR-Erfassung — In Aufbau` ist ausgegraut und nicht klickbar; der Wunschtermin bleibt App-Wahrheit, `Outlook-Synchronisierung — In Aufbau` ist höchstens passiver Status und öffnet keine tote Route.
- **Übertragbarkeit:** Ja. Kernports, Commands, Receipts, Zustände und Snapshot-Felder bleiben frei von Kreile-Fachbegriffen; Rollen, Texte, Katalogabbildung, Zahlungsregeln und spätere M04/M06-Adapter liegen im Kreile-HostAdapter. Andere Zielapps werden hier weder beschrieben noch vorweggenommen.
- **Red-Team-Ratestellen:** RT-1, RT-9, RT-10, RT-11, RT-15, RT-16, RT-18, RT-19, RT-21, RT-22, RT-23, RT-25.
- **Stand:** 2026-09-26; überprüfter lokaler Tracking-Snapshot `origin/main@21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`. Ein Remote-Abgleich war nicht möglich: `.git` ist read-only und SSH-Port 22 ist gesperrt.
- **Bearbeiter:** Codex (Writer); ein unabhängiger Read-only-Review ist vor FREIGEGEBEN weiterhin erforderlich.

