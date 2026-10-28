# ABGABE H13 – Stille Ersatzwerte

Stand: 28.10.2026 22:06 Europe/Berlin
Branch: `kreile/s1-p2-eingang`

## Befund und Stand

| Unterpunkt | Ergebnis | Fundstelle / Nachweis |
|---|---|---|
| H13.1 Firmendaten | Nach einem Fixversuch vollständig zurückgenommen; keine Produkt- oder Datenbankänderung. Rückfrage dokumentiert. | `docs/project/endversion/codex/RUECKFRAGEN_H13.md` |
| H13.2 Zahlungsziel Kunde | Nach einem Fixversuch vollständig zurückgenommen; die Migration wurde nicht auf die Dev-DB angewendet. Rückfrage dokumentiert. | `docs/project/endversion/codex/RUECKFRAGEN_H13.md` |
| H13.3 stille Berechtigungsfehler | Erledigt. Der Datenbankfehler behält die sichtbare Kennung `AUTH_DB_ERROR`; die 13 in der Warteschlange genannten Produktpfade geben die Resolver-Meldung weiter. Zusätzlich wurden vier gleichartige allgemeine Berechtigungshelfer vom stillen Catch befreit. | `src/lib/server/authorization.ts:191`; `src/app/actions/invoices.actions.ts:28`; `src/app/actions/intakeDraft.actions.ts:8`; `src/app/actions/customers.actions.ts:100`; `src/app/actions/communications.actions.ts:16`; `src/app/warendurchlauf/actions.ts:188`; `src/lib/server/commands/invoiceItemPriceCommand.ts:108`; `src/lib/server/commands/orderContentCommand.ts:107`; `src/lib/server/commands/orderIntakeCommand.ts:507`; `src/app/buchhaltung/rechnungen/InvoicesAppAdapter.tsx:8`; `src/lib/auth/permissions.ts:10` |
| H13.4 Tenant / Eingang | Unverändert, wie beauftragt. | Keine Änderung an `src/db/schema.ts` oder `GlobalCreateFlow.tsx`. |

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

## Owner-Klickweg (maximal 6 Schritte)

H13 ist wegen der regelkonform zurückgenommenen Unterpunkte 1 und 2 noch nicht vollständig klickbereit.

1. Einen Dev-Datenbankfehler im Berechtigungslesen simulieren beziehungsweise vom Prüfer auslösen.
2. Kundenkarte, Rechnungsliste oder Neuer Eingang öffnen.
3. Erwartung: Die sichtbare Fehlermeldung enthält `AUTH_DB_ERROR`; sie lautet nicht „Sitzung nicht verfügbar“.

## Erwarteter Datenbankstand

- H13.3 schreibt keine Datenbankzeile.
- K-2026-0001, K-2026-0011 und K-2026-0012 bleiben durch diese Abgabe unverändert, weil H13.2 vollständig zurückgenommen wurde.
- Production bleibt unverändert.
