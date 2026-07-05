# 07 · Livegang-Gate & Roadmap

## Das harte Livegang-Gate (nicht verhandelbar)

**Grundsatz:** Ein grüner Build ist **kein** Livegang-Beweis. Der QA-Prüfer hat ausdrücklich festgehalten: `tsc`=0, Unit 75/75, Build 77/77 beweisen nur, dass der Code kompiliert — **nicht**, dass die Vernetzung funktioniert. Der Livegang hängt an **Laufzeitbeweisen**, nicht an Kompiliergates.

### Go-live-Bedingungen (alle müssen erfüllt & unabhängig abgenommen sein)

| # | Bedingung | Beweistyp | Welle |
|---|---|---|---|
| G1 | Alle API-Routen: unauth. Aufruf → 401 (curl-Matrix) | Laufzeit | 0 |
| G2 | `customer-search` & alle Kundendaten: kein Abfluss ohne Auth+Tenant | Laufzeit | 0 |
| G3 | Storage-Downloads nur über signierte URL; öffentlicher Direktabruf → 403 | Laufzeit | 0/3 |
| G4 | PINs gehasht (kein Klartext in DB) | DB-Beweis | 0 |
| G5 | Frische DB aus Migrationen = Remote-Schema (Diff leer) | Reproduzierbarkeit | 1 |
| G6 | `grep isSupabase\|mockData src` = 0 im Produktionspfad | statisch+Review | 2 |
| G7 | Cross-Tenant-`SELECT` unter fremder Session → 0 Zeilen | SQL-Laufzeitbeweis | 3 |
| G8 | Foto aufnehmen → Crash/Reload → Original noch da | Laufzeit | 4 |
| G9 | Offline erfassen → online → genau 1 Auftrag (kein Duplikat) | Laufzeit | 4 |
| G10 | Foto→DB→erste Produktionskarte läuft real durch (E2E) | E2E-Beweis | 4 |
| G11 | Unabhängiger E2E-Verifier: PASS gegen Originalkriterien | Abnahme | 4 |

**Kein Livegang, solange auch nur eine Bedingung offen ist.** Insbesondere G1–G4 sind **DSGVO-/Missbrauchs-Sperren** und blockieren jede Live-Instanz absolut.

## Roadmap (Wellen → Missionen → Gate)

```
JETZT ─► Board/Auftraggeber-Freigabe dieses Berichts
  │
  ├─ Welle 0  Sicherheit + Hygiene ........... Gate G1–G4     ◄── P0, blockiert alles
  ├─ Welle 1  Schema reproduzierbar .......... Gate G5
  ├─ Welle 2  Ein Datenpfad (Kernhebel) ...... Gate G6
  ├─ Welle 3  RLS/Tenant/Storage echt ........ Gate G7
  ├─ Welle 4  Offline/Capture konsolidieren .. Gate G8–G11
  │            └─► PILOT-LIVEGANG Slice-1-Kern (1 Mandant, begleitet)
  └─ Welle 5  Fachlogik→SQL, Performance, Feinschliff
               └─► voller Feature-Ausbau der Module
```

## Missionsführung (pro Welle)

Jede Welle = **eine** Baumission nach dem autonomen Missionsprotokoll:
- 1 Orchestrator, 1 schreibender Agent, 1 unabhängiger Prüfer, keine parallelen Schreiber auf denselben Dateien.
- Vor Start: Projektpfad, Branch, HEAD, `git status --short`, Snapshot.
- Code-Gates P1–P4 (`tsc`, `lint`, `diff`, `status`) **plus** die wellen­spezifischen Laufzeitbeweise oben.
- Abschluss: genau ein `MISSION_VERDICT: PASS/FAIL` oder `STATUS: BLOCKIERT_EXTERN`. **Kein PASS bei offenem Sicherheits-/Datenintegritätsblocker.**
- Register nach jeder Mission aktualisieren (Findings→CLOSED mit Beweis, Decision, Changelog).

## Was der Auftraggeber jetzt entscheiden muss

1. **Freigabe des Sanierungspfads** (Option c) — oder abweichende Richtung.
2. **Freigabe Welle 0 als erste Baumission** (P0-Sicherheit) — empfohlen sofort, unabhängig vom Rest.
3. **Entscheidung Evas-Lerninsel-Template**: erst nach Welle 3 ausgründen (empfohlen) — oder anders.
4. **Branch-Strategie**: `feature/capture-auth-tenant` (9 Commits vor main) — nach main integrieren oder als Sanierungsbasis weiterführen? PROJECT_TRUTH-HEAD nachziehen.

## Design-Sequenz (aus 04_CURRENT_GATE beachten)

Der bestehende Gate-Vertrag sieht vor: **erst** akzeptierter Implementierungsvertrag V2, **dann** Claude Design für den UI-/Interaktionsvertrag, **dann** Bau. Dieser Audit ersetzt nicht die V2 — er liefert die **Faktenbasis**, auf der V2 realistisch und belegt neu geschrieben werden kann (v.a. für den Capture-/Slice-1-Teil). Empfehlung: Welle 0/1 sind so grundlegend, dass sie **vor** der V2-Feinschrift als eigene Sicherungsmissionen laufen dürfen.
