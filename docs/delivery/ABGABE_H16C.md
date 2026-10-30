# Abgabe H16c

Stand: 29.10.2026
Branch: `kreile/s1-p2-eingang`

## Befund und Umsetzung

1. Das Datenregister enthielt nur die 97 Tabellen aus `public`. Ergänzt wurden die 26 Tabellen aus `private` und `drizzle.__drizzle_migrations`; jede Tabelle steht genau einmal in ihrem Schema-Abschnitt. Commit: `8be92847`.
2. Die bisherige Kennzeichnung als `stammdaten` war nicht an einen aktiven Stufe-1-Leser gebunden. Jetzt bleiben genau sieben Stammdatentabellen übrig, jede mit `Datei:Zeile` des Lesers. Alle acht offenen `?` und alle Alt-/Stufe-2-Kataloge ohne passenden Leser sind entschieden. Commit: `320ff14b`.
3. H16.2 blockiert neue leere `catch`-Blöcke, `.catch(() => null)`, `.catch(() => [])`, `alert()` sowie WIP-, Demo- und Mock-Texte im Produktcode. Der vorhandene Bestand ist pro Regel und Datei einzeln dokumentiert; die Listen dürfen nur schrumpfen. Commit: `bd88d84c`.

## Fundstellen

- Registerspalten und Leser-Nachweise: `docs/delivery/DATEN_REGISTER.md:9`, `:111`, `:142`
- Ergebnis ohne offene Klassifizierung: `docs/delivery/DATEN_REGISTER.md:153`
- H16.2-Regeln: `scripts/quality/eslint-h16-plugin.mjs:114`, `:138`, `:159`
- Selbsttest-Vertrag: `scripts/quality/check-h16-eslint.mjs:9-11`
- Schrumpfende Bestandslisten: `eslint.config.mjs:36`, `:53`, `:61`

## Prüfergebnis

- Dev-DB gegen Register: `public 97`, `private 26`, `drizzle 1`; zusammen 124 Registerzeilen, fehlend 0, doppelt 0, zusätzlich 0.
- Ungeklärte Klassen: 0.
- Stammdaten: 7; Leser-Nachweis vorhanden: 7/7.
- `node scripts/quality/check-h16-eslint.mjs --selftest`: `H16_ESLINT_SELFTEST=PASS`.
- `node scripts/quality/check-h16-eslint.mjs`: `H16_ESLINT_CONTRACTS=PASS`.
- Fokussierter ESLint-Lauf für Konfiguration, Plug-in und Prüfer: PASS.
- Die lokale Gesamtsuite überschritt beim ersten Dokumentationscommit die 10-Minuten-Grenze; entsprechend Regel 7 entscheidet die CI am finalen Abgabe-SHA.

## Datenbank-Soll

H16c verändert keine Datenbankzeile und führt keine Migration aus. Die Dev-DB bleibt bei 97 `public`-, 26 `private`- und einer `drizzle`-Tabelle. Nummernkreise sind `system`, werden nie kopiert und starten in der späteren Produktions-DB leer.

## Owner-Klickweg

1. Im PR `docs/delivery/DATEN_REGISTER.md` öffnen: drei Schema-Tabellen müssen sichtbar sein.
2. Zur Zählung springen: `public 97 · private 26 · drizzle 1`, fehlend/doppelt/zusätzlich jeweils 0.
3. Nach `` `?` `` suchen: als Ergebnis muss ausschließlich die Zählzeile `0` erscheinen.
4. Nach `` `stammdaten` `` filtern: genau sieben Datenzeilen; jede enthält rechts einen Leser als `Datei:Zeile`.
5. Im CI-Lauf den Schritt „H16 rights and identity contracts“ öffnen: Selbsttest und Repository-Wächter müssen grün sein.

Erwartete DB-Zeilen nach der Prüfung: unverändert; H16c ist Register- und Wächterarbeit ohne Datenmutation.
