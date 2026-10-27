# Abgabe Korrektur Eingang 05

## Befund

> „Kundensuche nicht gebaut – nur Auswahlliste aller Kunden, keine Suche/Dublettenhinweis.“

Beleg aus dem Bauplan: `src/components/layout/GlobalCreateFlow.tsx:1462–1478`.

## Neu gemacht

- Die Gesamtliste im Neuen Eingang ist entfernt. „Kunde suchen“ fragt erst ab zwei Zeichen und nach 250 ms den vorhandenen tenant-gebundenen Serververtrag ab (`src/components/layout/GlobalCreateFlow.tsx:508`, `:1619`).
- Gesucht wird nach Name/Firma, Ansprechpartner, Telefon, E-Mail, Straße, PLZ, Ort und Kundennummer. Der Server liefert höchstens zehn Treffer (`src/lib/server/orderIntakeRead.ts:226`, `:231`).
- Treffer zeigen Firma/Name, Kundennummer, Ansprechpartner und Ort. Bei Treffern warnt die Oberfläche vor einem möglichen Doppelten.
- „… als Neukunde anlegen“ übernimmt den Suchtext als Name/Firma (`src/components/layout/GlobalCreateFlow.tsx:1207`, `:1638`).
- Die Suche ist an den Bereich „eingang“ gebunden und verlangt keine zusätzliche Kundenansichts-Berechtigung (`src/app/warendurchlauf/actions.ts:179`).
- Migration `20261027234500_intake_customer_search.sql` erweitert ausschließlich die bestehende Such-View; keine neue Tabelle und keine Echtdatenmutation.

## Datenbank-Nachweis

- Frischer lokaler Supabase-Replay einschließlich `20261027234500`: **grün**.
- Dev-Projekt `syhaigjhsbpjmtnggqka`: Migration angewendet; lokale und entfernte Migrationsliste führen beide `20261027234500`.

## Klickweg für den Owner

1. **Neuer Eingang** öffnen: Es darf keine Auswahlliste aller Kunden mehr erscheinen, nur „Kunde suchen“.
2. Zwei oder mehr Zeichen aus Name, Ansprechpartner, Telefon, E-Mail, Ort oder Kundennummer eines vorhandenen Kunden eingeben.
3. Einen Treffer wählen; es müssen dessen Name/Firma, Kundennummer, Ansprechpartner und Ort erscheinen.
4. „Anderer Kunde“ wählen, einen ähnlichen Namen eingeben und den Dublettenhinweis prüfen.
5. „… als Neukunde anlegen“ wählen; der Suchtext muss im Feld „Name / Firma“ stehen.

## Prüfergebnis

- Typprüfung: **grün**.
- Gezielte Read-, Action- und UI-Prüfungen: **3 Dateien / 26 Tests grün**.
- `node scripts/ui/spec-check.mjs --screens=eingang`: **2 erwartet / 2 gefunden / 0 fehlend**.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner führt den obigen Preview-Klickweg aus.
