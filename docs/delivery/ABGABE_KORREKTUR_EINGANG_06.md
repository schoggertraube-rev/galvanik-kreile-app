# Abgabe Korrektur Eingang 06

## Befund

> „Positionsfelder ‚Ausführung‘ und ‚Material‘ fehlen (K11).“

Beleg aus dem Bauplan: `src/components/layout/GlobalCreateFlow.tsx:1505–1512; src/lib/server/commands/orderIntakeCommand.ts:203–204`.

## Neu gemacht

- Der aktive Positionsblock im Neuen Eingang zeigt je Auftragsposition „Ausführung“ und „Material“ (`src/components/layout/GlobalCreateFlow.tsx:1696`).
- „Ausführung“ bietet Hochglanz, glänzend, matt, gelb passiviert, blau passiviert und den ehrlichen Standard „noch zu klären“. Gespeichert werden die stabilen Schlüssel aus dem Bauplan.
- Material bleibt optional, ist auf 120 Zeichen begrenzt und läuft über den bereits vorhandenen Materialvertrag.
- Der Server validiert Ausführung unabhängig von der Oberfläche und schreibt sie in `public.items.execution_requested` (`src/lib/server/commands/orderIntakeCommand.ts:210`, `:638`).
- Unveränderliche Eingangsbelege enthalten die Ausführung. Ältere Belege ohne dieses Feld bleiben als `offen` lesbar (`src/lib/server/orderIntakeRead.ts:145`).
- Migration `20261028002500_intake_position_execution.sql` ergänzt die kanonische Spalte mit Check-Constraint und erweitert die bestehende Receipt-Integritätsprüfung. Es wurde keine neue Tabelle angelegt und kein bestehender Datensatz gelöscht.

## Datenbank-Nachweis

- Frischer lokaler Supabase-Replay einschließlich `20261028002500`: **grün**.
- Dev-Projekt `syhaigjhsbpjmtnggqka`: Migration angewendet; lokale und entfernte Migrationsliste führen beide `20261028002500`.
- Nach dem Owner-Klick muss die neue Zeile in `public.items` den gewählten Schlüssel in `execution_requested` und den eingegebenen Text in `material` enthalten.

## Klickweg für den Owner

1. In der Preview als Rolf **Neuer Eingang** öffnen und einen vorhandenen vollständigen Kunden wählen.
2. In „Positionen“ ein Teil erfassen; es müssen zusätzlich „Ausführung“ und „Material“ sichtbar sein.
3. „Ausführung“ auf **matt** setzen, Material **TEST Stahl 1.4301** eintragen und den Auftrag buchen.
4. Die Auftragskarte öffnen; der Auftrag muss ohne Fehlermeldung vorhanden sein.
5. Datenbank prüfen: Die zugehörige `public.items`-Zeile muss `execution_requested = 'matt'` und `material = 'TEST Stahl 1.4301'` enthalten.

## Prüfergebnis

- Typprüfung: **grün**.
- Gezielte UI-, Command- und Read-Prüfungen: **3 Dateien / 35 Tests grün**.
- ESLint der betroffenen Dateien: **0 Fehler**; eine bereits bekannte Testwarnung zu `_paymentMode` bleibt unverändert.
- `node scripts/ui/spec-check.mjs --screens=eingang`: **2 erwartet / 2 gefunden / 0 fehlend**.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.

## Abgrenzung

- Diese Korrektur schließt den im Bauplan belegten Auftrags-Eingang über `orderIntakeCommand`. Der eigenständige KV-Persistenzvertrag wurde nicht still um eine neue Datenwahrheit erweitert.
