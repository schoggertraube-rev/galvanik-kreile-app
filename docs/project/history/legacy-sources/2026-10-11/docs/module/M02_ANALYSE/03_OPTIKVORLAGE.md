<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 03 – Optikvorlage

Stand: 2026-09-26  
Modul: M02 Analyse

## Verbindliche Designrichtung

- **Designvertrag:** Dashboard V5 gemäß D-UI-V5-003; V6 ist verworfen.
- **Designsystem:** Fraunces für Überschriften, Inter für UI/Text, `kr-`-Präfix und V5-Tokens gemäß OE-2609-03.
- **Modulstatus in V5:** Es existiert kein eigener Analyse-Mock. **Status: FEHLT → Designphase 1b.**
- **Verbot:** Kein Builder darf Screens, Responsive-Verhalten, Texte, Farben, Diagrammtypen oder Interaktionen erraten; insbesondere kein Mock-CSS als Produktwahrheit.
- **Bis zur Freigabe:** Analyse-Slots an Auftrag und Kunde sind grau, nicht klickbar und zeigen ausschließlich `In Klärung`; nach ausdrücklich freigegebenem Baubeginn darf `In Aufbau` verwendet werden. Ein Analyse-Menüpunkt und eine Analyse-Route erscheinen erst nach Anbindung. Die Startseite erhält keine Kennzahl-Kachel.

## Referenzen

| Referenz | Verbindlicher Teil | Stand/Hash | Verwendung |
|---|---|---|---|
| `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` | Designsystem, Navigation, Grundlayout; M02 hat keinen eigenen Anker | 2026-09-14 / SHA-256 `75258FF3BD4C…` | Primäre UI-Richtung |
| `docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md` | Autoritative Zuordnung der Referenzen | 2026-09-21 / SHA-256 `5AD0F70AB796…` | Quellensteuerung |
| `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` | Aktuell geltende Designentscheidungen | 2026-09-21 / SHA-256 `CDB573268ABB…` | Designstatus |
| `docs/project/linie/ui/KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` | Bestehender Slot „Analyse & Kundenwert“ | 2026-08-19 / SHA-256 `8B655B19B5DB…` | Nur Platzierungskandidat, keine gültigen Beispielwerte |
| `docs/project/linie/ui/KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html` | Bestehender Slot „Kalkulation & Kennzahlen“ | 2026-08-19 / SHA-256 `C4F74528ED4D…` | Nur Platzierungskandidat, keine gültigen Beispielwerte |
| `docs/project/linie/ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` | Dichte, Leseführung und Werkstatt-Kontext | 2026-08-20 / SHA-256 `878FAD351778…` | Ergänzende Referenz, nicht Analyse-Screen |

Die Beispielwerte in älteren HTML-Referenzen sind weder Datenvertrag noch Demo-Vorgabe. Sie dürfen nicht als echte oder synthetische Produktdaten übernommen werden.

## Benötigte Screenvarianten

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| UI-M02-001 Entscheidungsübersicht | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen | Core Claims/Recommendations/Briefs, V5 |
| UI-M02-002 Befund- und Belegdetail | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen | Derivation/Provenance, V5 |
| UI-M02-003 Visualisierung und Drill-down | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen | Visualisation Projection, V5 |
| UI-M02-004 Szenario und Prognose | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen | Scenario/Forecast, V5 |
| UI-M02-005 Handlung und Wirkung | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen | Recommendation/Receipt/Effect, V5 |
| UI-M02-006 Datenqualität und Blocker | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen | Capability/Evidence/Disclosure, V5 |
| UI-M02-007 eingebettete Kompaktprojektion | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen | Kunden-/Auftragsdetail, Home, Suche |

