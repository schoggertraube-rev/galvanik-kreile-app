# Abgabe Korrektur Eingang-08 · Termin- und Preisvorschlag

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, Korrektur `eingang` (mittel), A10/A11

## Befund

> Terminvorschlag (A10) und Preisvorschlag (A11) fehlen.

## Änderung

- `src/lib/server/intakeSuggestions.ts:105`: Preisvorschlag aus festgeschriebenen Rechnungspositionen der letzten 24 Monate: zuerst gleicher Kunde/gleiche Position, danach Median aus mindestens drei ähnlichen Fällen, zuletzt Katalogpreis. Höchstens fünf Vergleichsfälle werden geliefert.
- `src/lib/server/intakeSuggestions.ts:167`: Terminvorschlag aus größtem Durchlauf, gespeichertem Tagesleistungswert und gemeinsamem Arbeitstagskalender; Ergebnis ist `passt`, `knapp` oder `nicht machbar`.
- `src/app/warendurchlauf/actions.ts:199`: Tenant-, Sitzungs-, Auftrags- und Bereichsprüfung vor jedem Read. Ohne Bereich `geld` liefert der Server keine Preise oder Vergleichsfälle.
- `src/components/layout/GlobalCreateFlow.tsx:2113`: Terminvergleich mit Gründen und ausdrücklicher Wahl `übernehmen` oder `Wunsch halten`; keine automatische Übernahme.
- `src/components/layout/GlobalCreateFlow.tsx:2165`: Preisvorschlag je Position mit Quelle, Vergleichsfällen und ausdrücklichem `Übernehmen`; `Alles bestätigen` ändert keinen Preis.
- `supabase/migrations/20261028101001_add_intake_suggestion_settings.sql:4`: Ein tenantgebundener, gespeicherter Tagesleistungswert mit Startwert 800 € und Wertebereich 1–99.999. Lokal angewendet und über Spalte, Default und Check-Constraint verifiziert.
- `src/components/layout/TargetShell.module.css:66`: Darstellung ausschließlich mit V1.1-Tokens.

## Prüfergebnis

- `npx vitest run src/lib/server/__tests__/intakeSuggestions.test.ts`: **PASS**, 4/4 Tests.
- `npx vitest run src/components/layout/__tests__/path1GlobalCreateFlow.realRender.test.tsx`: **PASS**, 24/24 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- ESLint der geänderten TypeScript-Dateien: **PASS**.
- Lokale Migration: **PASS**; `tagesleistung_eur` ist `NOT NULL`, Default `800`, Check `1..99999`.
- Supabase Advisor: keine neue Warnung durch dieses Paket; vorhandene Altbefunde bleiben außerhalb dieser Korrektur.

## Owner-Klickweg

1. Aktuelle Preview öffnen, als Rolf anmelden und `Anlegen` → `Neuer Eingang` öffnen.
2. Einen bestehenden Kunden wählen, einen Liefertermin und eine Position mit Oberfläche eintragen.
3. Prüfen: Vor dem Liefertermin erscheint `Terminvorschlag` mit `passt`, `knapp` oder `nicht machbar`; bei knapp/nicht machbar werden Wunsch, machbarer Termin und Gründe gezeigt.
4. Bei `Preisvorschlag` prüfen: Preis je Einheit, Nettosumme, Quelle und höchstens fünf Vergleichsfälle; dann `Übernehmen` klicken.
5. Beim Termin entweder `{Datum} übernehmen` oder `Wunsch halten` klicken; erst jetzt darf sich der Liefertermin beziehungsweise der Wahlstatus ändern.
6. Dialog schließen, ohne zu buchen.

Erwarteter Datenbankzustand nach Schritt 6: keine neue Kunden-, Auftrags-, KV- oder Positionszeile; Vorschläge und ihre Auswahl schreiben vor dem Buchen nichts.
