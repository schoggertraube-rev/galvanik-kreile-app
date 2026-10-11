<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M01_BUCHHALTUNG — Optikvorlage

## Verbindlicher Designstatus

Für das vollständige M01 existiert **keine freigegebene Optikvorlage**. Daher gilt gemäß Dossier-Anleitung: **FEHLT → Designphase 1b**. Frühere Accounting-HTMLs, PNGs, UI-Pakete und das Control-Center-Anforderungsdokument sind durch OWNER #31/#32 für den Produktbau verworfen und dürfen weder nachgebaut noch als Layoutquelle verwendet werden.

Der Gesamtmock V5, SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`, ist nur für den bereits gebauten Grundstamm und das Designsystem gültig. Seine Funktion `accountingPage()` zeigt eine minimale Grundstammansicht „Geld & Rechnungen“; sie ist **kein** M01-Screen und keine Freigabe für die unten geplanten Oberflächen.

Bis Designphase 1b und Adoption enthält der Grundstamm genau ein gedämpftes, nicht klickbares Element:

- Titel: „Buchhaltungs-Kontrollzentrum“
- Status: „In Aufbau“
- Route: keine
- Daten: keine
- Verhalten bei Direkt-URL: 404/fail-closed

## Screen-Matrix

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| M01-Einstieg / Arbeitsvorrat | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Texte für Daten/lädt/leer/Fehler in Q-M01-011 | F-M01-001; OE-2609-26 |
| Rechnungs-/Zahlungsfall | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-011 | F-M01-002/003; bestehende G07-Facts |
| Zahlungskorrektur | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-001/011 | F-M01-004 |
| Gutschrift / Refund | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-011 | F-M01-005 |
| Bankeingang / Zuordnung | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-006/011 | F-M01-006 |
| Kartenterminal-Vorgang | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-005/011 | F-M01-007; OE-2609-12 |
| Belegeingang / E-Rechnung | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-007/008/011 | F-M01-008 |
| Kosten / Ausgaben | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-002/011 | F-M01-009 |
| Mahnung | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-003/011 | F-M01-010 |
| Steuerberaterexport | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-004/013/011 | F-M01-011 |
| Liquiditätsgrundlagen | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-009/010/011 | F-M01-012/013 |
| Aufbewahrung / Anonymisierung | FEHLT → Designphase 1b | FEHLT → Designphase 1b | FEHLT → Designphase 1b | 3/7; Q-M01-007/011 | F-M01-014 |

`3/7` bedeutet: „Gesperrt“, „In Klärung“ und „In Aufbau“ sind wörtlich festgelegt. Für Daten, lädt, leer und Fehler fehlen absichtlich die freigegebenen Screen-Copys; ihr fachlicher Inhalt steht in `02_FUNKTIONEN_ABLAEUFE.md`.

## Vollständiger Screen-Inhalt für Designphase 1b

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| M01-Einstieg / Arbeitsvorrat | alle; personenbezogen sperrbar | Falltyp, Referenz, Priorität, zuständige Person, Frist, Quelle, Stand, Coverage, Konfliktstatus | Fall öffnen; Filter; Reload | alle sieben | F-M01-001; K-M01-001–017 |
| Rechnungs-/Zahlungsfall | alle; Cancel capability-gebunden | Rechnung, Kunde, brutto/bezahlt/offen in Cent, Währung, Lifecycle, Versionen, Payment-Receipt, Belegreferenzen | Belege öffnen; Reload; Storno anfordern | alle sieben | F-M01-002/003; C2 DTOs |
| Zahlungskorrektur | spätere Reversal-Capability | Original-Payment-Receipt, reversierbarer Betrag, bisherige Reversals, Grund, Version | Teil-/Vollreversal prüfen und bestätigen | alle sieben | F-M01-004; Q-M01-001 |
| Gutschrift / Refund | spätere Credit-/Refund-Capability | Originalrechnung, korrigierbare Position/Betrag, Grund, Credit-Receipt, Refundstatus | Gutschrift bestätigen; getrennten Refund anstoßen; Status lesen | alle sieben | F-M01-005 |
| Bankeingang / Zuordnung | spätere Bank-Capability | Bewegung, Kontoalias, Buchungs-/Valutadatum, Centbetrag, Währung, Referenz, Dedupe-ID, Vorschläge, Zuordnungs-Receipts | Import prüfen; zuordnen; Zuordnung reversieren | alle sieben | F-M01-006 |
| Kartenterminal-Vorgang | Kassen-/Payment-Capability | Rechnung/Auftrag, Centbetrag, Währung, Adapterstatus, Intent, Terminal- und Payment-Receipt | Zahlung starten; Status abgleichen; niemals blind wiederholen | alle sieben | F-M01-007; OE-2609-12 |
| Belegeingang / E-Rechnung | alle; Domaincommand capability-gebunden | Originalhash, MIME, Quelle, Eingangszeit, Format/Profil, Validatorstand, OCR-/Parser-Vorschläge, Fundstellen, Konfidenz, Quarantänegrund, Zuordnung | Upload finalisieren; validieren; Vorschlag korrigieren; Routing bestätigen | alle sieben | F-M01-008; BMF-E; DIG #3/#14 |
| Kosten / Ausgaben | spätere Cost-Capability | Original, Lieferant, Leistungs-/Steuerdatum, Centbetrag, Währung, Kostenart, Attribution, Factversion, Korrekturen | Fakt bestätigen; additiv korrigieren/stornieren | alle sieben | F-M01-009; Q-M01-002 |
| Mahnung | spätere Dunning-Capability | Rechnung, offener Betrag, Fälligkeit, Empfänger, Eligibility-Gründe, bisherige Mahnereignisse, Entwurf, Zustellstatus | Entwurf prüfen; OP neu prüfen; Sendung freigeben; Status lesen | alle sieben | F-M01-010; Q-M01-003 |
| Steuerberaterexport | spätere Export-Capability | Zeitraum/Cutoff, Formatversion, Coverage, Inputsethash, Artefakthash, Actor, Laufstatus | Vorprüfung; Lauf starten; Artefakt nach Readback laden | alle sieben | F-M01-011; Q-M01-004/013 |
| Liquiditätsgrundlagen | alle lesend; Schreiben capability-gebunden | Fixkosten Betrag/Rhythmus/Fälligkeit/Gültigkeit, Kontostand/Stichtag/Quelle/Actor, Gehaltsaggregat/Coverage, Bankvorschläge | pflegen; Vorschlag bestätigen; Reload | alle sieben | F-M01-012/013; OE-2609-23/24 |
| Aufbewahrung / Anonymisierung | alle statuslesend; Adminfreigabe | Dokumentart, Fristbeginn/-ende, Ablaufhemmung, Datenwirkung, erhaltene Aggregate, Vorschlagstatus | Preview; Admin bestätigen; Receipt lesen | alle sieben | F-M01-014; OE-2609-20 |

## Gestaltungs- und Interaktionsregeln

- **Designsystem-Bausteine (`kr-`): wird nach Phase 1b ergänzt.**
- Nach Designphase 1b ausschließlich Kreile-Designsystem-Bausteine mit `kr-`-Präfix, Fraunces/Inter und mindestens 48 px Touchziel verwenden.
- Desktop, Tablet und Handy erhalten dieselben Fachmöglichkeiten; auf kleinen Viewports darf nur Anordnung, nie Bedeutung oder Sicherheitsabfrage entfallen.
- Konflikte und Entscheidungen stehen vor Übersichten; OE-2609-26 verbietet eine KPI-Wand als Einstieg.
- Geldwerte zeigen formatierte EUR-Werte, werden technisch aber ausschließlich als Integer-Cent transportiert.
- Quelle, Stand, Coverage sowie stale/partial/denied sind am betroffenen Wert erkennbar, nicht nur in einem globalen Hinweis.
- Mutierende Aktionen zeigen Bestätigungsgegenstand, Wirkung und sicheren Rückweg. `unknown` darf nicht wie Erfolg oder Fehler mit sicherer Nullmutation aussehen.
- „In Klärung“ und „In Aufbau“ sind gedämpft, nicht klickbar und besitzen keine Fake-Route.
- Die V5-Grundstammansicht und ihre synthetischen Inhalte dürfen nicht als M01-Datenbasis oder M01-Layout kopiert werden.

## Design-Gate

Designphase 1b ist bestanden, wenn alle zwölf Screens in drei Breakpoints, alle sieben Zustände, exakte deutsche Texte, Fokus-/Tastaturpfad, Touchziele, Lesereihenfolge, Konfliktpriorisierung und die Receipt-/Unknown-Interaktionen freigegeben sind. Erst danach dürfen die Screen-Copys aus Q-M01-011 in Produktcode übernommen werden.
