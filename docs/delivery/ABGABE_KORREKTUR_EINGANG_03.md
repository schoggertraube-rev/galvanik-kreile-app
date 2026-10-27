# Abgabe Korrektur Eingang-03 · Geldrechte am Eingang

Datum: 27.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, `spec_sha: faba82e2e3ff`

## Befund

> Zahlungsmodus, KV-Preis und Preisvorschlag sind ohne Recht „geld“ sichtbar und serverseitig ungeprüft (U-200).

## Änderung

- `src/app/GlobalCreateAppAdapter.tsx:79`: Der Eingang erhält das aktuelle Bereichsrecht `geld`; ohne Recht wird kein preisführender Katalog gelesen.
- `src/components/layout/GlobalCreateFlow.tsx:1494`: Ohne `geld` gibt es kein Feld Zahlungsmodus.
- `src/components/layout/GlobalCreateFlow.tsx:1514`: Ohne `geld` gibt es kein Preisfeld; KV und Preisvorschläge werden nicht angeboten.
- `src/components/layout/GlobalCreateFlow.tsx:1206`: Der Client sendet ohne `geld` weder Preis noch Mehrwertsteuer noch einen vorgegebenen Zahlungsmodus.
- `src/lib/server/commands/orderIntakeCommand.ts:484`: Der Server prüft das Bereichsrecht selbst; manipulierte Modus- oder Preisangaben werden vor einer Transaktion abgelehnt.
- `src/lib/server/commands/orderIntakeCommand.ts:563`: Fehlt das Geldrecht, wird der Zahlungsmodus serverseitig aus der gespeicherten Kundenbedingung abgeleitet.
- `src/app/actions/catalog.actions.ts:12`: Preisführende Katalogdaten sind serverseitig an `geld` gebunden.
- `src/app/actions/quotes.actions.ts:27`: Preisführende KV-Schreib- und Lesewege sind serverseitig an `geld` gebunden.
- `src/lib/server/commands/__tests__/orderIntakeCommand.test.ts:113`: Tests belegen die Ablehnung manipulierter Geldfelder und die serverseitige Modusableitung ohne Geldrecht.
- `src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx:532`: Der UI-Test belegt den ausgeblendeten Zahlungs-, KV- und Preisbereich.

## Prüfergebnis

- `npx vitest run src/lib/server/commands/__tests__/orderIntakeCommand.test.ts`: **PASS**, 11/11 Tests.
- `npx vitest run src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx`: **PASS**, 17/17 Tests.
- `npx vitest run src/modules/quotes/__tests__/quoteCommands.test.ts`: **PASS**, 6/6 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- `npm run quality:module-gates`: **PASS**.
- Datenbank: **unverändert**; keine Migration und keine Datenmutation in diesem Paket.

## Owner-Abnahme (5 Minuten)

Preview nach dem Branch-Deployment: <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app> · Rolle: bestehender Werkstatt-Login ohne Bereich `geld`

1. Anmelden und „Neuer Eingang“ öffnen; der Eingang ist sichtbar und als Art steht nur „Auftrag“ bereit.
2. Einen bestehenden vollständigen Kunden wählen; es gibt kein Feld „Zahlungsmodus“ und keine sichtbare Zahlungsbedingung.
3. Zu „Positionen“ wechseln; es gibt kein Preisfeld und keinen Preisvorschlag.
4. Eine Freitextposition vollständig erfassen und den Eingang buchen; der Auftrag wird angelegt.
5. Die Auftragskarte öffnen; der Zahlungsmodus entspricht der hinterlegten Kundenbedingung, obwohl im Eingang kein Modus eingegeben wurde.
