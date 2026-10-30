# Abgabe Korrektur Eingang 04

## Befund

> „Übergabe-Wechsel überschreibt die Zahlungsbedingung im Kundenstamm; Optionen hängen an der Übergabe.“

Beleg aus dem Bauplan: `src/components/layout/GlobalCreateFlow.tsx:1489,1144–1158,1493`.

## Neu gemacht

- Kunden-Zahlungsbedingung und Auftrags-Zahlungsmodus sind getrennte Zustände (`src/components/layout/GlobalCreateFlow.tsx:449`, `:1176`, `:1590`).
- Ein Wechsel der Übergabe ändert keinen Bestandskunden mehr. Ein vollständiger Bestandskunde wird beim Weitergehen nicht erneut gespeichert (`src/components/layout/GlobalCreateFlow.tsx:1222`).
- Der Zahlungsmodus zeigt immer Vorkasse, Bar/Karte bei Abholung und Rechnung auf Ziel. Rechnung bleibt ohne vorhandene Ziel-Freischaltung gesperrt; Bar/Karte ist bei Versand gesperrt.
- Der Server akzeptiert einen vom Kundenstamm abweichenden Auftragsmodus, prüft Ziel-Freischaltung weiterhin verbindlich und weist Bar/Karte bei Versand ab (`src/lib/server/paymentContract.ts:171`, `src/lib/server/commands/orderIntakeCommand.ts:548`).
- Der getrennte Zahlungsmodus bleibt auch in einem gespeicherten Eingangs-Entwurf erhalten.

## Klickweg für den Owner

1. Als Login mit Bereich „Geld“ **Neuer Eingang** öffnen und einen vollständigen Bestandskunden mit Zahlungsbedingung „Bar oder Karte bei Abholung“ wählen.
2. Bei Übergabe „Abholung“ den Auftrags-Zahlungsmodus auf „Vorkasse“ stellen; alle drei Optionen müssen sichtbar sein, „Rechnung auf Ziel“ bleibt ohne Freischaltung gesperrt.
3. Übergabe einmal auf „Versand“ und zurück auf „Abholung“ stellen: Die bewusst gewählte Vorkasse bleibt erhalten; der Kundenstamm wird nicht geändert.
4. Eingang vollständig buchen.
5. In der Dev-Datenbank prüfen: Der neue Auftrag hat `payment_mode = 'vorkasse'`; derselbe Kunde hat weiterhin `payment_preference = 'bar'` und keinen allein durch Schritt 3 ausgelösten neuen `updated_at`-Stand.

## Prüfergebnis

- Gezielte Komponenten- und Command-Tests: **31/31 grün**.
- Vollständiger Unit-Satz: **133 Dateien / 1071 Tests grün**.
- `npx tsc --noEmit --incremental false`: **grün**.
- `node scripts/ui/spec-check.mjs --screens=eingang`: **2 erwartet / 2 gefunden / 0 fehlend**.
- Kein Klicktest und kein Screenshot durch Codex gemäß Regel 4d; der Owner-Klick liefert den realen Dev-DB-Nachweis.
