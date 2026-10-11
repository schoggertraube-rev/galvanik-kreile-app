<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 05 – Regeln, Sperren und Konflikte

Stand: 2026-09-26  
Modul: M02 Analyse

## Fach- und Systemregeln

| Regel-ID | Regel | Verhalten der App | Quelle |
|---|---|---|---|
| R-M02-001 | M02 liest ausschließlich über `decision-support.read/v1`. | Kein zweiter Analyseport, kein direkter Legacy-Query und kein stiller Fallback. | Core Runtime Truth |
| R-M02-002 | Fakten bleiben Eigentum der Fachmodule. | M02 speichert oder kopiert keine Aufträge, Kunden, Dokumente, Zahlungen oder Produktionsdaten. | MODULARITY_STRATEGY, Core-Vertrag |
| R-M02-003 | Tenant, Auth, Disclosure und Retention gehören zum Host. | Jede Anfrage ist vor Core-Aufruf im Host zu autorisieren und zu begrenzen. | OE-2609-09, Core-Vertrag |
| R-M02-004 | Capability, Evidence und Disclosure sind unabhängige Achsen. | Keine Achse darf aus einer anderen abgeleitet oder zu „verfügbar“ zusammengefasst werden. | `RUNTIME_TRUTH.md` |
| R-M02-005 | Unvollständige Evidenz wird sichtbar. | `STALE`, `PARTIAL`, `UNKNOWN` und `CONFLICTING` erscheinen mit Scope/Coverage; kein Nullwert als Ersatz. | `SOURCES_AND_REQUIREMENTS.md` |
| R-M02-006 | Unterdrückung propagiert durch die gesamte Ableitung. | Ist ein Primärwert verborgen, bleiben alle davon abhängigen Sekundärwerte verborgen. | P1-Closure/Reaudit |
| R-M02-007 | Berechnungen sind deterministisch. | Keine Systemzeit, kein Zufall, keine Gleitkomma-Geldwerte; nur zugelassene Integer-Methoden. | `KPI_RESEARCH_AND_ADMISSION.md` |
| R-M02-008 | Jede Ausgabe ist belegbar. | Scope, Snapshot, Provenienz, Coverage, Unsicherheit, `projectionId` und `contentHash` reisen mit. | Core-Vertrag |
| R-M02-009 | Visualisierungen sind renderer-neutral und barrierearm. | Beschreibung und Datentabelle sind Pflicht; höchstens 12 Serien und 1000 Punkte. | `FUNCTION_CATALOG.md` |
| R-M02-010 | M02 führt keine fachliche Handlung aus. | Nur externe Action-/Receipt-Referenzen; Commands bleiben im zuständigen Fachmodul. | Core-Vertrag |
| R-M02-011 | Empfehlung ist nicht Entscheidung. | Priorität, Freigabe und Verantwortung werden vom Host beziehungsweise Leadership geliefert. | Decision Trace, OE-2609-10 |
| R-M02-012 | Eine Kennzahl hat eine kanonische Definition. | Fremdmodule rendern dieselbe Projektion statt lokal nachzurechnen. | Dokumentautorität, MODULARITY_STRATEGY |
| R-M02-013 | Nicht angebundene Funktionen bleiben erkennbar inaktiv. | Grau, nicht klickbar, wörtlich `In Klärung`; `In Aufbau` erst nach freigegebenem Start. | OE-2609-04 |
| R-M02-014 | M02 ist verschoben, nicht entfallen. | Keine Löschung oder dauerhafte Ausblendung aufgrund der alten Modulkarte. | OE-2609-05 |
| R-M02-015 | Implementiert heißt im Zielrepo adoptiert und geprüft. | Ein Off-Repo-Kandidat oder Patch wird nicht als Implementierung bezeichnet. | AGENTS.md, OE-2609-06 |
| R-M02-016 | Legacy-Analyse ist keine Produktwahrheit. | Alte Cockpit-/Performance-/Analyse-Routen dürfen nicht als Fallback oder Referenzimplementierung reaktiviert werden. | ARCHITEKTUR_MODULE_PATH1, MODULKARTE |
| R-M02-017 | Analyse erhält nach Anbindung einen eigenen Menüpunkt; davor existiert keine Analyse-Route. | Kennzahlwerte dürfen zusätzlich an Auftrag und Kunde erscheinen; ein ausgegrauter Menüpunkt ist verboten. | OE-2609-22 |
| R-M02-018 | Die Startseite zeigt aus M02 nur Dringendes. | Keine Kennzahl-Kachel; nur dringende Konflikte, Warnungen oder Entscheidungen bei Rolf beziehungsweise Phillip. | OE-2609-10/22/26 |
| R-M02-019 | Analyse-Aufbewahrung trennt Personenbezug und zulässige Langzeitaggregate. | Personenbezug wird nur nach Vorschlag und Admin-Freigabe entfernt; anonymisierte/aggregierte Analysedaten dürfen unbefristet bleiben. | OE-2609-20 |
| R-M02-020 | Ein veralteter Kontostand darf keine belastbare Liquiditätsentscheidung tragen. | Die Projektion warnt sichtbar und bleibt bis zur freigegebenen Schwelle wertfrei oder nicht entscheidungsreif. | OE-2609-24; Q-M02-008 |