## Screeninhalte für Designphase 1b

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| UI-M02-001 Entscheidungsübersicht | Rolf primär; alle gemäß Host | Titel, Scope, Zeitraum, Snapshot, Termintreue, Liquidität 30 Tage nach M01, Verlauf, betroffene Aufträge, Ursachen, Claim, Priorität, Empfehlung, Coverage, Unsicherheit, Aktualität, Herkunft | Filtern, Detail öffnen, Tabellenalternative öffnen | 7 Pflichtzustände | OE-2609-21/22/23/24; `FUNCTION_CATALOG.md`, `RUNTIME_TRUTH.md` |
| UI-M02-002 Befund- und Belegdetail | alle gemäß Host | Claim, Ableitungsschritte, Quellreferenzen, Ein-/Ausschlüsse, Coverage, Konflikte, Content-Hash | Quelle/Entität öffnen, zurück zum identischen Scope | 7 Pflichtzustände | Derivation- und Provenance-Vertrag |
| UI-M02-003 Visualisierung und Drill-down | alle gemäß Host | Serien, Punkte, Einheit, Achsenbedeutung, Beschreibung, Datentabelle, Scope | Punkt/Serie fokussieren, Tabelle öffnen | 7 Pflichtzustände | Renderer-neutrale Projektion; max. 12 Serien/1000 Punkte |
| UI-M02-004 Szenario und Prognose | Rolf/Gregor | Baseline, Annahmen, Methode, Zeitraum, Prognose, Band/Unsicherheit, spätere Bewertung | Szenario auswählen, Parameter nachvollziehen | 7 Pflichtzustände | Scenario-/Forecast-Verträge |
| UI-M02-005 Handlung und Wirkung | Verantwortliche des Fremdmoduls | Empfehlung, externe Action-/Receipt-Referenz, Vorher-/Nachher-Scope, Wirkung, Einschränkung | Zuständiges Modul öffnen, Receipt lesen | 7 Pflichtzustände | Effect-Assessment-Vertrag |
| UI-M02-006 Datenqualität und Blocker | alle; technische Tiefe rollenabhängig | Capability, Evidence, Disclosure, Staleness, Coverage, Snapshot, zuständiger Lieferweg | Details öffnen, neu laden | 7 Pflichtzustände | Capability-Manifest/Handshake |
| UI-M02-007 eingebettete Kompaktprojektion | Nutzer des jeweiligen Fremdmoduls | am Auftrag/Kunden: Kernwert/Befund, Einheit, Stand, Coverage, Herkunft; auf der Startseite ausschließlich dringender Konflikt, Warnung oder Entscheidung, keine Kennzahl-Kachel | nach Anbindung freigegebenes Detail öffnen | 7 Pflichtzustände | OE-2609-04/22/26, V2/V8-Slots |

## Designsystem-Bausteine (`kr-`)

wird nach Phase 1 ergänzt

## Barrierefreiheit und Visualisierung

- Jede Visualisierung benötigt Beschreibung und gleichwertige Datentabelle; Farbe darf nie der einzige Informationsträger sein.
- Tastaturreihenfolge, Fokus, Kontrast, Screenreader-Namen, reduzierte Bewegung und Touch-Ziele sind in Designphase 1b festzulegen und in T-M02-018 bis T-M02-020 zu prüfen.
- Keine Visualisierung darf die im Core gesetzten Grenzen von 12 Serien und 1000 Punkten überschreiten.
- Beträge werden als Integer-Minor-Units geliefert; Formatierung erfolgt ausschließlich im Host.

## Offenes Designgate

Wortlaut, Breakpoints unterhalb der Desktop-Referenz, konkrete Diagrammtypen und Screenlayouts sind nicht freigegeben (Q-M02-002). Die Produktplatzierung ist durch OE-2609-22/26 geklärt: eigener Menüpunkt erst nach Anbindung, Kennzahlwerte zusätzlich an Auftrag und Kunde, Startseite nur für Dringendes. Bis zum Design- und Integrationsgate bleiben Auftrag-/Kunden-Slots grau, nicht klickbar und zeigen `In Klärung`; eine ausgegraute Analyse-Route wird nicht angelegt.
