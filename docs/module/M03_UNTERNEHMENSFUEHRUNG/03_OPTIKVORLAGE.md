<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 03 - Optikvorlage

Stand: 2026-09-26  
Modul: M03 Unternehmensführung

## Verbindliche Designrichtung

- **Designvertrag:** V5 gemäß D-UI-V5-003; V6 ist verworfen. OE-2609-03 präzisiert den Weg als neu aus V5 abgeleitetes Kreile-Designsystem, nicht als Kopie von Mock-CSS.
- **Designsystem:** Fraunces für Überschriften, Inter für UI/Text, Navy/Cream, Touchziele mindestens 48 px und Präfix `kr-`.
- **Modulstatus in V5:** Es existiert kein M03-Mock und kein Leadership-Anker. **Status: FEHLT → Designphase 1b.**
- **Produktgrenze:** Die frühere UI-/Mockphase des Leadership-Chats ist `VERWORFEN_FUER_PRODUKTBAU / NICHT_AUTORITATIV`; ein separater späterer HTML-Kontrollmock ist ebenfalls kein Produktnachweis.
- **Bis zur Freigabe:** Keine Route. Nur das gedämpfte, nicht klickbare Element `Ziele & Entscheidungen` mit `In Klärung`; keine Zielwerte, Reifeprozente, Entscheidungen oder Fake-Daten.
- **Startseitenordnung:** Dringende Konflikte, Warnungen und Entscheidungen stehen im oberen Handlungsbereich; der V5-Tagesüberblick bleibt darunter. Für M03 wird diese Ordnung bis zur Anbindung ausschließlich durch das graue Element markiert.

## Referenzen