## Sperren

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| S-M02-001: Repo-Kanon ist im Nachlauf nicht aktuell verifizierbar | kanonische Adoption und Route | UI/Server/Gate | OE-2609-05/22; OP-02; Q-M02-007 | Produktentscheidung GEKLÄRT; bis PL-Abgleich Auftrag-/Kunden-Slots `In Klärung`, keine Route |
| S-M02-002: Zielhost/Modulpfad unentschieden | Übernahme des Cores | Server/Gate | Q-M02-004; `ADOPTION_AND_ATOMIC_CUTOVER.md` | FEHLT; Off-Repo-Kandidat bleibt unverändert |
| S-M02-003: Fact-Adapter oder Metric-Pack fehlt | echte Analysewerte | Server | OE-2609-21/23/24; Core-Handshake | Lieferreihenfolge GEKLÄRT, Umsetzung FEHLT; keine Werte, `In Klärung` |
| S-M02-004: UI-/Responsive-Vertrag fehlt | Bau der M02-Oberfläche | UI/Gate | Designphase 1b; Q-M02-002 | FEHLT; kein erfundener Screen |
| S-M02-005: Capability nicht `SUPPORTED` | betroffene Metrik/Projektion | Server/UI | `RUNTIME_TRUTH.md` | GEBAUT im Core; Host/UI FEHLT |
| S-M02-006: Evidence nicht `READY` | belastbare Behauptung | Server/UI | `RUNTIME_TRUTH.md` | GEBAUT im Core; Host/UI FEHLT |
| S-M02-007: Disclosure `DENIED`/`SUPPRESSED` | Wert und alle abhängigen Ableitungen | Server/UI | `P1_CLOSURE.md`; externer Closure-Check | GEBAUT im Core; Host/UI FEHLT |
| S-M02-008: Manifesthash oder vollständiger Post-Closure-Gesamtlauf weichen ab beziehungsweise fehlen | Adoption/Release | Server/Gate | `ARTIFACT_MANIFEST.json`; `TEST_RECEIPT.json` vom 2026-09-17: 66/66 im Glob-Lauf am Audit-Freeze, 67/67 in der Post-Closure-Funktionssuite ohne `artifact-integrity.test.mjs`; Q-M02-011 | SPEZ; keine Teiladoption, bis vollständiger Gesamtlauf belegt ist `In Klärung` |
| S-M02-009: Leadership-/Receipt-Mapping fehlt | Zielbezug und Wirkungsbewertung | Server/UI | Q-M02-006 | FEHLT; betroffene Funktionen `In Klärung` |
| S-M02-010: unabhängiger Review fehlt | Import und Abschluss einer Integrationsmission | Gate | AGENTS.md; Anleitung Abschnitt 9; Q-M02-009 | FEHLT; Off-Repo-Kandidat unverändert, keine Route, nicht als implementiert melden |
| S-M02-011: Aktualitätsschwelle für manuellen Kontostand offen | belastbare Liquiditätsentscheidung | Server/UI/Gate | OE-2609-24; Q-M02-008 | `In Klärung`; Warnung statt Wert/Entscheidung |

