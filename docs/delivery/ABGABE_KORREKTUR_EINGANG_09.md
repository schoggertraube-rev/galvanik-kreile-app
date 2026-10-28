# Abgabe Korrektur Eingang-09 · Vorbelegungen

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, Korrektur `eingang` (mittel), Vorbelegungen

## Befund

> Vorbelegungen fehlen: Liefertermin (Machbar-Termin), Übergabe (letzte des Kunden), Oberfläche (aus Katalog), Eingangsart (aus dem Aufruf).

## Änderung

- `src/components/layout/GlobalCreateFlow.tsx`: Der Machbar-Termin aus A10 belegt einen leeren Liefertermin vor. Solange der Termin nur vorbelegt ist, folgt er einer Neuberechnung; ein von Hand gesetzter oder erkannter Termin wird nicht überschrieben.
- `src/lib/server/orderIntakeRead.ts`: Die Kundensuche liest tenantgebunden die letzte reale Übergabe aus Aufträgen; Test-, Demo- und Seed-Daten zählen nicht.
- `src/app/actions/customers.actions.ts`: Auch der Einstieg aus der Kundenkarte erhält dieselbe letzte reale Übergabe.
- `src/components/layout/GlobalCreateFlow.tsx`: Eine gewählte Katalogleistung belegt ihre Oberfläche vor. Nach einer manuellen Oberflächenwahl bleibt der Handwert erhalten.
- `src/components/layout/globalCreateRequest.ts`: Der Aufruf kann die Eingangsart mitgeben; Mail-Aufrufe belegen „Anfrage per Mail“, ein leerer Aufruf „persönlich angeliefert“.
- Die bestehenden Entwurfsdaten merken, welche Werte vorbelegt und welche von Hand geändert wurden; eine manuelle Eingabe hat immer Vorrang.

## Prüfergebnis

- `npx tsc --noEmit --incremental false`: **PASS**.
- ESLint der geänderten TypeScript-Dateien: **PASS**.
- `npx vitest run src/lib/server/__tests__/orderIntakeRead.test.ts src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx`: **PASS**, 28/28 Tests.
- `node scripts/ui/spec-check.mjs --screens=eingang`: **PASS**.

## Owner-Klickweg

1. Aktuelle Preview öffnen, anmelden und aus einer Kundenkarte „Neuer Auftrag“ öffnen.
2. Prüfen: Übergabe entspricht der letzten Übergabe dieses Kunden; ohne Vorgänger steht „Abholung“.
3. Eine Katalogleistung wählen und prüfen: deren Oberfläche wird vorbelegt.
4. Oberfläche von Hand ändern, Bezeichnung kurz ändern und dieselbe Katalogleistung erneut wählen; die Handänderung bleibt stehen.
5. Prüfen: Sobald eine verwertbare Oberfläche vorliegt, steht im leeren Liefertermin der Machbar-Termin. Liefertermin von Hand ändern; weitere Positionsänderungen überschreiben ihn nicht.
6. Den Eingang aus einer Mail öffnen und prüfen: Eingangsart steht auf „Anfrage per Mail“. Dialoge ohne Buchen schließen.

Erwarteter Datenbankzustand nach Schritt 6: keine neue Kunden-, Auftrags-, KV- oder Positionszeile; die Vorbelegungen schreiben vor dem Buchen nichts.
