# Abgabe Korrektur Eingang-10 · gespeicherte Eingangsfelder

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, Korrektur `eingang` (mittel), echte Felder

## Befund

> Terminstatus, Eingangsart und „KV gültig bis“ werden nicht als Felder gespeichert.

## Änderung

- `public.orders` speichert `intake_term_status` und `intake_source` getrennt von technischer Herkunft und Notiz.
- `private.order_intake_receipts` hält beide Werte unveränderlich fest; der kanonische Lesepfad prüft sie gegen den Auftrag.
- `private.quotes` speichert zusätzlich `valid_until`; Terminstatus und Eingangsart werden ebenfalls als eigene Felder gelesen.
- Historische Zeilen bleiben ehrlich `NULL`. Neue Eingänge und neue KVs speichern nur die tatsächlich gewählten Werte.
- Die bisherige Notizergänzung „KV gültig bis …“ entfällt; das Datum liegt ausschließlich im neuen Datumsfeld.

## Datenbank-Nachweis

- Migration `20261028115500_store_intake_classification.sql` lokal: **PASS**.
- Dieselbe Migration im verknüpften Supabase-Entwicklungsprojekt: **PASS**.
- Remote-Schema zurückgelesen: sieben Spalten, Constraints, neue `create_quote_v1`-Signatur sowie beide kanonischen Views vorhanden.
- Keine Bestandszeile fachlich umgedeutet und keine Geschäftszeile gelöscht.

## Prüfergebnis

- `npx tsc --noEmit --incremental false`: **PASS**.
- Betroffene Command-, Readback- und UI-Tests: **PASS**, 48/48.
- Der ältere lokale Quote-Gesamtintegrationstest erreicht wegen seiner nicht mehr passenden Rollen-Testeinrichtung nur `FORBIDDEN`; er schreibt nichts und ist kein K23-Fehler.
- Statischer Spec-Check `eingang`: **PASS**, 2/2 Markierungen.

## Owner-Klickweg

1. Preview öffnen, anmelden und „Neuer Eingang“ öffnen.
2. Auftrag erfassen, Terminstatus und Eingangsart bewusst wählen, buchen und die Erfolgsansicht öffnen.
3. Einen zweiten Eingang als „KV“ erfassen, „KV gültig bis“ setzen und „KV anlegen“ ausführen.
4. KV erneut öffnen und prüfen: Gültigkeitsdatum, Terminstatus und Eingangsart entsprechen der Eingabe; das Gültigkeitsdatum steht nicht als künstlicher Notizvorspann im Hinweistext.

Erwarteter Datenbankzustand: Der Auftrag hat genau einen Wert in `intake_term_status` und `intake_source`; der KV hat zusätzlich genau ein `valid_until`. Die zugehörige Auftragsquittung trägt dieselben Eingangswerte. Historische Datensätze ohne belegte Auswahl bleiben `NULL`.
