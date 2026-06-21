# ROADMAP GALVANIK

Reihenfolge bewusst: erst stabil und ehrlich, dann schön, dann klug, dann übertragbar.

## Phase 1 — P0-Defekte schließen (JETZT, R3)
Ziel: Kernfunktion wirklich funktionsfähig.
- DEF-001 Scan→Order schreibt nichts in DB → Data Contract Engineer + Backend Engineer.
- DEF-002 OCR-URL ist Platzhalter → OCR Specialist (echter Klippa-Endpoint).
- Team: + Test Automation, RLS/Auth, QA, Red Team, Chief Verifier.
- Abschluss: SELECT-Beweis (Scan schreibt), echte OCR am Dokument, Tests grün, Verifier-Gegenzeichnung.

## Phase 2 — Stabilisierung & Sicherheit
- 30 Tabellen ohne RLS schließen (priorisiert im Produktpfad).
- inventory_items.tenant_id + einkaufspreis_eur; ausgangsrechnung.order_id (FK).
- DB-Passwort rotieren, Secrets als Env.
- Station-Workflow (bereits verifiziert) als Referenzpfad absichern.
- Ziel: erster echter Nutzertest möglich.

## Phase 3 — UI-Redesign (Visual-Pitch-gesteuert)
- UX Architect misst Ist (Auftrag anlegen, Kunde finden, 60-Sek-Orientierung).
- Klickbarer Prototyp gegen Twins → Visual Pitch → deine Freigabe → Bau.
- Ziel: Auftrag <30s, Kunde <10s, Orientierung <60s. USP („wo ist die Ware, wann fertig") im Zentrum.

## Phase 4 — In-App-Assistent (Ebene C)
- AI Product Architect: Assistenz für Endnutzer, Fallback-Kette Regeln→günstig→stark→Mensch, Kostencap.
- Ziel: die App wird zum „besten Mitarbeiter" — auf stabilem Fundament.

## Phase 5 — Template-Extraktion
- Galvanik-spezifische Begriffe zentral konfigurierbar machen (nicht hartkodiert).
- Forkbares Template extrahieren, sobald Datenmodell + lib-Logik stabil.
- Grundlage für Evas Lerninsel und weitere Kunden.

## Übergang Antigravity → Claude Code
Solange Antigravity baut: Beweispflicht über PRÜFPHASE-Block, Commits/Migrationen manuell durch dich. Sobald gewünscht: auf Claude Code wechseln (Hooks erzwingen Beweispflicht automatisch). Beide erzeugen dieselben Artefakte; der Verifier prüft identisch.
