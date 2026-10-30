# ABGABE H13 – Stille Ersatzwerte

Stand: 29.10.2026 00:05 Europe/Berlin
Branch: `kreile/s1-p2-eingang`

## Befund und Stand

| Unterpunkt | Ergebnis | Fundstelle / Nachweis |
|---|---|---|
| H13.1 Firmendaten | Erledigt nach Owner-Antwort. Der Read bewahrt fehlende Werte als `null`; die vorhandene Bearbeitungsfläche zeigt leere Eingaben und den verlinkten Hinweis „fehlt – in Firmendaten eintragen“. Es wird kein Land, Zahlungsziel oder Logo erfunden. | `src/modules/fundament/server/systemSettingsPort.ts:49,84-91`; `src/modules/fundament/public.ts:14-16,49-50`; `src/app/settings/SettingsAdminClient.tsx:64-76,281,286`; `src/modules/fundament/fundament.manifest.json:10` |
| H13.2 Zahlungsziel Kunde | Erledigt nach Owner-Antwort. Oberfläche und Server verwenden denselben festen Vertrag. `rechnung_14` und `rechnung_30` erscheinen und gelten nur bei realem `ziel_freigeschaltet`. Land und Zahlungsbedingung haben keine Vorgabe. | `src/modules/customers/paymentPreferenceContract.ts:1-17`; `src/modules/customers/ui/CustomerCardView.tsx:113-115,258-259`; `src/modules/customers/server/createCustomerCommand.ts:92`; `src/modules/customers/server/updateCustomerCommercialCommand.ts:25,35-45`; `src/lib/server/customerSummaryRead.ts:219-224` |
| H13.3 stille Berechtigungsfehler | Erledigt. Der Datenbankfehler behält die sichtbare Kennung `AUTH_DB_ERROR`; die 13 in der Warteschlange genannten Produktpfade geben die Resolver-Meldung weiter. Zusätzlich wurden vier gleichartige allgemeine Berechtigungshelfer vom stillen Catch befreit. | `src/lib/server/authorization.ts:191`; `src/app/actions/invoices.actions.ts:28`; `src/app/actions/intakeDraft.actions.ts:8`; `src/app/actions/customers.actions.ts:100`; `src/app/actions/communications.actions.ts:16`; `src/app/warendurchlauf/actions.ts:188`; `src/lib/server/commands/invoiceItemPriceCommand.ts:108`; `src/lib/server/commands/orderContentCommand.ts:107`; `src/lib/server/commands/orderIntakeCommand.ts:507`; `src/app/buchhaltung/rechnungen/InvoicesAppAdapter.tsx:8`; `src/lib/auth/permissions.ts:10` |
| H13.4 Tenant / Eingang | Unverändert, wie beauftragt. | Keine Änderung an `src/db/schema.ts` oder `GlobalCreateFlow.tsx`. |

## Prüfergebnis H13.1

- Ohne Firmendatenzeile liefert der Snapshot für alle Felder `null`.
- Vorhandene `NULL`-Spalten bleiben im Snapshot `null`; insbesondere werden Land, Zahlungsziel und Logo nicht ersetzt.
- Die Eingabefläche wandelt `null` ausschließlich für die Bearbeitung in ein leeres Eingabefeld um.
- Fokussierte Tests: **30/30 grün**. TypeScript, fokussierter ESLint, `quality:module-gates` und `quality:no-fake-production`: **grün**.
- Datenbank: keine Migration und keine Zeilenänderung.

## Prüfergebnis H13.3

- Suche nach `resolveAuthorization().catch(() => null)` unter `src/`: **0 Treffer**.
- Fokussierte Tests: **38/38 grün**.
- TypeScript: `npx tsc --noEmit --incremental false` **grün**.
- ESLint vollständig: **0 Fehler**, 9 vorbestehende Warnungen.
- `quality:module-gates`: **grün**.
- `quality:no-fake-production`: **grün**, 0 erreichbare Production-Mocks.
- Vollständige Unit-Suite im Commit-Hook: **137/137 Testdateien, 1.125/1.125 Tests grün**.
- `scripts/ui/spec-check.mjs`: nicht anwendbar, da H13.3 keine BAUPLAN-Oberfläche oder `data-spec-id` ändert.
- Datenbank: **keine Migration, keine Zeilenänderung** in H13.3.

## Prüfergebnis H13.2

- Fokussierte Tests: **18/18 grün**. TypeScript, fokussierter ESLint, `quality:module-gates` und `quality:no-fake-production`: **grün**.
- Die mechanische PDF-Test-Fixture enthält den realen Pflichtwert `invoiceTermsEnabled` (`src/lib/pdf/__tests__/QuoteDocument.test.tsx:18`).
- Dev-Migration `20261028234500_h13_clear_customer_payment_preferences.sql` gezielt ausgeführt und als angewandt registriert; die offene ältere Migration `20261028115141` blieb unberührt.
- SQL-Nachweis nach Migration: K-2026-0001, K-2026-0011 und K-2026-0012 jeweils `payment_preference = NULL`, `ziel_freigeschaltet = false`.
- Production blieb unverändert.

## Owner-Klickweg (maximal 6 Schritte)

1. Als Rolf Kundenkarte **K-2026-0011** öffnen und **Bearbeiten** wählen.
2. Erwartung: Zahlungsbedingung steht auf **„Nicht festgelegt“**; Rechnung 14/30 wird ohne Freischaltung nicht angeboten; Land hat keine Vorgabe, wenn es fehlt.
3. **Vorkasse** wählen und speichern; Erwartung: Meldung **„Stammdaten gespeichert.“**
4. **Einstellungen → Firmendaten** öffnen; bei Lücken steht **„fehlt – in Firmendaten eintragen“**, der Link springt zu den leeren Feldern.
5. Für H13.3 einen Dev-Datenbankfehler im Berechtigungslesen auslösen und Kundenkarte oder Rechnungsliste öffnen.
6. Erwartung: Die sichtbare Fehlermeldung enthält `AUTH_DB_ERROR`; sie lautet nicht „Sitzung nicht verfügbar“.

## Erwarteter Datenbankstand

- H13.1 und H13.3 schreiben keine Datenbankzeile. Fehlende Firmendaten bleiben `NULL`.
- Unmittelbar nach der H13.2-Migration: K-2026-0001, K-2026-0011 und K-2026-0012 jeweils `payment_preference = NULL`, `ziel_freigeschaltet = false`.
- Nach Owner-Klick Schritt 3: K-2026-0011 hat `payment_preference = 'vorkasse'`; die beiden anderen bleiben `NULL`.
- Production bleibt unverändert.
