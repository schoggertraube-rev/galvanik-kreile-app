# 00 — EXECUTIVE PROJECT CHARTER
## Kreile WerkstattCockpit

**Erstellt:** 2026-06-19 | **Rolle:** Leitender Projektmanager und Orchestrator
**Tenant:** `galvanik-kreile` | **Pfad:** `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`

---

## 1. Projektziel

Ein dauerhaft lebendes, modular erweiterbares Unternehmenssystem für einen Galvanik-/Restaurationsbetrieb (Meisterbetrieb seit 1962, ~3 Mitarbeiter, ~30 Stammkunden), das:

- den gesamten Betrieb sichtbar macht (Kunden, Aufträge, Teile, Stationen, Kommunikation, Buchhaltung, Analyse),
- operative Probleme früh erkennt und Maßnahmen vorschlägt,
- automatisierte Unternehmensführung schrittweise ermöglicht,
- technisch wenig versierte Nutzer (Inhaber Mitte 60, Nachfolger/Sohn) sicher führt,
- aus echten Daten messbaren Nutzen erzeugt,
- als Kern-Template für weitere Kundenprojekte (Evas Lerninsel u. a.) wiederverwendbar ist, ohne dass Galvanik-Fachlogik den Kern verschmutzt.

## 2. Produktvision

Kein Werbeprodukt, kein Demo-Showcase — ein Betriebsnervensystem, das die zentrale USP bedient: **jederzeit wissen, wo ein Werkstück ist und wann es fertig wird.** Alles andere (Buchhaltung, Marketing, KI-Automatisierung) ist Ausbaustufe um diesen stabilen Kern.

## 3. Kundennutzen

| Nutzer | Kernfrage | Heutiger Zustand | Zielzustand |
|---|---|---|---|
| Inhaber (Franz Kreile, Mitte 60) | „Wann ist Auftrag X fertig? Wo liegt das Teil?" | Leere Liste ohne Erklärung (Auth-Bug) | Antwort in <10 Sekunden, belastbar |
| Nachfolger (Sohn) | „Was muss ich heute tun, damit der Betrieb besser läuft?" | Fachbegriffe ohne Übersetzung, Cockpit unverstanden | Klartext-Kennzahlen mit Handlungsempfehlung |
| Büro-Mitarbeiter | „Kundenanruf sofort beantworten" | 0 Treffer mangels Session | Suche funktioniert, Status auf einen Blick |
| Werkstatt-Mitarbeiter | „Was ist als Nächstes dran?" | Stationsseite mit 0 Aufträgen | Priorisierte Tagesliste je Station |

## 4. Rollen (Projektorganisation)

- **Claude (dieser Chat):** Requirements Architect, Projektmanager, Spezifikationsschreiber.
- **Antigravity (Gemini-basiert, lokale IDE):** Ausführender Coding-Agent. Arbeitet ausschließlich nach den hier erzeugten Bauprompts.
- **Siglinder:** Auftraggeber, Entscheider bei Scope-Konflikten, einziger Instanz für `git commit`.
- **Franz Kreile (Inhaber) / Sohn (Nachfolger):** Endnutzer, Abnahmeinstanz für UX.

## 5. Scope

### Im Scope (dieses Projekt)
- WerkstattCockpit App (Next.js/Supabase/Drizzle) — Stabilisierung, Vernetzung, Plattformbereinigung, Ausbau.
- Galvanik-Fachmodule: Wareneingang, Stationen, Bäder, Lager, Kunden, Aufträge, Buchhaltung, Kommunikation, Cockpit/Analyse, Lizenz-/Feature-System.
- Plattformkern-Extraktion soweit sie diesem Projekt nicht schadet (Vorbereitung für spätere Wiederverwendung, kein Parallelprojekt).

### Explizit außerhalb des Scope
- Hotel Revenue Intelligence (separates Projekt, eigener Stack, eigener Tenant — **niemals fachlich vermischen**).
- Evas Lerninsel (eigenständiges Projekt, das vom Kern erst NACH Galvanik-Stabilisierung profitieren wird).
- Kreile-Website (kreile.de) — eigenständiges Projekt, Spec v3.1 vorhanden, separates Next.js-Deployment, erst nach App-Stabilität.
- Marketing Studio — Daten/Schema vorhanden, aber eingefroren bis Entscheidung E-03 (siehe Dok. 11).
- Multi-Tenant-Betrieb mit echtem zweiten Kunden (vorbereitet, nicht aktiviert).

## 6. Prioritäten bei Zielkonflikten

1. Stabilität
2. Datenintegrität
3. Sicherheit und Mandantentrennung
4. Performance
5. echte End-to-End-Vernetzung
6. Bedienbarkeit
7. Kundennutzen
8. Go-live-Fähigkeit
9. wirtschaftlicher Nutzen
10. Wartbarkeit
11. Wiederverwendbarkeit
12. Automatisierung
13. Designveredelung
14. Marketingwirkung
15. optionale Innovationen

Diese Reihenfolge gilt für **technische und strukturelle** Entscheidungen. Für inhaltliche Ausbaustufen (Features, UI-Wow-Effekt, Medien-Nutzung) gilt zusätzlich die in den Projektanweisungen festgelegte Priorität (Performance → UI/UX → Marketingwirkung → echte Assets → Kundennutzen → Datengewinnung → operative Effizienz → Erweiterbarkeit → Datenschutz → Kosten). Datenschutz ist niemals ein automatisches Verbotsargument (siehe `KREILE_STACK_POLICY.md`, `00_PRIORITY_RULES_KREILE.md`) — Entscheidungs-Matrix statt Pauschalverbot.

