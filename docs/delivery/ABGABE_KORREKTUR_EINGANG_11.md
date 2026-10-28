# Abgabe Korrektur Eingang-11 · Prüfliste und Feldsprung

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, Korrektur K24 (`eingang`, mittel)

## Befund

> Prüfliste (rechts) fehlt; Buchen nur an „geprüft“ gekoppelt, kein Sprung zum Feldfehler.

## Änderung

- Neuer Eingang zeigt auf Desktop und Tablet rechts eine Prüfliste mit Fortschritt, Pflichtangaben und dem nicht sperrenden Hinweis „Eingangsfoto fehlt“ (`src/components/layout/GlobalCreateFlow.tsx:2351`, `src/components/layout/TargetShell.module.css:72`).
- Jede Zeile ist direkt anwählbar. Sie wechselt bei Bedarf in den passenden Handyschritt, scrollt zum Feld und setzt dort den Fokus (`src/components/layout/GlobalCreateFlow.tsx:1640`).
- Der Hauptknopf ist außer während eines laufenden Schreibvorgangs immer bedienbar. Bei einer Lücke wird vor jedem Command abgebrochen und „Noch offen: {Label}“ gezeigt (`src/components/layout/GlobalCreateFlow.tsx:1943`).
- Positionsfelder haben eindeutige Markierungen je Position, damit beispielsweise die fehlende Menge der zweiten Position exakt angesprungen wird.
- Der bestehende Login und die Datenbank wurden nicht geändert.

## Prüfergebnis

- `npx tsc --noEmit --incremental false`: **PASS**.
- Betroffener UI-Test: **PASS**, 27/27.
- Neuer Fokus-/Schreibschutztest: **PASS** (`src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx:692`).
- Gezieltes ESLint: **PASS**.
- `quality:no-fake-production`: **PASS**.
- `quality:module-gates`: **PASS**.
- Statischer Spec-Check `eingang`: **PASS**, 2/2 Markierungen.

## Owner-Klickweg

1. Preview öffnen, anmelden und „Neuer Eingang“ öffnen.
2. Ohne Kunde auf „Wareneingang buchen“ klicken: Der Knopf bleibt klickbar, es erscheint „Noch offen: Kunde“, der Fokus steht in „Kunde suchen“ und es wird nichts gespeichert.
3. Kunde und erste Position vollständig erfassen, eine zweite Position ergänzen und deren Menge leeren.
4. Erneut buchen: Die Prüfliste zeigt bei „Menge“ „Position 2 fehlt“ und der Fokus springt genau in deren Mengenfeld; weiterhin wird nichts gespeichert.
5. Menge und restliche Pflichtangaben ergänzen, „Ware gemeinsam geprüft“ setzen und buchen.
6. Prüfen, dass nun genau ein Auftrag angelegt wurde.

Erwarteter Datenbankzustand: Nach den beiden unvollständigen Versuchen gibt es weder einen neuen Auftrag noch eine neue Eingangsquittung. Erst der vollständige letzte Versuch erzeugt genau einen Auftrag mit genau zwei Positionen und genau eine zugehörige Eingangsquittung.