| Referenz | Verbindlicher Teil | Stand/Hash | Verwendung |
|---|---|---|---|
| `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` | Designrichtung und Grundhülle; kein M03-Anker | 2026-09-14 / SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA` | Primäre UI-Richtung |
| `docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md` | Autoritative UI-Zuordnung | 2026-09-21 / SHA-256 `5AD0F70AB796…` | Quellensteuerung |
| `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json` | Aktueller Designreferenzstand | 2026-09-21 / SHA-256 `CDB573268ABB…` | Designstatus |
| `docs/project/linie/ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` | Dichte und Leseführung für Rolf; keine M03-Funktion | 2026-08-20 / SHA-256 `878FAD351778…` | Platzierungskontext für das graue Element |
| `LEADERSHIP_REAL_IMPLEMENTATION_DELTA_FROM_UX_REDTEAM_2026-09-17.md` | Informationshierarchie und zehnsekündige Führungsfragen, nicht Optik | 2026-09-17 / SHA-256 `DDF5662272F0…` | Inhaltsquelle für spätere Screens |
| Candidate.3 `public.ts` / `server-public.ts` | Echte verfügbare GOALS-Daten und Zustände | 2026-09-17 / SHA-256 `1FC35472BE82…` / `7D8154686FC6…` | Daten-/Interaktionsgrenze, keine Gestaltung |
| OE-2609-23 / `HINWEIS_OWNER_OE-2609-23.md` | Erster Kreile-Nutzenfall: Termintreue und Liquidität 30 Tage gemeinsam | 2026-09-26 / SHA-256 `9667CAE1C266…` | Inhaltsbindung für Ziel-, Warnungs- und Entscheidungsdarstellung |
| OE-2609-26 / `HINWEIS_OWNER_OE-2609-26.md` | Dringendes oben, V5-Tagesüberblick darunter | 2026-09-26 / SHA-256 `102DE574C411…` | Startseitenhierarchie |

## Benötigte Screenvarianten

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| UI-M03-001 Grundstamm-Platzhalter auf Rolf „Der Tag“ | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7; nur `In Klärung`/`In Aufbau` belegt | OE-2609-04/05; Q-M03-001 |
| UI-M03-002 Zielübersicht | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7; fünf Texte offen | Candidate.3 Goal-/Attention-Reads |
| UI-M03-003 Zieldetail und Versionshistorie | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7; fünf Texte offen | `GoalAggregateV1`, Receipts |
| UI-M03-004 Zielentwurf anlegen/bearbeiten | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7; fünf Texte offen | `GoalIntentV1`, `SaveDraft` |
| UI-M03-005 Aktivieren/Ablösen/Schließen | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7; fünf Texte offen | Consequential Commands/Confirmation |
| UI-M03-006 Receipt, Konflikt und Reconciliation | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7; fünf Texte offen | `CommandOutcomeV1`, D-RES-001 |
| UI-M03-007 Entscheidungsfall und Review | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen; Funktion blockiert | D-LEADERSHIP-001; Delta UX-005; `DECISION_GOVERNANCE_V1` blockiert |
| UI-M03-008 Wirkung und Lernschluss | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | alle 7 offen; Funktion blockiert | Delta UX-006; Analysis-/Review-Gate |

## Screeninhalte für Designphase 1b

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| UI-M03-001 Grundstamm-Platzhalter | Rolf primär | ausschließlich Titel `Ziele & Entscheidungen` und Status im oberen Handlungsbereich vor dem Tagesüberblick | keine; nicht klickbar, keine Route | `In Klärung`; nach realem Baustart `In Aufbau` | Anleitung §6; OE-2609-04/05/26 |
| UI-M03-002 Zielübersicht | Rolf primär; weitere Personen gemäß Hostrecht | Ziel-ID, Label, gültige aktive Version, Zeitraum, Verantwortung, getrennte Bewertungen für Termintreue und Liquidität 30 Tage mit Quelle/Stand/Coverage, gemeinsamer Warnstatus, Draft-Hinweis, Lifecycle | berechtigtes Ziel öffnen; neuen Entwurf anlegen; keine direkte Fachaktion | alle 7 Pflichtzustände; jede Evaluation-Partial/Stale/Denied/Unknown sichtbar | Candidate.3 `GoalAttentionPageV1`; OE-2609-23; Delta UX-003/011 |
| UI-M03-003 Zieldetail und Versionshistorie | alle gemäß Hostrecht | Label, Zielmodus/-wert, Einheit, Messdefinitionsref samt Version/Hash, Zeitraum/Zeitzone, `validFrom`, Verantwortung, RelatedRefs, Revision, Lifecycle, Versionen, Dispositionen, Transitionen, Receipt-Nachweise | neuen Draft beginnen; aktivieren/ablösen/schließen nur bei Recht; Receipt lesen; Quelle öffnen | alle 7 Pflichtzustände plus Revisionskonflikt/Unknown als Fehlerunterfälle | Candidate.3 `GoalAggregateV1`, `CommandReceiptV1` |
| UI-M03-004 Zielentwurf | alle gemäß Hostrecht | Label; Zielmodus minimum/maximum/exact/range; typisierter Wert; Toleranz/Band; Einheit; Messdefinition; Start inkl./Ende exkl.; Zeitzone; `validFrom`; Verantwortung; Evaluation-/Task-/Domaincommand-Refs | Entwurf speichern; abbrechen; keine Aktivierung im selben unbestätigten Schritt | alle 7 Pflichtzustände, Feldvalidierung, Idempotenzkonflikt | `GoalIntentV1`, `SaveGoalDraftCommandV1` |
| UI-M03-005 Aktivieren/Ablösen/Schließen | alle gemäß Hostrecht | exakte Versionen, erwartete Revision, Änderungen alt/neu, Reason-Code, Measurement-/Responsibility-Status, Confirmation-Zusammenfassung | servergebundene Confirmation anfordern; bestätigen; zurück; niemals Blind-Retry | alle 7 Pflichtzustände, missing/stale/partial/denied/incompatible, conflict/unknown | Candidate.3 Runtime/Ports |
| UI-M03-006 Receipt und Reconciliation | auslösende Person; technische Details rollenabhängig Gregor | Command-Art, Ziel-ID, Revision, Receipt-ID, Hash, Event-IDs, committedAt, Policyversionen, Confirmation-EvidenceRef, Correlation-ID, Reconciliation-Token | Receipt erneut lesen; aktuelles Ziel laden; bei Konflikt Absicht neu basieren; Correlation-ID kopieren | alle 7 Pflichtzustände; Erfolg nur mit passendem Receipt/Readback | Candidate.3 `CommandOutcomeV1`; D-RES-001 |
| UI-M03-007 Entscheidungsfall/Review | Rolf/Freigebende; **nicht im ersten Slice baubar** | Frage, Ziel/Messkriterium, getrennte Wirkung auf Termintreue und Liquidität 30 Tage, Fakten/Annahmen/Prognosen/External Claims, Optionen inkl. Nichtstun, Gegenargument, Nebenwirkungen, Datenlücken, Sensitivität, Reversibilität, Frist, Guardrails/Stopkriterien, Rollen/Freigabe, Action-Wunsch, Reviewplan/-entscheidung | bis eigenem Gate keine Aktion/Route; später Option wählen/ablehnen/vertagen und Review planen, nie Fachcommand direkt | `In Klärung` bis eigenem Runtime-/Persistenz-/Authgate; danach sieben Pflichtzustände | OE-2609-23; D-LEADERSHIP-001; Delta UX-005/AC-08 |
| UI-M03-008 Wirkung/Lernschluss | Rolf/Freigebende; **nicht im ersten Slice baubar** | Baseline, Beobachtungsfenster, Gegenfaktoren, Zuordnungs-/Kausalitätsmethode, Nebenwirkungsmetriken, EvidenceRefs, Methodenversion, Analysis-Assessment, menschlicher Lernschluss | bis Gate keine Route; später `beibehalten`, `ändern`, `beenden` als Reviewentscheidung, keine stille Ziel-/Policyänderung | `too_early`, `insufficient_data`, `inconclusive` müssen sichtbar bleiben; sieben Pflichtzustände | Delta UX-006/AC-11 |

## Designsystem-Bausteine (`kr-`)

wird nach Phase 1 ergänzt

## Verbindliche Design- und Barrierefreiheitsregeln

- Die Informationsreihenfolge lautet: Lage/Status -> Ziel/Abweichung -> Quelle und Datenreife -> nächste zulässige Handlung; keine KPI-Wand und kein freier KI-Score.
- Auf Rolf „Der Tag“ stehen nur dringende M03-Konflikte, -Warnungen und -Entscheidungen oberhalb des unveränderten Tagesüberblicks; M03 dupliziert dort keine vollständige Analyse.
- Farbe darf weder Status noch Datenreife allein tragen; jede Grafik braucht Textbeschreibung und gleichwertige Datentabelle.
- Tastaturreihenfolge, sichtbarer Fokus, Screenreader-Namen, reduzierte Bewegung, Kontrast und 48-px-Touchziele werden pro Variante abgenommen.
- Mobil bleiben im späteren Gesamtausbau höchstens `Überblick`, `Entscheidungen` und `Ziele` direkt erreichbar; diese Aussage ist Inhaltsanforderung, keine aktuelle Navigationsfreigabe.
- Jede sichtbare Primäraktion benötigt einen realen Zielpfad. Blockierte spätere Capabilities bleiben unsichtbar beziehungsweise im Grundstamm ausschließlich als das definierte graue Element.

## Offener Designentscheid

Wortlaut der fünf nicht standardisierten Zustände, responsive Layouts, Navigation, Diagrammformen und endgültige Platzierung sind nicht freigegeben. Maßgeblich sind Q-M03-001 und Q-M03-002; bis zu deren Abschluss bleibt das Modul routenlos und `In Klärung`.
