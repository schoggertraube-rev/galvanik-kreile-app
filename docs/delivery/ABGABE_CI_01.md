# Abgabe CI-01 · Developer-Login-Routing

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

## Ursache und Änderung

Der rote `agentur-gate`-Durchlauf von 04:44 UTC scheiterte ausschließlich an `src/app/actions/__tests__/loginEmailProductActor.test.ts`: Der Test erwartete nach erfolgreicher E-Mail-Anmeldung des Developers weiterhin `/settings`.

Der Produktcode leitet seit `507a94c8` korrekt nach `/`. Das entspricht der alleinigen Bauquelle `docs/project/endversion/codex/BAUPLAN.json:2726` und `:2740`: Developer öffnet bis zum Bau der Wartung „Der Tag“, niemals `/settings`.

Die Testbeschreibung und Erwartung prüfen nun genau diese bestätigte Weiterleitung. Produktcode, Datenbank und Serververtrag bleiben unverändert.

## Prüfschritt

- `npx vitest run src/app/actions/__tests__/loginEmailProductActor.test.ts`: erwartet grün.
- Kein Klickweg und kein Datenbanknachweis erforderlich: reine Testkorrektur, kein Produkt-Schreibweg.
