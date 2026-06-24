# Galvanik-Kreile WerkstattCockpit — Produkt- und Slice-Vertrag

## Produktkern

Das WerkstattCockpit ist ein vernetztes Betriebs- und Entscheidungswerkzeug. Primärer Nutzen:

- Kontrolle
- Planbarkeit
- Entlastung
- unternehmerische Sicherheit
- geringere Personenabhängigkeit

Operatives Herz:

`Eingang → Produktion → Ausgang`

Datenkreislauf:

`Kunde → Auftrag → Ware/Teil → Arbeitsschritt → Ereignis → Kommunikation → Rechnung → Zahlung → Ergebnis → Handlung`

## Slice 1

`Kundenware oder Begleitdokument per Foto`
→ `Original unverändert sichern`
→ `lokal/offline belastbar speichern`
→ `OCR/KI nur auf gesichertem Original`
→ `bestehenden Kunden/Auftrag/Teilgruppe zuordnen oder kontrolliert anlegen`
→ `nur unsichere Angaben prüfen`
→ `fachlichen Wareneingang erzeugen`
→ `erste reale Produktionskarte gemäß Route anzeigen`

## Verbindlicher Vertrag

`Datenquelle → kanonisches Objekt → Ereignis → SQL-View → Query/Serverpfad → Komponente → UI-Zustände → Folgeprozesse`

## Kernregeln

1. Genau ein kanonischer Capture-Vertrag; mehrere UI-Einstiege dürfen denselben Vertrag verwenden.
2. Original vor OCR/KI unverändert sichern.
3. Keine dauerhafte Bildspeicherung als Base64 in `localStorage`.
4. Keine stille Löschung nicht synchronisierter Originale.
5. Mindestens 48 Stunden garantierte Offlinevorhaltung; danach weiterhin bis erfolgreicher Synchronisation oder ausdrücklichem Verwerfen.
6. Idempotente Synchronisation ohne Doppelauftrag.
7. Kein Last-Writer-Wins für den vollständigen Record.
8. KI ist Vorschlagsquelle, nie Datenbank oder unbeaufsichtigte Wahrheit.
9. Konfidenz ist feldbezogen und kombiniert Quellen, Validierung und Matching.
10. Keine feste produktive Schwelle ohne Pilotkalibrierung.
11. Kunde, Auftrag, Teilgruppe, Wareneingang und Ereignisse besitzen eine eindeutige Transaktionsgrenze.
12. Die erste Produktionsstation folgt dem vorhandenen Routenvertrag, nicht einem Hardcode.
13. Fachberechnungen und KPIs liegen in SQL-Views, nicht in React.
14. Bestehende globale Queryverträge werden nicht ersetzt, bevor alle Konsumenten kompatibel belegt sind.
15. Korrektur und Undo sind abhängigkeitsbewusst; nicht jeder spätere Zustand ist pauschal rückgängig.
16. Session, Rolle, Tenant, RLS und Storage werden Ende-zu-Ende geprüft.
17. Kein Mock, `Math.random`, Demo- oder stiller Fallback im Produktionspfad.
18. Navigation/Sidebar nur nach ausdrücklicher Freigabe ändern.

## Acht-Fragen-Vertrag

Jede Arbeits-/Entscheidungskarte beantwortet:

1. Warum entstand sie?
2. Welches Objekt ist betroffen?
3. Was ist belegt und aus welcher Quelle?
4. Was fehlt?
5. Welche konkrete Handlung schlägt die App vor?
6. Wer darf handeln?
7. Welche DB-/Eventwirkung folgt?
8. Wohin kehrt der Vorgang zurück?
