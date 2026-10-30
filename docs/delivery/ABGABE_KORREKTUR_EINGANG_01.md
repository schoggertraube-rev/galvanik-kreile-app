# Abgabe Korrektur Eingang-01 · Kein stilles Zahlungsziel

Datum: 27.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, `spec_sha: 2d0e16351eb2`

## Befund

> Stiller Fallback „rechnung_14“: Altkunde ohne Zahlungsbedingung gilt als „Rechnung auf Ziel“ (K6, U-110/U-111).

## Änderung

- `src/app/actions/customers.actions.ts:136`: Eine fehlende Datenbankangabe bleibt beim Kundenlesen fehlend; es wird kein Zahlungsziel erfunden.
- `src/app/GlobalCreateAppAdapter.tsx:109`: Der App-Adapter reicht den fehlenden Wert unverändert an den Eingang weiter.
- `src/db/schema.ts:77`: Das Drizzle-Schema enthält keinen Default `rechnung_14` mehr.
- `supabase/migrations/20261027230000_remove_customer_payment_fallback.sql:2`: Additive Migration entfernt den Datenbank-Default. Bestehende Kundenwerte bleiben unverändert.
- Der vorhandene Eingang zeigt für einen Altkunden ohne Zahlungsbedingung „Bitte auswählen“, sperrt „Rechnung auf Ziel“ und verlangt eine echte Auswahl.

## Prüfergebnis

- Lokaler Fresh Replay aller Migrationen: **PASS**, einschließlich `20261027230000_remove_customer_payment_fallback.sql`.
- Remote-Migration auf der freigegebenen Entwicklungsdatenbank: **PASS**.
- Migrationsstand: `local=20261027230000`, `remote=20261027230000`.
- `npx vitest run src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx`: **PASS**, 16/16 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- `node scripts/ui/spec-check.mjs --screens=eingang`: **PASS**, `expected=2 found=2 missing=0`.
- `npm run quality:module-gates`: **PASS**.
- Keine Bestandsdaten geändert, gelöscht oder zurückgesetzt; nur der Default für künftige Datensätze wurde entfernt.

## Owner-Abnahme (5 Minuten)

Preview nach dem Branch-Deployment: <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app> · Rolle: Rolf

1. Anmelden und „Neuer Eingang“ öffnen; der Eingangs-Dialog ist sichtbar.
2. Einen bestehenden Kunden ohne hinterlegte Zahlungsbedingung auswählen; „Zahlungsmodus“ zeigt „Bitte auswählen“.
3. Prüfen: „Rechnung auf Ziel“ ist als nicht freigeschaltet gekennzeichnet und nicht auswählbar.
4. „Abholung“ wählen; „Bar oder Karte bei Abholung“ wird als echte Auswahl gesetzt.
5. Auf „Versand“ wechseln; „Vorkasse“ wird gesetzt und kein Zahlungsziel erscheint automatisch.