## Konflikte und Priorität

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-M02-001 | Letzter belegter Repo-Kanon kann OE-2609-05/22 noch widersprechen | Quellenabgleich am Adoptionsgate | Rolf | kein App-Konflikt; PL-Gate | PL bestätigt aktuellen `origin/main`-Stand und synchronisiert OP-02; Q-M02-007 | In Klärung |
| K-M02-002 | Historischer Auditstatus widerspricht späterem PASS-Closure | Hash-/Datumsabgleich der Auditbelege | Gregor | kein App-Konflikt; Integrations-Gate | Closure-Check ersetzt nur den alten Status; Manifest gemeinsam dokumentieren | SPEZ |
| K-M02-003 | Zwei Registerkopien weichen ab | SHA-/Inhaltsvergleich | Rolf | kein App-Konflikt; PL-Gate | Repo-Kopie plus D-UI-V5-003; OP-01 kanonisch zusammenführen | FEHLT |
| K-M02-004 | Legacy-UI zeigt Werte ohne realen Adapter/Metric-Pack | Route-/Import-/Datenpfadprüfung | Gregor | kein Endnutzer-Konflikt; Integrations-Gate | Legacy-Werte nicht rendern; später nach Salvage separat entfernen | SPEZ |
| K-M02-005 | Empfehlung/Wirkung liegt ohne externe Prioritäts-/Entscheidungs-/Command-Wahrheit vor | fehlende Policy-, Decision- oder Receipt-Referenz | Rolf | Rolf › Handlungsbedarf | Ziel/Entscheidung im Leadership-, Handlung im Fachmodul klären; M02 bleibt read-only | GEBAUT im Core; Host FEHLT |
| K-M02-006 | UI-Referenz enthält Analyse-Slot, letzter belegter Repo-Kanon schließt M02 aus | Screen-/Kanon-Abgleich | Rolf | kein aktiver Bereich; grauer Auftrag-/Kunden-Slot `In Klärung`, keine Route | Produktplatzierung gemäß OE-2609-22; PL synchronisiert den Kanon in Q-M02-007 | In Klärung |
| K-M02-007 | Unvollständige oder veraltete M01-Daten würden vollständige Liquidität vortäuschen | Admission erkennt fehlende Population/Snapshot/Recognition beziehungsweise veralteten Kontostand | Rolf | Rolf › Handlungsbedarf erst nach Anbindung; davor `In Klärung` | KPI wertfrei/nicht entscheidungsreif; vollständigen M01-Fact-Vertrag und Aktualitätsschwelle liefern | SPEZ |
| K-M02-008 | Home/Suche/Leadership berechnet einen Wert lokal neu | abweichende `projectionId`/`contentHash` oder Importscan | Gregor | kein Endnutzer-Konflikt; Integrations-Gate | ausschließlich kanonische M02-Projektion verwenden | GEPLANT |
| K-M02-009 | Auftrags-/Produktionsfakten widersprechen sich | Evidence-Status `CONFLICTING` bei identischem Scope/Snapshot | Phillip | Phillip › Handlungsbedarf | Fachfakten im zuständigen Orders-/Production-Modul korrigieren; M02 berechnet keinen Wert | GEBAUT im Core; Anzeige FEHLT |
| K-M02-010 | Technische Adapter-/Providerfakten widersprechen sich | Capability-/Provenienzvergleich | Gregor | kein Endnutzer-Konflikt; Integrations-Gate | zuständigen Adapter/Fachowner klären; bis dahin `CONFLICTING`/wertfrei | GEBAUT im Core; Anzeige FEHLT |
| K-M02-011 | Kontostand ist nach der freizugebenden Schwelle veraltet | Vergleich Standdatum gegen Host-Policy | Rolf | Rolf › Handlungsbedarf erst nach Anbindung; davor `In Klärung` | Kontostand aktualisieren; bis dahin Warnung und keine belastbare Entscheidung | SPEZ; Schwelle Q-M02-008 |

## Konfliktauflösung nach Verantwortung

Bei fachlichen Definitionen entscheidet der benannte fachliche Owner; bei Designfragen die Designphase; bei Architektur-/Datenwahrheiten das Projekt-Gate anhand `DOCUMENT_AUTHORITY.md`. Bis zu einer Entscheidung wird nichts geraten: Die betroffene Funktion bleibt wertfrei, grau und nicht klickbar.