## 7. Erfolgskennzahlen (Go-live-relevant)

| Kennzahl | Heute | Ziel Testbetrieb | Ziel Live |
|---|---|---|---|
| DoD-Kriterien Nutzersimulation erfüllt | 0 von 12 | 8 von 12 | 12 von 12 |
| DoD-Kriterien Plattformcheck erfüllt | 0 von 20 | 6 von 20 | 14 von 20 (Rest = bewusst spätere Phase) |
| P0-Befunde offen | 2 | 0 | 0 |
| P1-Befunde offen | 3 | ≤1 | 0 |
| Kernfeature Scan→Auftrag funktioniert | nein | ja | ja |
| Kernfeature OCR→Buchhaltung funktioniert | nein | ja | ja |
| Operativ nutzbarer Funktionsanteil | ~32 % | ~65 % | ~85 % |
| Tabellen ohne RLS | 30 | ≤5 (nicht-kritische) | 0 |

## 8. Go-live-Definition

Live-fähig bedeutet: stabil, schnell, sicher, verständlich, vollständig verdrahtet, persistent, realdatenbasiert, wartbar, getestet, dokumentiert — und durch die in Dok. 09 definierte Abnahme bestätigt. Eine Funktion gilt nur als fertig, wenn die vollständige Kette **Datenquelle → Datenmodell → SQL-View/Serverlogik → Repository → Server Action/API → Hook/State → Komponente → UI-Zustand → Benutzeraktion → Persistenz → Reload → Folgeprozess → Analyse** nachgewiesen ist (siehe Dok. 05).

## 9. Projektprinzipien (verbindlich, aus Audit-Lage + Anweisungen destilliert)

1. **Live-Data-Policy absolut:** keine Mockdaten, kein `Math.random`, keine erfundenen Fallback-Werte im Produktionspfad. Leerzustand zeigt „Noch keine Daten erfasst" + Aktionslink, niemals erfundene Zahlen.
2. **Ehrlichkeit vor Wow:** Eine Erfolgsmeldung ohne DB-Bestätigung ist ein Vertrauensbruch und P0-Befund (siehe B-01/B-02).
3. **Auth-Fehler müssen sichtbar sein.** Eine leere UI ohne Fehlerursache ist für diese Nutzergruppe gleichbedeutend mit „App kaputt".
4. **KPI-Berechnung ausschließlich in SQL-Views**, nie in React-Komponenten (Architekturverstoß A-07).
5. **Ein Komponenten-Instanz-Prinzip:** eine `CustomerOverlay.tsx`, eine `CustomerTile.tsx` usw. — keine Duplikate.
6. **Branchenlogik gehört in Module, nicht in den Kern** — langfristig, aber niemals auf Kosten des aktuellen Go-live umgesetzt (siehe Konfliktregel Dok. 01).
7. **Keine pauschalen Technologieverbote.** Jede Stack-Frage läuft über eine Entscheidungs-Matrix (Nutzen, UX, Performance, Aufwand, Kosten, Wartbarkeit, Datenschutzrisiko, Alternativen, Empfehlung).
8. **Nichts ist unmöglich, aber alles ist gestuft.** Jede ambitionierte Idee bekommt Zielbild + kleinste tragfähige Stufe + Ausbaupfad + Risiken.
9. **Manuelle Commits, manuelle Migrationen am Tagesende.** Antigravity committet nie. Migrationen folgen dem Supabase-Protokoll (login → link → db push → Schema-Reload, mit Verifikation gegen den Remote-Stand, nicht nur lokale Dateipräsenz).
10. **Prüfphase ist Pflichtbestandteil jedes Bauprompts**, niemals optional (siehe Dok. 08).

## 10. Lizenz-/Monetarisierungs-Grundsatz

Bereits spezifiziert und teilweise gebaut (`SPEC_LICENSE_FEATURE_TOGGLES_v1.md`, `resolveFeatures.ts`): 4-Tier-Modell Basis/Pro/Premium/Enterprise. Kernprinzip: Kein Feature für operative Basisnutzung wird gesperrt; Monetarisierung erfolgt über Tiefe (Reporting, Forecast, Automatisierung), nicht über Breite. Downgrades sperren Sicht, niemals Daten. Dieses System ist gebaut, aber nicht verdrahtet (F-008/A-05) — Verdrahtung ist Teil von Phase 2.

## 11. Nicht-Ziele (bewusst abgegrenzt)

- Keine vollautomatische KI-Entscheidungsfreigabe ohne Stufenmodell (siehe Automatisierungs-Freigabestufen, Dok. 06).
- Keine Plattform-Generalisierung, die den aktuellen Go-live verzögert (Konfliktregel: bestehende Funktion schützen, schrittweise migrieren).
- Kein Parallel-Forken der Codebasis für andere Branchen vor Kern-Stabilisierung.

---

*Dieses Dokument ist die oberste Referenz. Bei Widersprüchen zwischen Fachrollen-Ausgaben gilt dieses Charter.*
