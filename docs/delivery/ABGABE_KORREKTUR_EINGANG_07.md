# Abgabe Korrektur Eingang-07 · Schnell erfassen

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, Korrektur `eingang` (mittel), E07/U-195

## Befund

> Text-/Diktat-Erfassung (E07) und „Alles bestätigen“ fehlen; keine Markierung „erkannt/aus Kundendaten“ (U-195).

## Änderung

- `src/lib/server/intakeTextRecognition.ts:46`: Regelbasierte, ratelose Erkennung für eindeutige E-Mail-, Telefon-, PLZ/Ort-, Firmen-, Termin- und Positionsmuster. Preise, Zahlungsbedingung, Art und Übergabe werden nicht erkannt.
- `src/app/warendurchlauf/actions.ts:180`: Server-Action validiert Eingabe, Sitzung, Auftragsrecht und Bereich `eingang`, bevor sie ausschließlich die für die Oberfläche nötigen Vorschläge zurückgibt.
- `src/components/layout/GlobalCreateFlow.tsx:1336`: Erkannte Angaben füllen nur leere Eingangsdaten vor; die leere Startposition wird ersetzt, bestehende Positionen bleiben erhalten und die Grenze 20 gilt weiter.
- `src/components/layout/GlobalCreateFlow.tsx:1906`: Sichtbarer Block `Schnell erfassen` mit Freitext, `Angaben erkennen`, Herkunftschips und `Alles bestätigen`.
- `src/components/layout/TargetShell.module.css:63`: Darstellung ausschließlich mit Designsystem-Tokens.
- Diktat bleibt ehrlich `In Klärung`: Für Azure Speech ist derzeit kein freigegebener Zugang im Projekt vorhanden. Es wurde kein Browser-/Fake-Diktat als Ersatz eingebaut.

## Prüfergebnis

- `npx vitest run src/lib/server/__tests__/intakeTextRecognition.test.ts src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx`: **PASS**, 25/25 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- ESLint der geänderten TypeScript-Dateien: **PASS**.
- `node scripts/ui/spec-check.mjs --screens=eingang`: **PASS**, 2/2 gebundene Spec-IDs gefunden.
- `npm run quality:module-gates`: **PASS**.
- `git diff --check`: **PASS**.
- Keine Migration und keine Datenbankänderung durch dieses Paket.

## Owner-Klickweg

1. Aktuelle Preview öffnen, anmelden und `Anlegen` → `Neuer Eingang` öffnen; oben muss `Schnell erfassen` erscheinen.
2. `TEST Erkannt GmbH, 2 Stück Flansch verzinken matt bis 12.11.` eintragen und `Angaben erkennen` klicken.
3. Prüfen: Firma, Liefertermin und Position sind vorausgefüllt; der Kasten zeigt die Angaben als `erkannt` mit Herkunft.
4. `Alles bestätigen` klicken; der Kasten zeigt `Angaben bestätigt`.
5. Die weiterhin fehlenden Kundendaten ergänzen und den bestehenden Eingangspfad buchen.
6. Prüfen: Die neue Auftragskarte öffnet sich mit einer Position `Flansch`, Menge `2`, Oberfläche `Verzinken`, Ausführung `matt`.

Erwarteter Datenbankzustand nach Schritt 5: genau ein neuer TEST-Auftrag mit genau einer zugehörigen Position; die Erkennung selbst legt vorher keine Daten an.
