# Galvanik-Kreile WerkstattCockpit — autonomes Missionsprotokoll

## Ziel

Cowork arbeitet pro Mission selbstständig, prüft intern, korrigiert und kehrt erst mit einem belastbaren Endergebnis zurück.

## Rollen je Mission

- ein Orchestrator
- genau ein schreibender Agent
- genau ein unabhängiger Prüfer
- keine parallelen Schreibagenten auf denselben Dateien

Der Prüfer prüft gegen Originalkriterien und Rohbelege, nicht gegen die Selbsteinschätzung des Schreibers.

## Modellrouting

Günstigstes Modell genügt für:

- mechanische Suche
- Inventur
- Formatierung
- einfache Vergleiche
- klar abgegrenzte Verifikation

Starkes Modell ist erforderlich für:

- Architektur
- Datenmodell
- Transaktionen
- Offline/Outbox
- Security/RLS/Storage
- gekoppelte Module
- Ursachenanalyse
- End-to-End-Implementierung

## TRUTH

- `K` direkt belegt
- `R` verbindlich
- `I` begründete Schlussfolgerung
- `H` prüfbare Hypothese
- `U` unbekannt
- `X` widerlegt/veraltet/ungeeignet

Jedes `K` braucht Datei, Symbol, Query, Terminal- oder Laufzeitnachweis.

## Autonomieregeln

1. Keine Zwischenberichte.
2. Keine normalen Rückfragen.
3. Technische Probleme selbst untersuchen und beheben.
4. Korrekturschleife bis PASS, FAIL oder echtem externen Blocker.
5. Kein „fertig“ ohne nummerierte Kriterien und Evidenz.
6. Kein neues Folgeprojekt starten.
7. Keine Planungsdatei statt geforderter Umsetzung.
8. Keine Löschung, Bereinigung, Migration, Merge, Push oder Deploy ohne Missionsfreigabe.
9. Vor Änderungen: Projektpfad, Branch, HEAD, `git status --short`, betroffene Dateien, Snapshot.
10. DOM-/Browser-Automation nur, wenn technisch unvermeidbar oder ausdrücklich freigegeben.

## REDTEAM-Pflicht

- zweite Daten-/UI-Wahrheit?
- Datenverlust/Dublette?
- falsches Routing?
- Mehrarbeit für Rolf/Philipp?
- Originalverlust?
- Offlinekonflikt?
- Auth versus Autorisierung?
- Tenant/RLS/Storage?
- Fachwert in TS/React statt SQL?
- Laufzeitbeweis statt statischer Behauptung?
- Live-/Verkaufsreife verbessert?

## Code-Gates

- P1 `npx tsc --noEmit`
- P2 `npm run lint`
- P3 `git diff --stat`
- P4 `git status --short`
- zusätzlich alle aktuellen Tests
- `npm run build`
- DB-/RLS-/Storage-/E2E-Nachweise gemäß Scope

## Abschluss

Genau eines:

- `MISSION_VERDICT: PASS`
- `MISSION_VERDICT: FAIL`
- `STATUS: BLOCKIERT_EXTERN`

Ein PASS ist unzulässig bei offenem Sicherheits-, Datenintegritäts- oder Vertragsblocker.
