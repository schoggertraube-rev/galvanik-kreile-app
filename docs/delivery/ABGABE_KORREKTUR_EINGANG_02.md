# Abgabe Korrektur Eingang-02 · Zahlungsziel serverseitig geschützt

Datum: 27.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, `spec_sha: 2d0e16351eb2`

## Befund

> Kein Server-Guard für „Rechnung auf Ziel“, Zuordnung Bedingung→Modus doppelt im Client (K5, K7).

## Änderung

- `src/lib/server/paymentContract.ts:162`: Eine zentrale Vertragsfunktion ordnet Zahlungsbedingung und Zahlungsmodus zu.
- `src/lib/server/paymentContract.ts:168`: Der Vertrag lehnt Zielzahlung für Neukunden sowie für nicht freigeschaltete Bestandskunden mit „Ziel nicht freigeschaltet.“ ab.
- `src/lib/server/commands/orderIntakeCommand.ts:535`: Der Server prüft Neukunden vor der Kundenanlage; bei Ablehnung entsteht kein verwaister Kunde.
- `src/lib/server/commands/orderIntakeCommand.ts:551`: Bei Bestandskunden wird die aktuelle Zahlungsbedingung aus der Datenbank geprüft.
- `src/lib/server/commands/orderIntakeCommand.ts:559`: Nur der serverseitig bestätigte Modus wird in Auftrag und Ereignis geschrieben.
- `src/components/layout/GlobalCreateFlow.tsx:1227`: Der Client verwendet dieselbe Zuordnung; die zweite Inline-Abbildung wurde entfernt.
- `src/lib/server/commands/__tests__/orderIntakeCommand.test.ts:144`: Tests belegen Ablehnung vor Neukundenanlage und Ablehnung eines nicht freigeschalteten Bestandskunden.

## Prüfergebnis

- `npx vitest run src/lib/server/commands/__tests__/orderIntakeCommand.test.ts`: **PASS**, 10/10 Tests.
- `npx vitest run src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx`: **PASS**, 16/16 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- `npm run quality:module-gates`: **PASS**.
- Datenbank: **unverändert**; keine Migration und keine Datenmutation in diesem Paket.

## Owner-Abnahme (5 Minuten)

Preview nach dem Branch-Deployment: <https://galvanik-kreile-werksta-git-25bb48-schoggertraube-revs-projects.vercel.app> · Rolle: Rolf

1. Anmelden und „Neuer Eingang“ öffnen; der Eingangs-Dialog ist sichtbar.
2. Einen Neukunden beginnen; „Rechnung auf Ziel“ ist nicht freigeschaltet, Vorkasse beziehungsweise Bar bleibt möglich.
3. Einen Bestandskunden ohne freigeschaltetes Zahlungsziel wählen; „Rechnung auf Ziel“ ist nicht auswählbar.
4. Für diesen Kunden einen gültigen Modus wählen und den Eingang buchen; der Auftrag öffnet mit diesem Zahlungsmodus.
