# MODELL- UND KOSTENSTRATEGIE

Ziel: **je nach Aufgabenkomplexität das passende Modell**, automatische Aktualisierung, **kein Kostenkollaps**. Default sparsam, teuer nur wo nötig.

---

## 1. Tier-Modell

| Tier | Modell (Stand: aktuelle Config) | Wofür | Kosten |
|---|---|---|---|
| **T0** | kein LLM (Regeln/Skripte) | Validierung, Lint, Tests, SQL-Checks, Schema-Diff, Format-Prüfung | 0 |
| **T1** | Claude Haiku | Triage, Klassifikation, einfache Texte, Routine-Antworten des In-App-Assistenten | sehr niedrig |
| **T2** | Claude Sonnet | **Standard**: Code, Build, die meisten Subagenten, normale Analyse | mittel |
| **T3** | Claude Opus | komplexe Architektur, schwierige Konzepte, Forecast-Logik (Hotel-Rev), Migrationen mit hohem Risiko | hoch |
| **T4** | GPT-5 (OpenAI API) | **unabhängige Verifikation** kritischer Behauptungen — anderes Anbieter-Modell als der Builder | nur bei R2/R3 |

Die konkreten Modell-Strings stehen in **einer einzigen Datei**: `04_CLAUDE_CODE_SETUP/.claude/config/MODELLE.json`. Modell wechseln = diese eine Datei ändern. Niemand hartkodiert Modellnamen irgendwo anders.

---

## 2. Komplexitäts-Routing

Der Mission Coordinator klassifiziert jede Aufgabe und wählt den Tier:

| Aufgabentyp | Tier-Default |
|---|---|
| Doku, Labels, Markdown, Triage | T1 |
| Standard-Code, UI-Bau, CRUD, normale Analyse | T2 |
| Geschäftsanalyse mit Forecast, Pricing-Engine, komplexe Architektur, riskante Migration | T3 |
| Prüfung kritischer Behauptungen (Auth, Zahlung, Migration, P0) | T4 zusätzlich |
| Deterministisch prüfbar (Build, Test, Schema) | T0 — gar kein LLM |

Hochstufung ist erlaubt, wenn T2 dreimal scheitert; jede Hochstufung wird im `DECISION_LOG` notiert (Aufgabe, alter Tier, neuer Tier, Grund).

---

## 3. Kosten-Schutz (gegen Kollaps)

1. **90–95 % aller Operationen auf T0/T1.** Das ist Zielwert, nicht Zufall. Teure Modelle sind die Ausnahme.
2. **Eskalations-Kette:** Regeln → günstiges Modell → Standard → schweres Modell → Mensch. Erst hoch, wenn die Stufe darunter nachweislich nicht reicht.
3. **Budget-Cap pro Mission.** Überschreitung → Mission pausiert, Eskalation an dich mit Vorschlag.
4. **Manueller Trigger für Teuer-Operationen.** Forecast-Neuberechnung, große KI-Auswertungen laufen nur auf Knopfdruck („Aktualisierungs-Button"-Prinzip), nie automatisch im Hintergrund.
5. **Verifier nur ab R2.** Routine-Bugfixes (R1) und Doku (R0) brauchen kein GPT-5.
6. **Caching/Wiederverwendung:** Twin-Antworten, Analyseergebnisse, Marktscans werden gespeichert und nicht bei jedem Lauf neu erzeugt.
7. **Kein Modell in Endlosschleife:** Hooks/PRÜFPHASE brechen ab, statt teuer im Kreis zu laufen.

---

## 4. Automatische Aktualisierung der Modelle

Der **Market & Tooling Scout** (Dauerdienst, Tier T1) läuft wöchentlich und prüft:

- neue Modelle (Anbieter, Preis, Können, Kontextfenster),
- neue MCP-Connectoren,
- neue SDK-/Tool-Versionen.

Ergebnis: ein **Vorschlags-Diff** auf `MODELLE.json` mit Begründung (was wird besser/billiger, welches Risiko). **Du segnest ab** — erst dann wird die Config geändert. So bleibt die Firma auf Stand, ohne dass du recherchieren musst und ohne unkontrollierte Selbstumstellung.

---

## 5. In-App-Assistent (Ebene C) — eigene Kostenlogik

Der In-App-Assistent für Endnutzer ist die größte laufende Kostenquelle (API-Call pro Nutzerfrage). Regeln:

- Standardfragen (Status, „wo ist Auftrag X?") über **Regeln + T1**, nicht über teures Modell.
- Komplexe/seltene Fragen eskalieren auf T2.
- Caching häufiger Antworten.
- Harte Obergrenze pro Tag/Mandant, Warnung bei Annäherung.

Damit liegen geschätzt 90 % der Endnutzer-Interaktionen bei nahezu null KI-Kosten.
